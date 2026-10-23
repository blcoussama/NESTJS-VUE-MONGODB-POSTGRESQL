import { http } from './http'
import { asList } from './normalize'
import type { Job, JobFilters, JobPayload, JobUpdatePayload, Paginated, SavedJob } from '@/types/api'

/** Drops empty filters so that the query string only contains meaningful parameters. */
export function toJobQuery(filters: JobFilters): Record<string, string | number> {
  const query: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed !== '') query[key] = trimmed
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      query[key] = value
    }
  }
  if (typeof query.limit === 'number') query.limit = Math.min(Math.max(query.limit, 1), 50)
  return query
}

const jobPath = (id: string) => `/jobs/${encodeURIComponent(id)}`

export const jobsApi = {
  async list(filters: JobFilters = {}): Promise<Paginated<Job>> {
    const { data } = await http.get<Paginated<Job>>('/jobs', { params: toJobQuery(filters) })
    return data
  },

  async mine(): Promise<Job[]> {
    const { data } = await http.get<Job[] | Paginated<Job>>('/jobs/mine')
    return asList(data)
  },

  async get(id: string): Promise<Job> {
    const { data } = await http.get<Job>(jobPath(id))
    return data
  },

  async create(payload: JobPayload): Promise<Job> {
    const { data } = await http.post<Job>('/jobs', payload)
    return data
  },

  async update(id: string, payload: JobUpdatePayload): Promise<Job> {
    const { data } = await http.patch<Job>(jobPath(id), payload)
    return data
  },

  async remove(id: string): Promise<void> {
    await http.delete(jobPath(id))
  },

  async save(id: string): Promise<void> {
    await http.post(`${jobPath(id)}/save`)
  },

  async unsave(id: string): Promise<void> {
    await http.delete(`${jobPath(id)}/save`)
  },

  async saved(): Promise<SavedJob[]> {
    const { data } = await http.get<SavedJob[] | Paginated<SavedJob>>('/saved-jobs')
    return asList(data)
  },
}
