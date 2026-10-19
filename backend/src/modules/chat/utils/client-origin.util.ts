import { DEFAULT_CLIENT_URL } from '../chat.constants';

const stripTrailingSlashes = (url: string): string => url.replace(/\/+$/, '');

/**
 * Allowed browser origin for the chat socket (`CLIENT_URL`, never `*`).
 *
 * Read lazily (at request time, not at import time): the @WebSocketGateway()
 * options are evaluated when the file is imported, before ConfigModule has
 * loaded the .env file. Same source and default as `client.url` in
 * config/configuration.ts.
 */
export function getAllowedClientOrigin(): string {
  return stripTrailingSlashes(process.env.CLIENT_URL || DEFAULT_CLIENT_URL);
}

/** Exact match against CLIENT_URL (trailing slashes ignored). */
export function isAllowedClientOrigin(origin: string | undefined): boolean {
  return (
    typeof origin === 'string' &&
    stripTrailingSlashes(origin) === getAllowedClientOrigin()
  );
}

/**
 * Handshake origin policy. Browsers always send `Origin` (WebSocket upgrades
 * are not covered by CORS, so it must be checked here); non-browser clients
 * usually send none and are still subject to JWT authentication.
 */
export function isHandshakeOriginAllowed(origin: string | undefined): boolean {
  return origin === undefined || isAllowedClientOrigin(origin);
}
