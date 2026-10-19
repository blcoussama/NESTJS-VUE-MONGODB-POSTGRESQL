import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { CookieOptions, Response } from 'express';
import type { StringValue } from 'ms';

import { User, UserDocument } from '../users/schemas/user.schema';
import { Session, SessionDocument } from './schemas/session.schema';
import { EmailService } from './email.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import type { RefreshTokenPayload } from './strategies/jwt-refresh.strategy';
import {
  BCRYPT_COST,
  DUMMY_PASSWORD_HASH,
  EMAIL_VERIFICATION_TTL_MS,
  GENERIC_RESEND_MESSAGE,
  GENERIC_RESET_MESSAGE,
  MAX_SESSIONS_PER_USER,
  PASSWORD_RESET_TTL_MS,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  ROTATION_GRACE_MS,
} from './auth.constants';
import {
  randomToken,
  safeEqualHex,
  sha256,
} from '../../common/utils/crypto.util';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type TokenSubject = Pick<User, 'email' | 'role'> & { _id: Types.ObjectId };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private jwtService: JwtService,
    private config: ConfigService,
    private emailService: EmailService,
  ) {}

  // ─── Signup ───────────────────────────────────────────────────────────────

  async signup(dto: SignupDto) {
    const existing = await this.userModel.findOne({ email: dto.email }).exec();

    if (existing) {
      // An unverified account whose verification link expired is released:
      // nobody can "squat" an email address they do not control.
      const expiry = existing.emailVerificationExpiry;
      const abandoned =
        !existing.isEmailVerified && (!expiry || expiry < new Date());
      if (!abandoned) throw new ConflictException('Email already in use');
      await this.userModel
        .deleteOne({ _id: existing._id, isEmailVerified: false })
        .exec();
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_COST);
    const verificationToken = randomToken();

    await this.userModel.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      password: hashedPassword,
      role: dto.role,
      emailVerificationToken: sha256(verificationToken),
      emailVerificationExpiry: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    });

    this.dispatchEmail('verification', () =>
      this.emailService.sendVerificationEmail(dto.email, verificationToken),
    );

    return {
      message: 'Account created. Check your email to verify your account.',
    };
  }

  // ─── Verify Email ─────────────────────────────────────────────────────────

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.userModel
      .findOneAndUpdate(
        {
          emailVerificationToken: sha256(dto.token),
          emailVerificationExpiry: { $gt: new Date() },
        },
        {
          $set: {
            isEmailVerified: true,
            emailVerificationToken: null,
            emailVerificationExpiry: null,
          },
        },
      )
      .exec();

    if (!user)
      throw new BadRequestException('Invalid or expired verification token');

    return { message: 'Email verified successfully. You can now log in.' };
  }

  // ─── Resend verification email ────────────────────────────────────────────

  async resendVerification(dto: ResendVerificationDto) {
    const user = await this.userModel.findOne({ email: dto.email }).exec();

    // Same answer whether the account exists, is verified or not
    if (!user || user.isEmailVerified)
      return { message: GENERIC_RESEND_MESSAGE };

    const verificationToken = randomToken();
    user.emailVerificationToken = sha256(verificationToken);
    user.emailVerificationExpiry = new Date(
      Date.now() + EMAIL_VERIFICATION_TTL_MS,
    );
    await user.save();

    this.dispatchEmail('verification', () =>
      this.emailService.sendVerificationEmail(user.email, verificationToken),
    );

    return { message: GENERIC_RESEND_MESSAGE };
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(dto: LoginDto, res: Response) {
    const user = await this.userModel
      .findOne({ email: dto.email })
      .select('+password')
      .exec();

    // Always run bcrypt, even for an unknown email: same response time
    const passwordMatch = await bcrypt.compare(
      dto.password,
      user?.password ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !passwordMatch)
      throw new UnauthorizedException('Invalid credentials');

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in',
      );
    }

    const accessToken = await this.startSession(user, res);

    return {
      accessToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl ?? null,
      },
    };
  }

  // ─── Refresh Token (rotation + replay detection) ──────────────────────────

  async refresh(
    userId: string,
    familyId: string,
    refreshToken: string,
    res: Response,
  ) {
    const session = await this.sessionModel
      .findOne({ familyId, userId })
      .exec();
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      this.clearRefreshTokenCookie(res);
      throw new UnauthorizedException('Access denied');
    }

    const presentedHash = sha256(refreshToken);

    if (!safeEqualHex(presentedHash, session.tokenHash)) {
      const benignRace =
        session.previousTokenHash !== null &&
        safeEqualHex(presentedHash, session.previousTokenHash) &&
        session.rotatedAt !== null &&
        Date.now() - session.rotatedAt.getTime() < ROTATION_GRACE_MS;

      if (!benignRace) {
        // A token of this family was already rotated: it has been stolen or
        // replayed. Revoke the whole family (attacker AND victim sessions).
        await this.sessionModel.deleteOne({ _id: session._id }).exec();
        this.logger.warn(
          `Refresh token reuse detected — session revoked (user ${userId})`,
        );
      }
      this.clearRefreshTokenCookie(res);
      throw new UnauthorizedException('Access denied');
    }

    const user = await this.userModel
      .findById(userId)
      .select('email role')
      .exec();
    if (!user) {
      await this.sessionModel.deleteOne({ _id: session._id }).exec();
      this.clearRefreshTokenCookie(res);
      throw new UnauthorizedException('Access denied');
    }

    const tokens = await this.generateTokens(user, familyId);
    const expiresAt = this.tokenExpiry(tokens.refreshToken);

    // Compare-and-swap: only one concurrent refresh can rotate a given token
    const rotated = await this.sessionModel
      .findOneAndUpdate(
        { _id: session._id, tokenHash: session.tokenHash },
        {
          $set: {
            tokenHash: sha256(tokens.refreshToken),
            previousTokenHash: session.tokenHash,
            rotatedAt: new Date(),
            expiresAt,
          },
        },
      )
      .exec();
    if (!rotated) throw new UnauthorizedException('Access denied');

    this.setRefreshTokenCookie(res, tokens.refreshToken, expiresAt);
    return { accessToken: tokens.accessToken };
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  async logout(
    userId: string,
    refreshToken: string | undefined,
    res: Response,
  ) {
    if (refreshToken) {
      const payload = await this.verifyRefreshToken(refreshToken);
      if (payload && payload.sub === userId && payload.fam) {
        await this.sessionModel
          .deleteOne({ familyId: payload.fam, userId })
          .exec();
      }
    }
    this.clearRefreshTokenCookie(res);
    return { message: 'Logged out successfully' };
  }

  // ─── Forgot Password ──────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userModel.findOne({ email: dto.email }).exec();

    // Always return the same message — don't reveal if email exists
    if (!user) return { message: GENERIC_RESET_MESSAGE };

    const resetToken = randomToken();
    user.passwordResetToken = sha256(resetToken);
    user.passwordResetExpiry = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await user.save();

    // Not awaited: SMTP latency must not reveal whether the account exists
    this.dispatchEmail('password reset', () =>
      this.emailService.sendPasswordResetEmail(user.email, resetToken),
    );

    return { message: GENERIC_RESET_MESSAGE };
  }

  // ─── Reset Password ───────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.userModel
      .findOne({
        passwordResetToken: sha256(dto.token),
        passwordResetExpiry: { $gt: new Date() },
      })
      .exec();

    if (!user) throw new BadRequestException('Invalid or expired reset token');

    user.password = await bcrypt.hash(dto.newPassword, BCRYPT_COST);
    user.passwordResetToken = null;
    user.passwordResetExpiry = null;
    await user.save();

    // Invalidate every refresh token of this user (all devices)
    await this.sessionModel.deleteMany({ userId: user._id }).exec();

    return { message: 'Password reset successfully. Please log in.' };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /** Creates a new session (token family) and sets the refresh cookie. */
  private async startSession(
    user: TokenSubject,
    res: Response,
  ): Promise<string> {
    const familyId = randomUUID();
    const tokens = await this.generateTokens(user, familyId);
    const expiresAt = this.tokenExpiry(tokens.refreshToken);

    await this.sessionModel.create({
      userId: user._id,
      familyId,
      tokenHash: sha256(tokens.refreshToken),
      expiresAt,
    });
    await this.pruneSessions(user._id.toString());

    this.setRefreshTokenCookie(res, tokens.refreshToken, expiresAt);
    return tokens.accessToken;
  }

  /** Keeps only the MAX_SESSIONS_PER_USER most recent sessions. */
  private async pruneSessions(userId: string): Promise<void> {
    const stale = await this.sessionModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(MAX_SESSIONS_PER_USER)
      .select('_id')
      .lean()
      .exec();
    if (stale.length > 0) {
      await this.sessionModel
        .deleteMany({ _id: { $in: stale.map((s) => s._id) } })
        .exec();
    }
  }

  private async generateTokens(user: TokenSubject, familyId: string) {
    const userId = user._id.toString();
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email: user.email, role: user.role },
        {
          secret: this.config.get<string>('jwt.accessSecret'),
          expiresIn: this.config.get<StringValue>('jwt.accessExpiry'),
        },
      ),
      this.jwtService.signAsync(
        // jti makes every refresh token unique, even within the same second
        { sub: userId, fam: familyId, jti: randomUUID() },
        {
          secret: this.config.get<string>('jwt.refreshSecret'),
          expiresIn: this.config.get<StringValue>('jwt.refreshExpiry'),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(
    token: string,
  ): Promise<RefreshTokenPayload | null> {
    try {
      return await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.get<string>('jwt.refreshSecret'),
        algorithms: ['HS256'],
      });
    } catch {
      return null;
    }
  }

  /** Expiry date of a signed token (from its `exp` claim). */
  private tokenExpiry(token: string): Date {
    const decoded = this.jwtService.decode<{ exp?: number } | null>(token);
    if (decoded && typeof decoded.exp === 'number') {
      return new Date(decoded.exp * 1000);
    }
    return new Date(Date.now() + SEVEN_DAYS_MS);
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true, // Not accessible from JS — prevents XSS token theft
      secure: this.config.get<boolean>('cookies.secure') === true,
      sameSite: 'lax', // Not sent on cross-site POSTs (CSRF)
      path: REFRESH_COOKIE_PATH, // Only sent to /api/auth/*
    };
  }

  private setRefreshTokenCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(REFRESH_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
    });
  }

  private clearRefreshTokenCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  /** Sends an email in the background; failures are logged, never thrown. */
  private dispatchEmail(kind: string, send: () => Promise<void>): void {
    send().catch(() => {
      this.logger.error(`Failed to send ${kind} email`);
    });
  }
}
