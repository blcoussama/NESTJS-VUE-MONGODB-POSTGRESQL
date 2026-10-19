import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useJobsStore } from '@/stores/jobs'
import { deferred, installMockServer, makeJob, type MockReply, type MockServer } from '../helpers'

describe('stores/jobs', () => {
  let server: MockServer
  let jobs: ReturnType<typeof useJobsStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    server = installMockServer()
    jobs = useJobsStore()
  })

  it('fetchJobs() envoie les filtres nettoyés et stocke la pagination', async () => {
    server.on('GET', '/jobs', {
      status: 200,
      data: { items: [makeJob()], total: 21, page: 2, limit: 10, totalPages: 3 },
    })
    await jobs.fetchJobs({ search: 'vue', location: '', jobType: 'internship', page: 2, sort: 'oldest' })

    expect(server.calls[0]?.params).toEqual({ search: 'vue', jobType: 'internship', page: 2, sort: 'oldest', limit: 10 })
    expect(jobs.items).toHaveLength(1)
    expect(jobs.total).toBe(21)
    expect(jobs.page).toBe(2)
    expect(jobs.totalPages).toBe(3)
    expect(jobs.listLoading).toBe(false)
  })

  it('fetchJobs() en erreur → message et liste vide', async () => {
    server.on('GET', '/jobs', { status: 500 })
    await jobs.fetchJobs()
    expect(jobs.listError).toMatch(/Erreur serveur/)
    expect(jobs.items).toEqual([])
  })

  it('ignore une réponse obsolète (recherche plus récente déjà affichée)', async () => {
    const slow = deferred<MockReply>()
    server.on('GET', '/jobs', (config) =>
      config.params?.search === 'old'
        ? slow.promise
        : { status: 200, data: { items: [makeJob({ title: 'Nouveau' })], total: 1, page: 1, limit: 10, totalPages: 1 } },
    )
    const first = jobs.fetchJobs({ search: 'old' })
    await jobs.fetchJobs({ search: 'new' })
    slow.resolve({ status: 200, data: { items: [makeJob({ title: 'Ancien' })], total: 1, page: 1, limit: 10, totalPages: 1 } })
    await first
    expect(jobs.items[0]?.title).toBe('Nouveau')
  })

  it('fetchJob() 404 → état « introuvable »', async () => {
    server.on('GET', /^\/jobs\/[\w-]+$/, { status: 404, data: { statusCode: 404, message: 'Job not found' } })
    const result = await jobs.fetchJob('missing')
    expect(result).toBeNull()
    expect(jobs.currentNotFound).toBe(true)
    expect(jobs.currentError).toMatch(/n’existe pas/)
  })

  it('fetchJob() reprend isSaved renvoyé par l’API', async () => {
    const job = makeJob({ isSaved: true, hasApplied: false })
    server.on('GET', `/jobs/${job.id}`, { status: 200, data: job })
    await jobs.fetchJob(job.id)
    expect(jobs.isSaved(job.id)).toBe(true)
    expect(jobs.current?.hasApplied).toBe(false)
  })

  it('toggleSave() : POST puis DELETE /jobs/:id/save', async () => {
    const id = makeJob().id
    server.on('POST', `/jobs/${id}/save`, { status: 201, data: {} })
    server.on('DELETE', `/jobs/${id}/save`, { status: 200, data: {} })

    await expect(jobs.toggleSave(id)).resolves.toBe(true)
    expect(jobs.isSaved(id)).toBe(true)
    await expect(jobs.toggleSave(id)).resolves.toBe(false)
    expect(jobs.isSaved(id)).toBe(false)
    expect(server.callsTo('POST', `/jobs/${id}/save`)).toHaveLength(1)
    expect(server.callsTo('DELETE', `/jobs/${id}/save`)).toHaveLength(1)
  })

  it('fetchSaved() construit l’ensemble des favoris', async () => {
    server.on('GET', '/saved-jobs', {
      status: 200,
      data: [{ id: 's1', jobId: 'j1', createdAt: '2026-10-01', job: { id: 'j1', title: 'A' } }],
    })
    await jobs.fetchSaved()
    expect(jobs.isSaved('j1')).toBe(true)
    expect(jobs.savedCount).toBe(1)
  })

  it('recruteur : fetchMine (enveloppe paginée acceptée), create, close, delete', async () => {
    const existing = makeJob({ applicationsCount: 4 })
    server.on('GET', '/jobs/mine', { status: 200, data: { items: [existing], total: 1, page: 1, limit: 10, totalPages: 1 } })
    server.on('POST', '/jobs', (config) => ({
      status: 201,
      data: makeJob({ id: 'new-job', ...JSON.parse(String(config.data)) }),
    }))
    server.on('PATCH', `/jobs/${existing.id}`, { status: 200, data: { ...existing, isOpen: false, applicationsCount: undefined } })
    server.on('DELETE', '/jobs/new-job', { status: 200, data: {} })

    await jobs.fetchMine()
    expect(jobs.mine).toHaveLength(1)

    await jobs.createJob({
      title: 'Stage DevOps',
      description: 'x'.repeat(30),
      location: 'Tanger',
      jobType: 'internship',
      experienceLevel: 'entry',
      requirements: ['Docker'],
      salaryType: 'negotiable',
      companyId: existing.companyId,
    })
    expect(jobs.mine[0]?.id).toBe('new-job')

    await jobs.setOpen(existing.id, false)
    const closed = jobs.mine.find((j) => j.id === existing.id)
    expect(closed?.isOpen).toBe(false)
    expect(closed?.applicationsCount).toBe(4) // kept from the list
    expect(JSON.parse(String(server.callsTo('PATCH', `/jobs/${existing.id}`)[0]?.data))).toEqual({ isOpen: false })

    await jobs.deleteJob('new-job')
    expect(jobs.mine.map((j) => j.id)).toEqual([existing.id])
  })
})
