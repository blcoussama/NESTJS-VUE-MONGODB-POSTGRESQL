import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { REST_MESSAGE_RATE_LIMIT } from '../chat.constants';
import { SlidingWindowRateLimiter } from '../utils/sliding-window-rate-limiter';

/**
 * Per-user rate limit on the REST fallback `POST /chat/messages`, so the
 * socket limit (20 messages / 10 s) cannot be bypassed over HTTP.
 * Must run after JwtAuthGuard (needs `req.user`).
 */
@Injectable()
export class MessageRateLimitGuard implements CanActivate {
  private readonly limiter = new SlidingWindowRateLimiter(
    REST_MESSAGE_RATE_LIMIT.limit,
    REST_MESSAGE_RATE_LIMIT.windowMs,
  );

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { userId?: unknown } }>();
    const userId = request.user?.userId;
    if (typeof userId !== 'string') return false;

    if (!this.limiter.tryConsume(userId)) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many messages, please slow down',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
