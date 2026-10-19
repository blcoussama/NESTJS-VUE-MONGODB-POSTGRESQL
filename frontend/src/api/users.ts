import { http } from './http'
import { normalizeProfile } from './normalize'
import type { PresignedUrlResponse, UpdateProfilePayload, UserProfile } from '@/types/api'

function fileForm(file: File): FormData {
  const form = new FormData()
  form.append('file', file)
  return form
}

export const usersApi = {
  async me(): Promise<UserProfile> {
    const { data } = await http.get<unknown>('/users/me')
    return normalizeProfile(data)
  },

  async updateMe(payload: UpdateProfilePayload): Promise<UserProfile> {
    const { data } = await http.patch<unknown>('/users/me', payload)
    return normalizeProfile(data)
  },

  async uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
    const { data } = await http.post<{ avatarUrl: string }>('/users/me/avatar', fileForm(file))
    return data
  },

  async deleteAvatar(): Promise<void> {
    await http.delete('/users/me/avatar')
  },

  async uploadCv(file: File): Promise<void> {
    await http.post('/users/me/cv', fileForm(file))
  },

  async deleteCv(): Promise<void> {
    await http.delete('/users/me/cv')
  },

  async cvUrl(): Promise<PresignedUrlResponse> {
    const { data } = await http.get<PresignedUrlResponse>('/users/me/cv-url')
    return data
  },
}

export { fileForm }
