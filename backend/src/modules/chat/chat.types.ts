import type { DefaultEventsMap, Namespace, Socket } from 'socket.io';

// ─── Domain views (exact JSON shapes of the API v2 contract) ────────────────

/** Authenticated chat participant (from the JWT access token). */
export interface ChatUser {
  userId: string;
  role: string;
}

/** Message JSON: `{ id, from, to, text, createdAt, readAt }`. */
export interface MessageView {
  id: string;
  from: string;
  to: string;
  text: string;
  createdAt: string;
  readAt: string | null;
}

export interface MessagePage {
  items: MessageView[];
  nextCursor: string | null;
}

export interface ConversationView {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  lastMessage: {
    text: string;
    createdAt: string;
    from: string;
  };
  unreadCount: number;
}

// ─── Socket.io event payloads ────────────────────────────────────────────────

export type ChatAckError =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_payload'
  | 'rate_limited'
  | 'internal_error';

export type SendMessageAck =
  | { ok: true; message: MessageView }
  | { ok: false; error: ChatAckError };

export type ReadMessagesAck =
  | { ok: true; updated: number }
  | { ok: false; error: ChatAckError };

export interface TypingEvent {
  from: string;
  isTyping: boolean;
}

export interface PresenceEvent {
  userId: string;
  online: boolean;
}

/** Server → client events (contract). */
export interface ChatServerToClientEvents {
  'message:new': (message: MessageView) => void;
  typing: (event: TypingEvent) => void;
  presence: (event: PresenceEvent) => void;
}

/** Data attached to a socket once its handshake is authenticated. */
export interface ChatSocketData {
  user?: ChatUser;
}

export type ChatSocket = Socket<
  DefaultEventsMap,
  ChatServerToClientEvents,
  DefaultEventsMap,
  ChatSocketData
>;

export type ChatNamespace = Namespace<
  DefaultEventsMap,
  ChatServerToClientEvents,
  DefaultEventsMap,
  ChatSocketData
>;
