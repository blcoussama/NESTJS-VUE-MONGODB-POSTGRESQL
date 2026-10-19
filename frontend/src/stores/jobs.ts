import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { jobsApi } from '@/api/jobs'
import { errorMessage, hasStatus } from '@/api/errors'
import { JOBS_PAGE_SIZE } from '@/config'
import type { Job, JobFilters, JobPayload, JobUpdatePayload, SavedJob } from '@/types/api'

export const useJobsStore = defineStore('jobs', () => {
  // ─── Public listing (GET /jobs) ────────────────────────────────────────────
  const items = ref<Job[]>([])
  const total = ref(0)
  const page = ref(1)
  const limit = ref(JOBS_PAGE_SIZE)
  const totalPages = ref(0)
  const listLoading = ref(false)
  const listError = ref<string | null>(null)
  let listRequestId = 0

  async function fetchJobs(filters: JobFilters = {}): Promise<void> {
    const requestId = ++listRequestId
    listLoading.value = true
    listError.value = null
    try {
      const data = await jobsApi.list({ limit: JOBS_PAGE_SIZE, ...filters })
      if (requestId !== listRequestId) return // a newer search superseded this one
      items.value = Array.isArray(data.items) ? data.items : []
      total.value = data.total ?? items.value.length
      page.value = data.page ?? filters.page ?? 1
      limit.value = data.limit ?? JOBS_PAGE_SIZE
      totalPages.value = data.totalPages ?? Math.ceil(total.value / limit.value)
    } catch (error) {
      if (requestId !== listRequestId) return
      items.value = []
      total.value = 0
      totalPages.value = 0
      listError.value = errorMessage(error, 'Impossible de charger les offres.')
    } finally {
      if (requestId === listRequestId) listLoading.value = false
    }
  }

  // ─── Detail (GET /jobs/:id) ────────────────────────────────────────────────
  const current = ref<Job | null>(null)
  const currentLoading = ref(false)
  const currentError = ref<string | null>(null)
  const currentNotFound = ref(false)

  async function fetchJob(id: string): Promise<Job | null> {
    currentLoading.value = true
    currentError.value = null
    currentNotFound.value = false
    if (current.value?.id !== id) current.value = null
    try {
      const job = await jobsApi.get(id)
      current.value = job
      if (job.isSaved === true) savedIdSet.value.add(job.id)
      if (job.isSaved === false) savedIdSet.value.delete(job.id)
      return job
    } catch (error) {
      current.value = null
      currentNotFound.value = hasStatus(error, 404)
      currentError.value = currentNotFound.value
        ? 'Cette offre n’existe pas ou n’est plus disponible.'
        : errorMessage(error, 'Impossible de charger l’offre.')
      return null
    } finally {
      currentLoading.value = false
    }
  }

  function patchJobEverywhere(id: string, patch: Partial<Job>): void {
    const apply = (job: Job): Job => (job.id === id ? { ...job, ...patch } : job)
    items.value = items.value.map(apply)
    mine.value = mine.value.map(apply)
    if (current.value?.id === id) current.value = { ...current.value, ...patch }
  }

  // ─── Recruiter: my jobs (GET /jobs/mine) ──────────────────────────────────
  const mine = ref<Job[]>([])
  const mineLoading = ref(false)
  const mineLoaded = ref(false)
  const mineError = ref<string | null>(null)

  async function fetchMine(): Promise<void> {
    mineLoading.value = true
    mineError.value = null
    try {
      mine.value = await jobsApi.mine()
      mineLoaded.value = true
    } catch (error) {
      mineError.value = errorMessage(error, 'Impossible de charger vos offres.')
    } finally {
      mineLoading.value = false
    }
  }

  async function createJob(payload: JobPayload): Promise<Job> {
    const job = await jobsApi.create(payload)
    mine.value = [{ applicationsCount: 0, ...job }, ...mine.value]
    return job
  }

  async function updateJob(id: string, payload: JobUpdatePayload): Promise<Job> {
    const job = await jobsApi.update(id, payload)
    // keep the client-only counters that a PATCH response may not include
    const previous = mine.value.find((j) => j.id === id)
    patchJobEverywhere(id, {
      ...job,
      applicationsCount: job.applicationsCount ?? previous?.applicationsCount,
    })
    return job
  }

  const setOpen = (id: string, isOpen: boolean) => updateJob(id, { isOpen })

  async function deleteJob(id: string): Promise<void> {
    await jobsApi.remove(id)
    mine.value = mine.value.filter((j) => j.id !== id)
    items.value = items.value.filter((j) => j.id !== id)
    if (current.value?.id === id) current.value = null
  }

  // ─── Candidate: saved jobs ─────────────────────────────────────────────────
  const saved = ref<SavedJob[]>([])
  const savedLoaded = ref(false)
  const savedLoading = ref(false)
  const savedError = ref<string | null>(null)
  const savedIdSet = ref<Set<string>>(new Set())
  const savingIds = ref<Set<string>>(new Set())

  const savedCount = computed(() => savedIdSet.value.size)

  function isSaved(jobId: string): boolean {
    return savedIdSet.value.has(jobId)
  }

  async function fetchSaved(force = false): Promise<void> {
    if (savedLoading.value || (savedLoaded.value && !force)) return
    savedLoading.value = true
    savedError.value = null
    try {
      saved.value = await jobsApi.saved()
      savedIdSet.value = new Set(
        saved.value
          .map((s) => s.jobId ?? s.job?.id)
          .filter((id): id is string => typeof id === 'string' && id !== ''),
      )
      savedLoaded.value = true
    } catch (error) {
      savedError.value = errorMessage(error, 'Impossible de charger vos favoris.')
    } finally {
      savedLoading.value = false
    }
  }

  /** Returns the new saved state. */
  async function toggleSave(jobId: string): Promise<boolean> {
    if (savingIds.value.has(jobId)) return isSaved(jobId)
    savingIds.value.add(jobId)
    const wasSaved = isSaved(jobId)
    try {
      if (wasSaved) {
        await jobsApi.unsave(jobId)
        savedIdSet.value.delete(jobId)
        saved.value = saved.value.filter((s) => (s.jobId ?? s.job?.id) !== jobId)
      } else {
        await jobsApi.save(jobId)
        savedIdSet.value.add(jobId)
        // The saved list needs the server summary: refetch it next time it is displayed.
        savedLoaded.value = false
      }
      if (current.value?.id === jobId) current.value = { ...current.value, isSaved: !wasSaved }
      return !wasSaved
    } finally {
      savingIds.value.delete(jobId)
    }
  }

  function isSaving(jobId: string): boolean {
    return savingIds.value.has(jobId)
  }

  /** Clears user-specific data (logout / account switch). */
  function reset(): void {
    mine.value = []
    mineLoaded.value = false
    mineError.value = null
    saved.value = []
    savedLoaded.value = false
    savedError.value = null
    savedIdSet.value = new Set()
    savingIds.value = new Set()
    current.value = null
  }

  return {
    items,
    total,
    page,
    limit,
    totalPages,
    listLoading,
    listError,
    fetchJobs,
    current,
    currentLoading,
    currentError,
    currentNotFound,
    fetchJob,
    patchJobEverywhere,
    mine,
    mineLoading,
    mineLoaded,
    mineError,
    fetchMine,
    createJob,
    updateJob,
    setOpen,
    deleteJob,
    saved,
    savedLoaded,
    savedLoading,
    savedError,
    savedCount,
    isSaved,
    isSaving,
    fetchSaved,
    toggleSave,
    reset,
  }
})
