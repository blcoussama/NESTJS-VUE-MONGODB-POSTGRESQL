import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import type { JwtPayload } from '../auth/strategies/jwt-access.strategy';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { MAX_TOKEN_LENGTH } from './chat.constants';
import { ChatUser } from './chat.types';
import { isObjectIdString } from './utils/object-id.util';

const USER_ROLES: readonly string[] = Object.values(UserRole);

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLES.includes(value);
}

/**
 * Authenticates a Socket.io handshake with the JWT access token, using the
 * same secret as JwtAccessStrategy. Returns null for every failure (missing,
 * malformed, bad signature, expired, unknown user) so callers cannot leak
 * which check failed.
 */
@Injectable()
export class ChatSocketAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async authenticate(rawToken: unknown): Promise<ChatUser | null> {
    const token = this.extractToken(rawToken);
    const secret = this.config.get<string>('jwt.accessSecret');
    if (!token || !secret) return null;

    let payload: Partial<JwtPayload>;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret,
        algorithms: ['HS256'],
      });
    } catch {
      return null;
    }

    const { sub, role } = payload;
    if (!isObjectIdString(sub) || !isUserRole(role)) return null;

    // The account must still exist with the role carried by the token
    const exists = await this.userModel.exists({ _id: sub, role }).exec();
    if (!exists) return null;

    return { userId: sub, role };
  }

  // Accepts the raw token (contract) or a "Bearer <token>" string
  private extractToken(rawToken: unknown): string | null {
    if (typeof rawToken !== 'string') return null;
    const token = rawToken.startsWith('Bearer ')
      ? rawToken.slice('Bearer '.length).trim()
      : rawToken.trim();
    if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;
    return token;
  }
}
