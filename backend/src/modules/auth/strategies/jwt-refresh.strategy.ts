import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { REFRESH_COOKIE } from '../auth.constants';

/** Claims of a refresh token: user, session family and a unique token id. */
export interface RefreshTokenPayload {
  sub: string;
  fam: string;
  jti: string;
  exp?: number;
}

export interface RefreshRequestUser {
  userId: string;
  familyId: string;
  refreshToken: string;
}

function readRefreshCookie(req: Request): string | null {
  const value = (req?.cookies as Record<string, unknown> | undefined)?.[
    REFRESH_COOKIE
  ];
  return typeof value === 'string' && value !== '' ? value : null;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(config: ConfigService) {
    super({
      // Extract refresh token from httpOnly cookie (not Authorization header)
      jwtFromRequest: ExtractJwt.fromExtractors([readRefreshCookie]),
      // ! asserts non-null — Joi validation guarantees this exists at startup
      secretOrKey: config.get<string>('jwt.refreshSecret')!,
      algorithms: ['HS256'],
      // `as const` helps TypeScript resolve the StrategyOptionsWithRequest overload
      passReqToCallback: true as const,
    });
  }

  // Called after signature verified — the service then checks the session
  validate(req: Request, payload: RefreshTokenPayload): RefreshRequestUser {
    const refreshToken = readRefreshCookie(req);
    if (!refreshToken || !payload.sub || !payload.fam) {
      throw new UnauthorizedException('Access denied');
    }
    return { userId: payload.sub, familyId: payload.fam, refreshToken };
  }
}
