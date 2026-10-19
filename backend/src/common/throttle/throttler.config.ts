import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { ACCOUNT_THROTTLE_KEY, ACCOUNT_THROTTLER } from './throttle.constants';

/** Tracks the per-account throttler by the (normalised) email in the body. */
export function accountTracker(req: Record<string, any>): string {
  const body = req.body as Record<string, unknown> | undefined;
  const email = body?.['email'];
  if (typeof email === 'string' && email.trim() !== '') {
    return `account:${email.trim().toLowerCase()}`;
  }
  return `ip:${String(req.ip)}`;
}

/** The per-account throttler only runs on routes decorated with it. */
export function isAccountThrottled(context: ExecutionContext): boolean {
  return (
    Reflect.getMetadata(ACCOUNT_THROTTLE_KEY, context.getHandler()) === true
  );
}

export function throttlerOptionsFactory(
  config: ConfigService,
): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        name: 'default',
        ttl: config.get<number>('throttle.ttl') ?? 60_000,
        limit: config.get<number>('throttle.limit') ?? 100,
      },
      {
        // Limits are always set per route by @AuthThrottle(); these are fallbacks
        name: ACCOUNT_THROTTLER,
        ttl: 15 * 60_000,
        limit: 10,
        getTracker: accountTracker,
        skipIf: (context) => !isAccountThrottled(context),
      },
    ],
  };
}
