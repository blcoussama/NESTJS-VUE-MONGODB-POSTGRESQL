import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { registerAuthHandlers, resetAuthHandlers } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { authHeader, candidate, installMockServer, recruiter, type MockServer } from '../helpers'

describe('stores/auth', () => {
  let server: MockServer
  let auth: ReturnType<typeof useAuthStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    server = installMockServer()
    auth = useAuthStore()
    registerAuthHandlers({
      getAccessToken: () => auth.accessToken,
      setAccessToken: (t) => auth.setAccessToken(t),
      onSessionExpired: () => auth.clearSession(),
    })
  })

  afterEach(() => resetAuthHandlers())

  it('init() restaure la session par refresh silencieux puis GET /users/me', async () => {
    server.on('POST', '/auth/refresh', { status: 200, data: { accessToken: 'restored' } })
    server.on('GET', '/users/me', (config) => ({
      status: authHeader(config) === 'Bearer restored' ? 200 : 401,
      data: { _id: candidate.id, ...candidate, cvKey: 'cvs/x.pdf' },
    }))

    await auth.init()

    expect(auth.status).toBe('ready')
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.accessToken).toBe('restored')
    expect(auth.user).toMatchObject({ id: candidate.id, role: 'candidate' })
    expect(server.callsTo('POST', '/auth/refresh')[0]?.withCredentials).toBe(true)
  })

  it('init() sans cookie valide → visiteur anonyme, sans erreur', async () => {
    server.on('POST', '/auth/refresh', { status: 401, data: { statusCode: 401, message: 'Unauthorized' } })
    await auth.init()
    expect(auth.status).toBe('ready')
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.accessToken).toBeNull()
  })

  it('init() n’est exécuté qu’une fois (appels concurrents)', async () => {
    server.on('POST', '/auth/refresh', { status: 401 })
    await Promise.all([auth.init(), auth.init(), auth.init()])
    expect(server.callsTo('POST', '/auth/refresh')).toHaveLength(1)
  })

  it('login() garde le jeton en mémoire uniquement (jamais localStorage/sessionStorage)', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    server.on('POST', '/auth/login', { status: 200, data: { accessToken: 'tok-1', user: candidate } })
    server.on('GET', '/users/me', { status: 200, data: candidate })

    const user = await auth.login({ email: candidate.email, password: 'Password123!' })

    expect(user.firstName).toBe('Oussama')
    expect(auth.accessToken).toBe('tok-1')
    expect(auth.isCandidate).toBe(true)
    expect(setItem).not.toHaveBeenCalled()
    expect(JSON.stringify(window.localStorage)).not.toContain('tok-1')
    expect(JSON.stringify(window.sessionStorage)).not.toContain('tok-1')
  })

  it('login() en échec propage l’erreur et reste anonyme', async () => {
    server.on('POST', '/auth/login', { status: 401, data: { statusCode: 401, message: 'Invalid credentials' } })
    await expect(auth.login({ email: 'x@y.z', password: 'bad' })).rejects.toBeTruthy()
    expect(auth.isAuthenticated).toBe(false)
  })

  it('logout() appelle l’API avec le Bearer puis vide la session', async () => {
    auth.setAccessToken('tok')
    auth.setUser(recruiter)
    server.on('POST', '/auth/logout', { status: 200, data: { message: 'ok' } })
    await auth.logout()
    expect(authHeader(server.callsTo('POST', '/auth/logout')[0])).toBe('Bearer tok')
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.user).toBeNull()
  })

  it('logout() vide la session même si l’API échoue', async () => {
    auth.setAccessToken('tok')
    auth.setUser(recruiter)
    server.on('POST', '/auth/logout', { status: 500 })
    server.on('POST', '/auth/refresh', { status: 401 })
    await auth.logout()
    expect(auth.accessToken).toBeNull()
  })

  it('getters de rôle et page d’accueil', () => {
    auth.setAccessToken('t')
    auth.setUser(recruiter)
    expect(auth.isRecruiter).toBe(true)
    expect(auth.homeRoute).toBe('/recruiter/jobs')
    expect(auth.fullName).toBe('Sara Recruteuse')
    auth.setUser(candidate)
    expect(auth.homeRoute).toBe('/jobs')
  })

  it('signup() envoie le rôle choisi', async () => {
    server.on('POST', '/auth/signup', { status: 201, data: { message: 'Account created.' } })
    await auth.signup({ firstName: 'A', lastName: 'B', email: 'a@b.co', password: 'Password1!', role: 'recruiter' })
    expect(JSON.parse(String(server.calls[0]?.data))).toMatchObject({ role: 'recruiter' })
  })
})
