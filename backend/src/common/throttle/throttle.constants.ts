export interface ThrottleRule {
  limit: number;
  /** Window in milliseconds. */
  ttl: number;
}

const MINUTE = 60_000;

/** Name of the per-account throttler (tracked by the email in the body). */
export const ACCOUNT_THROTTLER = 'account';

/** Metadata key enabling the per-account throttler on a route. */
export const ACCOUNT_THROTTLE_KEY = 'profyle:account-throttle';

/**
 * Strict limits for the sensitive auth routes.
 * `ip` applies per client IP; `account` per target email address (stops a
 * distributed brute force on one account and email bombing of one victim).
 */
export const AUTH_THROTTLE = {
  signup: { ip: { limit: 5, ttl: MINUTE } },
  verifyEmail: { ip: { limit: 10, ttl: MINUTE } },
  resendVerification: {
    ip: { limit: 3, ttl: MINUTE },
    account: { limit: 3, ttl: 15 * MINUTE },
  },
  login: {
    ip: { limit: 10, ttl: MINUTE },
    account: { limit: 10, ttl: 15 * MINUTE },
  },
  refresh: { ip: { limit: 30, ttl: MINUTE } },
  forgotPassword: {
    ip: { limit: 3, ttl: MINUTE },
    account: { limit: 3, ttl: 15 * MINUTE },
  },
  resetPassword: { ip: { limit: 5, ttl: MINUTE } },
} satisfies Record<string, { ip: ThrottleRule; account?: ThrottleRule }>;
