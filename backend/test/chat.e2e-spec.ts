/**
 * Chat module — real end-to-end tests (MongoDB + PostgreSQL + Socket.io).
 *
 * Uses a dedicated test module (NOT AppModule): config + MongoDB + Prisma +
 * the real JwtAccessStrategy (what JwtAuthGuard relies on) + ChatModule.
 * Tokens are signed like AuthService does ({ sub, email, role }, access secret).
 * Throwaway databases:
 *   CHAT_E2E_MONGODB_URI  (default: MONGODB_URI with a "_chat" suffix)
 *   CHAT_E2E_DATABASE_URL (default: DATABASE_URL with a "_chat" suffix)
 * The PostgreSQL schema must exist (`npx prisma migrate deploy`).
 * Both databases are WIPED by this suite.
 *
 * Run: npx jest --config ./test/jest-chat-e2e.json --runInBand
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { randomBytes } from 'crypto';
import type { Server } from 'http';
import { Model } from 'mongoose';
import { AddressInfo } from 'net';
import * as os from 'os';
import { io, Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types';

import configuration from '../src/config/configuration';
import { validationSchema } from '../src/config/validation.schema';
import { PrismaModule } from '../src/database/prisma/prisma.module';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { JwtAccessStrategy } from '../src/modules/auth/strategies/jwt-access.strategy';
import { ChatModule } from '../src/modules/chat/chat.module';
import type {
  ConversationView,
  MessagePage,
  MessageView,
  PresenceEvent,
  ReadMessagesAck,
  SendMessageAck,
  TypingEvent,
} from '../src/modules/chat/chat.types';
import {
  Message,
  MessageDocument,
} from '../src/modules/chat/schemas/message.schema';
import {
  User,
  UserDocument,
  UserRole,
} from '../src/modules/users/schemas/user.schema';
import { chatDatabaseUrls } from './setup/chat-databases';

jest.setTimeout(30_000);

// ─── Throwaway test environment (never the real .env) ────────────────────────

const { mongoUri: MONGODB_URI, databaseUrl: DATABASE_URL } = chatDatabaseUrls();
const CLIENT_URL = 'http://localhost:5173';

// Safety net: this suite deletes every document/row of both databases
for (const uri of [MONGODB_URI, DATABASE_URL]) {
  const dbName = new URL(uri).pathname.replace(/^\//, '');
  if (!/(_chat|test)/i.test(dbName)) {
    throw new Error(`Refusing to wipe non-test database "${dbName}"`);
  }
}

Object.assign(process.env, {
  NODE_ENV: 'test',
  MONGODB_URI,
  DATABASE_URL,
  JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
  JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
  JWT_ACCESS_EXPIRY: '15m',
  JWT_REFRESH_EXPIRY: '7d',
  AWS_REGION: 'eu-west-3',
  AWS_ACCESS_KEY_ID: 'test-access-key-id',
  AWS_SECRET_ACCESS_KEY: 'test-secret-access-key',
  AWS_BUCKET_NAME: 'test-bucket',
  EMAIL_HOST: 'localhost',
  EMAIL_PORT: '2525',
  EMAIL_USER: 'test',
  EMAIL_PASS: 'test',
  EMAIL_FROM: 'noreply@example.com',
  CLIENT_URL,
});

// ─── Socket helpers ──────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function waitForEvent<T>(
  socket: ClientSocket,
  event: string,
  predicate: (payload: T) => boolean = () => true,
  timeoutMs = 3000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const handler = (payload: T) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeoutMs);
    socket.on(event, handler);
  });
}

/** Records every payload of `event` (for "must NOT receive" assertions). */
function record<T>(socket: ClientSocket, event: string): T[] {
  const received: T[] = [];
  socket.on(event, (payload: T) => received.push(payload));
  return received;
}

function emitWithAck<T>(
  socket: ClientSocket,
  event: string,
  payload: unknown,
): Promise<T> {
  return socket.timeout(3000).emitWithAck(event, payload) as Promise<T>;
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('Chat (e2e)', () => {
  let moduleRef: TestingModule;
  let app: INestApplication<App>;
  let baseUrl: string;
  let userModel: Model<UserDocument>;
  let messageModel: Model<MessageDocument>;
  let prisma: PrismaService;
  const jwt = new JwtService();
  const sockets: ClientSocket[] = [];

  // recruiter ↔ candidate are linked by an application; the others are not
  const ids = { recruiter: '', candidate: '', outsider: '', recruiter2: '' };
  const tokens = { recruiter: '', candidate: '', outsider: '', recruiter2: '' };

  function connect(
    token: string | undefined,
    options: { autoConnect?: boolean; origin?: string } = {},
  ): ClientSocket {
    const socket = io(`${baseUrl}/chat`, {
      path: '/socket.io',
      auth: token === undefined ? {} : { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      autoConnect: options.autoConnect ?? true,
      extraHeaders: options.origin ? { Origin: options.origin } : undefined,
    });
    sockets.push(socket);
    return socket;
  }

  async function connected(socket: ClientSocket): Promise<ClientSocket> {
    if (socket.connected) return socket;
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', (err) => reject(err));
      if (!socket.active) socket.connect();
    });
    return socket;
  }

  function connectError(socket: ClientSocket): Promise<Error> {
    return new Promise<Error>((resolve, reject) => {
      socket.once('connect', () => reject(new Error('Unexpected connection')));
      socket.once('connect_error', (err) => resolve(err));
    });
  }

  function signAccessToken(userId: string, role: UserRole, exp?: number) {
    const payload = { sub: userId, email: `${userId}@profyle.test`, role };
    const secret = process.env.JWT_ACCESS_SECRET!;
    return exp === undefined
      ? jwt.sign(payload, { secret, expiresIn: '15m' })
      : jwt.sign({ ...payload, exp }, { secret });
  }

  const api = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function wipeDatabases(): Promise<void> {
    await messageModel.deleteMany({});
    await userModel.deleteMany({});
    await prisma.application.deleteMany();
    await prisma.savedJob.deleteMany();
    await prisma.job.deleteMany();
    await prisma.company.deleteMany();
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [configuration],
          validationSchema,
          validationOptions: { allowUnknown: true, abortEarly: false },
        }),
        // mongodb@7 loads `os` with a dynamic import(), which fails inside
        // Jest's VM sandbox (empty handshake metadata → "Missing required
        // sub-document 'driver'"). Providing the adapter avoids that import.
        MongooseModule.forRoot(MONGODB_URI, { runtimeAdapters: { os } }),
        PrismaModule,
        PassportModule,
        ChatModule,
      ],
      // Registers the `jwt-access` passport strategy used by JwtAuthGuard
      providers: [JwtAccessStrategy],
    }).compile();

    app = moduleRef.createNestApplication<INestApplication<App>>({
      logger: ['error', 'warn'],
    });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.listen(0, '127.0.0.1');
    const httpServer = app.getHttpServer() as unknown as Server;
    const { port } = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;

    userModel = moduleRef.get<Model<UserDocument>>(getModelToken(User.name));
    messageModel = moduleRef.get<Model<MessageDocument>>(
      getModelToken(Message.name),
    );
    prisma = moduleRef.get(PrismaService);
    await messageModel.syncIndexes();
    await wipeDatabases();

    // ── Seed users (MongoDB) ──
    const password = 'unused-password-hash';
    const seed = async (key: keyof typeof ids, role: UserRole) => {
      const user = await userModel.create({
        firstName: `First-${key}`,
        lastName: `Last-${key}`,
        email: `${key}@profyle.test`,
        password,
        role,
        isEmailVerified: true,
        avatarUrl: key === 'candidate' ? 'https://cdn.test/avatar.png' : null,
      });
      ids[key] = user._id.toString();
    };
    await seed('recruiter', UserRole.RECRUITER);
    await seed('candidate', UserRole.CANDIDATE);
    await seed('outsider', UserRole.CANDIDATE);
    await seed('recruiter2', UserRole.RECRUITER);

    // ── Seed company / job / application (PostgreSQL) ──
    const company = await prisma.company.create({
      data: { name: 'Chat E2E Company', ownerId: ids.recruiter },
    });
    const job = await prisma.job.create({
      data: {
        title: 'Backend Developer',
        description: 'NestJS',
        location: 'Tanger',
        jobType: 'internship',
        experienceLevel: 'entry',
        requirements: ['TypeScript'],
        salaryType: 'negotiable',
        companyId: company.id,
        recruiterId: ids.recruiter,
      },
    });
    await prisma.application.create({
      data: {
        jobId: job.id,
        applicantId: ids.candidate,
        experienceYears: 0,
        experienceLevel: 'entry',
      },
    });

    tokens.recruiter = signAccessToken(ids.recruiter, UserRole.RECRUITER);
    tokens.candidate = signAccessToken(ids.candidate, UserRole.CANDIDATE);
    tokens.outsider = signAccessToken(ids.outsider, UserRole.CANDIDATE);
    tokens.recruiter2 = signAccessToken(ids.recruiter2, UserRole.RECRUITER);
  });

  beforeEach(async () => {
    await messageModel.deleteMany({});
  });

  afterEach(async () => {
    sockets.splice(0).forEach((s) => s.disconnect());
    await sleep(150); // let async offline-presence broadcasts settle
  });

  afterAll(async () => {
    if (messageModel && userModel && prisma) await wipeDatabases();
    await app?.close();
  });

  // ─── Connection authentication ─────────────────────────────────────────────

  describe('connection authentication', () => {
    it('refuses a connection without token', async () => {
      const socket = connect(undefined);
      const err = await connectError(socket);
      expect(err.message).toBe('unauthorized');
      expect(socket.connected).toBe(false);
    });

    it('refuses invalid, expired, foreign-secret and refresh tokens with the same generic error', async () => {
      const expired = signAccessToken(
        ids.candidate,
        UserRole.CANDIDATE,
        Math.floor(Date.now() / 1000) - 60,
      );
      const foreign = jwt.sign(
        { sub: ids.candidate, role: UserRole.CANDIDATE },
        { secret: randomBytes(32).toString('hex'), expiresIn: '15m' },
      );
      const refresh = jwt.sign(
        { sub: ids.candidate },
        { secret: process.env.JWT_REFRESH_SECRET!, expiresIn: '7d' },
      );
      const ghost = signAccessToken(
        '0123456789abcdef01234567',
        UserRole.CANDIDATE,
      );

      for (const token of ['not-a-jwt', expired, foreign, refresh, ghost]) {
        const err = await connectError(connect(token));
        expect(err.message).toBe('unauthorized');
      }
    });

    it('refuses a browser origin other than CLIENT_URL', async () => {
      const err = await connectError(
        connect(tokens.candidate, { origin: 'http://evil.example' }),
      );
      expect(err.message).toBe('origin_not_allowed');
    });

    it('accepts a valid access token (also from the allowed origin)', async () => {
      const socket = await connected(
        connect(tokens.candidate, { origin: CLIENT_URL }),
      );
      expect(socket.connected).toBe(true);
    });

    it('sends CORS headers for CLIENT_URL only (polling transport)', async () => {
      const allowed = await api()
        .get('/socket.io/?EIO=4&transport=polling')
        .set('Origin', CLIENT_URL)
        .expect(200);
      expect(allowed.headers['access-control-allow-origin']).toBe(CLIENT_URL);

      const evil = await api()
        .get('/socket.io/?EIO=4&transport=polling')
        .set('Origin', 'http://evil.example');
      expect(evil.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('closes the connection when a frame exceeds maxHttpBufferSize', async () => {
      const socket = await connected(connect(tokens.candidate));
      const disconnected = waitForEvent<string>(socket, 'disconnect');
      socket.emit('message:send', {
        to: ids.recruiter,
        text: 'x'.repeat(64_000),
      });
      await expect(disconnected).resolves.toBe('transport close');
      expect(await messageModel.countDocuments()).toBe(0);
    });
  });

  // ─── Presence ──────────────────────────────────────────────────────────────

  describe('presence', () => {
    it('notifies contacts only, sends the initial state, and handles multi-tab', async () => {
      const recruiter = await connected(connect(tokens.recruiter));
      const outsider = await connected(connect(tokens.outsider));
      const outsiderPresence = record<PresenceEvent>(outsider, 'presence');

      const recruiterSeesOnline = waitForEvent<PresenceEvent>(
        recruiter,
        'presence',
        (p) => p.userId === ids.candidate && p.online,
      );
      const tab1 = connect(tokens.candidate, { autoConnect: false });
      const initialState = waitForEvent<PresenceEvent>(
        tab1,
        'presence',
        (p) => p.userId === ids.recruiter,
      );
      await connected(tab1);

      await expect(recruiterSeesOnline).resolves.toEqual({
        userId: ids.candidate,
        online: true,
      });
      await expect(initialState).resolves.toEqual({
        userId: ids.recruiter,
        online: true,
      });

      // Second tab: no new "online" broadcast; closing one tab keeps the user online
      const recruiterPresence = record<PresenceEvent>(recruiter, 'presence');
      const tab2 = await connected(connect(tokens.candidate));
      tab1.disconnect();
      await sleep(300);
      expect(
        recruiterPresence.filter((p) => p.userId === ids.candidate),
      ).toEqual([]);

      // Last tab closed → offline
      const recruiterSeesOffline = waitForEvent<PresenceEvent>(
        recruiter,
        'presence',
        (p) => p.userId === ids.candidate && !p.online,
      );
      tab2.disconnect();
      await expect(recruiterSeesOffline).resolves.toEqual({
        userId: ids.candidate,
        online: false,
      });

      // The unrelated user never learnt anything about the candidate
      expect(
        outsiderPresence.filter((p) => p.userId === ids.candidate),
      ).toEqual([]);
    });
  });

  // ─── Messaging over Socket.io ──────────────────────────────────────────────

  describe('message:send', () => {
    it('delivers in real time with ack, to the recipient and the sender’s other tabs only', async () => {
      const recruiter = await connected(connect(tokens.recruiter));
      const tab1 = await connected(connect(tokens.candidate));
      const tab2 = await connected(connect(tokens.candidate));
      const outsider = await connected(connect(tokens.outsider));
      const tab1Received = record<MessageView>(tab1, 'message:new');
      const outsiderReceived = record<MessageView>(outsider, 'message:new');

      const recruiterGets = waitForEvent<MessageView>(recruiter, 'message:new');
      const tab2Gets = waitForEvent<MessageView>(tab2, 'message:new');

      // A forged `from` must be ignored by the server
      const ack = await emitWithAck<SendMessageAck>(tab1, 'message:send', {
        to: ids.recruiter,
        text: '  Hello, thank you for your offer!  ',
        from: ids.recruiter2,
      });

      expect(ack.ok).toBe(true);
      if (!ack.ok) return;
      expect(ack.message).toEqual({
        id: expect.stringMatching(/^[a-f0-9]{24}$/) as string,
        from: ids.candidate,
        to: ids.recruiter,
        text: 'Hello, thank you for your offer!',
        createdAt: expect.any(String) as string,
        readAt: null,
      });
      await expect(recruiterGets).resolves.toEqual(ack.message);
      await expect(tab2Gets).resolves.toEqual(ack.message);

      await sleep(200);
      expect(tab1Received).toEqual([]); // the emitting tab only gets the ack
      expect(outsiderReceived).toEqual([]); // nobody else can listen
      expect(await messageModel.countDocuments()).toBe(1);
    });

    it('rejects an exchange without application, in both directions', async () => {
      const recruiter = await connected(connect(tokens.recruiter));
      const outsider = await connected(connect(tokens.outsider));
      const recruiter2 = await connected(connect(tokens.recruiter2));
      const recruiterReceived = record<MessageView>(recruiter, 'message:new');

      await expect(
        emitWithAck(outsider, 'message:send', {
          to: ids.recruiter,
          text: 'Hi',
        }),
      ).resolves.toEqual({ ok: false, error: 'forbidden' });
      await expect(
        emitWithAck(recruiter, 'message:send', {
          to: ids.outsider,
          text: 'Hi',
        }),
      ).resolves.toEqual({ ok: false, error: 'forbidden' });
      await expect(
        emitWithAck(recruiter2, 'message:send', {
          to: ids.candidate,
          text: 'Hi',
        }),
      ).resolves.toEqual({ ok: false, error: 'forbidden' });
      await expect(
        emitWithAck(recruiter2, 'message:send', {
          to: ids.recruiter,
          text: 'Hi',
        }),
      ).resolves.toEqual({ ok: false, error: 'forbidden' });

      await sleep(200);
      expect(recruiterReceived).toEqual([]);
      expect(await messageModel.countDocuments()).toBe(0);
    });

    it('rejects invalid payloads (bad ObjectId, empty or too long text)', async () => {
      const candidate = await connected(connect(tokens.candidate));
      const invalid = { ok: false, error: 'invalid_payload' };

      for (const payload of [
        { to: 'not-an-object-id', text: 'Hi' },
        { to: ids.recruiter, text: '   ' },
        { to: ids.recruiter, text: 'x'.repeat(2001) },
        { to: ids.recruiter, text: 42 },
        'garbage',
      ]) {
        await expect(
          emitWithAck(candidate, 'message:send', payload),
        ).resolves.toEqual(invalid);
      }
      await expect(
        emitWithAck<SendMessageAck>(candidate, 'message:send', {
          to: ids.recruiter,
          text: 'x'.repeat(2000),
        }),
      ).resolves.toMatchObject({ ok: true });
    });

    it('rate limits a socket to 20 messages per 10 seconds', async () => {
      const candidate = await connected(connect(tokens.candidate));
      const acks: SendMessageAck[] = [];
      for (let i = 1; i <= 21; i++) {
        acks.push(
          await emitWithAck<SendMessageAck>(candidate, 'message:send', {
            to: ids.recruiter,
            text: `message ${i}`,
          }),
        );
      }
      expect(acks.slice(0, 20).every((a) => a.ok)).toBe(true);
      expect(acks[20]).toEqual({ ok: false, error: 'rate_limited' });
      expect(await messageModel.countDocuments()).toBe(20);

      // The limit is per socket: another tab can still send
      const otherTab = await connected(connect(tokens.candidate));
      await expect(
        emitWithAck(otherTab, 'message:send', {
          to: ids.recruiter,
          text: 'from another tab',
        }),
      ).resolves.toMatchObject({ ok: true });
    });
  });

  // ─── typing & message:read ─────────────────────────────────────────────────

  describe('typing and message:read', () => {
    it('relays typing to a linked recipient only, with the server-side sender id', async () => {
      const recruiter = await connected(connect(tokens.recruiter));
      const candidate = await connected(connect(tokens.candidate));
      const outsider = await connected(connect(tokens.outsider));
      const recruiterTyping = record<TypingEvent>(recruiter, 'typing');

      const typing = waitForEvent<TypingEvent>(recruiter, 'typing');
      candidate.emit('typing', { to: ids.recruiter, isTyping: true });
      await expect(typing).resolves.toEqual({
        from: ids.candidate,
        isTyping: true,
      });

      outsider.emit('typing', { to: ids.recruiter, isTyping: true });
      await sleep(300);
      expect(recruiterTyping.filter((t) => t.from === ids.outsider)).toEqual(
        [],
      );
    });

    it('marks messages as read over the socket', async () => {
      const recruiter = await connected(connect(tokens.recruiter));
      const candidate = await connected(connect(tokens.candidate));
      await emitWithAck(candidate, 'message:send', {
        to: ids.recruiter,
        text: 'First',
      });
      await emitWithAck(candidate, 'message:send', {
        to: ids.recruiter,
        text: 'Second',
      });

      await expect(
        emitWithAck<ReadMessagesAck>(recruiter, 'message:read', {
          from: ids.candidate,
        }),
      ).resolves.toEqual({ ok: true, updated: 2 });
      expect(await messageModel.countDocuments({ readAt: null })).toBe(0);

      await expect(
        emitWithAck(recruiter, 'message:read', { from: 'bad-id' }),
      ).resolves.toEqual({ ok: false, error: 'invalid_payload' });
    });
  });

  // ─── REST ──────────────────────────────────────────────────────────────────

  describe('REST /api/chat', () => {
    it('requires a valid access token', async () => {
      await api().get('/api/chat/conversations').expect(401);
      await api()
        .get('/api/chat/conversations')
        .set(bearer('invalid.token.value'))
        .expect(401);
    });

    it('sends via REST (delivered in real time), paginates history, counts and clears unread', async () => {
      const recruiterSocket = await connected(connect(tokens.recruiter));
      const candidateSocket = await connected(connect(tokens.candidate));
      const recruiterGets = waitForEvent<MessageView>(
        recruiterSocket,
        'message:new',
        (m) => m.text === 'm1',
      );
      const candidateTabGets = waitForEvent<MessageView>(
        candidateSocket,
        'message:new',
        (m) => m.text === 'm1',
      );

      const sent: MessageView[] = [];
      for (const text of ['m1', 'm2', 'm3', 'm4', 'm5']) {
        const res = await api()
          .post('/api/chat/messages')
          .set(bearer(tokens.candidate))
          .send({ to: ids.recruiter, text })
          .expect(201);
        sent.push(res.body as MessageView);
      }
      expect(sent[0]).toMatchObject({
        from: ids.candidate,
        to: ids.recruiter,
        text: 'm1',
        readAt: null,
      });
      await expect(recruiterGets).resolves.toEqual(sent[0]);
      await expect(candidateTabGets).resolves.toEqual(sent[0]);

      // Cursor pagination, newest → oldest
      const page1 = (
        await api()
          .get(`/api/chat/messages/${ids.candidate}?limit=2`)
          .set(bearer(tokens.recruiter))
          .expect(200)
      ).body as MessagePage;
      expect(page1.items.map((m) => m.text)).toEqual(['m5', 'm4']);
      expect(page1.nextCursor).toBe(sent[3].id);

      const page2 = (
        await api()
          .get(
            `/api/chat/messages/${ids.candidate}?limit=2&cursor=${page1.nextCursor}`,
          )
          .set(bearer(tokens.recruiter))
          .expect(200)
      ).body as MessagePage;
      expect(page2.items.map((m) => m.text)).toEqual(['m3', 'm2']);

      const page3 = (
        await api()
          .get(
            `/api/chat/messages/${ids.candidate}?limit=2&cursor=${page2.nextCursor}`,
          )
          .set(bearer(tokens.recruiter))
          .expect(200)
      ).body as MessagePage;
      expect(page3).toEqual({ items: [sent[0]], nextCursor: null });

      // Conversations: other user's public info + unread count
      const conversations = (
        await api()
          .get('/api/chat/conversations')
          .set(bearer(tokens.recruiter))
          .expect(200)
      ).body as ConversationView[];
      expect(conversations).toEqual([
        {
          user: {
            id: ids.candidate,
            firstName: 'First-candidate',
            lastName: 'Last-candidate',
            avatarUrl: 'https://cdn.test/avatar.png',
          },
          lastMessage: {
            text: 'm5',
            createdAt: sent[4].createdAt,
            from: ids.candidate,
          },
          unreadCount: 5,
        },
      ]);

      const senderView = (
        await api()
          .get('/api/chat/conversations')
          .set(bearer(tokens.candidate))
          .expect(200)
      ).body as ConversationView[];
      expect(senderView).toHaveLength(1);
      expect(senderView[0].user.id).toBe(ids.recruiter);
      expect(senderView[0].unreadCount).toBe(0);

      // Mark as read
      await api()
        .patch(`/api/chat/messages/${ids.candidate}/read`)
        .set(bearer(tokens.recruiter))
        .expect(200)
        .expect({ updated: 5 });
      const afterRead = (
        await api()
          .get('/api/chat/conversations')
          .set(bearer(tokens.recruiter))
          .expect(200)
      ).body as ConversationView[];
      expect(afterRead[0].unreadCount).toBe(0);
    });

    it('never exposes other users’ conversations', async () => {
      await api()
        .post('/api/chat/messages')
        .set(bearer(tokens.candidate))
        .send({ to: ids.recruiter, text: 'private' })
        .expect(201);

      const outsiderView = (
        await api()
          .get(`/api/chat/messages/${ids.candidate}`)
          .set(bearer(tokens.outsider))
          .expect(200)
      ).body as MessagePage;
      expect(outsiderView).toEqual({ items: [], nextCursor: null });
      await api()
        .get('/api/chat/conversations')
        .set(bearer(tokens.outsider))
        .expect(200)
        .expect([]);
      // Marking someone else's conversation as read changes nothing
      await api()
        .patch(`/api/chat/messages/${ids.candidate}/read`)
        .set(bearer(tokens.outsider))
        .expect(200)
        .expect({ updated: 0 });
    });

    it('returns 403 without application and 400 on invalid input', async () => {
      await api()
        .post('/api/chat/messages')
        .set(bearer(tokens.outsider))
        .send({ to: ids.recruiter, text: 'Hi' })
        .expect(403);
      await api()
        .post('/api/chat/messages')
        .set(bearer(tokens.candidate))
        .send({ to: 'nope', text: 'Hi' })
        .expect(400);
      await api()
        .post('/api/chat/messages')
        .set(bearer(tokens.candidate))
        .send({ to: ids.recruiter, text: 'x'.repeat(2001) })
        .expect(400);
      await api()
        .post('/api/chat/messages')
        .set(bearer(tokens.candidate))
        .send({ to: ids.recruiter, text: '   ' })
        .expect(400);
      await api()
        .get('/api/chat/messages/not-an-id')
        .set(bearer(tokens.candidate))
        .expect(400);
      await api()
        .get(
          `/api/chat/messages/${ids.recruiter}?cursor=0123456789abcdef01234567`,
        )
        .set(bearer(tokens.candidate))
        .expect(400);
      await api()
        .get(`/api/chat/messages/${ids.recruiter}?limit=1000`)
        .set(bearer(tokens.candidate))
        .expect(400);
      expect(await messageModel.countDocuments()).toBe(0);
    });

    it('rate limits POST /chat/messages per user (429 after 20 attempts / 10 s)', async () => {
      // recruiter2 has no application link: each attempt is a 403, but counts
      for (let i = 0; i < 20; i++) {
        await api()
          .post('/api/chat/messages')
          .set(bearer(tokens.recruiter2))
          .send({ to: ids.candidate, text: `attempt ${i}` })
          .expect(403);
      }
      await api()
        .post('/api/chat/messages')
        .set(bearer(tokens.recruiter2))
        .send({ to: ids.candidate, text: 'one too many' })
        .expect(429);
    });
  });
});
