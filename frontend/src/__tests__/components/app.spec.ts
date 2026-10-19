import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import App from '@/App.vue'
import { createAppRouter } from '@/router'
import { installSession } from '@/plugins/session'
import { resetAuthHandlers } from '@/api/http'
import { useChatStore } from '@/stores/chat'
import { candidate, installMockServer, makeJob } from '../helpers'

const io = vi.hoisted(() =>
  vi.fn(() => ({ on: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), removeAllListeners: vi.fn(), connected: false })),
)
vi.mock('socket.io-client', () => ({ io }))

afterEach(() => resetAuthHandlers())

async function mountApp(path: string) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createAppRouter(createMemoryHistory())
  installSession(router)
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('App (montage complet)', () => {
  it('visiteur : header public, liste des offres, aucun socket ouvert', async () => {
    const server = installMockServer()
    server.on('POST', '/auth/refresh', { status: 401 })
    server.on('GET', '/jobs', { status: 200, data: { items: [makeJob()], total: 1, page: 1, limit: 10, totalPages: 1 } })

    const { wrapper } = await mountApp('/jobs')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Développeur Vue.js'))

    expect(wrapper.text()).toContain('Connexion')
    expect(wrapper.text()).toContain('Créer un compte')
    expect(wrapper.find('a[href="#main"]').exists()).toBe(true)
    expect(io).not.toHaveBeenCalled()
  })

  it('candidat restauré : navigation candidat, badge de non-lus et socket ouvert', async () => {
    const server = installMockServer()
    server.on('POST', '/auth/refresh', { status: 200, data: { accessToken: 'tok' } })
    server.on('GET', '/users/me', { status: 200, data: candidate })
    server.on('GET', '/jobs', { status: 200, data: { items: [], total: 0, page: 1, limit: 10, totalPages: 0 } })
    server.on('GET', '/saved-jobs', { status: 200, data: [] })

    const { wrapper } = await mountApp('/jobs')
    useChatStore().conversations = [
      { user: { id: 'r1', firstName: 'Sara', lastName: 'R', avatarUrl: null }, lastMessage: null, unreadCount: 2 },
    ]
    await flushPromises()

    expect(io).toHaveBeenCalledWith('http://api.test/chat', expect.objectContaining({ path: '/socket.io' }))
    expect(wrapper.text()).toContain('Favoris')
    expect(wrapper.text()).toContain('Candidatures')
    expect(wrapper.text()).toContain('Oussama Belcadi')
    expect(wrapper.text()).toMatch(/Messages\s*2\s+message\(s\) non lu\(s\)/)
  })
})
