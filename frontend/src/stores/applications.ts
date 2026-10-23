import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { applicationsApi } from '@/api/applications'
import { errorMessage, hasStatus } from '@/api/errors'
import { safeHttpUrl } from '@/utils/url'
import { useJobsStore } from './jobs'
import type {
  Application,
  ApplyPayload,
  CandidateApplication,
  RecruiterApplication,
  ReviewStatus,
} from '@/types/api'

export const useApplicationsStore = defineStore('applications', () => {
  // ─── Candidate side ────────────────────────────────────────────────────────
  const mine = ref<CandidateApplication[]>([])
  const mineLoaded = ref(false)
  const mineLoading = ref(false)
  const mineError = ref<string | null>(null)
  const withdrawingIds = ref<Set<string>>(new Set())

  const appliedJobIds = computed(() => new Set(mine.value.map((a) => a.jobId ?? a.job?.id)))

  function hasAppliedTo(jobId: string): boolean {
    return appliedJobIds.value.has(jobId)
  }

  async function fetchMine(force = false): Promise<void> {
    if (mineLoading.value || (mineLoaded.value && !force)) return
    mineLoading.value = true
    mineError.value = null
    try {
      mine.value = await applicationsApi.mine()
      mineLoaded.value = true
    } catch (error) {
      mineError.value = errorMessage(error, 'Impossible de charger vos candidatures.')
    } finally {
      mineLoading.value = false
    }
  }

  /**
   * POST /jobs/:jobId/applications. Throws a user-facing Error on failure
   * (409 → already applied, 404 → job closed or missing).
   */
  async function apply(jobId: string, payload: ApplyPayload): Promise<Application> {
    const jobs = useJobsStore()
    try {
      const application = await applicationsApi.apply(jobId, payload)
      const job = jobs.current?.id === jobId ? jobs.current : undefined
      mine.value = [
        {
          ...application,
          job: job
            ? {
                id: job.id,
                title: job.title,
                company: job.company
                  ? { name: job.company.name, logoUrl: job.company.logoUrl }
                  : undefined,
              }
            : undefined,
        },
        ...mine.value.filter((a) => a.id !== application.id),
      ]
      if (jobs.current?.id === jobId) jobs.current = { ...jobs.current, hasApplied: true }
      return application
    } catch (error) {
      if (hasStatus(error, 409)) {
        if (jobs.current?.id === jobId) jobs.current = { ...jobs.current, hasApplied: true }
        throw new Error('Vous avez déjà postulé à cette offre.')
      }
      if (hasStatus(error, 404)) {
        throw new Error('Cette offre est fermée ou n’existe plus.')
      }
      throw new Error(errorMessage(error, 'La candidature n’a pas pu être envoyée.'))
    }
  }

  async function withdraw(id: string): Promise<void> {
    if (withdrawingIds.value.has(id)) return
    withdrawingIds.value.add(id)
    try {
      const updated = await applicationsApi.withdraw(id)
      mine.value = mine.value.map((a) =>
        a.id === id
          ? {
              ...a,
              ...updated,
              job: a.job,
              status: updated?.status ?? 'WITHDRAWN',
              withdrawnAt: updated?.withdrawnAt ?? new Date().toISOString(),
            }
          : a,
      )
    } finally {
      withdrawingIds.value.delete(id)
    }
  }

  const isWithdrawing = (id: string) => withdrawingIds.value.has(id)

  // ─── Recruiter side ────────────────────────────────────────────────────────
  const byJob = ref<Record<string, RecruiterApplication[]>>({})
  const byJobLoading = ref<Record<string, boolean>>({})
  const byJobError = ref<Record<string, string | null>>({})
  const updatingIds = ref<Set<string>>(new Set())

  async function fetchForJob(jobId: string): Promise<void> {
    byJobLoading.value = { ...byJobLoading.value, [jobId]: true }
    byJobError.value = { ...byJobError.value, [jobId]: null }
    try {
      const list = await applicationsApi.forJob(jobId)
      byJob.value = { ...byJob.value, [jobId]: list }
    } catch (error) {
      byJobError.value = {
        ...byJobError.value,
        [jobId]: hasStatus(error, 403)
          ? 'Vous n’êtes pas le propriétaire de cette offre.'
          : errorMessage(error, 'Impossible de charger les candidatures.'),
      }
    } finally {
      byJobLoading.value = { ...byJobLoading.value, [jobId]: false }
    }
  }

  async function updateStatus(jobId: string, id: string, status: ReviewStatus): Promise<void> {
    if (updatingIds.value.has(id)) return
    updatingIds.value.add(id)
    try {
      const updated = await applicationsApi.setStatus(id, status)
      const list = byJob.value[jobId] ?? []
      byJob.value = {
        ...byJob.value,
        [jobId]: list.map((a) =>
          a.id === id ? { ...a, ...updated, applicant: a.applicant, status: updated?.status ?? status } : a,
        ),
      }
    } catch (error) {
      if (hasStatus(error, 409)) {
        throw new Error('Cette candidature a déjà été traitée ou retirée.')
      }
      throw new Error(errorMessage(error, 'La mise à jour du statut a échoué.'))
    } finally {
      updatingIds.value.delete(id)
    }
  }

  const isUpdating = (id: string) => updatingIds.value.has(id)

  /** Presigned (short-lived) URL of the applicant's CV. */
  async function getCvUrl(id: string): Promise<string> {
    const { url } = await applicationsApi.cvUrl(id)
    const safe = safeHttpUrl(url)
    if (!safe) throw new Error('URL de CV invalide.')
    return safe
  }

  function reset(): void {
    mine.value = []
    mineLoaded.value = false
    mineError.value = null
    byJob.value = {}
    byJobLoading.value = {}
    byJobError.value = {}
    withdrawingIds.value = new Set()
    updatingIds.value = new Set()
  }

  return {
    mine,
    mineLoaded,
    mineLoading,
    mineError,
    hasAppliedTo,
    fetchMine,
    apply,
    withdraw,
    isWithdrawing,
    byJob,
    byJobLoading,
    byJobError,
    fetchForJob,
    updateStatus,
    isUpdating,
    getCvUrl,
    reset,
  }
})
