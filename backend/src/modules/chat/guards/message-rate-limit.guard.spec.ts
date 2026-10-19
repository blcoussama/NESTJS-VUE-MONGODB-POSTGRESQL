import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { REST_MESSAGE_RATE_LIMIT } from '../chat.constants';
import { MessageRateLimitGuard } from './message-rate-limit.guard';

function contextFor(user?: { userId?: unknown }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('MessageRateLimitGuard', () => {
  let guard: MessageRateLimitGuard;

  beforeEach(() => {
    guard = new MessageRateLimitGuard();
  });

  it(`allows ${REST_MESSAGE_RATE_LIMIT.limit} messages per window, then answers 429`, () => {
    const context = contextFor({ userId: 'user-1' });
    for (let i = 0; i < REST_MESSAGE_RATE_LIMIT.limit; i++) {
      expect(guard.canActivate(context)).toBe(true);
    }

    let error: unknown;
    try {
      guard.canActivate(context);
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );

    // Budget is per user
    expect(guard.canActivate(contextFor({ userId: 'user-2' }))).toBe(true);
  });

  it('denies a request without authenticated user', () => {
    expect(guard.canActivate(contextFor(undefined))).toBe(false);
    expect(guard.canActivate(contextFor({ userId: 42 }))).toBe(false);
  });
});
