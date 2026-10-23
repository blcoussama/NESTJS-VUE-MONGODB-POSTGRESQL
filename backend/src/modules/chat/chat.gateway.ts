import {
  BadRequestException,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { ChatSocketAuthService } from './chat-socket-auth.service';
import {
  CHAT_NAMESPACE,
  MAX_SOCKETS_PER_USER,
  SOCKET_MAX_HTTP_BUFFER_SIZE,
  SOCKET_MESSAGE_RATE_LIMIT,
  SOCKET_SIGNAL_RATE_LIMIT,
  userRoom,
} from './chat.constants';
import { ChatService } from './chat.service';
import {
  ChatAckError,
  ChatNamespace,
  ChatSocket,
  ChatUser,
  MessageView,
  ReadMessagesAck,
  SendMessageAck,
} from './chat.types';
import { PresenceRegistry } from './presence.registry';
import {
  isAllowedClientOrigin,
  isHandshakeOriginAllowed,
} from './utils/client-origin.util';
import { SlidingWindowRateLimiter } from './utils/sliding-window-rate-limiter';

type CorsOriginCallback = (err: Error | null, allow?: boolean) => void;

// Only the fields we read are picked: a client-sent `from` is never used
function asRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === 'object' && payload !== null
    ? (payload as Record<string, unknown>)
    : {};
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : 'unknown error';
}

/**
 * Real-time chat (namespace `/chat`). Every connection is authenticated in
 * a namespace middleware *before* it is accepted: no handler runs, no room is
 * joined and no presence is emitted for an unauthenticated socket.
 *
 * Transport only: validation and business rules live in ChatService.
 */
@WebSocketGateway({
  namespace: CHAT_NAMESPACE,
  cors: {
    // CLIENT_URL only (never `*`), resolved at request time
    origin: (origin: string | undefined, callback: CorsOriginCallback) =>
      callback(null, isAllowedClientOrigin(origin)),
    credentials: true,
  },
  maxHttpBufferSize: SOCKET_MAX_HTTP_BUFFER_SIZE,
})
export class ChatGateway
  implements
    OnGatewayInit<ChatNamespace>,
    OnGatewayConnection<ChatSocket>,
    OnGatewayDisconnect<ChatSocket>
{
  @WebSocketServer()
  server: ChatNamespace;

  private readonly logger = new Logger(ChatGateway.name);

  private readonly messageLimiter = new SlidingWindowRateLimiter(
    SOCKET_MESSAGE_RATE_LIMIT.limit,
    SOCKET_MESSAGE_RATE_LIMIT.windowMs,
  );

  private readonly signalLimiter = new SlidingWindowRateLimiter(
    SOCKET_SIGNAL_RATE_LIMIT.limit,
    SOCKET_SIGNAL_RATE_LIMIT.windowMs,
  );

  constructor(
    private readonly chatService: ChatService,
    private readonly socketAuth: ChatSocketAuthService,
    private readonly presence: PresenceRegistry,
  ) {}

  // ─── Handshake authentication ─────────────────────────────────────────────

  afterInit(namespace: ChatNamespace): void {
    namespace.use((socket, next) => {
      void this.authenticateHandshake(socket).then((error) =>
        next(error ?? undefined),
      );
    });
  }

  /**
   * Returns null when the socket may connect, or an Error whose message is a
   * generic code sent to the client as `connect_error` (no detail leaked).
   */
  async authenticateHandshake(socket: ChatSocket): Promise<Error | null> {
    try {
      if (!isHandshakeOriginAllowed(socket.handshake.headers.origin)) {
        return new Error('origin_not_allowed');
      }
      const token: unknown = socket.handshake.auth?.token;
      const user = await this.socketAuth.authenticate(token);
      if (!user) return new Error('unauthorized');

      if (this.presence.count(user.userId) >= MAX_SOCKETS_PER_USER) {
        return new Error('too_many_connections');
      }
      socket.data.user = user;
      return null;
    } catch (err) {
      this.logger.error(`Socket authentication error: ${describeError(err)}`);
      return new Error('internal_error');
    }
  }

  // ─── Connection lifecycle & presence ──────────────────────────────────────

  async handleConnection(client: ChatSocket): Promise<void> {
    const user = client.data.user;
    // Defense in depth: the middleware should already have refused it
    if (!user) {
      client.disconnect(true);
      return;
    }

    // Synchronous, before any await: keeps the counter consistent
    const cameOnline = this.presence.add(user.userId);
    await client.join(userRoom(user.userId));

    try {
      const contacts = await this.chatService.getContactIds(user);
      if (cameOnline) this.broadcastPresence(user.userId, contacts);

      // Initial state for this tab: which contacts are online right now
      for (const contactId of contacts) {
        if (this.presence.isOnline(contactId)) {
          client.emit('presence', { userId: contactId, online: true });
        }
      }
    } catch (err) {
      this.logger.warn(`Presence sync failed: ${describeError(err)}`);
    }
  }

  handleDisconnect(client: ChatSocket): void {
    this.messageLimiter.reset(client.id);
    this.signalLimiter.reset(client.id);

    const user = client.data.user;
    if (!user) return;
    if (this.presence.remove(user.userId)) {
      void this.announceOffline(user);
    }
  }

  // ─── Client → server events ───────────────────────────────────────────────

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: unknown,
  ): Promise<SendMessageAck> {
    const user = client.data.user;
    if (!user) return { ok: false, error: 'unauthorized' };
    // Every attempt counts, including invalid or forbidden ones
    if (!this.messageLimiter.tryConsume(client.id)) {
      return { ok: false, error: 'rate_limited' };
    }

    const { to, text } = asRecord(payload);
    try {
      // The sender is always the authenticated socket user
      const message = await this.chatService.sendMessage(user, to, text);
      this.emitNewMessage(message, client.id);
      return { ok: true, message };
    } catch (err) {
      return { ok: false, error: this.toAckError(err) };
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    const user = client.data.user;
    if (!user || !this.signalLimiter.tryConsume(client.id)) return;

    const { to, isTyping } = asRecord(payload);
    try {
      const target = await this.chatService.resolveTypingTarget(
        user,
        to,
        isTyping,
      );
      if (!target) return;
      this.server.to(userRoom(target.to)).emit('typing', {
        from: user.userId,
        isTyping: target.isTyping,
      });
    } catch (err) {
      this.logger.warn(`Typing relay failed: ${describeError(err)}`);
    }
  }

  @SubscribeMessage('message:read')
  async handleMarkAsRead(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: unknown,
  ): Promise<ReadMessagesAck> {
    const user = client.data.user;
    if (!user) return { ok: false, error: 'unauthorized' };
    if (!this.signalLimiter.tryConsume(client.id)) {
      return { ok: false, error: 'rate_limited' };
    }

    const { from } = asRecord(payload);
    try {
      const { updated } = await this.chatService.markAsRead(user.userId, from);
      return { ok: true, updated };
    } catch (err) {
      return { ok: false, error: this.toAckError(err) };
    }
  }

  // ─── Server → client emissions ────────────────────────────────────────────

  /**
   * `message:new` to the recipient and to the sender's other tabs
   * (`exceptSocketId` = the emitting socket, which already got the ack).
   */
  emitNewMessage(message: MessageView, exceptSocketId?: string): void {
    if (!this.server) return;
    const rooms = [userRoom(message.to), userRoom(message.from)];
    const target = exceptSocketId
      ? this.server.to(rooms).except(exceptSocketId)
      : this.server.to(rooms);
    target.emit('message:new', message);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async announceOffline(user: ChatUser): Promise<void> {
    try {
      const contacts = await this.chatService.getContactIds(user);
      this.broadcastPresence(user.userId, contacts);
    } catch (err) {
      this.logger.warn(`Presence broadcast failed: ${describeError(err)}`);
    }
  }

  // Presence goes to contacts only (not to every connected user). The state
  // is read at emission time, which keeps fast reconnects consistent.
  private broadcastPresence(userId: string, contacts: string[]): void {
    if (contacts.length === 0) return;
    this.server.to(contacts.map(userRoom)).emit('presence', {
      userId,
      online: this.presence.isOnline(userId),
    });
  }

  private toAckError(err: unknown): ChatAckError {
    if (err instanceof ForbiddenException) return 'forbidden';
    if (err instanceof BadRequestException) return 'invalid_payload';
    if (err instanceof UnauthorizedException) return 'unauthorized';
    this.logger.error(`Unexpected chat error: ${describeError(err)}`);
    return 'internal_error';
  }
}
