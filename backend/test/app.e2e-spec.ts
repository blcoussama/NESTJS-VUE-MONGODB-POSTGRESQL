import { client, createE2eApp, E2eContext } from './utils/e2e-app';

describe('App (e2e)', () => {
  let ctx: E2eContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('GET /api/health → 200 without auth, without any configuration value', async () => {
    const res = await client(ctx.http).get('/api/health').expect(200);
    const body = res.body as Record<string, unknown>;

    expect(body.status).toBe('ok');
    expect(Object.keys(body).sort()).toEqual(['status', 'timestamp', 'uptime']);
  });

  it('GET /api → 200 (root route kept)', async () => {
    await client(ctx.http).get('/api').expect(200);
  });

  it('sets security headers (helmet) and hides x-powered-by', async () => {
    const res = await client(ctx.http).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('unknown routes → 404 in the standard error format', async () => {
    const res = await client(ctx.http).get('/api/does-not-exist').expect(404);

    expect(res.body).toMatchObject({ statusCode: 404, error: 'Not Found' });
  });
});
