import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { io, type Socket } from 'socket.io-client'
import { chatApi } from '@/api/chat'
import { errorMessage, hasStatus } from '@/api/errors'
import { refreshAccessToken } from '@/api/http'
import {
  CHAT_NAMESPACE,
  MAX_MESSAGE_LENGTH,
  SOCKET_ORIGIN,
  SOCKET_PATH,
} from '@/config'
import { useAuthStore } from './auth'
import type { ChatMessage, ChatUser, Conversation, SendAck } from '@/types/api'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

export interface LocalMessage extends ChatMessage {
  /** Client-side id of an optimistic message (until the server acknowledges it). */
  tempId?: string
  pending?: boolean
  failed?: boolean
  errorText?: string
}

export interface ThreadState {
  messages: LocalMessage[]
  nextCursor: string | null
  hasMore: boolean
  loaded: boolean
  loading: boolean
  loadingOlder: boolean
  error: string | null
}

const ACK_TIMEOUT_MS = 10_000
const TYPING_THROTTLE_MS = 2_500
const TYPING_IDLE_MS = 4_000
const REMOTE_TYPING_TTL_MS = 6_000
const MAX_AUTH_RETRIES = 3

const ACK_ERRORS: Record<string, string> = {
  rate_limited: 'Vous envoyez trop de messages. Patientez quelques secondes.',
  forbidden:
    'Vous ne pouvez pas écrire à cet utilisateur : aucune candidature ne vous relie.',
  not_allowed:
    'Vous ne pouvez pas écrire à cet utilisateur : aucune candidature ne vous relie.',
  unauthorized: 'Session expirée, reconnexion en cours…',
  // Codes renvoyés par le ChatGateway du backend (voir backend/src/modules/chat/chat.types.ts)
  invalid_payload: 'Message invalide (vide ou trop long).',
  internal_error: 'Erreur du serveur, réessayez dans un instant.',
  validation: 'Message invalide.',
  not_found: 'Destinataire introuvable.',
}

export class ChatSendError extends Error {}

export function describeAckError(code: string | undefined): string {
  if (!code) return 'Échec de l’envoi du message.'
  return ACK_ERRORS[code] ?? code
}

function emptyThread(): ThreadState {
  return {
    messages: [],
    nextCursor: null,
    hasMore: false,
    loaded: false,
    loading: false,
    loadingOlder: false,
    error: null,
  }
}

function byDateAsc(a: ChatMessage, b: ChatMessage): number {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}

export const useChatStore = defineStore('chat', () => {
  const auth = useAuthStore()

  const conversations = ref<Conversation[]>([])
  const conversationsLoaded = ref(false)
  const conversationsLoading = ref(false)
  const conversationsError = ref<string | null>(null)
  const threads = ref<Record<string, ThreadState>>({})
  const activeUserId = ref<string | null>(null)
  const draftContacts = ref<Record<string, ChatUser>>({})
  const typing = ref<Record<string, boolean>>({})
  const online = ref<Record<string, boolean>>({})
  const status = ref<ConnectionStatus>('disconnected')
  const sendError = ref<string | null>(null)

  let socket: Socket | null = null
  let authRetries = 0
  let tempCounter = 0
  const remoteTypingTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const outgoingTyping = new Map<string, { lastSentAt: number; idleTimer: ReturnType<typeof setTimeout> | null }>()

  // ─── Getters ───────────────────────────────────────────────────────────────

  const totalUnread = computed(() =>
    conversations.value.reduce((sum, c) => sum + (c.unreadCount > 0 ? c.unreadCount : 0), 0),
  )

  const sortedConversations = computed(() =>
    [...conversations.value].sort((a, b) => {
      const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0
      const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0
      return tb - ta
    }),
  )

  const activeThread = computed<ThreadState | null>(() =>
    activeUserId.value ? (threads.value[activeUserId.value] ?? null) : null,
  )

  function contactFor(userId: string): ChatUser | null {
    return (
      conversations.value.find((c) => c.user.id === userId)?.user ??
      draftContacts.value[userId] ??
      null
    )
  }

  const activeContact = computed(() => (activeUserId.value ? contactFor(activeUserId.value) : null))
  const isConnected = computed(() => status.value === 'connected')

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function thread(userId: string): ThreadState {
    let t = threads.value[userId]
    if (!t) {
      threads.value[userId] = emptyThread()
      t = threads.value[userId]!
    }
    return t
  }

  function otherParty(message: ChatMessage): string {
    return message.from === auth.user?.id ? message.to : message.from
  }

  function insertMessages(userId: string, incoming: ChatMessage[]): void {
    const t = thread(userId)
    const known = new Set(t.messages.map((m) => m.id))
    const fresh = incoming.filter((m) => !known.has(m.id))
    if (fresh.length === 0) return
    t.messages = [...t.messages, ...fresh].sort(byDateAsc)
  }

  function touchConversation(message: ChatMessage, incrementUnread: boolean): boolean {
    const userId = otherParty(message)
    const index = conversations.value.findIndex((c) => c.user.id === userId)
    const lastMessage = { text: message.text, createdAt: message.createdAt, from: message.from }
    if (index === -1) {
      const contact = draftContacts.value[userId]
      if (!contact) return false
      conversations.value = [
        { user: contact, lastMessage, unreadCount: incrementUnread ? 1 : 0 },
        ...conversations.value,
      ]
      return true
    }
    const conv = conversations.value[index]!
    const updated: Conversation = {
      ...conv,
      lastMessage,
      unreadCount: incrementUnread ? conv.unreadCount + 1 : conv.unreadCount,
    }
    conversations.value = [
      updated,
      ...conversations.value.slice(0, index),
      ...conversations.value.slice(index + 1),
    ]
    return true
  }

  function isViewing(userId: string): boolean {
    const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden'
    return activeUserId.value === userId && visible
  }

  // ─── Socket lifecycle ──────────────────────────────────────────────────────

  function connect(): void {
    if (socket || !auth.isAuthenticated) return
    status.value = 'connecting'
    authRetries = 0
    const s = io(`${SOCKET_ORIGIN}${CHAT_NAMESPACE}`, {
      path: SOCKET_PATH,
      // Authentication = access token in the handshake (no cookie needed on the socket).
      // Evaluated on every (re)connection attempt → always the current in-memory token.
      auth: (cb) => cb({ token: auth.accessToken ?? '' }),
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
    })
    socket = s

    s.on('connect', () => {
      status.value = 'connected'
      authRetries = 0
      void fetchConversations()
      if (activeUserId.value) void syncLatest(activeUserId.value)
    })

    s.on('disconnect', (reason: string) => {
      if (reason === 'io client disconnect') {
        status.value = 'disconnected'
      } else if (reason === 'io server disconnect') {
        // The server closes the socket when the access token is invalid/expired.
        void reauthenticate()
      } else {
        status.value = 'reconnecting' // socket.io retries automatically
      }
    })

    s.on('connect_error', () => {
      // `active === false` → rejected by the server middleware (auth); no auto-retry.
      if (!s.active) void reauthenticate()
      else status.value = 'reconnecting'
    })

    s.on('message:new', (message: ChatMessage) => handleIncoming(message))
    s.on('typing', (payload: { from: string; isTyping: boolean }) => handleTyping(payload))
    s.on('presence', (payload: { userId: string; online: boolean }) => handlePresence(payload))
  }

  async function reauthenticate(): Promise<void> {
    const s = socket
    if (!s) return
    authRetries += 1
    if (authRetries > MAX_AUTH_RETRIES) {
      status.value = 'error'
      return
    }
    status.value = 'reconnecting'
    try {
      await refreshAccessToken()
      if (socket === s && auth.isAuthenticated) s.connect()
    } catch {
      if (socket === s) status.value = 'error'
    }
  }

  /** Manual retry from the UI after a connection error. */
  function reconnect(): void {
    if (!socket) {
      connect()
      return
    }
    authRetries = 0
    status.value = 'connecting'
    socket.connect()
  }

  function disconnect(): void {
    if (socket) {
      socket.removeAllListeners()
      socket.disconnect()
      socket = null
    }
    status.value = 'disconnected'
  }

  // ─── Incoming events ───────────────────────────────────────────────────────

  function handleIncoming(message: ChatMessage): void {
    if (!message || typeof message.id !== 'string') return
    const me = auth.user?.id
    const userId = otherParty(message)
    const fromOther = message.from !== me

    const t = threads.value[userId]
    if (t?.loaded) {
      // Our own message echoed from another tab: replace a matching optimistic one if any.
      if (!fromOther) {
        const optimistic = t.messages.find((m) => m.pending && m.text === message.text)
        if (optimistic) t.messages = t.messages.filter((m) => m !== optimistic)
      }
      insertMessages(userId, [message])
    }

    if (fromOther) setRemoteTyping(userId, false)
    const viewing = isViewing(userId)
    const known = touchConversation(message, fromOther && !viewing)
    if (!known) void fetchConversations()
    if (fromOther && viewing) void markRead(userId)
  }

  function setRemoteTyping(userId: string, value: boolean): void {
    const timer = remoteTypingTimers.get(userId)
    if (timer) clearTimeout(timer)
    remoteTypingTimers.delete(userId)
    typing.value = { ...typing.value, [userId]: value }
    if (value) {
      // Safety net if the "stop typing" event is lost.
      remoteTypingTimers.set(
        userId,
        setTimeout(() => setRemoteTyping(userId, false), REMOTE_TYPING_TTL_MS),
      )
    }
  }

  function handleTyping(payload: { from: string; isTyping: boolean }): void {
    if (!payload?.from) return
    setRemoteTyping(payload.from, Boolean(payload.isTyping))
  }

  function handlePresence(payload: { userId: string; online: boolean }): void {
    if (!payload?.userId) return
    online.value = { ...online.value, [payload.userId]: Boolean(payload.online) }
  }

  // ─── REST: conversations & history ─────────────────────────────────────────

  async function fetchConversations(): Promise<void> {
    conversationsLoading.value = true
    conversationsError.value = null
    try {
      conversations.value = await chatApi.conversations()
      conversationsLoaded.value = true
    } catch (error) {
      conversationsError.value = errorMessage(error, 'Impossible de charger les conversations.')
    } finally {
      conversationsLoading.value = false
    }
  }

  async function loadInitial(userId: string): Promise<void> {
    const t = thread(userId)
    if (t.loading) return
    t.loading = true
    t.error = null
    try {
      const page = await chatApi.messages(userId)
      t.messages = [...page.items].sort(byDateAsc)
      t.nextCursor = page.nextCursor
      t.hasMore = page.nextCursor !== null
      t.loaded = true
    } catch (error) {
      t.error = hasStatus(error, 403)
        ? 'Vous ne pouvez pas échanger avec cet utilisateur : aucune candidature ne vous relie.'
        : errorMessage(error, 'Impossible de charger les messages.')
    } finally {
      t.loading = false
    }
  }

  /** Fetches the most recent page and merges it (used after a reconnection). */
  async function syncLatest(userId: string): Promise<void> {
    const t = threads.value[userId]
    if (!t?.loaded) return
    try {
      const page = await chatApi.messages(userId)
      insertMessages(userId, page.items)
    } catch {
      // non-blocking
    }
  }

  /** Cursor-based pagination: loads older messages (server returns newest → oldest). */
  async function loadOlder(userId: string): Promise<void> {
    const t = thread(userId)
    if (t.loadingOlder || !t.hasMore || !t.nextCursor) return
    t.loadingOlder = true
    t.error = null
    try {
      const page = await chatApi.messages(userId, t.nextCursor)
      insertMessages(userId, page.items)
      t.nextCursor = page.nextCursor
      t.hasMore = page.nextCursor !== null
    } catch (error) {
      t.error = errorMessage(error, 'Impossible de charger les messages précédents.')
    } finally {
      t.loadingOlder = false
    }
  }

  async function openConversation(userId: string, contact?: ChatUser): Promise<void> {
    activeUserId.value = userId
    sendError.value = null
    if (contact && !conversations.value.some((c) => c.user.id === userId)) {
      draftContacts.value = { ...draftContacts.value, [userId]: contact }
    }
    const t = thread(userId)
    if (!t.loaded) await loadInitial(userId)
    if (activeUserId.value === userId) await markRead(userId)
  }

  function closeConversation(): void {
    if (activeUserId.value) sendTypingNow(activeUserId.value, false)
    activeUserId.value = null
  }

  async function markRead(userId: string): Promise<void> {
    const conv = conversations.value.find((c) => c.user.id === userId)
    const t = threads.value[userId]
    const unreadLocal = t?.messages.some((m) => m.from === userId && !m.readAt) ?? false
    if ((!conv || conv.unreadCount === 0) && !unreadLocal) return

    if (conv) {
      conversations.value = conversations.value.map((c) =>
        c.user.id === userId ? { ...c, unreadCount: 0 } : c,
      )
    }
    if (t) {
      const now = new Date().toISOString()
      t.messages = t.messages.map((m) => (m.from === userId && !m.readAt ? { ...m, readAt: now } : m))
    }
    try {
      if (socket?.connected) socket.emit('message:read', { from: userId })
      else await chatApi.markRead(userId)
    } catch {
      // non-blocking: the unread counter will be resynchronized on next load
    }
  }

  // ─── Sending ───────────────────────────────────────────────────────────────

  async function deliver(to: string, text: string): Promise<ChatMessage> {
    if (socket?.connected) {
      let ack: SendAck
      try {
        ack = (await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('message:send', { to, text })) as SendAck
      } catch {
        throw new ChatSendError('Le serveur n’a pas confirmé l’envoi. Réessayez.')
      }
      if (!ack || ack.ok !== true) {
        throw new ChatSendError(describeAckError(ack && 'error' in ack ? ack.error : undefined))
      }
      return ack.message
    }
    // REST fallback when the socket is down.
    try {
      return await chatApi.send(to, text)
    } catch (error) {
      if (hasStatus(error, 403)) throw new ChatSendError(ACK_ERRORS.forbidden!)
      if (hasStatus(error, 429)) throw new ChatSendError(ACK_ERRORS.rate_limited!)
      throw new ChatSendError(errorMessage(error, 'Échec de l’envoi du message.'))
    }
  }

  /** Returns true when the server acknowledged the message. */
  async function sendMessage(to: string, rawText: string): Promise<boolean> {
    const text = rawText.trim()
    sendError.value = null
    if (text === '') return false
    if (text.length > MAX_MESSAGE_LENGTH) {
      sendError.value = `Le message dépasse ${MAX_MESSAGE_LENGTH} caractères.`
      return false
    }
    const me = auth.user?.id ?? ''
    const tempId = `tmp-${Date.now()}-${++tempCounter}`
    const optimistic: LocalMessage = {
      id: tempId,
      tempId,
      from: me,
      to,
      text,
      createdAt: new Date().toISOString(),
      readAt: null,
      pending: true,
    }
    const t = thread(to)
    t.messages = [...t.messages, optimistic]
    sendTypingNow(to, false)

    try {
      const saved = await deliver(to, text)
      const current = thread(to)
      const alreadyThere = current.messages.some((m) => m.id === saved.id)
      current.messages = alreadyThere
        ? current.messages.filter((m) => m.tempId !== tempId)
        : current.messages.map((m) => (m.tempId === tempId ? { ...saved } : m))
      if (!touchConversation(saved, false)) void fetchConversations()
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Échec de l’envoi du message.'
      const current = thread(to)
      current.messages = current.messages.map((m) =>
        m.tempId === tempId ? { ...m, pending: false, failed: true, errorText: message } : m,
      )
      sendError.value = message
      return false
    }
  }

  async function retryMessage(to: string, tempId: string): Promise<boolean> {
    const t = threads.value[to]
    const failed = t?.messages.find((m) => m.tempId === tempId && m.failed)
    if (!t || !failed) return false
    t.messages = t.messages.filter((m) => m.tempId !== tempId)
    return sendMessage(to, failed.text)
  }

  function discardMessage(to: string, tempId: string): void {
    const t = threads.value[to]
    if (t) t.messages = t.messages.filter((m) => m.tempId !== tempId)
  }

  // ─── Outgoing typing indicator (throttled) ─────────────────────────────────

  function sendTypingNow(to: string, isTyping: boolean): void {
    const state = outgoingTyping.get(to)
    if (!isTyping) {
      if (state?.idleTimer) clearTimeout(state.idleTimer)
      if (state) {
        outgoingTyping.delete(to)
        if (socket?.connected) socket.emit('typing', { to, isTyping: false })
      }
      return
    }
    if (socket?.connected) socket.emit('typing', { to, isTyping: true })
  }

  /** Call on every keystroke in the composer. */
  function userTyping(to: string): void {
    const now = Date.now()
    const state = outgoingTyping.get(to) ?? { lastSentAt: 0, idleTimer: null }
    if (now - state.lastSentAt >= TYPING_THROTTLE_MS) {
      sendTypingNow(to, true)
      state.lastSentAt = now
    }
    if (state.idleTimer) clearTimeout(state.idleTimer)
    state.idleTimer = setTimeout(() => sendTypingNow(to, false), TYPING_IDLE_MS)
    outgoingTyping.set(to, state)
  }

  // ─── Reset ─────────────────────────────────────────────────────────────────

  function reset(): void {
    disconnect()
    for (const timer of remoteTypingTimers.values()) clearTimeout(timer)
    remoteTypingTimers.clear()
    for (const state of outgoingTyping.values()) if (state.idleTimer) clearTimeout(state.idleTimer)
    outgoingTyping.clear()
    conversations.value = []
    conversationsLoaded.value = false
    conversationsError.value = null
    threads.value = {}
    activeUserId.value = null
    draftContacts.value = {}
    typing.value = {}
    online.value = {}
    sendError.value = null
  }

  return {
    conversations,
    conversationsLoaded,
    conversationsLoading,
    conversationsError,
    threads,
    activeUserId,
    typing,
    online,
    status,
    sendError,
    totalUnread,
    sortedConversations,
    activeThread,
    activeContact,
    isConnected,
    contactFor,
    connect,
    reconnect,
    disconnect,
    handleIncoming,
    handleTyping,
    handlePresence,
    fetchConversations,
    loadInitial,
    loadOlder,
    openConversation,
    closeConversation,
    markRead,
    sendMessage,
    retryMessage,
    discardMessage,
    userTyping,
    reset,
  }
})
