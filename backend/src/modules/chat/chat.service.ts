import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { PrismaService } from '../../database/prisma/prisma.service';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import {
  AUTHORIZATION_CACHE_MAX_ENTRIES,
  AUTHORIZATION_CACHE_TTL_MS,
  CHAT_NOT_ALLOWED_MESSAGE,
  CONVERSATIONS_MAX,
  HISTORY_DEFAULT_LIMIT,
  HISTORY_MAX_LIMIT,
  MESSAGE_MAX_LENGTH,
} from './chat.constants';
import {
  ChatUser,
  ConversationView,
  MessagePage,
  MessageView,
} from './chat.types';
import { Message, MessageDocument } from './schemas/message.schema';
import { isObjectIdString } from './utils/object-id.util';

/** Minimal shape needed to serialize a message (document or lean object). */
interface MessageLike {
  _id: Types.ObjectId;
  from: Types.ObjectId;
  to: Types.ObjectId;
  text: string;
  createdAt: Date;
  readAt?: Date | null;
}

/** One row of the conversations aggregation. */
interface ConversationRow {
  _id: Types.ObjectId;
  lastText: string;
  lastCreatedAt: Date;
  lastFrom: Types.ObjectId;
  unreadCount: number;
}

export interface HistoryOptions {
  cursor?: unknown;
  limit?: unknown;
}

export function toMessageView(message: MessageLike): MessageView {
  return {
    id: message._id.toHexString(),
    from: message.from.toHexString(),
    to: message.to.toHexString(),
    text: message.text,
    createdAt: message.createdAt.toISOString(),
    readAt: message.readAt ? message.readAt.toISOString() : null,
  };
}

@Injectable()
export class ChatService {
  private readonly authorizationCache = new Map<
    string,
    { allowed: boolean; expiresAt: number }
  >();

  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Send ─────────────────────────────────────────────────────────────────

  /**
   * Persists a message from `sender` (always the authenticated user, never a
   * client-supplied `from`) to `to`, after validating the input and the
   * recruiter ↔ candidate business rule.
   */
  async sendMessage(
    sender: ChatUser,
    to: unknown,
    text: unknown,
  ): Promise<MessageView> {
    const senderId = this.parseUserId(sender.userId, 'user');
    const recipientId = this.parseUserId(to, 'recipient');
    if (recipientId === senderId) {
      throw new BadRequestException('You cannot send a message to yourself');
    }
    const body = this.normalizeText(text);

    if (!(await this.canChat(sender, recipientId))) {
      throw new ForbiddenException(CHAT_NOT_ALLOWED_MESSAGE);
    }

    const created = await this.messageModel.create({
      from: new Types.ObjectId(senderId),
      to: new Types.ObjectId(recipientId),
      text: body,
    });
    return toMessageView(created);
  }

  // ─── History (cursor pagination, newest → oldest) ─────────────────────────

  async getMessages(
    userId: string,
    otherUserId: unknown,
    options: HistoryOptions = {},
  ): Promise<MessagePage> {
    const me = new Types.ObjectId(this.parseUserId(userId, 'user'));
    const other = new Types.ObjectId(this.parseUserId(otherUserId, 'user'));
    const limit = this.normalizeLimit(options.limit);

    // Only messages of this conversation, where the current user is a party
    const participants = {
      $or: [
        { from: me, to: other },
        { from: other, to: me },
      ],
    };

    let filter: Record<string, unknown> = participants;
    if (
      options.cursor !== undefined &&
      options.cursor !== null &&
      options.cursor !== ''
    ) {
      const cursorId = new Types.ObjectId(
        this.parseObjectId(options.cursor, 'Invalid cursor'),
      );
      const cursor = await this.messageModel
        .findOne({ _id: cursorId, ...participants })
        .select({ createdAt: 1 })
        .lean<{ _id: Types.ObjectId; createdAt: Date }>()
        .exec();
      if (!cursor) throw new BadRequestException('Invalid cursor');

      filter = {
        $and: [
          participants,
          {
            $or: [
              { createdAt: { $lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
            ],
          },
        ],
      };
    }

    const docs = await this.messageModel
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean<MessageLike[]>()
      .exec();

    const hasMore = docs.length > limit;
    const page = hasMore ? docs.slice(0, limit) : docs;
    return {
      items: page.map(toMessageView),
      nextCursor: hasMore ? page[page.length - 1]._id.toHexString() : null,
    };
  }

  // ─── Conversations (last message + unread count) ──────────────────────────

  async getConversations(userId: string): Promise<ConversationView[]> {
    const me = new Types.ObjectId(this.parseUserId(userId, 'user'));

    const rows = await this.messageModel
      .aggregate<ConversationRow>([
        { $match: { $or: [{ from: me }, { to: me }] } },
        { $sort: { createdAt: -1, _id: -1 } },
        {
          $group: {
            _id: { $cond: [{ $eq: ['$from', me] }, '$to', '$from'] },
            lastText: { $first: '$text' },
            lastCreatedAt: { $first: '$createdAt' },
            lastFrom: { $first: '$from' },
            unreadCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$to', me] },
                      { $eq: [{ $ifNull: ['$readAt', null] }, null] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $sort: { lastCreatedAt: -1 } },
        { $limit: CONVERSATIONS_MAX },
      ])
      .exec();

    if (rows.length === 0) return [];

    const users = await this.userModel
      .find({ _id: { $in: rows.map((row) => row._id) } })
      .select({ firstName: 1, lastName: 1, avatarUrl: 1 })
      .lean<
        Array<{
          _id: Types.ObjectId;
          firstName: string;
          lastName: string;
          avatarUrl?: string | null;
        }>
      >()
      .exec();
    const usersById = new Map(users.map((u) => [u._id.toHexString(), u]));

    // Conversations with deleted accounts are skipped
    return rows.flatMap((row): ConversationView[] => {
      const user = usersById.get(row._id.toHexString());
      if (!user) return [];
      return [
        {
          user: {
            id: user._id.toHexString(),
            firstName: user.firstName,
            lastName: user.lastName,
            avatarUrl: user.avatarUrl ?? null,
          },
          lastMessage: {
            text: row.lastText,
            createdAt: row.lastCreatedAt.toISOString(),
            from: row.lastFrom.toHexString(),
          },
          unreadCount: row.unreadCount,
        },
      ];
    });
  }

  // ─── Mark as read ─────────────────────────────────────────────────────────

  /** Marks every unread message sent by `otherUserId` to `userId` as read. */
  async markAsRead(
    userId: string,
    otherUserId: unknown,
  ): Promise<{ updated: number }> {
    const me = new Types.ObjectId(this.parseUserId(userId, 'user'));
    const other = new Types.ObjectId(this.parseUserId(otherUserId, 'user'));

    const result = await this.messageModel
      .updateMany(
        { from: other, to: me, readAt: null },
        { $set: { readAt: new Date() } },
      )
      .exec();
    return { updated: result.modifiedCount };
  }

  // ─── Authorization (business rule) ────────────────────────────────────────

  /**
   * A RECRUITER and a CANDIDATE may talk only if the candidate applied to one
   * of the recruiter's jobs (any application status). The other party must
   * exist in MongoDB with the opposite role.
   */
  async canChat(user: ChatUser, otherUserId: string): Promise<boolean> {
    if (
      !isObjectIdString(user.userId) ||
      !isObjectIdString(otherUserId) ||
      user.userId === otherUserId
    ) {
      return false;
    }

    let recruiterId: string;
    let candidateId: string;
    let otherRole: UserRole;
    if (user.role === (UserRole.RECRUITER as string)) {
      recruiterId = user.userId;
      candidateId = otherUserId;
      otherRole = UserRole.CANDIDATE;
    } else if (user.role === (UserRole.CANDIDATE as string)) {
      recruiterId = otherUserId;
      candidateId = user.userId;
      otherRole = UserRole.RECRUITER;
    } else {
      return false;
    }

    const [otherUser, application] = await Promise.all([
      this.userModel.exists({ _id: otherUserId, role: otherRole }).exec(),
      this.prisma.application.findFirst({
        where: { applicantId: candidateId, job: { recruiterId } },
        select: { id: true },
      }),
    ]);
    return otherUser !== null && application !== null;
  }

  /**
   * Same rule with a short-lived cache, for high-frequency signals (typing).
   * Messages always use the uncached check.
   */
  async canChatCached(user: ChatUser, otherUserId: string): Promise<boolean> {
    const key = `${user.userId}|${user.role}|${otherUserId}`;
    const now = Date.now();
    const cached = this.authorizationCache.get(key);
    if (cached && cached.expiresAt > now) return cached.allowed;

    const allowed = await this.canChat(user, otherUserId);
    if (this.authorizationCache.size >= AUTHORIZATION_CACHE_MAX_ENTRIES) {
      this.pruneAuthorizationCache(now);
    }
    this.authorizationCache.set(key, {
      allowed,
      expiresAt: now + AUTHORIZATION_CACHE_TTL_MS,
    });
    return allowed;
  }

  /**
   * Validates a `typing` signal. Returns the validated target, or null when
   * the signal must be dropped (bad payload or users not allowed to talk).
   */
  async resolveTypingTarget(
    user: ChatUser,
    to: unknown,
    isTyping: unknown,
  ): Promise<{ to: string; isTyping: boolean } | null> {
    if (!isObjectIdString(to) || typeof isTyping !== 'boolean') return null;
    const target = to.toLowerCase();
    if (!(await this.canChatCached(user, target))) return null;
    return { to: target, isTyping };
  }

  /** Users this user may talk to (used to scope presence notifications). */
  async getContactIds(user: ChatUser): Promise<string[]> {
    if (!isObjectIdString(user.userId)) return [];

    let ids: string[];
    if (user.role === (UserRole.CANDIDATE as string)) {
      const applications = await this.prisma.application.findMany({
        where: { applicantId: user.userId },
        select: { job: { select: { recruiterId: true } } },
      });
      ids = applications.map((a) => a.job.recruiterId);
    } else if (user.role === (UserRole.RECRUITER as string)) {
      const applications = await this.prisma.application.findMany({
        where: { job: { recruiterId: user.userId } },
        select: { applicantId: true },
        distinct: ['applicantId'],
      });
      ids = applications.map((a) => a.applicantId);
    } else {
      return [];
    }

    return [...new Set(ids)].filter(
      (id) => isObjectIdString(id) && id !== user.userId,
    );
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private parseUserId(value: unknown, label: string): string {
    return this.parseObjectId(value, `Invalid ${label} id`);
  }

  private parseObjectId(value: unknown, errorMessage: string): string {
    if (!isObjectIdString(value)) throw new BadRequestException(errorMessage);
    return value.toLowerCase();
  }

  private normalizeText(text: unknown): string {
    if (typeof text !== 'string') {
      throw new BadRequestException('Message text must be a string');
    }
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('Message text must not be empty');
    }
    if (trimmed.length > MESSAGE_MAX_LENGTH) {
      throw new BadRequestException(
        `Message text must be at most ${MESSAGE_MAX_LENGTH} characters`,
      );
    }
    return trimmed;
  }

  private normalizeLimit(limit: unknown): number {
    if (limit === undefined || limit === null || limit === '') {
      return HISTORY_DEFAULT_LIMIT;
    }
    const value = typeof limit === 'string' ? Number(limit) : limit;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
      throw new BadRequestException('limit must be a positive integer');
    }
    return Math.min(value, HISTORY_MAX_LIMIT);
  }

  private pruneAuthorizationCache(now: number): void {
    for (const [key, entry] of this.authorizationCache) {
      if (entry.expiresAt <= now) this.authorizationCache.delete(key);
    }
    if (this.authorizationCache.size >= AUTHORIZATION_CACHE_MAX_ENTRIES) {
      this.authorizationCache.clear();
    }
  }
}
