import { http } from './http'
import { asList } from './normalize'
import type {
  Application,
  ApplyPayload,
  CandidateApplication,
  Paginated,
  PresignedUrlResponse,
  RecruiterApplication,
  ReviewStatus,
} from '@/types/api'

const appPath = (id: string) => `/applications/${encodeURIComponent(id)}`

export const applicationsApi = {
  async apply(jobId: string, payload: ApplyPayload): Promise<Application> {
    const { data } = await http.post<Application>(
      `/jobs/${encodeURIComponent(jobId)}/applications`,
      payload,
    )
    return data
  },

  async mine(): Promise<CandidateApplication[]> {
    const { data } = await http.get<CandidateApplication[] | Paginated<CandidateApplication>>(
      '/applications/mine',
    )
    return asList(data)
  },

  async forJob(jobId: string): Promise<RecruiterApplication[]> {
    const { data } = await http.get<RecruiterApplication[] | Paginated<RecruiterApplication>>(
      `/jobs/${encodeURIComponent(jobId)}/applications`,
    )
    return asList(data)
  },

  async setStatus(id: string, status: ReviewStatus): Promise<Application> {
    const { data } = await http.patch<Application>(`${appPath(id)}/status`, { status })
    return data
  },

  async withdraw(id: string): Promise<Application> {
    const { data } = await http.patch<Application>(`${appPath(id)}/withdraw`)
    return data
  },

  async cvUrl(id: string): Promise<PresignedUrlResponse> {
    const { data } = await http.get<PresignedUrlResponse>(`${appPath(id)}/cv-url`)
    return data
  },
}
