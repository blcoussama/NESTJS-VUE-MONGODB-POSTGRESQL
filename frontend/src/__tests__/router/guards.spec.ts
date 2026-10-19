import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { resolveGuard, type GuardAuthState } from '@/router/guards'
import { createAppRouter } from '@/router'
import { installSession } from '@/plugins/session'
import { resetAuthHandlers } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { candidate, installMockServer, recruiter, type MockServer } from '../helpers'

// The session bridge opens the chat socket once authenticated: keep it offline in tests.
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
    connected: false,
  })),
}))

const anonymous: GuardAuthState = { isAuthenticated: false, role: null, homeRoute: '/jobs' }
const asCandidate: GuardAuthState = { isAuthenticated: true, role: 'candidate', homeRoute: '/jobs' }
const asRecruiter: GuardAuthState = { isAuthenticated: true, role: 'recruiter', homeRoute: '/recruiter/jobs' }

describe('router/guards — resolveGuard()', () => {
  it('route publique : toujours autorisée', () => {
    expect(resolveGuard({ meta: {}, fullPath: '/jobs' }, anonymous)).toEqual({ allow: true })
  })

  it('route protégée + visiteur → /login avec redirect', () => {
    const decision = resolveGuard({ meta: { requiresAuth: true }, fullPath: '/profile?tab=cv' }, anonymous)
    expect(decision).toMatchObject({ allow: false, reason: 'auth', redirect: { name: 'login', query: { redirect: '/profile?tab=cv' } } })
  })

  it('route par rôle sans session → /login (roles implique requiresAuth)', () => {
    expect(resolveGuard({ meta: { roles: ['recruiter'] }, fullPath: '/recruiter/jobs' }, anonymous)).toMatchObject({ reason: 'auth' })
  })

  it('candidat sur une page recruteur → renvoyé vers son accueil avec message', () => {
    const decision = resolveGuard({ meta: { roles: ['recruiter'] }, fullPath: '/recruiter/jobs' }, asCandidate)
    expect(decision).toMatchObject({ allow: false, reason: 'role', redirect: '/jobs' })
    expect(decision.allow === false && decision.message).toMatch(/recruteurs/)
  })

  it('recruteur sur une page candidat → /recruiter/jobs', () => {
    expect(resolveGuard({ meta: { roles: ['candidate'] }, fullPath: '/saved' }, asRecruiter)).toMatchObject({ redirect: '/recruiter/jobs' })
  })

  it('page invité (login) avec session → accueil du rôle', () => {
    expect(resolveGuard({ meta: { guestOnly: true }, fullPath: '/login' }, asRecruiter)).toMatchObject({ reason: 'guest', redirect: '/recruiter/jobs' })
  })

  it('bon rôle → autorisé', () => {
    expect(resolveGuard({ meta: { roles: ['candidate'] }, fullPath: '/applications' }, asCandidate)).toEqual({ allow: true })
  })
})

describe('router — intégration avec le store auth (installSession)', () => {
  let server: MockServer

  beforeEach(() => {
    setActivePinia(createPinia())
    server = installMockServer()
  })

  afterEach(() => resetAuthHandlers())

  function appRouter() {
    const router = createAppRouter(createMemoryHistory())
    installSession(router)
    return router
  }

  it('attend la restauration de session avant de décider (refresh puis /users/me)', async () => {
    server.on('POST', '/auth/refresh', { status: 200, data: { accessToken: 't' } })
    server.on('GET', '/users/me', { status: 200, data: { ...candidate } })
    const router = appRouter()
    await router.push('/applications')
    expect(router.currentRoute.value.fullPath).toBe('/applications')
    expect(useAuthStore().isCandidate).toBe(true)
  })

  it('visiteur sur /chat → /login?redirect=/chat', async () => {
    server.on('POST', '/auth/refresh', { status: 401 })
    const router = appRouter()
    await router.push('/chat')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/chat')
  })

  it('recruteur sur /saved → /recruiter/jobs + notification', async () => {
    server.on('POST', '/auth/refresh', { status: 200, data: { accessToken: 't' } })
    server.on('GET', '/users/me', { status: 200, data: { ...recruiter } })
    const router = appRouter()
    await router.push('/saved')
    expect(router.currentRoute.value.path).toBe('/recruiter/jobs')
    expect(useUiStore().toasts[0]?.message).toMatch(/candidats/)
  })
})
