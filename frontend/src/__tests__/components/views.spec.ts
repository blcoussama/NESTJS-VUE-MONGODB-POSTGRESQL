import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { createMemoryHistory, type Router } from 'vue-router'
import { createAppRouter } from '@/router'
import { installSession } from '@/plugins/session'
import { resetAuthHandlers } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import LoginView from '@/views/auth/LoginView.vue'
import SignupView from '@/views/auth/SignupView.vue'
import JobsView from '@/views/JobsView.vue'
import JobApplicationsView from '@/views/recruiter/JobApplicationsView.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { candidate, installMockServer, makeJob, recruiter, type MockServer } from '../helpers'

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({ on: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), removeAllListeners: vi.fn(), connected: false })),
}))

let server: MockServer
let pinia: Pinia
let router: Router

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  server = installMockServer()
  router = createAppRouter(createMemoryHistory())
  installSession(router)
})

afterEach(() => resetAuthHandlers())

async function visit(path: string) {
  await router.push(path)
  await router.isReady()
}

describe('LoginView', () => {
  beforeEach(() => server.on('POST', '/auth/refresh', { status: 401 }))

  it('valide les champs côté client avant tout appel', async () => {
    await visit('/login')
    const wrapper = mount(LoginView, { global: { plugins: [pinia, router] } })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Adresse e-mail invalide.')
    expect(wrapper.text()).toContain('Mot de passe requis.')
    expect(server.callsTo('POST', '/auth/login')).toHaveLength(0)
  })

  it('affiche proprement l’erreur serveur (role="alert")', async () => {
    server.on('POST', '/auth/login', { status: 401, data: { statusCode: 401, message: 'Please verify your email before logging in', error: 'Unauthorized' } })
    await visit('/login')
    const wrapper = mount(LoginView, { global: { plugins: [pinia, router] } })
    await wrapper.get('input[type="email"]').setValue('candidate@example.com')
    await wrapper.get('input[type="password"]').setValue('Password123!')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Please verify your email before logging in')
  })

  it('connexion réussie → redirection vers ?redirect (chemin interne uniquement)', async () => {
    server.on('POST', '/auth/login', { status: 200, data: { accessToken: 'tok', user: candidate } })
    server.on('GET', '/users/me', { status: 200, data: candidate })
    server.on('GET', '/applications/mine', { status: 200, data: [] })
    await visit('/login?redirect=/applications')
    const wrapper = mount(LoginView, { global: { plugins: [pinia, router] } })
    await wrapper.get('input[type="email"]').setValue(candidate.email)
    await wrapper.get('input[type="password"]').setValue('Password123!')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(useAuthStore().isAuthenticated).toBe(true)
    // The target view is lazy-loaded: wait for the navigation to settle.
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/applications'))
  })

  it('ignore une redirection externe (open redirect)', async () => {
    server.on('POST', '/auth/login', { status: 200, data: { accessToken: 'tok', user: recruiter } })
    server.on('GET', '/users/me', { status: 200, data: recruiter })
    server.on('GET', '/jobs/mine', { status: 200, data: [] })
    server.on('GET', '/companies/mine', { status: 404 })
    await visit('/login?redirect=//evil.example')
    const wrapper = mount(LoginView, { global: { plugins: [pinia, router] } })
    await wrapper.get('input[type="email"]').setValue(recruiter.email)
    await wrapper.get('input[type="password"]').setValue('Password123!')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/recruiter/jobs'))
  })
})

describe('SignupView', () => {
  beforeEach(() => server.on('POST', '/auth/refresh', { status: 401 }))

  it('envoie le rôle choisi (recruteur) et affiche l’écran de vérification', async () => {
    server.on('POST', '/auth/signup', { status: 201, data: { message: 'Account created. Check your email to verify your account.' } })
    await visit('/signup')
    const wrapper = mount(SignupView, { global: { plugins: [pinia, router] } })
    await wrapper.get('input[value="recruiter"]').setValue(true)
    const inputs = wrapper.findAll('input:not([type="radio"])')
    const [first, last, email, password, confirm] = inputs
    await first!.setValue('Sara')
    await last!.setValue('R')
    await email!.setValue('sara@example.com')
    await password!.setValue('Password123!')
    await confirm!.setValue('Password123!')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(JSON.parse(String(server.callsTo('POST', '/auth/signup')[0]?.data))).toEqual({
      firstName: 'Sara',
      lastName: 'R',
      email: 'sara@example.com',
      password: 'Password123!',
      role: 'recruiter',
    })
    expect(wrapper.text()).toContain('Vérifiez votre e-mail')
  })

  it('mots de passe différents → erreur, pas d’appel API', async () => {
    await visit('/signup')
    const wrapper = mount(SignupView, { global: { plugins: [pinia, router] } })
    const inputs = wrapper.findAll('input:not([type="radio"])')
    await inputs[3]!.setValue('Password123!')
    await inputs[4]!.setValue('Different123!')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Les mots de passe ne correspondent pas.')
    expect(server.callsTo('POST', '/auth/signup')).toHaveLength(0)
  })
})

describe('JobsView', () => {
  beforeEach(() => server.on('POST', '/auth/refresh', { status: 401 }))

  it('lit les filtres depuis l’URL, affiche les offres et l’état vide', async () => {
    server.on('GET', '/jobs', (config) =>
      config.params?.search === 'vue'
        ? { status: 200, data: { items: [makeJob()], total: 1, page: 1, limit: 10, totalPages: 1 } }
        : { status: 200, data: { items: [], total: 0, page: 1, limit: 10, totalPages: 0 } },
    )
    await visit('/jobs?search=vue&jobType=internship&page=1')
    const wrapper = mount(JobsView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    expect(server.callsTo('GET', '/jobs')[0]?.params).toMatchObject({ search: 'vue', jobType: 'internship', page: 1 })
    expect(wrapper.text()).toContain('Développeur Vue.js')
    expect(wrapper.text()).toContain('1 offre trouvée')

    await router.push('/jobs?search=zzz')
    await flushPromises()
    expect(wrapper.text()).toContain('Aucune offre ne correspond')
  })

  it('erreur serveur → message et bouton Réessayer', async () => {
    server.on('GET', '/jobs', { status: 503 })
    await visit('/jobs')
    const wrapper = mount(JobsView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toMatch(/Erreur serveur/)
    expect(wrapper.text()).toContain('Réessayer')
  })
})

describe('JobApplicationsView (recruteur)', () => {
  const job = makeJob()
  const application = {
    id: 'a-1',
    jobId: job.id,
    applicantId: candidate.id,
    experienceYears: 2,
    experienceLevel: 'junior',
    status: 'PENDING',
    createdAt: '2026-10-02T09:00:00.000Z',
    applicant: { id: candidate.id, firstName: 'Oussama', lastName: 'Belcadi', email: candidate.email, avatarUrl: null, hasCv: true },
  }

  beforeEach(() => {
    server.on('POST', '/auth/refresh', { status: 200, data: { accessToken: 'rec' } })
    server.on('GET', '/users/me', { status: 200, data: recruiter })
    server.on('GET', `/jobs/${job.id}`, { status: 200, data: job })
    server.on('GET', `/jobs/${job.id}/applications`, { status: 200, data: [application] })
  })

  it('accepte une candidature après confirmation et met à jour le statut', async () => {
    server.on('PATCH', '/applications/a-1/status', { status: 200, data: { ...application, status: 'ACCEPTED' } })
    await visit(`/recruiter/jobs/${job.id}/applications`)
    const wrapper = mount(
      { components: { JobApplicationsView, ConfirmDialog }, template: `<JobApplicationsView id="${job.id}" /><ConfirmDialog />` },
      { global: { plugins: [pinia, router] }, attachTo: document.body },
    )
    await flushPromises()
    expect(wrapper.text()).toContain('Oussama Belcadi')
    expect(wrapper.text()).toContain('Télécharger le CV')

    await wrapper.findAll('button').find((b) => b.text() === 'Accepter')!.trigger('click')
    await flushPromises()
    const dialog = wrapper.get('[role="alertdialog"]')
    await dialog.findAll('button').find((b) => b.text() === 'Accepter')!.trigger('click')
    await flushPromises()

    expect(JSON.parse(String(server.callsTo('PATCH', '/applications/a-1/status')[0]?.data))).toEqual({ status: 'ACCEPTED' })
    expect(wrapper.get('[data-status]').text()).toBe('Acceptée')
    wrapper.unmount()
  })
})
