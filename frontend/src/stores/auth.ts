import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authApi } from '@/api/auth'
import { usersApi } from '@/api/users'
import { refreshAccessToken } from '@/api/http'
import type { AuthUser, LoginPayload, SignupPayload, UserProfile, UserRole } from '@/types/api'

export type AuthStatus = 'idle' | 'restoring' | 'ready'

/**
 * Authentication state.
 * Security: the access token is kept ONLY in memory (this store). It is never written to
 * localStorage/sessionStorage. A page reload restores the session through a silent
 * `POST /auth/refresh` that relies on the httpOnly refresh cookie.
 */
export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)
  const user = ref<AuthUser | null>(null)
  const status = ref<AuthStatus>('idle')
  let initPromise: Promise<void> | null = null

  const isAuthenticated = computed(() => Boolean(accessToken.value && user.value))
  const role = computed<UserRole | null>(() => user.value?.role ?? null)
  const isCandidate = computed(() => role.value === 'candidate')
  const isRecruiter = computed(() => role.value === 'recruiter')
  const fullName = computed(() =>
    user.value ? `${user.value.firstName} ${user.value.lastName}`.trim() : '',
  )
  const homeRoute = computed(() => (isRecruiter.value ? '/recruiter/jobs' : '/jobs'))

  function setAccessToken(token: string | null): void {
    accessToken.value = token
  }

  function setUser(next: AuthUser | null): void {
    user.value = next
  }

  /** Keeps the header in sync after a profile update / avatar upload. */
  function patchUser(partial: Partial<AuthUser> | UserProfile): void {
    if (!user.value) return
    user.value = {
      ...user.value,
      firstName: partial.firstName ?? user.value.firstName,
      lastName: partial.lastName ?? user.value.lastName,
      avatarUrl: partial.avatarUrl !== undefined ? partial.avatarUrl : user.value.avatarUrl,
    }
  }

  function clearSession(): void {
    accessToken.value = null
    user.value = null
  }

  async function fetchMe(): Promise<UserProfile> {
    const profile = await usersApi.me()
    user.value = {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      role: profile.role,
      avatarUrl: profile.avatarUrl ?? null,
    }
    return profile
  }

  /** Silent session restore. Runs once; later calls return the same promise. */
  function init(): Promise<void> {
    if (!initPromise) {
      status.value = 'restoring'
      initPromise = (async () => {
        if (isAuthenticated.value) {
          status.value = 'ready'
          return
        }
        try {
          await refreshAccessToken()
          await fetchMe()
        } catch {
          clearSession()
        } finally {
          status.value = 'ready'
        }
      })()
    }
    return initPromise
  }

  async function login(payload: LoginPayload): Promise<AuthUser> {
    const result = await authApi.login(payload)
    accessToken.value = result.accessToken
    user.value = result.user
    status.value = 'ready'
    // Enrich with the avatar for the header; failure is not blocking.
    fetchMe().catch(() => undefined)
    return result.user
  }

  async function logout(): Promise<void> {
    try {
      if (accessToken.value) await authApi.logout()
    } catch {
      // The local session is cleared anyway; the server cookie expires on its own.
    } finally {
      clearSession()
    }
  }

  const signup = (payload: SignupPayload) => authApi.signup(payload)
  const verifyEmail = (token: string) => authApi.verifyEmail(token)
  const forgotPassword = (email: string) => authApi.forgotPassword(email)
  const resetPassword = (token: string, newPassword: string) =>
    authApi.resetPassword(token, newPassword)

  return {
    accessToken,
    user,
    status,
    isAuthenticated,
    role,
    isCandidate,
    isRecruiter,
    fullName,
    homeRoute,
    setAccessToken,
    setUser,
    patchUser,
    clearSession,
    fetchMe,
    init,
    login,
    logout,
    signup,
    verifyEmail,
    forgotPassword,
    resetPassword,
  }
})
