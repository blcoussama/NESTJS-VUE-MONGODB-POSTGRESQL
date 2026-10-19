import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * For public routes that personalise their response when a valid access
 * token is present (e.g. GET /jobs/:id → isSaved, hasApplied).
 * Missing, invalid or expired token → anonymous request (req.user = null).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt-access') {
  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    return (user || null) as TUser;
  }
}
