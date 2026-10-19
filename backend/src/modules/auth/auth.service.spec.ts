import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { Response } from 'express';
import { Types } from 'mongoose';

import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { User, UserRole } from '../users/schemas/user.schema';
import { Session } from './schemas/session.schema';
import {
  DUMMY_PASSWORD_HASH,
  MAX_SESSIONS_PER_USER,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  ROTATION_GRACE_MS,
} from './auth.constants';
import { sha256 } from '../../common/utils/crypto.util';

/** Typed access to the arguments of a recorded mock call. */
function arg(mock: jest.Mock, call = 0, index = 0): unknown {
  return (mock.mock.calls as unknown[][])[call][index];
}

// bcrypt is mocked (CPU-heavy); SHA-256 / crypto are REAL in this suite, so
// the refresh-token rotation and replay detection are genuinely exercised.
jest.mock('bcryptjs');

// ─── Helpers ────────────────────────────────────────────────────────────────

const USER_ID = new Types.ObjectId('6710f0c2a1b2c3d4e5f60718');
const ACCESS_SECRET = 'a'.repeat(40);
const REFRESH_SECRET = 'r'.repeat(40);

/** Chainable Mongoose query mock: .select()/.sort()/… then .exec(). */
interface QueryMock {
  select: jest.Mock;
  sort: jest.Mock;
  skip: jest.Mock;
  lean: jest.Mock;
  exec: jest.Mock;
}

function query<T>(value: T): QueryMock {
  const chain = { exec: jest.fn().mockResolvedValue(value) } as QueryMock;
  chain.select = jest.fn().mockReturnValue(chain);
  chain.sort = jest.fn().mockReturnValue(chain);
  chain.skip = jest.fn().mockReturnValue(chain);
  chain.lean = jest.fn().mockReturnValue(chain);
  return chain;
}

function createMockUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: USER_ID,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    password: '$2b$12$hashedpassword',
    role: UserRole.CANDIDATE,
    isEmailVerified: true,
    avatarUrl: null,
    emailVerificationToken: null as string | null,
    emailVerificationExpiry: null as Date | null,
    passwordResetToken: null as string | null,
    passwordResetExpiry: null as Date | null,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockSession(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    userId: USER_ID,
    familyId: 'family-1',
    tokenHash: sha256('current-refresh-token'),
    previousTokenHash: null as string | null,
    rotatedAt: null as Date | null,
    expiresAt: new Date(Date.now() + 86_400_000),
    ...overrides,
  };
}

/** Lets fire-and-forget promises (email dispatch) settle. */
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let module: TestingModule;
  let service: AuthService;

  let userModel: {
    findOne: jest.Mock;
    findById: jest.Mock;
    findOneAndUpdate: jest.Mock;
    deleteOne: jest.Mock;
    create: jest.Mock;
  };
  let sessionModel: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    deleteOne: jest.Mock;
    deleteMany: jest.Mock;
    findOneAndUpdate: jest.Mock;
  };
  let jwtService: {
    signAsync: jest.Mock;
    verifyAsync: jest.Mock;
    decode: jest.Mock;
  };
  let configValues: Record<string, unknown>;
  let emailService: {
    sendVerificationEmail: jest.Mock;
    sendPasswordResetEmail: jest.Mock;
  };
  let mockRes: { cookie: jest.Mock; clearCookie: jest.Mock };
  const res = () => mockRes as unknown as Response;

  beforeEach(async () => {
    userModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      findOneAndUpdate: jest.fn(),
      deleteOne: jest.fn().mockReturnValue(query({ deletedCount: 1 })),
      create: jest.fn().mockResolvedValue(undefined),
    };
    sessionModel = {
      findOne: jest.fn(),
      find: jest.fn().mockReturnValue(query([])),
      create: jest.fn().mockResolvedValue(undefined),
      deleteOne: jest.fn().mockReturnValue(query({ deletedCount: 1 })),
      deleteMany: jest.fn().mockReturnValue(query({ deletedCount: 0 })),
      findOneAndUpdate: jest.fn(),
    };
    jwtService = {
      signAsync: jest
        .fn()
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token'),
      verifyAsync: jest.fn(),
      decode: jest
        .fn()
        .mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 604_800 }),
    };
    configValues = {
      'jwt.accessSecret': ACCESS_SECRET,
      'jwt.refreshSecret': REFRESH_SECRET,
      'jwt.accessExpiry': '15m',
      'jwt.refreshExpiry': '7d',
      'cookies.secure': false,
    };
    emailService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };
    mockRes = { cookie: jest.fn(), clearCookie: jest.fn() };

    module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Session.name), useValue: sessionModel },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => configValues[key]) },
        },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get(AuthService);

    (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$hashedpassword');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
  });

  // ─── signup ───────────────────────────────────────────────────────────────

  describe('signup', () => {
    const dto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'Password123!',
      role: UserRole.CANDIDATE,
    };

    it('throws ConflictException if a verified account uses the email', async () => {
      userModel.findOne.mockReturnValue(query(createMockUser()));

      await expect(service.signup(dto)).rejects.toThrow(ConflictException);
      expect(userModel.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException if an unverified account is still within its verification window', async () => {
      userModel.findOne.mockReturnValue(
        query(
          createMockUser({
            isEmailVerified: false,
            emailVerificationExpiry: new Date(Date.now() + 3_600_000),
          }),
        ),
      );

      await expect(service.signup(dto)).rejects.toThrow(ConflictException);
    });

    it('releases an abandoned unverified account (expired link) instead of blocking the email', async () => {
      userModel.findOne.mockReturnValue(
        query(
          createMockUser({
            isEmailVerified: false,
            emailVerificationExpiry: new Date(Date.now() - 1000),
          }),
        ),
      );

      await service.signup(dto);

      expect(userModel.deleteOne).toHaveBeenCalledWith({
        _id: USER_ID,
        isEmailVerified: false,
      });
      expect(userModel.create).toHaveBeenCalled();
    });

    it('hashes the password with bcrypt (cost 12)', async () => {
      userModel.findOne.mockReturnValue(query(null));

      await service.signup(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 12);
    });

    it('stores only the SHA-256 digest of the verification token and emails the raw token', async () => {
      userModel.findOne.mockReturnValue(query(null));

      await service.signup(dto);

      const [, rawToken] = emailService.sendVerificationEmail.mock.calls[0] as [
        string,
        string,
      ];
      const created = arg(userModel.create, 0, 0) as Record<string, unknown>;
      expect(rawToken).toMatch(/^[a-f0-9]{64}$/);
      expect(created.emailVerificationToken).toBe(sha256(rawToken));
      expect(created.emailVerificationToken).not.toBe(rawToken);
      expect(created.emailVerificationExpiry).toBeInstanceOf(Date);
      expect(created.password).toBe('$2b$12$hashedpassword');
    });

    it('does not fail the signup when the SMTP server is unreachable', async () => {
      userModel.findOne.mockReturnValue(query(null));
      emailService.sendVerificationEmail.mockRejectedValue(
        new Error('ECONNREFUSED'),
      );

      await expect(service.signup(dto)).resolves.toEqual({
        message: 'Account created. Check your email to verify your account.',
      });
      await flushPromises();
    });
  });

  // ─── verifyEmail ──────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    const token = 'ab'.repeat(32);

    it('throws BadRequestException if the token is invalid or expired', async () => {
      userModel.findOneAndUpdate.mockReturnValue(query(null));

      await expect(service.verifyEmail({ token })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('looks the user up by the token digest and clears the token atomically', async () => {
      userModel.findOneAndUpdate.mockReturnValue(query(createMockUser()));

      const result = await service.verifyEmail({ token });

      const [filter, update] = userModel.findOneAndUpdate.mock.calls[0] as [
        Record<string, unknown>,
        { $set: Record<string, unknown> },
      ];
      expect(filter.emailVerificationToken).toBe(sha256(token));
      expect(update.$set).toEqual({
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      });
      expect(result).toEqual({
        message: 'Email verified successfully. You can now log in.',
      });
    });
  });

  // ─── resendVerification ───────────────────────────────────────────────────

  describe('resendVerification', () => {
    it('returns the generic message for an unknown email (no email sent)', async () => {
      userModel.findOne.mockReturnValue(query(null));

      const result = await service.resendVerification({
        email: 'nobody@example.com',
      });

      expect(result.message).toMatch(/If this account exists/);
      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('returns the same message for an already verified account (no email sent)', async () => {
      userModel.findOne.mockReturnValue(query(createMockUser()));

      const result = await service.resendVerification({
        email: 'john@example.com',
      });

      expect(result.message).toMatch(/If this account exists/);
      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('issues a new hashed token for an unverified account', async () => {
      const user = createMockUser({ isEmailVerified: false });
      userModel.findOne.mockReturnValue(query(user));

      await service.resendVerification({ email: 'john@example.com' });

      const [, rawToken] = emailService.sendVerificationEmail.mock.calls[0] as [
        string,
        string,
      ];
      expect(user.emailVerificationToken).toBe(sha256(rawToken));
      expect(user.save).toHaveBeenCalled();
    });
  });

  // ─── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    const dto = { email: 'john@example.com', password: 'Password123!' };

    it('throws 401 for an unknown email but still runs bcrypt (constant time)', async () => {
      userModel.findOne.mockReturnValue(query(null));

      await expect(service.login(dto, res())).rejects.toThrow(
        UnauthorizedException,
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'Password123!',
        DUMMY_PASSWORD_HASH,
      );
    });

    it('throws 401 if the password is wrong', async () => {
      userModel.findOne.mockReturnValue(query(createMockUser()));
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(service.login(dto, res())).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('throws 401 if the email is not verified', async () => {
      userModel.findOne.mockReturnValue(
        query(createMockUser({ isEmailVerified: false })),
      );

      await expect(service.login(dto, res())).rejects.toThrow(
        'Please verify your email before logging in',
      );
    });

    it('selects the password hash explicitly (select: false in the schema)', async () => {
      const chain = query(createMockUser());
      userModel.findOne.mockReturnValue(chain);

      await service.login(dto, res());

      expect(chain.select).toHaveBeenCalledWith('+password');
    });

    it('returns the access token and public user data only', async () => {
      userModel.findOne.mockReturnValue(query(createMockUser()));

      const result = await service.login(dto, res());

      expect(result).toEqual({
        accessToken: 'access-token',
        user: {
          id: USER_ID,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          role: UserRole.CANDIDATE,
          avatarUrl: null,
        },
      });
    });

    it('creates a session storing the SHA-256 of the refresh token (never the token)', async () => {
      userModel.findOne.mockReturnValue(query(createMockUser()));

      await service.login(dto, res());

      const session = arg(sessionModel.create, 0, 0) as Record<string, unknown>;
      expect(session.userId).toBe(USER_ID);
      expect(session.tokenHash).toBe(sha256('refresh-token'));
      expect(typeof session.familyId).toBe('string');
      expect(session.expiresAt).toBeInstanceOf(Date);
    });

    it('signs a refresh token carrying the family id and a unique jti', async () => {
      userModel.findOne.mockReturnValue(query(createMockUser()));

      await service.login(dto, res());

      const refreshPayload = arg(jwtService.signAsync, 1, 0) as Record<
        string,
        unknown
      >;
      const session = arg(sessionModel.create, 0, 0) as Record<string, unknown>;
      expect(refreshPayload.sub).toBe(USER_ID.toString());
      expect(refreshPayload.fam).toBe(session.familyId);
      expect(typeof refreshPayload.jti).toBe('string');
    });

    it('sets an httpOnly, sameSite=lax cookie scoped to /api/auth', async () => {
      userModel.findOne.mockReturnValue(query(createMockUser()));

      await service.login(dto, res());

      expect(mockRes.cookie).toHaveBeenCalledWith(
        REFRESH_COOKIE,
        'refresh-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: REFRESH_COOKIE_PATH,
          secure: false,
        }),
      );
    });

    it('marks the cookie secure when cookies.secure is enabled (production)', async () => {
      configValues['cookies.secure'] = true;
      userModel.findOne.mockReturnValue(query(createMockUser()));

      await service.login(dto, res());

      expect(mockRes.cookie).toHaveBeenCalledWith(
        REFRESH_COOKIE,
        'refresh-token',
        expect.objectContaining({ secure: true }),
      );
    });

    it(`revokes sessions beyond the ${MAX_SESSIONS_PER_USER} most recent`, async () => {
      userModel.findOne.mockReturnValue(query(createMockUser()));
      const stale = [{ _id: 'old-1' }, { _id: 'old-2' }];
      const findChain = query(stale);
      sessionModel.find.mockReturnValue(findChain);

      await service.login(dto, res());

      expect(findChain.skip).toHaveBeenCalledWith(MAX_SESSIONS_PER_USER);
      expect(sessionModel.deleteMany).toHaveBeenCalledWith({
        _id: { $in: ['old-1', 'old-2'] },
      });
    });
  });

  // ─── refresh ──────────────────────────────────────────────────────────────

  describe('refresh', () => {
    beforeEach(() => {
      userModel.findById.mockReturnValue(query(createMockUser()));
      sessionModel.findOneAndUpdate.mockReturnValue(query(createMockSession()));
    });

    it('throws 401 if the session does not exist (logged out / revoked)', async () => {
      sessionModel.findOne.mockReturnValue(query(null));

      await expect(
        service.refresh(
          USER_ID.toString(),
          'family-1',
          'current-refresh-token',
          res(),
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockRes.clearCookie).toHaveBeenCalled();
    });

    it('throws 401 if the session is expired', async () => {
      sessionModel.findOne.mockReturnValue(
        query(createMockSession({ expiresAt: new Date(Date.now() - 1) })),
      );

      await expect(
        service.refresh(
          USER_ID.toString(),
          'family-1',
          'current-refresh-token',
          res(),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rotates the token: compare-and-swap on the current digest, new cookie, new access token', async () => {
      const session = createMockSession();
      sessionModel.findOne.mockReturnValue(query(session));

      const result = await service.refresh(
        USER_ID.toString(),
        'family-1',
        'current-refresh-token',
        res(),
      );

      expect(result).toEqual({ accessToken: 'access-token' });
      const [filter, update] = sessionModel.findOneAndUpdate.mock.calls[0] as [
        Record<string, unknown>,
        { $set: Record<string, unknown> },
      ];
      expect(filter).toEqual({
        _id: session._id,
        tokenHash: sha256('current-refresh-token'),
      });
      expect(update.$set.tokenHash).toBe(sha256('refresh-token'));
      expect(update.$set.previousTokenHash).toBe(
        sha256('current-refresh-token'),
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        REFRESH_COOKIE,
        'refresh-token',
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('detects the replay of an already rotated token and revokes the whole session', async () => {
      const session = createMockSession({
        tokenHash: sha256('newer-token'),
        previousTokenHash: sha256('older-token'),
        rotatedAt: new Date(Date.now() - ROTATION_GRACE_MS - 1000),
      });
      sessionModel.findOne.mockReturnValue(query(session));

      await expect(
        service.refresh(USER_ID.toString(), 'family-1', 'older-token', res()),
      ).rejects.toThrow(UnauthorizedException);
      expect(sessionModel.deleteOne).toHaveBeenCalledWith({
        _id: session._id,
      });
      expect(sessionModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('tolerates a concurrent refresh (just-rotated token within the grace window): 401 but session kept', async () => {
      sessionModel.findOne.mockReturnValue(
        query(
          createMockSession({
            tokenHash: sha256('newer-token'),
            previousTokenHash: sha256('older-token'),
            rotatedAt: new Date(),
          }),
        ),
      );

      await expect(
        service.refresh(USER_ID.toString(), 'family-1', 'older-token', res()),
      ).rejects.toThrow(UnauthorizedException);
      expect(sessionModel.deleteOne).not.toHaveBeenCalled();
    });

    it('throws 401 if a concurrent refresh won the compare-and-swap', async () => {
      sessionModel.findOne.mockReturnValue(query(createMockSession()));
      sessionModel.findOneAndUpdate.mockReturnValue(query(null));

      await expect(
        service.refresh(
          USER_ID.toString(),
          'family-1',
          'current-refresh-token',
          res(),
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockRes.cookie).not.toHaveBeenCalled();
    });

    it('revokes the session if the user no longer exists', async () => {
      const session = createMockSession();
      sessionModel.findOne.mockReturnValue(query(session));
      userModel.findById.mockReturnValue(query(null));

      await expect(
        service.refresh(
          USER_ID.toString(),
          'family-1',
          'current-refresh-token',
          res(),
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(sessionModel.deleteOne).toHaveBeenCalledWith({
        _id: session._id,
      });
    });

    it('distinguishes two REAL refresh tokens of the same user (regression: bcrypt 72-byte truncation)', async () => {
      // Real JWTs signed in the same second share a long common prefix
      // (header + sub). bcrypt only compared their first 72 bytes and
      // considered them equal; the SHA-256 digests must differ.
      const realJwt = new JwtService();
      const sign = (jti: string) =>
        realJwt.signAsync(
          { sub: USER_ID.toString(), fam: 'family-1', jti },
          { secret: REFRESH_SECRET, expiresIn: '7d' },
        );
      const [older, newer] = await Promise.all([sign('jti-1'), sign('jti-2')]);
      expect(older.slice(0, 72)).toBe(newer.slice(0, 72));

      const session = createMockSession({
        tokenHash: sha256(newer),
        previousTokenHash: sha256(older),
        rotatedAt: new Date(Date.now() - ROTATION_GRACE_MS - 1000),
      });
      sessionModel.findOne.mockReturnValue(query(session));

      await expect(
        service.refresh(USER_ID.toString(), 'family-1', older, res()),
      ).rejects.toThrow(UnauthorizedException);
      expect(sessionModel.deleteOne).toHaveBeenCalled();
    });
  });

  // ─── logout ───────────────────────────────────────────────────────────────

  describe('logout', () => {
    it("revokes the session of the cookie's token family", async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: USER_ID.toString(),
        fam: 'family-1',
        jti: 'x',
      });

      const result = await service.logout(
        USER_ID.toString(),
        'cookie-token',
        res(),
      );

      expect(sessionModel.deleteOne).toHaveBeenCalledWith({
        familyId: 'family-1',
        userId: USER_ID.toString(),
      });
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it("does not revoke a session belonging to another user's token", async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'another-user',
        fam: 'family-x',
        jti: 'x',
      });

      await service.logout(USER_ID.toString(), 'cookie-token', res());

      expect(sessionModel.deleteOne).not.toHaveBeenCalled();
    });

    it('ignores an invalid or expired cookie and still clears it', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await service.logout(USER_ID.toString(), 'bad-token', res());

      expect(sessionModel.deleteOne).not.toHaveBeenCalled();
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        REFRESH_COOKIE,
        expect.objectContaining({ path: REFRESH_COOKIE_PATH }),
      );
    });

    it('works without any refresh cookie', async () => {
      await service.logout(USER_ID.toString(), undefined, res());

      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
      expect(mockRes.clearCookie).toHaveBeenCalled();
    });
  });

  // ─── forgotPassword ───────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    const generic = {
      message: 'If this email exists, a reset link has been sent.',
    };

    it('returns the same message for an unknown email and sends nothing', async () => {
      userModel.findOne.mockReturnValue(query(null));

      await expect(
        service.forgotPassword({ email: 'unknown@example.com' }),
      ).resolves.toEqual(generic);
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('stores the SHA-256 of the reset token with a 1h expiry', async () => {
      const user = createMockUser();
      userModel.findOne.mockReturnValue(query(user));

      await service.forgotPassword({ email: 'john@example.com' });

      const [, rawToken] = emailService.sendPasswordResetEmail.mock
        .calls[0] as [string, string];
      expect(user.passwordResetToken).toBe(sha256(rawToken));
      const expiry = user.passwordResetExpiry as unknown as Date;
      expect(expiry.getTime()).toBeGreaterThan(Date.now() + 3_500_000);
      expect(user.save).toHaveBeenCalled();
    });

    it('returns the generic message even if the email cannot be sent', async () => {
      userModel.findOne.mockReturnValue(query(createMockUser()));
      emailService.sendPasswordResetEmail.mockRejectedValue(new Error('SMTP'));

      await expect(
        service.forgotPassword({ email: 'john@example.com' }),
      ).resolves.toEqual(generic);
      await flushPromises();
    });
  });

  // ─── resetPassword ────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    const dto = { token: 'cd'.repeat(32), newPassword: 'NewPass123!' };

    it('throws BadRequestException if the token is invalid or expired', async () => {
      userModel.findOne.mockReturnValue(query(null));

      await expect(service.resetPassword(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('looks the user up by token digest, hashes the new password and clears the token', async () => {
      const user = createMockUser({
        passwordResetToken: sha256(dto.token),
        passwordResetExpiry: new Date(Date.now() + 3_600_000),
      });
      userModel.findOne.mockReturnValue(query(user));

      await service.resetPassword(dto);

      const filter = arg(userModel.findOne, 0, 0) as Record<string, unknown>;
      expect(filter.passwordResetToken).toBe(sha256(dto.token));
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPass123!', 12);
      expect(user.passwordResetToken).toBeNull();
      expect(user.passwordResetExpiry).toBeNull();
      expect(user.save).toHaveBeenCalled();
    });

    it('revokes every session of the user (all refresh tokens invalid)', async () => {
      userModel.findOne.mockReturnValue(query(createMockUser()));

      const result = await service.resetPassword(dto);

      expect(sessionModel.deleteMany).toHaveBeenCalledWith({
        userId: USER_ID,
      });
      expect(result).toEqual({
        message: 'Password reset successfully. Please log in.',
      });
    });
  });
});
