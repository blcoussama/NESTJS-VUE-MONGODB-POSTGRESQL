import axios, { type AxiosInstance } from 'axios'
import { API_URL } from '@/config'
import type { RefreshResponse } from '@/types/api'

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Do not try a silent refresh when this request fails with 401. */
    skipAuthRefresh?: boolean
    /** Internal: the request has already been replayed once after a refresh. */
    _retry?: boolean
    /** Internal: access token attached when the request was sent. */
    _sentToken?: string | null
  }
}

/**
 * Bridge between the HTTP layer and the auth store. The access token lives only in
 * memory (Pinia store); the HTTP layer reads it through these callbacks so that it never
 * has to persist anything itself.
 */
export interface AuthHandlers {
  getAccessToken: () => string | null
  setAccessToken: (token: string) => void
  onSessionExpired: () => void
}

const noopHandlers: AuthHandlers = {
  getAccessToken: () => null,
  setAccessToken: () => undefined,
  onSessionExpired: () => undefined,
}

let handlers: AuthHandlers = noopHandlers

export function registerAuthHandlers(next: AuthHandlers): void {
  handlers = next
}

export function resetAuthHandlers(): void {
  handlers = noopHandlers
}

/** Endpoints for which a 401 must never trigger a refresh (credentials / public auth flows). */
const NO_REFRESH_PATHS = [
  '/auth/login',
  '/auth/signup',
  '/auth/refresh',
  '/auth/verify-email',
  '/auth/forgot-password',
  '/auth/reset-password',
]

function isNoRefreshPath(url: string | undefined): boolean {
  if (!url) return false
  const path = url.split('?')[0] ?? ''
  return NO_REFRESH_PATHS.some((p) => path === p || path.endsWith(p))
}

const baseConfig = {
  baseURL: API_URL,
  // Needed so that the httpOnly refresh cookie is sent/received cross-origin (CORS credentials).
  withCredentials: true,
  timeout: 20_000,
  headers: { Accept: 'application/json' },
}

/** Main API client: attaches the Bearer token and replays once after a silent refresh. */
export const http: AxiosInstance = axios.create(baseConfig)

/** Bare client used for `/auth/refresh` only (no interceptors → no refresh loop). */
export const authClient: AxiosInstance = axios.create(baseConfig)

let refreshInFlight: Promise<string> | null = null

/**
 * Exchanges the httpOnly refresh cookie for a new access token.
 * Concurrent callers share the same in-flight request: the backend rotates the refresh
 * token, so two parallel refreshes would invalidate each other.
 */
export function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = authClient
      .post<RefreshResponse>('/auth/refresh')
      .then(({ data }) => {
        if (!data || typeof data.accessToken !== 'string' || data.accessToken === '') {
          throw new Error('Réponse de rafraîchissement invalide')
        }
        handlers.setAccessToken(data.accessToken)
        return data.accessToken
      })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

http.interceptors.request.use((config) => {
  const token = handlers.getAccessToken()
  config._sentToken = token
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  } else {
    config.headers.delete('Authorization')
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.config) throw error
    const config = error.config

    const shouldTryRefresh =
      error.response?.status === 401 &&
      !config._retry &&
      !config.skipAuthRefresh &&
      !isNoRefreshPath(config.url) &&
      // Anonymous request: nothing to refresh.
      Boolean(config._sentToken)

    if (!shouldTryRefresh) throw error

    config._retry = true
    const current = handlers.getAccessToken()
    // Another request already refreshed the token while this one was in flight.
    if (!current || current === config._sentToken) {
      try {
        await refreshAccessToken()
      } catch {
        handlers.onSessionExpired()
        throw error
      }
    }
    // The request interceptor attaches the (new) in-memory token.
    return http.request(config)
  },
)
