import { AUTH_THROTTLE } from '../src/common/throttle/throttle.constants';
import { client, createE2eApp, E2eContext, uniqueEmail } from './utils/e2e-app';

describe('Rate limiting (e2e)', () => {
  let ctx: E2eContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it(`login: ${AUTH_THROTTLE.login.ip.limit} attempts per minute per IP, then 429 (other IPs unaffected)`, async () => {
    const attacker = client(ctx.http);
    const attempt = () =>
      attacker
        .post('/api/auth/login')
        .send({ email: uniqueEmail('brute'), password: 'wrong-password' });

    for (let i = 0; i < AUTH_THROTTLE.login.ip.limit; i++) {
      await attempt().expect(401);
    }
    const blocked = await attempt().expect(429);

    expect(blocked.body).toEqual({
      statusCode: 429,
      message: 'Too many requests, please try again later.',
      error: 'Too Many Requests',
    });
    expect(blocked.headers['retry-after']).toBeDefined();

    await client(ctx.http)
      .post('/api/auth/login')
      .send({ email: uniqueEmail('legit'), password: 'whatever-password' })
      .expect(401);
  });

  it(`login: ${AUTH_THROTTLE.login.account.limit} attempts per 15 min per targeted account, even from many IPs`, async () => {
    const victim = uniqueEmail('victim');
    for (let i = 0; i < AUTH_THROTTLE.login.account.limit; i++) {
      await client(ctx.http)
        .post('/api/auth/login')
        .send({ email: victim, password: `guess-${i}-password` })
        .expect(401);
    }
    await client(ctx.http)
      .post('/api/auth/login')
      .send({ email: victim.toUpperCase(), password: 'another-guess' })
      .expect(429);
  });

  it('forgot-password: email bombing of one address is limited across IPs', async () => {
    const target = uniqueEmail('bombed');
    for (let i = 0; i < AUTH_THROTTLE.forgotPassword.account.limit; i++) {
      await client(ctx.http)
        .post('/api/auth/forgot-password')
        .send({ email: target })
        .expect(200);
    }
    await client(ctx.http)
      .post('/api/auth/forgot-password')
      .send({ email: target })
      .expect(429);
  });

  it.each([
    ['signup', '/api/auth/signup', AUTH_THROTTLE.signup.ip.limit],
    [
      'verify-email',
      '/api/auth/verify-email',
      AUTH_THROTTLE.verifyEmail.ip.limit,
    ],
    [
      'reset-password',
      '/api/auth/reset-password',
      AUTH_THROTTLE.resetPassword.ip.limit,
    ],
    ['refresh', '/api/auth/refresh', AUTH_THROTTLE.refresh.ip.limit],
  ])(
    '%s is limited to %s requests per minute per IP',
    async (_name, url, limit) => {
      const ip = client(ctx.http);
      for (let i = 0; i < limit; i++) {
        const res = await ip.post(url).send({});
        expect(res.status).not.toBe(429);
      }
      await ip.post(url).send({}).expect(429);
    },
  );

  it('global limit applies to other routes; /api/health is never throttled', async () => {
    const ip = client(ctx.http);
    const statuses: number[] = [];
    for (let i = 0; i < 101; i++) {
      statuses.push((await ip.get('/api/jobs?limit=1')).status);
    }
    expect(statuses.slice(0, 100).every((s) => s === 200)).toBe(true);
    expect(statuses[100]).toBe(429);

    for (let i = 0; i < 120; i++) {
      await ip.get('/api/health').expect(200);
    }
  });
});
