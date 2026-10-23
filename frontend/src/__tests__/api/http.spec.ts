import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  http,
  refreshAccessToken,
  registerAuthHandlers,
  resetAuthHandlers,
  type AuthHandlers,
} from '@/api/http'
import { authHeader, deferred, installMockServer, type MockServer } from '../helpers'

describe('api/http — client Axios et intercepteur 401', () => {
  let server: MockServer
  let token: string | null
  let handlers: AuthHandlers
  let onSessionExpired: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => {
    server = installMockServer()
    token = 'access-1'
    onSessionExpired = vi.fn<() => void>()
    handlers = {
      getAccessToken: () => token,
      setAccessToken: (t: string) => {
        token = t
      },
      onSessionExpired,
    }
    registerAuthHandlers(handlers)
  })

  afterEach(() => resetAuthHandlers())

  it('envoie le jeton d’accès en Bearer et les cookies (withCredentials)', async () => {
    server.on('GET', '/users/me', { status: 200, data: { ok: true } })
    await http.get('/users/me')
    const call = server.calls[0]
    expect(authHeader(call)).toBe('Bearer access-1')
    expect(call?.withCredentials).toBe(true)
  })

  it('n’envoie pas d’en-tête Authorization sans jeton', async () => {
    token = null
    server.on('GET', '/jobs', { status: 200, data: { items: [] } })
    await http.get('/jobs')
    expect(authHeader(server.calls[0])).toBeUndefined()
  })

  it('401 → rafraîchit le jeton puis rejoue la requête avec le nouveau jeton', async () => {
    server.on('GET', '/users/me', (config) =>
      authHeader(config) === 'Bearer access-2'
        ? { status: 200, data: { id: 'u1' } }
        : { status: 401, data: { statusCode: 401, message: 'Unauthorized' } },
    )
    server.on('POST', '/auth/refresh', { status: 200, data: { accessToken: 'access-2' } })

    const { data } = await http.get('/users/me')

    expect(data).toEqual({ id: 'u1' })
    expect(token).toBe('access-2')
    expect(server.callsTo('POST', '/auth/refresh')).toHaveLength(1)
    expect(server.callsTo('GET', '/users/me')).toHaveLength(2)
  })

  it('plusieurs 401 simultanés partagent un seul refresh', async () => {
    const refresh = deferred<{ status: number; data: unknown }>()
    for (const url of ['/jobs/mine', '/applications/mine', '/saved-jobs']) {
      server.on('GET', url, (config) =>
        authHeader(config) === 'Bearer access-2' ? { status: 200, data: [] } : { status: 401 },
      )
    }
    server.on('POST', '/auth/refresh', () => refresh.promise)

    const pending = Promise.all([http.get('/jobs/mine'), http.get('/applications/mine'), http.get('/saved-jobs')])
    await vi.waitFor(() => expect(server.callsTo('POST', '/auth/refresh')).toHaveLength(1))
    refresh.resolve({ status: 200, data: { accessToken: 'access-2' } })
    const results = await pending

    expect(results.map((r) => r.status)).toEqual([200, 200, 200])
    expect(server.callsTo('POST', '/auth/refresh')).toHaveLength(1)
  })

  it('échec du refresh → session expirée et erreur d’origine propagée', async () => {
    server.on('GET', '/users/me', { status: 401, data: { statusCode: 401, message: 'Unauthorized' } })
    server.on('POST', '/auth/refresh', { status: 401, data: { statusCode: 401, message: 'Access denied' } })

    await expect(http.get('/users/me')).rejects.toMatchObject({ response: { status: 401 } })
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('ne tente pas de refresh pour un 401 sur /auth/login (identifiants invalides)', async () => {
    server.on('POST', '/auth/login', { status: 401, data: { statusCode: 401, message: 'Invalid credentials' } })
    server.on('POST', '/auth/refresh', { status: 200, data: { accessToken: 'x' } })

    await expect(http.post('/auth/login', {})).rejects.toMatchObject({ response: { status: 401 } })
    expect(server.callsTo('POST', '/auth/refresh')).toHaveLength(0)
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  it('ne tente pas de refresh pour une requête anonyme', async () => {
    token = null
    server.on('GET', '/users/me', { status: 401 })
    await expect(http.get('/users/me')).rejects.toBeTruthy()
    expect(server.callsTo('POST', '/auth/refresh')).toHaveLength(0)
  })

  it('ne rejoue qu’une seule fois (pas de boucle si le nouveau jeton est aussi refusé)', async () => {
    server.on('GET', '/users/me', { status: 401 })
    server.on('POST', '/auth/refresh', { status: 200, data: { accessToken: 'access-2' } })

    await expect(http.get('/users/me')).rejects.toMatchObject({ response: { status: 401 } })
    expect(server.callsTo('GET', '/users/me')).toHaveLength(2)
    expect(server.callsTo('POST', '/auth/refresh')).toHaveLength(1)
  })

  it('rejoue sans refresh si le jeton a déjà été renouvelé entre-temps', async () => {
    server.on('GET', '/users/me', (config) => {
      if (authHeader(config) === 'Bearer access-1') {
        token = 'access-9' // another request refreshed meanwhile
        return { status: 401 }
      }
      return { status: 200, data: { ok: true } }
    })
    await http.get('/users/me')
    expect(server.callsTo('POST', '/auth/refresh')).toHaveLength(0)
    expect(authHeader(server.calls[1])).toBe('Bearer access-9')
  })

  it('refreshAccessToken dédoublonne les appels concurrents et met à jour le jeton', async () => {
    server.on('POST', '/auth/refresh', { status: 200, data: { accessToken: 'fresh' } })
    const [a, b] = await Promise.all([refreshAccessToken(), refreshAccessToken()])
    expect(a).toBe('fresh')
    expect(b).toBe('fresh')
    expect(token).toBe('fresh')
    expect(server.callsTo('POST', '/auth/refresh')).toHaveLength(1)
  })

  it('refreshAccessToken rejette une réponse sans accessToken', async () => {
    server.on('POST', '/auth/refresh', { status: 200, data: {} })
    await expect(refreshAccessToken()).rejects.toThrow()
    expect(token).toBe('access-1')
  })
})
