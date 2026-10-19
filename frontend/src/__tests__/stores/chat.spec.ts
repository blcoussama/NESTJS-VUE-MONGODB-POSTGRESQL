import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { registerAuthHandlers, resetAuthHandlers } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import type { ChatMessage, Conversation } from '@/types/api'
import { candidate, flushPromises, installMockServer, recruiter, type MockServer } from '../helpers'

// ─── socket.io-client mock ────────────────────────────────────────────────────
const sockets = vi.hoisted(() => {
  type Listener = (...args: unknown[]) => void
  class FakeSocket {
    listeners = new Map<string, Listener[]>()
    emitted: { event: string; payload: unknown }[] = []
    connected = false
    active = true
    connectCalls = 0
    ackImpl: (event: string, payload: unknown) => Promise<unknown> = async () => ({ ok: true })
    constructor(
      public url: string,
      public options: { path?: string; auth?: (cb: (data: unknown) => void) => void },
    ) {}
    on(event: string, fn: Listener) {
      this.listeners.set(event, [...(this.listeners.get(event) ?? []), fn])
      return this
    }
    emit(event: string, payload?: unknown) {
      this.emitted.push({ event, payload })
      return this
    }
    timeout() {
      return { emitWithAck: (event: string, payload: unknown) => this.ackImpl(event, payload) }
    }
    connect() {
      this.connectCalls++
      return this
    }
    disconnect() {
      this.connected = false
      return this
    }
    removeAllListeners() {
      this.listeners.clear()
      return this
    }
    /** Simulates an event coming from the server. */
    trigger(event: string, ...args: unknown[]) {
      if (event === 'connect') this.connected = true
      if (event === 'disconnect') this.connected = false
      for (const fn of this.listeners.get(event) ?? []) fn(...args)
    }
    /** Token the client would send in the handshake right now. */
    handshakeToken(): unknown {
      let data: unknown
      this.options.auth?.((d) => (data = d))
      return (data as { token?: string } | undefined)?.token
    }
  }
  const created: FakeSocket[] = []
  return { FakeSocket, created }
})

vi.mock('socket.io-client', () => ({
  io: vi.fn((url: string, options: never) => {
    const socket = new sockets.FakeSocket(url, options)
    sockets.created.push(socket)
    return socket
  }),
}))

function msg(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `m-${Math.random().toString(36).slice(2)}`,
    from: candidate.id,
    to: recruiter.id,
    text: 'Bonjour',
    createdAt: new Date().toISOString(),
    readAt: null,
    ...overrides,
  }
}

const conversation = (unreadCount = 0): Conversation => ({
  user: { id: candidate.id, firstName: candidate.firstName, lastName: candidate.lastName, avatarUrl: null },
  lastMessage: { text: 'Ancien', createdAt: '2026-10-01T10:00:00.000Z', from: candidate.id },
  unreadCount,
})

describe('stores/chat (Socket.io + REST)', () => {
  let server: MockServer
  let auth: ReturnType<typeof useAuthStore>
  let chat: ReturnType<typeof useChatStore>

  beforeEach(() => {
    sockets.created.length = 0
    setActivePinia(createPinia())
    server = installMockServer()
    auth = useAuthStore()
    auth.setAccessToken('token-A')
    auth.setUser(recruiter)
    registerAuthHandlers({
      getAccessToken: () => auth.accessToken,
      setAccessToken: (t) => auth.setAccessToken(t),
      onSessionExpired: () => auth.clearSession(),
    })
    server.on('GET', '/chat/conversations', { status: 200, data: [conversation(0)] })
    chat = useChatStore()
  })

  afterEach(() => {
    chat.reset()
    resetAuthHandlers()
    vi.useRealTimers()
  })

  function connected() {
    chat.connect()
    const socket = sockets.created[0]!
    socket.trigger('connect')
    return socket
  }

  it('se connecte au namespace /chat avec path /socket.io et le jeton courant (auth callback)', () => {
    chat.connect()
    const socket = sockets.created[0]!
    expect(socket.url).toBe('http://api.test/chat')
    expect(socket.options.path).toBe('/socket.io')
    expect(socket.handshakeToken()).toBe('token-A')
    auth.setAccessToken('token-B')
    expect(socket.handshakeToken()).toBe('token-B') // re-evaluated at each (re)connection
  })

  it('ne se connecte pas sans session', () => {
    auth.clearSession()
    chat.connect()
    expect(sockets.created).toHaveLength(0)
    expect(chat.status).toBe('disconnected')
  })

  it('connexion → statut connecté et chargement des conversations', async () => {
    connected()
    await flushPromises()
    expect(chat.status).toBe('connected')
    expect(chat.conversations).toHaveLength(1)
  })

  it('message:new d’un autre utilisateur → non-lu incrémenté, conversation en tête', async () => {
    const socket = connected()
    await flushPromises()
    socket.trigger('message:new', msg({ text: 'Nouveau message' }))
    expect(chat.totalUnread).toBe(1)
    expect(chat.sortedConversations[0]?.lastMessage?.text).toBe('Nouveau message')
  })

  it('message:new dans la conversation ouverte → ajouté au fil et marqué lu (message:read)', async () => {
    server.on('GET', `/chat/messages/${candidate.id}`, { status: 200, data: { items: [], nextCursor: null } })
    const socket = connected()
    await flushPromises()
    await chat.openConversation(candidate.id)

    socket.trigger('message:new', msg({ id: 'live-1', text: 'Live' }))
    await flushPromises()

    expect(chat.activeThread?.messages.map((m) => m.id)).toEqual(['live-1'])
    expect(chat.totalUnread).toBe(0)
    expect(socket.emitted).toContainEqual({ event: 'message:read', payload: { from: candidate.id } })
  })

  it('ignore un doublon (même id reçu deux fois)', async () => {
    server.on('GET', `/chat/messages/${candidate.id}`, { status: 200, data: { items: [], nextCursor: null } })
    const socket = connected()
    await chat.openConversation(candidate.id)
    const m = msg({ id: 'dup' })
    socket.trigger('message:new', m)
    socket.trigger('message:new', m)
    expect(chat.activeThread?.messages).toHaveLength(1)
  })

  it('indicateur « en train d’écrire » avec expiration automatique', () => {
    vi.useFakeTimers()
    const socket = connected()
    socket.trigger('typing', { from: candidate.id, isTyping: true })
    expect(chat.typing[candidate.id]).toBe(true)
    vi.advanceTimersByTime(6_500)
    expect(chat.typing[candidate.id]).toBe(false)
  })

  it('présence en ligne / hors ligne', () => {
    const socket = connected()
    socket.trigger('presence', { userId: candidate.id, online: true })
    expect(chat.online[candidate.id]).toBe(true)
    socket.trigger('presence', { userId: candidate.id, online: false })
    expect(chat.online[candidate.id]).toBe(false)
  })

  it('historique paginé par curseur : ordre chronologique et ajout des anciens messages en tête', async () => {
    const newest = msg({ id: 'm3', createdAt: '2026-10-03T10:00:00.000Z' })
    const middle = msg({ id: 'm2', createdAt: '2026-10-02T10:00:00.000Z' })
    const oldest = msg({ id: 'm1', createdAt: '2026-10-01T10:00:00.000Z' })
    server.on('GET', `/chat/messages/${candidate.id}`, (config) =>
      config.params?.cursor === 'm2'
        ? { status: 200, data: { items: [oldest], nextCursor: null } }
        : { status: 200, data: { items: [newest, middle], nextCursor: 'm2' } },
    )

    await chat.openConversation(candidate.id)
    expect(chat.activeThread?.messages.map((m) => m.id)).toEqual(['m2', 'm3'])
    expect(chat.activeThread?.hasMore).toBe(true)

    await chat.loadOlder(candidate.id)
    expect(server.calls.at(-1)?.params).toMatchObject({ cursor: 'm2', limit: 30 })
    expect(chat.activeThread?.messages.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
    expect(chat.activeThread?.hasMore).toBe(false)
  })

  it('envoi via socket : message optimiste remplacé par le message acquitté', async () => {
    server.on('GET', `/chat/messages/${candidate.id}`, { status: 200, data: { items: [], nextCursor: null } })
    const socket = connected()
    await chat.openConversation(candidate.id)
    socket.ackImpl = async (event, payload) => {
      expect(event).toBe('message:send')
      expect(payload).toEqual({ to: candidate.id, text: 'Bonjour !' })
      return { ok: true, message: msg({ id: 'srv-1', from: recruiter.id, to: candidate.id, text: 'Bonjour !' }) }
    }

    await expect(chat.sendMessage(candidate.id, '  Bonjour !  ')).resolves.toBe(true)
    const messages = chat.activeThread?.messages ?? []
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ id: 'srv-1', text: 'Bonjour !' })
    expect(messages[0]?.pending).toBeUndefined()
  })

  it('ack { ok:false, error:"rate_limited" } → message en échec et erreur lisible', async () => {
    server.on('GET', `/chat/messages/${candidate.id}`, { status: 200, data: { items: [], nextCursor: null } })
    const socket = connected()
    await chat.openConversation(candidate.id)
    socket.ackImpl = async () => ({ ok: false, error: 'rate_limited' })

    await expect(chat.sendMessage(candidate.id, 'spam')).resolves.toBe(false)
    expect(chat.activeThread?.messages[0]).toMatchObject({ failed: true })
    expect(chat.sendError).toMatch(/trop de messages/)
  })

  it('secours REST (POST /chat/messages) quand le socket est déconnecté', async () => {
    server.on('POST', '/chat/messages', (config) => ({
      status: 201,
      data: msg({ id: 'rest-1', from: recruiter.id, to: candidate.id, text: JSON.parse(String(config.data)).text }),
    }))
    await expect(chat.sendMessage(candidate.id, 'Via REST')).resolves.toBe(true)
    expect(JSON.parse(String(server.callsTo('POST', '/chat/messages')[0]?.data))).toEqual({ to: candidate.id, text: 'Via REST' })
  })

  it('refuse un message vide ou > 2000 caractères', async () => {
    await expect(chat.sendMessage(candidate.id, '   ')).resolves.toBe(false)
    await expect(chat.sendMessage(candidate.id, 'x'.repeat(2001))).resolves.toBe(false)
    expect(chat.sendError).toMatch(/2000/)
  })

  it('déconnexion par le serveur (jeton expiré) → refresh puis reconnexion avec le nouveau jeton', async () => {
    server.on('POST', '/auth/refresh', { status: 200, data: { accessToken: 'token-NEW' } })
    const socket = connected()
    socket.trigger('disconnect', 'io server disconnect')
    expect(chat.status).toBe('reconnecting')
    await flushPromises()
    expect(auth.accessToken).toBe('token-NEW')
    expect(socket.connectCalls).toBe(1)
    expect(socket.handshakeToken()).toBe('token-NEW')
  })

  it('connect_error refusé par le serveur et refresh impossible → statut « error »', async () => {
    server.on('POST', '/auth/refresh', { status: 401 })
    chat.connect()
    const socket = sockets.created[0]!
    socket.active = false
    socket.trigger('connect_error', new Error('unauthorized'))
    await flushPromises()
    expect(chat.status).toBe('error')
    expect(socket.connectCalls).toBe(0)
  })

  it('émission « typing » limitée (throttle) puis arrêt automatique', () => {
    vi.useFakeTimers()
    const socket = connected()
    chat.userTyping(candidate.id)
    chat.userTyping(candidate.id)
    chat.userTyping(candidate.id)
    const typingTrue = socket.emitted.filter((e) => e.event === 'typing' && (e.payload as { isTyping: boolean }).isTyping)
    expect(typingTrue).toHaveLength(1)
    vi.advanceTimersByTime(4_100)
    expect(socket.emitted.at(-1)).toEqual({ event: 'typing', payload: { to: candidate.id, isTyping: false } })
  })

  it('reset() (déconnexion) ferme le socket et vide l’état', async () => {
    connected()
    await flushPromises()
    chat.reset()
    expect(chat.status).toBe('disconnected')
    expect(chat.conversations).toEqual([])
    expect(sockets.created[0]?.connected).toBe(false)
  })
})
