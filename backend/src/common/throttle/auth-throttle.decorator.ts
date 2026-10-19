import { applyDecorators, SetMetadata } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ACCOUNT_THROTTLE_KEY,
  ACCOUNT_THROTTLER,
  ThrottleRule,
} from './throttle.constants';

/**
 * Stricter rate limit for a route: `ip` overrides the global per-IP limit,
 * `account` (optional) adds a per-email limit read from the request body.
 */
export function AuthThrottle(rules: {
  ip: ThrottleRule;
  account?: ThrottleRule;
}) {
  if (!rules.account) {
    return applyDecorators(Throttle({ default: rules.ip }));
  }
  return applyDecorators(
    SetMetadata(ACCOUNT_THROTTLE_KEY, true),
    Throttle({ default: rules.ip, [ACCOUNT_THROTTLER]: rules.account }),
  );
}
