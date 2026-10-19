import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { Types } from 'mongoose';

import { UserDocument, UserRole } from '../users/schemas/user.schema';
import { ChatSocketAuthService } from './chat-socket-auth.service';
import { Model } from 'mongoose';

describe('ChatSocketAuthService', () => {
  const accessSecret = randomBytes(32).toString('hex');
  const jwt = new JwtService();
  const userId = new Types.ObjectId().toHexString();

  let service: ChatSocketAuthService;
  let userModel: { exists: jest.Mock };
  let config: { get: jest.Mock };

  const sign = (payload: object, secret = accessSecret, expiresIn = 900) =>
    jwt.sign(payload, { secret, expiresIn });

  beforeEach(() => {
    userModel = {
      exists: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(userId) }),
      }),
    };
    config = {
      get: jest
        .fn()
        .mockImplementation((key: string) =>
          key === 'jwt.accessSecret' ? accessSecret : undefined,
        ),
    };
    service = new ChatSocketAuthService(
      jwt,
      config as unknown as ConfigService,
      userModel as unknown as Model<UserDocument>,
    );
  });

  it('accepts a valid access token and returns the user', async () => {
    const token = sign({
      sub: userId,
      email: 'a@b.c',
      role: UserRole.CANDIDATE,
    });

    await expect(service.authenticate(token)).resolves.toEqual({
      userId,
      role: UserRole.CANDIDATE,
    });
    expect(userModel.exists).toHaveBeenCalledWith({
      _id: userId,
      role: UserRole.CANDIDATE,
    });
  });

  it('accepts a "Bearer <token>" value', async () => {
    const token = sign({
      sub: userId,
      email: 'a@b.c',
      role: UserRole.RECRUITER,
    });

    await expect(service.authenticate(`Bearer ${token}`)).resolves.toEqual({
      userId,
      role: UserRole.RECRUITER,
    });
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['a number', 123],
    ['an object', { token: 'x' }],
    ['empty', '   '],
    ['too long', 'a'.repeat(5000)],
    ['malformed', 'not-a-jwt'],
  ])(
    'rejects a %s token without touching the database',
    async (_label, token) => {
      await expect(service.authenticate(token)).resolves.toBeNull();
      expect(userModel.exists).not.toHaveBeenCalled();
    },
  );

  it('rejects a token signed with another secret (e.g. the refresh secret)', async () => {
    const token = sign(
      { sub: userId, role: UserRole.CANDIDATE },
      randomBytes(32).toString('hex'),
    );

    await expect(service.authenticate(token)).resolves.toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = jwt.sign(
      {
        sub: userId,
        role: UserRole.CANDIDATE,
        exp: Math.floor(Date.now() / 1000) - 10,
      },
      { secret: accessSecret },
    );

    await expect(service.authenticate(token)).resolves.toBeNull();
  });

  it('rejects an unsigned ("alg: none") token', async () => {
    const encode = (part: object) =>
      Buffer.from(JSON.stringify(part)).toString('base64url');
    const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: userId, role: 'candidate' })}.`;

    await expect(service.authenticate(token)).resolves.toBeNull();
  });

  it.each([
    ['no sub (refresh-like payload)', { role: UserRole.CANDIDATE }],
    ['a non-ObjectId sub', { sub: 'admin', role: UserRole.CANDIDATE }],
    ['no role', { sub: userId }],
    ['an unknown role', { sub: userId, role: 'admin' }],
  ])('rejects a payload with %s', async (_label, payload) => {
    await expect(service.authenticate(sign(payload))).resolves.toBeNull();
    expect(userModel.exists).not.toHaveBeenCalled();
  });

  it('rejects a token whose user no longer exists', async () => {
    userModel.exists.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.authenticate(sign({ sub: userId, role: UserRole.CANDIDATE })),
    ).resolves.toBeNull();
  });

  it('rejects everything when the access secret is not configured', async () => {
    const token = sign({ sub: userId, role: UserRole.CANDIDATE });
    config.get.mockReturnValue(undefined);

    await expect(service.authenticate(token)).resolves.toBeNull();
  });
});
