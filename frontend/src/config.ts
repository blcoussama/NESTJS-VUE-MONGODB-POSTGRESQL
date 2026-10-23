const DEFAULT_API_URL = 'http://localhost:3000/api'

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

/** REST base URL (with the global `/api` prefix). */
export const API_URL: string = stripTrailingSlash(import.meta.env.VITE_API_URL || DEFAULT_API_URL)

/**
 * Socket.io server origin: `VITE_SOCKET_URL` if provided, otherwise the origin of the API URL
 * (the chat gateway runs on the same NestJS server, namespace `/chat`).
 */
export function deriveSocketOrigin(apiUrl: string, explicit?: string): string {
  if (explicit) return stripTrailingSlash(explicit)
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  return new URL(apiUrl, base).origin
}

export const SOCKET_ORIGIN: string = deriveSocketOrigin(API_URL, import.meta.env.VITE_SOCKET_URL)

export const CHAT_NAMESPACE = '/chat'
export const SOCKET_PATH = '/socket.io'

export const MAX_MESSAGE_LENGTH = 2000
export const MESSAGES_PAGE_SIZE = 30
export const JOBS_PAGE_SIZE = 10
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024
export const MAX_CV_BYTES = 5 * 1024 * 1024
