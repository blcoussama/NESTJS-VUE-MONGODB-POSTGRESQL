import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { EmailService } from '../../src/modules/auth/email.service';
import { StorageService } from '../../src/common/storage/storage.service';
import { PrismaService } from '../../src/database/prisma/prisma.service';
import { UserRole } from '../../src/modules/users/schemas/user.schema';

// ─── Fakes ──────────────────────────────────────────────────────────────────

interface SentEmail {
  kind: 'verification' | 'reset';
  to: string;
  token: string;
}

/**
 * Replaces EmailService in tests only (overrideProvider): no SMTP, and the
 * tests can read the token "received" by the user. Production code is
 * unchanged — email verification stays mandatory.
 */
export class FakeEmailService {
  readonly sent: SentEmail[] = [];

  sendVerificationEmail(to: string, token: string): Promise<void> {
    this.sent.push({ kind: 'verification', to, token });
    return Promise.resolve();
  }

  sendPasswordResetEmail(to: string, token: string): Promise<void> {
    this.sent.push({ kind: 'reset', to, token });
    return Promise.resolve();
  }

  lastToken(to: string, kind: SentEmail['kind']): string {
    const email = [...this.sent]
      .reverse()
      .find((e) => e.to === to && e.kind === kind);
    if (!email) throw new Error(`No ${kind} email sent to ${to}`);
    return email.token;
  }

  count(to: string, kind: SentEmail['kind']): number {
    return this.sent.filter((e) => e.to === to && e.kind === kind).length;
  }
}

export interface S3Call {
  name: string;
  input: { Bucket?: string; Key?: string; ContentType?: string };
}

// ─── App ────────────────────────────────────────────────────────────────────

export interface E2eContext {
  app: NestExpressApplication;
  http: App;
  email: FakeEmailService;
  /** Commands that would have been sent to S3 (the network is never used). */
  s3Calls: S3Call[];
  prisma: PrismaService;
  mongo: Connection;
  close: () => Promise<void>;
}

/** Boots the REAL AppModule with the production HTTP pipeline. */
export async function createE2eApp(): Promise<E2eContext> {
  const email = new FakeEmailService();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EmailService)
    .useValue(email)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  // Listen once on an ephemeral port: supertest would otherwise call
  // listen() per request, which breaks concurrent requests (Promise.all)
  await app.listen(0, '127.0.0.1');

  // Real StorageService (key validation, presigning — computed locally),
  // but its S3 client never reaches the network
  const s3Calls: S3Call[] = [];
  const storage = app.get(StorageService);
  const client = (storage as unknown as { s3: { send: unknown } }).s3;
  client.send = (command: { constructor: { name: string }; input: object }) => {
    s3Calls.push({ name: command.constructor.name, input: command.input });
    return Promise.resolve({});
  };

  return {
    app,
    http: app.getHttpServer() as App,
    email,
    s3Calls,
    prisma: app.get(PrismaService),
    mongo: app.get<Connection>(getConnectionToken()),
    close: () => app.close(),
  };
}

// ─── Clients ────────────────────────────────────────────────────────────────

let ipSequence = 0;

/** Unique fake client IP (sent as X-Forwarded-For, trusted from loopback). */
export function nextIp(): string {
  ipSequence += 1;
  return `10.${(ipSequence >> 16) & 255}.${(ipSequence >> 8) & 255}.${ipSequence & 255}`;
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@example.com`;
}

/** Supertest helpers bound to one simulated client IP. */
export function client(http: App, ip = nextIp()) {
  const withIp = (test: request.Test) => test.set('X-Forwarded-For', ip);
  return {
    ip,
    get: (url: string) => withIp(request(http).get(url)),
    post: (url: string) => withIp(request(http).post(url)),
    patch: (url: string) => withIp(request(http).patch(url)),
    delete: (url: string) => withIp(request(http).delete(url)),
  };
}

export type Client = ReturnType<typeof client>;

/** Extracts the RefreshToken cookie ("RefreshToken=<jwt>") from a response. */
export function refreshCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith('RefreshToken='));
  if (!cookie) throw new Error('No RefreshToken cookie in the response');
  return cookie.split(';')[0];
}

export function rawSetCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith('RefreshToken=')) ?? '';
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  accessToken: string;
  cookie: string;
  api: Client;
  bearer: string;
}

/** signup → verify (token from the fake mailbox) → login. */
export async function registerUser(
  ctx: E2eContext,
  role: UserRole,
  prefix: string = role,
): Promise<TestUser> {
  const api = client(ctx.http);
  const email = uniqueEmail(prefix);
  const password = 'Str0ngPassword!';

  await api
    .post('/api/auth/signup')
    .send({ firstName: 'Test', lastName: prefix, email, password, role })
    .expect(201);

  await api
    .post('/api/auth/verify-email')
    .send({ token: ctx.email.lastToken(email, 'verification') })
    .expect(200);

  const login = await api
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);
  const body = login.body as { accessToken: string; user: { id: string } };

  return {
    id: body.user.id,
    email,
    password,
    role,
    accessToken: body.accessToken,
    cookie: refreshCookie(login),
    api,
    bearer: `Bearer ${body.accessToken}`,
  };
}

export const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
export const PDF_BYTES = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n');
