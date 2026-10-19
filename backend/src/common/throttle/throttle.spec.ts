import { ExecutionContext, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorageService } from '@nestjs/throttler';
import {
  accountTracker,
  isAccountThrottled,
  throttlerOptionsFactory,
} from './throttler.config';
import { AuthThrottle } from './auth-throttle.decorator';
import { AppThrottlerGuard } from './app-throttler.guard';
import { AUTH_THROTTLE } from './throttle.constants';

class SampleController {
  @AuthThrottle(AUTH_THROTTLE.login)
  login() {}

  @AuthThrottle(AUTH_THROTTLE.signup)
  signup() {}
}

/** Route handlers, read as plain functions (as Nest's ExecutionContext does). */
const handlers = SampleController.prototype as unknown as Record<
  'login' | 'signup',
  () => void
>;

function contextFor(
  handler: () => void,
  type: 'http' | 'ws' = 'http',
  req: Record<string, unknown> = { ip: '10.0.0.1', headers: {} },
): ExecutionContext {
  const res = { header: jest.fn() };
  return {
    getType: () => type,
    getHandler: () => handler,
    getClass: () => SampleController,
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
}

describe('throttler configuration', () => {
  it('tracks the account throttler by normalised email, falling back to the IP', () => {
    expect(
      accountTracker({ ip: '1.2.3.4', body: { email: '  John@Example.COM ' } }),
    ).toBe('account:john@example.com');
    expect(accountTracker({ ip: '1.2.3.4', body: {} })).toBe('ip:1.2.3.4');
    expect(accountTracker({ ip: '1.2.3.4' })).toBe('ip:1.2.3.4');
  });

  it('enables the account throttler only on routes declaring it', () => {
    expect(isAccountThrottled(contextFor(handlers.login))).toBe(true);
    expect(isAccountThrottled(contextFor(handlers.signup))).toBe(false);
  });

  it('reads the global limit from the configuration', () => {
    const values: Record<string, number> = {
      'throttle.ttl': 30_000,
      'throttle.limit': 42,
    };
    const options = throttlerOptionsFactory({
      get: (key: string) => values[key],
    } as unknown as ConfigService);

    expect(Array.isArray(options)).toBe(false);
    const throttlers = (options as { throttlers: { name?: string }[] })
      .throttlers;
    expect(throttlers[0]).toMatchObject({
      name: 'default',
      ttl: 30_000,
      limit: 42,
    });
    expect(throttlers[1].name).toBe('account');
  });
});

describe('AppThrottlerGuard', () => {
  async function createGuard() {
    const options = throttlerOptionsFactory({
      get: () => undefined,
    } as unknown as ConfigService);
    const guard = new AppThrottlerGuard(
      options,
      new ThrottlerStorageService(),
      new Reflector(),
    );
    await guard.onModuleInit();
    return guard;
  }

  it('does not throttle WebSocket contexts (chat has its own limiter)', async () => {
    const guard = await createGuard();
    const ctx = contextFor(handlers.login, 'ws');

    for (let i = 0; i < 20; i++) {
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    }
  });

  it(`blocks the ${AUTH_THROTTLE.login.ip.limit + 1}th login from one IP with a 429 in the API error format`, async () => {
    const guard = await createGuard();
    const ctx = contextFor(handlers.login, 'http', {
      ip: '10.0.0.2',
      headers: {},
      body: {},
    });

    for (let i = 0; i < AUTH_THROTTLE.login.ip.limit; i++) {
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    }
    const error = await guard.canActivate(ctx).catch((e: HttpException) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect((error as HttpException).getResponse()).toEqual({
      statusCode: 429,
      message: 'Too many requests, please try again later.',
      error: 'Too Many Requests',
    });
  });

  it('limits login attempts per targeted account across different IPs', async () => {
    const guard = await createGuard();
    const handler = handlers.login;
    const attempt = (i: number) =>
      guard.canActivate(
        contextFor(handler, 'http', {
          ip: `10.1.0.${i}`,
          headers: {},
          body: { email: 'victim@example.com' },
        }),
      );

    for (let i = 0; i < AUTH_THROTTLE.login.account.limit; i++) {
      await expect(attempt(i)).resolves.toBe(true);
    }
    await expect(attempt(99)).rejects.toBeInstanceOf(HttpException);
  });
});
