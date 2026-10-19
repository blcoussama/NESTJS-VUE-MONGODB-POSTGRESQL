import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../src/modules/users/schemas/user.schema';
import { sha256 } from '../src/common/utils/crypto.util';
import {
  client,
  createE2eApp,
  E2eContext,
  rawSetCookie,
  refreshCookie,
  registerUser,
  uniqueEmail,
} from './utils/e2e-app';

interface MessageBody {
  message: string | string[];
}

describe('Auth (e2e) — signup → verify → login → refresh rotation / replay', () => {
  let ctx: E2eContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  const users = () => ctx.mongo.collection('users');
  const sessions = () => ctx.mongo.collection('sessions');

  describe('signup and email verification', () => {
    const api = () => client(ctx.http);

    it('full flow, storing only digests of the tokens', async () => {
      const http = api();
      const email = uniqueEmail('flow');
      const password = 'Str0ngPassword!';

      await http
        .post('/api/auth/signup')
        .send({
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: email.toUpperCase(), // normalised to lowercase
          password,
          role: UserRole.CANDIDATE,
        })
        .expect(201);

      const token = ctx.email.lastToken(email, 'verification');
      const stored = await users().findOne({ email });
      expect(stored?.emailVerificationToken).toBe(sha256(token));
      expect(stored?.emailVerificationToken).not.toBe(token);
      expect(stored?.password).not.toBe(password);

      // Login refused before verification
      await http.post('/api/auth/login').send({ email, password }).expect(401);

      await http
        .post('/api/auth/verify-email')
        .send({ token: 'f'.repeat(64) })
        .expect(400);
      await http.post('/api/auth/verify-email').send({ token }).expect(200);
      // A verification token is single-use
      await http.post('/api/auth/verify-email').send({ token }).expect(400);

      const login = await http
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);
      const body = login.body as {
        accessToken: string;
        user: Record<string, unknown>;
      };
      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.user).toMatchObject({ email, role: 'candidate' });
      expect(body.user).not.toHaveProperty('password');

      const cookie = rawSetCookie(login);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Path=\/api\/auth/);
      expect(cookie).toMatch(/SameSite=Lax/i);

      await http
        .get('/api/users/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);
    });

    it('409 when the email is already used by a verified account', async () => {
      const user = await registerUser(ctx, UserRole.CANDIDATE);

      await client(ctx.http)
        .post('/api/auth/signup')
        .send({
          firstName: 'X',
          lastName: 'Y',
          email: user.email,
          password: 'AnotherPass123',
          role: UserRole.RECRUITER,
        })
        .expect(409);
    });

    it.each([
      ['a password over 72 bytes', 'a'.repeat(73)],
      ['a 40-char password of 2-byte characters (80 bytes)', 'é'.repeat(40)],
      ['a 7-char password', 'Short1!'],
    ])('400 for %s', async (_label, password) => {
      await client(ctx.http)
        .post('/api/auth/signup')
        .send({
          firstName: 'X',
          lastName: 'Y',
          email: uniqueEmail('pwd'),
          password,
          role: UserRole.CANDIDATE,
        })
        .expect(400);
    });

    it('400 for an unknown role and for extra fields (mass assignment)', async () => {
      const base = {
        firstName: 'X',
        lastName: 'Y',
        email: uniqueEmail('role'),
        password: 'Str0ngPassword!',
      };
      await client(ctx.http)
        .post('/api/auth/signup')
        .send({ ...base, role: 'admin' })
        .expect(400);
      await client(ctx.http)
        .post('/api/auth/signup')
        .send({ ...base, role: 'candidate', isEmailVerified: true })
        .expect(400);
    });

    it('400 for NoSQL operator injection in login', async () => {
      await client(ctx.http)
        .post('/api/auth/login')
        .send({ email: { $ne: null }, password: { $ne: null } })
        .expect(400);
    });

    it('resend-verification answers the same for unknown, verified and pending accounts', async () => {
      const verified = await registerUser(ctx, UserRole.CANDIDATE);
      const pendingEmail = uniqueEmail('pending');
      await client(ctx.http)
        .post('/api/auth/signup')
        .send({
          firstName: 'P',
          lastName: 'Q',
          email: pendingEmail,
          password: 'Str0ngPassword!',
          role: UserRole.CANDIDATE,
        })
        .expect(201);

      const answers = await Promise.all(
        [uniqueEmail('nobody'), verified.email, pendingEmail].map((email) =>
          client(ctx.http)
            .post('/api/auth/resend-verification')
            .send({ email })
            .expect(200),
        ),
      );

      const messages = answers.map((r) => (r.body as MessageBody).message);
      expect(new Set(messages).size).toBe(1);
      expect(ctx.email.count(pendingEmail, 'verification')).toBe(2);
      expect(ctx.email.count(verified.email, 'verification')).toBe(1);
    });
  });

  describe('refresh token rotation and replay detection', () => {
    it('rotates on every refresh and revokes the session when an old token is replayed', async () => {
      const user = await registerUser(ctx, UserRole.CANDIDATE);
      const first = user.cookie;

      const r1 = await user.api
        .post('/api/auth/refresh')
        .set('Cookie', first)
        .expect(200);
      const second = refreshCookie(r1);
      expect(second).not.toBe(first);
      expect((r1.body as { accessToken: string }).accessToken).toEqual(
        expect.any(String),
      );

      const r2 = await user.api
        .post('/api/auth/refresh')
        .set('Cookie', second)
        .expect(200);
      const third = refreshCookie(r2);

      // Replay of a token rotated twice ago: theft → whole family revoked
      await user.api.post('/api/auth/refresh').set('Cookie', first).expect(401);
      // …including the latest, legitimate token
      await user.api.post('/api/auth/refresh').set('Cookie', third).expect(401);

      const remaining = await sessions().countDocuments({
        tokenHash: sha256(third.replace('RefreshToken=', '')),
      });
      expect(remaining).toBe(0);
    });

    it('stores only a SHA-256 digest of the refresh token', async () => {
      const user = await registerUser(ctx, UserRole.RECRUITER);
      const token = user.cookie.replace('RefreshToken=', '');

      const session = await sessions().findOne({ tokenHash: sha256(token) });
      expect(session).not.toBeNull();
      const json = JSON.stringify(session);
      expect(json).not.toContain(token);
    });

    it('401 without cookie, with a garbage cookie, or with an ACCESS token as cookie', async () => {
      const user = await registerUser(ctx, UserRole.CANDIDATE);

      await user.api.post('/api/auth/refresh').expect(401);
      await user.api
        .post('/api/auth/refresh')
        .set('Cookie', 'RefreshToken=not-a-jwt')
        .expect(401);
      await user.api
        .post('/api/auth/refresh')
        .set('Cookie', `RefreshToken=${user.accessToken}`)
        .expect(401);
    });

    it('401 for a forged token signed with another secret', async () => {
      const user = await registerUser(ctx, UserRole.CANDIDATE);
      const forged = await new JwtService().signAsync(
        { sub: user.id, fam: 'whatever', jti: 'x' },
        { secret: 'z'.repeat(64), expiresIn: '7d' },
      );

      await user.api
        .post('/api/auth/refresh')
        .set('Cookie', `RefreshToken=${forged}`)
        .expect(401);
    });

    it('two logins = two independent sessions (multi-device)', async () => {
      const user = await registerUser(ctx, UserRole.CANDIDATE);
      const second = await user.api
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);

      await user.api
        .post('/api/auth/refresh')
        .set('Cookie', user.cookie)
        .expect(200);
      await user.api
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookie(second))
        .expect(200);
    });
  });

  describe('logout and password reset', () => {
    it('logout revokes the current session', async () => {
      const user = await registerUser(ctx, UserRole.CANDIDATE);

      await user.api
        .post('/api/auth/logout')
        .set('Authorization', user.bearer)
        .set('Cookie', user.cookie)
        .expect(200);

      await user.api
        .post('/api/auth/refresh')
        .set('Cookie', user.cookie)
        .expect(401);
    });

    it('forgot-password gives the same answer whether the account exists or not', async () => {
      const user = await registerUser(ctx, UserRole.CANDIDATE);
      const known = await client(ctx.http)
        .post('/api/auth/forgot-password')
        .send({ email: user.email })
        .expect(200);
      const unknown = await client(ctx.http)
        .post('/api/auth/forgot-password')
        .send({ email: uniqueEmail('ghost') })
        .expect(200);

      expect(known.body).toEqual(unknown.body);
    });

    it('reset-password invalidates every refresh token and the old password', async () => {
      const user = await registerUser(ctx, UserRole.CANDIDATE);
      const otherDevice = await user.api
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);

      await client(ctx.http)
        .post('/api/auth/forgot-password')
        .send({ email: user.email })
        .expect(200);
      const token = ctx.email.lastToken(user.email, 'reset');
      const stored = await users().findOne({ email: user.email });
      expect(stored?.passwordResetToken).toBe(sha256(token));

      const newPassword = 'An0therStrongOne!';
      await client(ctx.http)
        .post('/api/auth/reset-password')
        .send({ token, newPassword })
        .expect(200);

      // Every session (both devices) is revoked
      for (const cookie of [user.cookie, refreshCookie(otherDevice)]) {
        await user.api
          .post('/api/auth/refresh')
          .set('Cookie', cookie)
          .expect(401);
      }
      // The reset token is single-use
      await client(ctx.http)
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'YetAn0therOne!' })
        .expect(400);

      await user.api
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(401);
      await user.api
        .post('/api/auth/login')
        .send({ email: user.email, password: newPassword })
        .expect(200);
    });
  });
});
