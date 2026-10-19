import {
  BadRequestException,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Types } from 'mongoose';

import { UserRole } from '../users/schemas/user.schema';
import { ChatSocketAuthService } from './chat-socket-auth.service';
import {
  MAX_SOCKETS_PER_USER,
  SOCKET_MESSAGE_RATE_LIMIT,
  SOCKET_SIGNAL_RATE_LIMIT,
} from './chat.constants';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatNamespace, ChatSocket, ChatUser, MessageView } from './chat.types';
import { PresenceRegistry } from './presence.registry';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const newId = () => new Types.ObjectId().toHexString();

function createServerMock() {
  const operator = { to: jest.fn(), except: jest.fn(), emit: jest.fn() };
  operator.to.mockReturnValue(operator);
  operator.except.mockReturnValue(operator);
  const server = { to: jest.fn().mockReturnValue(operator), use: jest.fn() };
  return { server, operator };
}

let socketSeq = 0;
function createSocketMock(
  user?: ChatUser,
  handshake: { origin?: string; token?: unknown } = {},
) {
  socketSeq += 1;
  return {
    id: `socket-${socketSeq}`,
    data: { user } as { user?: ChatUser },
    handshake: {
      headers: { origin: handshake.origin },
      auth: { token: handshake.token },
    },
    join: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
}

const flushPromises = () =>
  new Promise<void>((resolve) => setImmediate(resolve));

type Middleware = (socket: ChatSocket, next: (err?: Error) => void) => void;

const asSocket = (mock: ReturnType<typeof createSocketMock>) =>
  mock as unknown as ChatSocket;

function messageView(from: string, to: string): MessageView {
  return {
    id: newId(),
    from,
    to,
    text: 'Hello',
    createdAt: '2026-10-01T10:00:00.000Z',
    readAt: null,
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let presence: PresenceRegistry;
  let server: ReturnType<typeof createServerMock>['server'];
  let operator: ReturnType<typeof createServerMock>['operator'];
  let chatService: {
    sendMessage: jest.Mock;
    markAsRead: jest.Mock;
    resolveTypingTarget: jest.Mock;
    getContactIds: jest.Mock;
  };
  let socketAuth: { authenticate: jest.Mock };

  const recruiterId = newId();
  const candidateId = newId();
  const recruiter: ChatUser = { userId: recruiterId, role: UserRole.RECRUITER };
  const candidate: ChatUser = { userId: candidateId, role: UserRole.CANDIDATE };

  beforeEach(() => {
    // Keep the test output clean (error paths are asserted explicitly)
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    process.env.CLIENT_URL = 'http://localhost:5173';
    chatService = {
      sendMessage: jest.fn(),
      markAsRead: jest.fn(),
      resolveTypingTarget: jest.fn(),
      getContactIds: jest.fn().mockResolvedValue([]),
    };
    socketAuth = { authenticate: jest.fn() };
    presence = new PresenceRegistry();
    gateway = new ChatGateway(
      chatService as unknown as ChatService,
      socketAuth as unknown as ChatSocketAuthService,
      presence,
    );
    ({ server, operator } = createServerMock());
    gateway.server = server as unknown as ChatNamespace;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.CLIENT_URL;
  });

  const registeredMiddleware = (): Middleware =>
    (server.use.mock.calls as Array<[Middleware]>)[0][0];

  // ─── Handshake authentication ───────────────────────────────────────────────

  describe('handshake authentication', () => {
    it('registers a namespace middleware that refuses unauthenticated sockets', async () => {
      gateway.afterInit(server as unknown as ChatNamespace);
      const middleware = registeredMiddleware();
      socketAuth.authenticate.mockResolvedValue(null);

      const next = jest.fn();
      middleware(asSocket(createSocketMock()), next);
      await flushPromises();

      expect(next).toHaveBeenCalledWith(new Error('unauthorized'));
    });

    it('lets an authenticated socket through (next() without error)', async () => {
      gateway.afterInit(server as unknown as ChatNamespace);
      const middleware = registeredMiddleware();
      socketAuth.authenticate.mockResolvedValue(candidate);

      const next = jest.fn();
      middleware(asSocket(createSocketMock(undefined, { token: 'jwt' })), next);
      await flushPromises();

      expect(next).toHaveBeenCalledWith(undefined);
    });

    it('refuses a socket without token with a generic error', async () => {
      socketAuth.authenticate.mockResolvedValue(null);
      const socket = createSocketMock();

      const error = await gateway.authenticateHandshake(asSocket(socket));

      expect(error?.message).toBe('unauthorized');
      expect(socketAuth.authenticate).toHaveBeenCalledWith(undefined);
      expect(socket.data.user).toBeUndefined();
    });

    it('verifies handshake.auth.token and attaches the user to the socket', async () => {
      socketAuth.authenticate.mockResolvedValue(candidate);
      const socket = createSocketMock(undefined, {
        token: 'access-token',
        origin: 'http://localhost:5173',
      });

      await expect(
        gateway.authenticateHandshake(asSocket(socket)),
      ).resolves.toBeNull();
      expect(socketAuth.authenticate).toHaveBeenCalledWith('access-token');
      expect(socket.data.user).toEqual(candidate);
    });

    it('refuses a browser origin other than CLIENT_URL before checking the token', async () => {
      const socket = createSocketMock(undefined, {
        token: 'access-token',
        origin: 'http://evil.example',
      });

      const error = await gateway.authenticateHandshake(asSocket(socket));

      expect(error?.message).toBe('origin_not_allowed');
      expect(socketAuth.authenticate).not.toHaveBeenCalled();
    });

    it(`refuses more than ${MAX_SOCKETS_PER_USER} sockets for the same user`, async () => {
      socketAuth.authenticate.mockResolvedValue(candidate);
      for (let i = 0; i < MAX_SOCKETS_PER_USER; i++) presence.add(candidateId);

      const error = await gateway.authenticateHandshake(
        asSocket(createSocketMock(undefined, { token: 't' })),
      );

      expect(error?.message).toBe('too_many_connections');
    });

    it('returns a generic internal_error when verification throws', async () => {
      socketAuth.authenticate.mockRejectedValue(
        new Error('mongo down: secret details'),
      );

      const error = await gateway.authenticateHandshake(
        asSocket(createSocketMock(undefined, { token: 't' })),
      );

      expect(error?.message).toBe('internal_error');
    });
  });

  // ─── Connection lifecycle & presence ────────────────────────────────────────

  describe('connection lifecycle and presence', () => {
    it('disconnects a socket that has no authenticated user (defense in depth)', async () => {
      const socket = createSocketMock();

      await gateway.handleConnection(asSocket(socket));

      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.join).not.toHaveBeenCalled();
      expect(presence.isOnline(candidateId)).toBe(false);
    });

    it('joins the private room, announces presence to contacts and sends their state', async () => {
      const otherRecruiter = newId();
      presence.add(recruiterId); // recruiter already online
      chatService.getContactIds.mockResolvedValue([
        recruiterId,
        otherRecruiter,
      ]);
      const socket = createSocketMock(candidate);

      await gateway.handleConnection(asSocket(socket));

      expect(socket.join).toHaveBeenCalledWith(`user:${candidateId}`);
      expect(presence.isOnline(candidateId)).toBe(true);
      expect(server.to).toHaveBeenCalledWith([
        `user:${recruiterId}`,
        `user:${otherRecruiter}`,
      ]);
      expect(operator.emit).toHaveBeenCalledWith('presence', {
        userId: candidateId,
        online: true,
      });
      // Initial state: only the contacts that are online
      expect(socket.emit).toHaveBeenCalledTimes(1);
      expect(socket.emit).toHaveBeenCalledWith('presence', {
        userId: recruiterId,
        online: true,
      });
    });

    it('does not re-announce presence when a second tab connects', async () => {
      chatService.getContactIds.mockResolvedValue([recruiterId]);
      await gateway.handleConnection(asSocket(createSocketMock(candidate)));
      server.to.mockClear();

      await gateway.handleConnection(asSocket(createSocketMock(candidate)));

      expect(presence.count(candidateId)).toBe(2);
      expect(server.to).not.toHaveBeenCalled();
    });

    it('survives a presence lookup failure', async () => {
      chatService.getContactIds.mockRejectedValue(new Error('db down'));
      const socket = createSocketMock(candidate);

      await expect(
        gateway.handleConnection(asSocket(socket)),
      ).resolves.toBeUndefined();
      expect(socket.join).toHaveBeenCalled();
    });

    it('announces offline only when the last tab disconnects', async () => {
      chatService.getContactIds.mockResolvedValue([recruiterId]);
      const tab1 = createSocketMock(candidate);
      const tab2 = createSocketMock(candidate);
      await gateway.handleConnection(asSocket(tab1));
      await gateway.handleConnection(asSocket(tab2));
      server.to.mockClear();
      operator.emit.mockClear();

      gateway.handleDisconnect(asSocket(tab1));
      await flushPromises();
      expect(operator.emit).not.toHaveBeenCalled();

      gateway.handleDisconnect(asSocket(tab2));
      await flushPromises();
      expect(server.to).toHaveBeenCalledWith([`user:${recruiterId}`]);
      expect(operator.emit).toHaveBeenCalledWith('presence', {
        userId: candidateId,
        online: false,
      });
    });

    it('ignores the disconnection of an unauthenticated socket', () => {
      expect(() =>
        gateway.handleDisconnect(asSocket(createSocketMock())),
      ).not.toThrow();
      expect(chatService.getContactIds).not.toHaveBeenCalled();
    });
  });

  // ─── message:send ───────────────────────────────────────────────────────────

  describe('message:send', () => {
    it('sends as the socket user (ignores a client-sent from) and acks the message', async () => {
      const message = messageView(candidateId, recruiterId);
      chatService.sendMessage.mockResolvedValue(message);
      const socket = createSocketMock(candidate);

      const ack = await gateway.handleSendMessage(asSocket(socket), {
        to: recruiterId,
        text: 'Hello',
        from: recruiterId,
      });

      expect(ack).toEqual({ ok: true, message });
      expect(chatService.sendMessage).toHaveBeenCalledWith(
        candidate,
        recruiterId,
        'Hello',
      );
    });

    it('emits message:new to the recipient and the sender’s other tabs', async () => {
      const message = messageView(candidateId, recruiterId);
      chatService.sendMessage.mockResolvedValue(message);
      const socket = createSocketMock(candidate);

      await gateway.handleSendMessage(asSocket(socket), {
        to: recruiterId,
        text: 'Hello',
      });

      expect(server.to).toHaveBeenCalledWith([
        `user:${recruiterId}`,
        `user:${candidateId}`,
      ]);
      expect(operator.except).toHaveBeenCalledWith(socket.id);
      expect(operator.emit).toHaveBeenCalledWith('message:new', message);
    });

    it('refuses a socket without authenticated user', async () => {
      await expect(
        gateway.handleSendMessage(asSocket(createSocketMock()), {
          to: recruiterId,
          text: 'Hi',
        }),
      ).resolves.toEqual({ ok: false, error: 'unauthorized' });
      expect(chatService.sendMessage).not.toHaveBeenCalled();
    });

    it(`rate limits to ${SOCKET_MESSAGE_RATE_LIMIT.limit} messages per ${SOCKET_MESSAGE_RATE_LIMIT.windowMs} ms per socket`, async () => {
      const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
      chatService.sendMessage.mockResolvedValue(
        messageView(candidateId, recruiterId),
      );
      const socket = asSocket(createSocketMock(candidate));
      const payload = { to: recruiterId, text: 'Hi' };

      for (let i = 0; i < SOCKET_MESSAGE_RATE_LIMIT.limit; i++) {
        await expect(
          gateway.handleSendMessage(socket, payload),
        ).resolves.toMatchObject({
          ok: true,
        });
      }
      await expect(gateway.handleSendMessage(socket, payload)).resolves.toEqual(
        {
          ok: false,
          error: 'rate_limited',
        },
      );
      expect(chatService.sendMessage).toHaveBeenCalledTimes(
        SOCKET_MESSAGE_RATE_LIMIT.limit,
      );

      // Another socket of the same user has its own budget
      await expect(
        gateway.handleSendMessage(
          asSocket(createSocketMock(candidate)),
          payload,
        ),
      ).resolves.toMatchObject({ ok: true });

      // Once the window has slid, the socket may send again
      now.mockReturnValue(1_000_000 + SOCKET_MESSAGE_RATE_LIMIT.windowMs + 1);
      await expect(
        gateway.handleSendMessage(socket, payload),
      ).resolves.toMatchObject({
        ok: true,
      });
    });

    it('counts invalid or forbidden attempts against the rate limit', async () => {
      chatService.sendMessage.mockRejectedValue(new ForbiddenException());
      const socket = asSocket(createSocketMock(candidate));

      for (let i = 0; i < SOCKET_MESSAGE_RATE_LIMIT.limit; i++) {
        await gateway.handleSendMessage(socket, {
          to: recruiterId,
          text: 'Hi',
        });
      }

      await expect(
        gateway.handleSendMessage(socket, { to: recruiterId, text: 'Hi' }),
      ).resolves.toEqual({ ok: false, error: 'rate_limited' });
    });

    it('resets the socket budget on disconnect', async () => {
      chatService.sendMessage.mockResolvedValue(
        messageView(candidateId, recruiterId),
      );
      const mock = createSocketMock(candidate);
      for (let i = 0; i < SOCKET_MESSAGE_RATE_LIMIT.limit; i++) {
        await gateway.handleSendMessage(asSocket(mock), {
          to: recruiterId,
          text: 'Hi',
        });
      }

      gateway.handleDisconnect(asSocket(mock));

      await expect(
        gateway.handleSendMessage(asSocket(mock), {
          to: recruiterId,
          text: 'Hi',
        }),
      ).resolves.toMatchObject({ ok: true });
    });

    it.each([
      ['ForbiddenException', new ForbiddenException(), 'forbidden'],
      ['BadRequestException', new BadRequestException(), 'invalid_payload'],
      ['UnauthorizedException', new UnauthorizedException(), 'unauthorized'],
      ['an unexpected error', new Error('boom'), 'internal_error'],
    ])('maps %s to the ack error code', async (_label, error, code) => {
      chatService.sendMessage.mockRejectedValue(error);

      await expect(
        gateway.handleSendMessage(asSocket(createSocketMock(candidate)), {
          to: recruiterId,
          text: 'Hi',
        }),
      ).resolves.toEqual({ ok: false, error: code });
      expect(operator.emit).not.toHaveBeenCalled();
    });

    it('passes undefined fields to the service for a non-object payload', async () => {
      chatService.sendMessage.mockRejectedValue(new BadRequestException());

      await expect(
        gateway.handleSendMessage(
          asSocket(createSocketMock(candidate)),
          'garbage',
        ),
      ).resolves.toEqual({ ok: false, error: 'invalid_payload' });
      expect(chatService.sendMessage).toHaveBeenCalledWith(
        candidate,
        undefined,
        undefined,
      );
    });
  });

  // ─── typing ─────────────────────────────────────────────────────────────────

  describe('typing', () => {
    it('relays typing to the recipient room with the server-side sender id', async () => {
      chatService.resolveTypingTarget.mockResolvedValue({
        to: recruiterId,
        isTyping: true,
      });

      await gateway.handleTyping(asSocket(createSocketMock(candidate)), {
        to: recruiterId,
        isTyping: true,
        from: 'forged',
      });

      expect(chatService.resolveTypingTarget).toHaveBeenCalledWith(
        candidate,
        recruiterId,
        true,
      );
      expect(server.to).toHaveBeenCalledWith(`user:${recruiterId}`);
      expect(operator.emit).toHaveBeenCalledWith('typing', {
        from: candidateId,
        isTyping: true,
      });
    });

    it('drops typing when the users may not talk or the payload is invalid', async () => {
      chatService.resolveTypingTarget.mockResolvedValue(null);

      await gateway.handleTyping(asSocket(createSocketMock(candidate)), {
        to: 'x',
      });

      expect(server.to).not.toHaveBeenCalled();
    });

    it('drops typing from an unauthenticated socket and beyond the signal budget', async () => {
      await gateway.handleTyping(asSocket(createSocketMock()), {
        to: recruiterId,
        isTyping: true,
      });
      expect(chatService.resolveTypingTarget).not.toHaveBeenCalled();

      chatService.resolveTypingTarget.mockResolvedValue({
        to: recruiterId,
        isTyping: true,
      });
      const socket = asSocket(createSocketMock(candidate));
      for (let i = 0; i < SOCKET_SIGNAL_RATE_LIMIT.limit + 5; i++) {
        await gateway.handleTyping(socket, { to: recruiterId, isTyping: true });
      }
      expect(chatService.resolveTypingTarget).toHaveBeenCalledTimes(
        SOCKET_SIGNAL_RATE_LIMIT.limit,
      );
    });

    it('swallows service errors', async () => {
      chatService.resolveTypingTarget.mockRejectedValue(new Error('db down'));

      await expect(
        gateway.handleTyping(asSocket(createSocketMock(candidate)), {
          to: recruiterId,
          isTyping: true,
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ─── message:read ───────────────────────────────────────────────────────────

  describe('message:read', () => {
    it('marks the messages from `from` to the socket user as read', async () => {
      chatService.markAsRead.mockResolvedValue({ updated: 3 });

      await expect(
        gateway.handleMarkAsRead(asSocket(createSocketMock(recruiter)), {
          from: candidateId,
        }),
      ).resolves.toEqual({ ok: true, updated: 3 });
      expect(chatService.markAsRead).toHaveBeenCalledWith(
        recruiterId,
        candidateId,
      );
    });

    it('returns invalid_payload for a bad id and unauthorized without user', async () => {
      chatService.markAsRead.mockRejectedValue(new BadRequestException());

      await expect(
        gateway.handleMarkAsRead(asSocket(createSocketMock(recruiter)), {
          from: 'x',
        }),
      ).resolves.toEqual({ ok: false, error: 'invalid_payload' });
      await expect(
        gateway.handleMarkAsRead(asSocket(createSocketMock()), {
          from: candidateId,
        }),
      ).resolves.toEqual({ ok: false, error: 'unauthorized' });
    });
  });

  // ─── emitNewMessage (used by the REST fallback) ─────────────────────────────

  describe('emitNewMessage', () => {
    it('emits to the recipient and every tab of the sender when no socket is excluded', () => {
      const message = messageView(candidateId, recruiterId);

      gateway.emitNewMessage(message);

      expect(server.to).toHaveBeenCalledWith([
        `user:${recruiterId}`,
        `user:${candidateId}`,
      ]);
      expect(operator.except).not.toHaveBeenCalled();
      expect(operator.emit).toHaveBeenCalledWith('message:new', message);
    });

    it('is a no-op before the server is initialized', () => {
      gateway.server = undefined as unknown as ChatNamespace;

      expect(() =>
        gateway.emitNewMessage(messageView(candidateId, recruiterId)),
      ).not.toThrow();
    });
  });
});
