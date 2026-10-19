// ─── Chat module constants (single source for every limit) ──────────────────

/** Socket.io namespace of the chat gateway (contract: `/chat`). */
export const CHAT_NAMESPACE = '/chat';

/** Maximum message length, measured after trimming (contract: ≤ 2000). */
export const MESSAGE_MAX_LENGTH = 2000;

/** Message history pagination (contract default: 30). */
export const HISTORY_DEFAULT_LIMIT = 30;
export const HISTORY_MAX_LIMIT = 100;

/** Upper bound on conversations returned by GET /chat/conversations. */
export const CONVERSATIONS_MAX = 100;

/** Contract: 20 messages / 10 s per socket. */
export const SOCKET_MESSAGE_RATE_LIMIT = { limit: 20, windowMs: 10_000 };

/** Budget for lightweight signals (typing, message:read) per socket. */
export const SOCKET_SIGNAL_RATE_LIMIT = { limit: 30, windowMs: 10_000 };

/** Same budget for the REST fallback, keyed by user (cannot bypass the socket limit). */
export const REST_MESSAGE_RATE_LIMIT = { limit: 20, windowMs: 10_000 };

/**
 * Max size of a single Socket.io/Engine.io payload (default is 1 MB).
 * A 2000-character message is at most ~12 KB once JSON-escaped.
 */
export const SOCKET_MAX_HTTP_BUFFER_SIZE = 32 * 1024;

/** Concurrent sockets allowed per user (multi-tab support, bounded). */
export const MAX_SOCKETS_PER_USER = 10;

/** Longest access token accepted at the handshake (cheap pre-check). */
export const MAX_TOKEN_LENGTH = 4096;

/** TTL of the authorization cache used for typing indicators. */
export const AUTHORIZATION_CACHE_TTL_MS = 60_000;
export const AUTHORIZATION_CACHE_MAX_ENTRIES = 10_000;

/** Fallback identical to `client.url` in config/configuration.ts. */
export const DEFAULT_CLIENT_URL = 'http://localhost:5173';

/** Generic error returned when two users are not allowed to talk. */
export const CHAT_NOT_ALLOWED_MESSAGE =
  'You are not allowed to exchange messages with this user';

/** Each authenticated socket joins the private room of its user. */
export const userRoom = (userId: string): string => `user:${userId}`;
