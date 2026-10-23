import { UserRole } from '../src/modules/users/schemas/user.schema';
import {
  createE2eApp,
  E2eContext,
  PDF_BYTES,
  PNG_BYTES,
  registerUser,
  TestUser,
} from './utils/e2e-app';

describe('Users (e2e) — PATCH /users/me whitelist and uploads', () => {
  let ctx: E2eContext;
  let candidate: TestUser;
  let recruiter: TestUser;

  beforeAll(async () => {
    ctx = await createE2eApp();
    candidate = await registerUser(ctx, UserRole.CANDIDATE);
    recruiter = await registerUser(ctx, UserRole.RECRUITER);
  });

  afterAll(async () => {
    await ctx.close();
  });

  const storedUser = (email: string) =>
    ctx.mongo.collection('users').findOne({ email });

  describe('PATCH /api/users/me (V2-01 regression)', () => {
    it.each([
      ['role', 'recruiter'],
      ['email', 'attacker@example.com'],
      ['password', 'plaintext-password'],
      ['cvKey', 'logos/0b5f8c2e-1d3a-4e5b-9c7d-2a4b6c8d0e1f.png'],
      [
        'avatarUrl',
        'https://bucket.s3.eu-west-3.amazonaws.com/logos/victim-logo.png',
      ],
      ['isEmailVerified', false],
      ['emailVerificationToken', 'x'],
      ['passwordResetToken', 'x'],
      ['refreshToken', 'x'],
    ])(
      'refuses the sensitive field "%s" (400) and changes nothing',
      async (field, value) => {
        const before = await storedUser(candidate.email);

        const res = await candidate.api
          .patch('/api/users/me')
          .set('Authorization', candidate.bearer)
          .send({ headline: 'Should not be saved', [field]: value })
          .expect(400);

        expect(JSON.stringify(res.body)).toContain(
          `property ${field} should not exist`,
        );
        const after = await storedUser(candidate.email);
        expect(after?.role).toBe('candidate');
        expect(after?.email).toBe(candidate.email);
        expect(after?.headline).toEqual(before?.headline);
        expect(after?.password).toBe(before?.password);
      },
    );

    it('updates allowed candidate fields and never returns secrets', async () => {
      const res = await candidate.api
        .patch('/api/users/me')
        .set('Authorization', candidate.bearer)
        .send({
          headline: 'Full-Stack Developer',
          skills: ['NestJS', 'Vue'],
          githubUrl: 'https://github.com/blcoussama',
          experiences: [
            { title: 'Intern', company: 'ACME', startDate: '2025-07-01' },
          ],
        })
        .expect(200);
      const body = res.body as Record<string, unknown>;

      expect(body).toMatchObject({
        headline: 'Full-Stack Developer',
        skills: ['NestJS', 'Vue'],
        hasCv: false,
        role: 'candidate',
      });
      for (const secret of [
        'password',
        'cvKey',
        'emailVerificationToken',
        'passwordResetToken',
        'refreshToken',
      ]) {
        expect(body).not.toHaveProperty(secret);
      }

      const me = await candidate.api
        .get('/api/users/me')
        .set('Authorization', candidate.bearer)
        .expect(200);
      expect((me.body as { headline: string }).headline).toBe(
        'Full-Stack Developer',
      );
    });

    it('validates according to the role: a recruiter cannot set candidate fields', async () => {
      await recruiter.api
        .patch('/api/users/me')
        .set('Authorization', recruiter.bearer)
        .send({ skills: ['NestJS'] })
        .expect(400);

      await recruiter.api
        .patch('/api/users/me')
        .set('Authorization', recruiter.bearer)
        .send({
          companyName: 'ALTEN Maroc',
          companyWebsite: 'https://alten.ma',
        })
        .expect(200);
    });

    it('rejects javascript: URLs, wrong types and non-object bodies', async () => {
      const patch = (body: unknown) =>
        candidate.api
          .patch('/api/users/me')
          .set('Authorization', candidate.bearer)
          .send(body as object);

      await patch({ linkedinUrl: 'javascript:alert(1)' }).expect(400);
      await patch({ isAvailable: 'false' }).expect(400);
      await patch({ firstName: null }).expect(400);
      await patch([{ headline: 'x' }]).expect(400);
    });

    it('401 without an access token', async () => {
      await candidate.api
        .patch('/api/users/me')
        .send({ headline: 'x' })
        .expect(401);
    });
  });

  describe('uploads (multer limits + magic bytes)', () => {
    it('avatar: 400 without file', async () => {
      await candidate.api
        .post('/api/users/me/avatar')
        .set('Authorization', candidate.bearer)
        .expect(400);
    });

    it('avatar: 400 for an SVG/HTML payload declared as image/png', async () => {
      await candidate.api
        .post('/api/users/me/avatar')
        .set('Authorization', candidate.bearer)
        .attach('file', Buffer.from('<svg onload="alert(1)"></svg>'), {
          filename: 'avatar.png',
          contentType: 'image/png',
        })
        .expect(400);
    });

    it('avatar: 413 above 2MB (rejected while streaming)', async () => {
      const big = Buffer.concat([PNG_BYTES, Buffer.alloc(2 * 1024 * 1024)]);

      await candidate.api
        .post('/api/users/me/avatar')
        .set('Authorization', candidate.bearer)
        .attach('file', big, { filename: 'big.png', contentType: 'image/png' })
        .expect(413);
    });

    it('avatar: a real PNG is stored under a server-generated key', async () => {
      const calls = ctx.s3Calls.length;
      const res = await candidate.api
        .post('/api/users/me/avatar')
        .set('Authorization', candidate.bearer)
        .attach('file', PNG_BYTES, {
          filename: 'me.jpg', // declared name/type are ignored
          contentType: 'image/jpeg',
        })
        .expect(201);

      const { avatarUrl } = res.body as { avatarUrl: string };
      expect(avatarUrl).toMatch(/\/avatars\/[0-9a-f-]{36}\.png$/);
      const put = ctx.s3Calls[calls];
      expect(put.name).toBe('PutObjectCommand');
      expect(put.input.ContentType).toBe('image/png');
    });

    it('CV: 403 for a recruiter, 400 for a fake PDF, 201 for a real PDF', async () => {
      await recruiter.api
        .post('/api/users/me/cv')
        .set('Authorization', recruiter.bearer)
        .attach('file', PDF_BYTES, { filename: 'cv.pdf' })
        .expect(403);

      await candidate.api
        .post('/api/users/me/cv')
        .set('Authorization', candidate.bearer)
        .attach('file', PNG_BYTES, {
          filename: 'cv.pdf',
          contentType: 'application/pdf',
        })
        .expect(400);

      await candidate.api
        .post('/api/users/me/cv')
        .set('Authorization', candidate.bearer)
        .attach('file', PDF_BYTES, {
          filename: 'cv.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      const me = await candidate.api
        .get('/api/users/me')
        .set('Authorization', candidate.bearer)
        .expect(200);
      expect((me.body as { hasCv: boolean }).hasCv).toBe(true);

      const url = await candidate.api
        .get('/api/users/me/cv-url')
        .set('Authorization', candidate.bearer)
        .expect(200);
      expect((url.body as { url: string }).url).toContain('X-Amz-Signature=');
    });

    it('CV: 413 above 5MB', async () => {
      const big = Buffer.concat([PDF_BYTES, Buffer.alloc(5 * 1024 * 1024)]);

      await candidate.api
        .post('/api/users/me/cv')
        .set('Authorization', candidate.bearer)
        .attach('file', big, { filename: 'big.pdf' })
        .expect(413);
    });
  });
});
