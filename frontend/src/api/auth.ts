import { http } from './http'
import { normalizeAuthUser } from './normalize'
import type { LoginPayload, LoginResponse, MessageResponse, SignupPayload } from '@/types/api'

export const authApi = {
  async signup(payload: SignupPayload): Promise<MessageResponse> {
    const { data } = await http.post<MessageResponse>('/auth/signup', payload)
    return data
  },

  async verifyEmail(token: string): Promise<MessageResponse> {
    const { data } = await http.post<MessageResponse>('/auth/verify-email', { token })
    return data
  },

  async login(payload: LoginPayload): Promise<LoginResponse> {
    const { data } = await http.post<LoginResponse>('/auth/login', payload)
    return { accessToken: data.accessToken, user: normalizeAuthUser(data.user) }
  },

  async logout(): Promise<void> {
    await http.post('/auth/logout')
  },

  async forgotPassword(email: string): Promise<MessageResponse> {
    const { data } = await http.post<MessageResponse>('/auth/forgot-password', { email })
    return data
  },

  async resetPassword(token: string, newPassword: string): Promise<MessageResponse> {
    const { data } = await http.post<MessageResponse>('/auth/reset-password', { token, newPassword })
    return data
  },
}
