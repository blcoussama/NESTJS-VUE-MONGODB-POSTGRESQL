/** Name of the httpOnly cookie holding the refresh token. */
export const REFRESH_COOKIE = 'RefreshToken';

/** The cookie is only sent to the auth routes (refresh, logout). */
export const REFRESH_COOKIE_PATH = '/api/auth';

/**
 * A just-rotated token presented again within this window is treated as a
 * benign race (two tabs refreshing at once): rejected, but the session is
 * kept. Outside the window, it is a replay and the session is revoked.
 */
export const ROTATION_GRACE_MS = 10_000;

/** Older sessions beyond this count are revoked at login. */
export const MAX_SESSIONS_PER_USER = 10;

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h

export const BCRYPT_COST = 12;

/**
 * bcrypt hash of a random, discarded string. Compared against when the email
 * is unknown so that login takes the same time whether or not it exists.
 */
export const DUMMY_PASSWORD_HASH =
  '$2b$12$iAHC0ntbQpiJe9lFCE1W0uXNJ7XCdsf24a8fiRkF/mZ68dsVQDY8G';

export const GENERIC_RESET_MESSAGE =
  'If this email exists, a reset link has been sent.';

export const GENERIC_RESEND_MESSAGE =
  'If this account exists and is not verified yet, a new verification email has been sent.';
