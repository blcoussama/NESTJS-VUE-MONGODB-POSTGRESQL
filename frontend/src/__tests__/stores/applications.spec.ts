import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useApplicationsStore } from '@/stores/applications'
import { useJobsStore } from '@/stores/jobs'
import { candidate, installMockServer, makeJob, type MockServer } from '../helpers'
import type { Job } from '@/types/api'

const job = makeJob()
const application = {
  id: 'a-1',
  jobId: job.id,
  applicantId: candidate.id,
  experienceYears: 2,
  experienceLevel: 'junior',
  status: 'PENDING',
  withdrawnAt: null,
  expiresAt: null,
  createdAt: '2026-10-02T09:00:00.000Z',
}

describe('stores/applications', () => {
  let server: MockServer
  let store: ReturnType<typeof useApplicationsStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    server = installMockServer()
    store = useApplicationsStore()
  })

  it('apply() envoie experienceYears/experienceLevel et marque l’offre comme postulée', async () => {
    const jobs = useJobsStore()
    jobs.current = { ...job } as unknown as Job
    server.on('POST', `/jobs/${job.id}/applications`, { status: 201, data: application })

    await store.apply(job.id, { experienceYears: 2, experienceLevel: 'junior' })

    expect(JSON.parse(String(server.calls[0]?.data))).toEqual({ experienceYears: 2, experienceLevel: 'junior' })
    expect(store.mine[0]?.job?.title).toBe(job.title)
    expect(store.hasAppliedTo(job.id)).toBe(true)
    expect(jobs.current?.hasApplied).toBe(true)
  })

  it('apply() 409 → « déjà postulé »', async () => {
    server.on('POST', `/jobs/${job.id}/applications`, { status: 409, data: { statusCode: 409, message: 'Already applied' } })
    await expect(store.apply(job.id, { experienceYears: 1, experienceLevel: 'entry' })).rejects.toThrow(/déjà postulé/)
  })

  it('apply() 404 → offre fermée ou absente', async () => {
    server.on('POST', `/jobs/${job.id}/applications`, { status: 404 })
    await expect(store.apply(job.id, { experienceYears: 1, experienceLevel: 'entry' })).rejects.toThrow(/fermée/)
  })

  it('withdraw() passe la candidature en WITHDRAWN', async () => {
    server.on('GET', '/applications/mine', {
      status: 200,
      data: [{ ...application, job: { id: job.id, title: job.title, company: { name: 'ACME', logoUrl: null } } }],
    })
    server.on('PATCH', '/applications/a-1/withdraw', {
      status: 200,
      data: { ...application, status: 'WITHDRAWN', withdrawnAt: '2026-10-03', expiresAt: '2026-11-02' },
    })
    await store.fetchMine()
    await store.withdraw('a-1')
    expect(store.mine[0]).toMatchObject({ status: 'WITHDRAWN', expiresAt: '2026-11-02' })
    expect(store.mine[0]?.job?.title).toBe(job.title)
  })

  it('recruteur : fetchForJob puis accepter une candidature', async () => {
    server.on('GET', `/jobs/${job.id}/applications`, {
      status: 200,
      data: [{ ...application, applicant: { ...candidate, hasCv: true } }],
    })
    server.on('PATCH', '/applications/a-1/status', { status: 200, data: { ...application, status: 'ACCEPTED' } })

    await store.fetchForJob(job.id)
    expect(store.byJob[job.id]).toHaveLength(1)
    await store.updateStatus(job.id, 'a-1', 'ACCEPTED')
    expect(JSON.parse(String(server.callsTo('PATCH', '/applications/a-1/status')[0]?.data))).toEqual({ status: 'ACCEPTED' })
    expect(store.byJob[job.id]?.[0]).toMatchObject({ status: 'ACCEPTED', applicant: { hasCv: true } })
  })

  it('updateStatus() 409 → candidature déjà traitée', async () => {
    server.on('PATCH', '/applications/a-1/status', { status: 409 })
    await expect(store.updateStatus(job.id, 'a-1', 'REJECTED')).rejects.toThrow(/déjà été traitée/)
  })

  it('fetchForJob() 403 → message propriétaire', async () => {
    server.on('GET', `/jobs/${job.id}/applications`, { status: 403 })
    await store.fetchForJob(job.id)
    expect(store.byJobError[job.id]).toMatch(/propriétaire/)
  })

  it('getCvUrl() renvoie l’URL présignée https et refuse une URL dangereuse', async () => {
    server.on('GET', '/applications/a-1/cv-url', { status: 200, data: { url: 'https://bucket.s3.amazonaws.com/cvs/x.pdf?X-Amz-Signature=abc', expiresIn: 900 } })
    await expect(store.getCvUrl('a-1')).resolves.toMatch(/^https:\/\/bucket\.s3/)
    server.on('GET', '/applications/a-2/cv-url', { status: 200, data: { url: 'javascript:alert(1)' } })
    await expect(store.getCvUrl('a-2')).rejects.toThrow(/invalide/)
  })
})
