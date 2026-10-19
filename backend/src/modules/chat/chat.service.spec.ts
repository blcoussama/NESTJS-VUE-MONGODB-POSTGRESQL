import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';

import { PrismaService } from '../../database/prisma/prisma.service';
import { User, UserRole } from '../users/schemas/user.schema';
import {
  AUTHORIZATION_CACHE_TTL_MS,
  CONVERSATIONS_MAX,
  HISTORY_DEFAULT_LIMIT,
  HISTORY_MAX_LIMIT,
} from './chat.constants';
import { ChatService } from './chat.service';
import { ChatUser } from './chat.types';
import { Message } from './schemas/message.schema';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const newId = () => new Types.ObjectId().toHexString();
const oid = (id: string) => new Types.ObjectId(id);

/** Chainable mongoose query mock: every builder returns itself, exec() resolves. */
function queryChain(result: unknown) {
  const chain = {
    select: jest.fn(),
    sort: jest.fn(),
    limit: jest.fn(),
    lean: jest.fn(),
    exec: jest.fn().mockResolvedValue(result),
  };
  chain.select.mockReturnValue(chain);
  chain.sort.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.lean.mockReturnValue(chain);
  return chain;
}

function messageDoc(
  from: string,
  to: string,
  text: string,
  createdAt = new Date('2026-10-01T10:00:00.000Z'),
  readAt: Date | null = null,
) {
  return {
    _id: new Types.ObjectId(),
    from: oid(from),
    to: oid(to),
    text,
    createdAt,
    readAt,
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('ChatService', () => {
  let service: ChatService;
  let messageModel: {
    create: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    aggregate: jest.Mock;
    updateMany: jest.Mock;
  };
  let userModel: { exists: jest.Mock; find: jest.Mock };
  let prisma: { application: { findFirst: jest.Mock; findMany: jest.Mock } };

  const recruiterId = newId();
  const candidateId = newId();
  const recruiter: ChatUser = { userId: recruiterId, role: UserRole.RECRUITER };
  const candidate: ChatUser = { userId: candidateId, role: UserRole.CANDIDATE };

  /** Makes canChat() succeed (recipient exists + application found). */
  function allowChat() {
    userModel.exists.mockReturnValue(queryChain({ _id: new Types.ObjectId() }));
    prisma.application.findFirst.mockResolvedValue({ id: 'application-uuid' });
  }

  beforeEach(async () => {
    messageModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      aggregate: jest.fn(),
      updateMany: jest.fn(),
    };
    userModel = { exists: jest.fn(), find: jest.fn() };
    prisma = { application: { findFirst: jest.fn(), findMany: jest.fn() } };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getModelToken(Message.name), useValue: messageModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(ChatService);
  });

  afterEach(() => jest.restoreAllMocks());

  // ─── sendMessage ────────────────────────────────────────────────────────────

  describe('sendMessage', () => {
    it('persists a trimmed message from the candidate and returns the contract JSON', async () => {
      allowChat();
      const doc = messageDoc(candidateId, recruiterId, 'Hello');
      messageModel.create.mockResolvedValue(doc);

      const result = await service.sendMessage(
        candidate,
        recruiterId,
        '  Hello  ',
      );

      expect(messageModel.create).toHaveBeenCalledWith({
        from: oid(candidateId),
        to: oid(recruiterId),
        text: 'Hello',
      });
      expect(result).toEqual({
        id: doc._id.toHexString(),
        from: candidateId,
        to: recruiterId,
        text: 'Hello',
        createdAt: '2026-10-01T10:00:00.000Z',
        readAt: null,
      });
    });

    it('checks the application candidate → job of this recruiter (candidate sender)', async () => {
      allowChat();
      messageModel.create.mockResolvedValue(
        messageDoc(candidateId, recruiterId, 'Hi'),
      );

      await service.sendMessage(candidate, recruiterId, 'Hi');

      expect(prisma.application.findFirst).toHaveBeenCalledWith({
        where: { applicantId: candidateId, job: { recruiterId } },
        select: { id: true },
      });
      expect(userModel.exists).toHaveBeenCalledWith({
        _id: recruiterId,
        role: UserRole.RECRUITER,
      });
    });

    it('checks the same rule in the other direction (recruiter sender)', async () => {
      allowChat();
      messageModel.create.mockResolvedValue(
        messageDoc(recruiterId, candidateId, 'Hi'),
      );

      await service.sendMessage(recruiter, candidateId, 'Hi');

      expect(prisma.application.findFirst).toHaveBeenCalledWith({
        where: { applicantId: candidateId, job: { recruiterId } },
        select: { id: true },
      });
      expect(userModel.exists).toHaveBeenCalledWith({
        _id: candidateId,
        role: UserRole.CANDIDATE,
      });
    });

    it('throws 403 when there is no application between the two users', async () => {
      userModel.exists.mockReturnValue(
        queryChain({ _id: new Types.ObjectId() }),
      );
      prisma.application.findFirst.mockResolvedValue(null);

      await expect(
        service.sendMessage(candidate, recruiterId, 'Hi'),
      ).rejects.toThrow(ForbiddenException);
      expect(messageModel.create).not.toHaveBeenCalled();
    });

    it('throws 403 when the recipient does not exist with the opposite role', async () => {
      userModel.exists.mockReturnValue(queryChain(null));
      prisma.application.findFirst.mockResolvedValue({
        id: 'application-uuid',
      });

      await expect(
        service.sendMessage(candidate, recruiterId, 'Hi'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 between two candidates (the recipient must be a recruiter)', async () => {
      const otherCandidate = newId();
      // Even with a matching application row, a candidate account is rejected
      prisma.application.findFirst.mockResolvedValue({ id: 'x' });
      userModel.exists.mockReturnValue(queryChain(null));

      await expect(
        service.sendMessage(candidate, otherCandidate, 'Hi'),
      ).rejects.toThrow(ForbiddenException);
      expect(userModel.exists).toHaveBeenCalledWith({
        _id: otherCandidate,
        role: UserRole.RECRUITER,
      });
    });

    it('throws 403 for an unknown sender role, without any query', async () => {
      await expect(
        service.sendMessage(
          { userId: candidateId, role: 'admin' },
          recruiterId,
          'Hi',
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.application.findFirst).not.toHaveBeenCalled();
      expect(userModel.exists).not.toHaveBeenCalled();
    });

    it.each([
      ['a short string', 'abc'],
      ['a 12-character string', 'aaaaaaaaaaaa'],
      ['a number', 42],
      ['undefined', undefined],
      ['an operator object', { $ne: null }],
    ])('throws 400 when the recipient id is %s', async (_label, to) => {
      await expect(service.sendMessage(candidate, to, 'Hi')).rejects.toThrow(
        BadRequestException,
      );
      expect(messageModel.create).not.toHaveBeenCalled();
    });

    it('throws 400 when sending a message to yourself', async () => {
      await expect(
        service.sendMessage(candidate, candidateId, 'Hi'),
      ).rejects.toThrow('You cannot send a message to yourself');
    });

    it.each([
      ['undefined', undefined],
      ['a number', 42],
      ['an object', { text: 'Hi' }],
      ['null', null],
    ])('throws 400 when the text is %s', async (_label, text) => {
      await expect(
        service.sendMessage(candidate, recruiterId, text),
      ).rejects.toThrow('Message text must be a string');
    });

    it.each(['', '   ', '\n\t '])(
      'throws 400 for empty text %j',
      async (text) => {
        await expect(
          service.sendMessage(candidate, recruiterId, text),
        ).rejects.toThrow('Message text must not be empty');
      },
    );

    it('throws 400 above 2000 characters (after trim)', async () => {
      await expect(
        service.sendMessage(candidate, recruiterId, 'x'.repeat(2001)),
      ).rejects.toThrow('Message text must be at most 2000 characters');
    });

    it('accepts exactly 2000 characters surrounded by spaces', async () => {
      allowChat();
      const text = 'x'.repeat(2000);
      messageModel.create.mockResolvedValue(
        messageDoc(candidateId, recruiterId, text),
      );

      await service.sendMessage(candidate, recruiterId, `   ${text}   `);

      expect(messageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ text }),
      );
    });
  });

  // ─── getMessages ────────────────────────────────────────────────────────────

  describe('getMessages', () => {
    it('queries both directions of the conversation, newest first, default limit 30', async () => {
      const docs = [
        messageDoc(candidateId, recruiterId, 'b'),
        messageDoc(recruiterId, candidateId, 'a'),
      ];
      const chain = queryChain(docs);
      messageModel.find.mockReturnValue(chain);

      const page = await service.getMessages(recruiterId, candidateId);

      expect(messageModel.find).toHaveBeenCalledWith({
        $or: [
          { from: oid(recruiterId), to: oid(candidateId) },
          { from: oid(candidateId), to: oid(recruiterId) },
        ],
      });
      expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
      expect(chain.limit).toHaveBeenCalledWith(HISTORY_DEFAULT_LIMIT + 1);
      expect(page.items.map((m) => m.text)).toEqual(['b', 'a']);
      expect(page.nextCursor).toBeNull();
    });

    it('returns nextCursor = id of the oldest returned item when more items exist', async () => {
      const docs = [1, 2, 3].map((i) =>
        messageDoc(candidateId, recruiterId, `m${i}`),
      );
      messageModel.find.mockReturnValue(queryChain(docs));

      const page = await service.getMessages(recruiterId, candidateId, {
        limit: 2,
      });

      expect(page.items).toHaveLength(2);
      expect(page.nextCursor).toBe(docs[1]._id.toHexString());
    });

    it('clamps the limit to 100 and accepts numeric strings', async () => {
      const chain = queryChain([]);
      messageModel.find.mockReturnValue(chain);

      await service.getMessages(recruiterId, candidateId, { limit: 500 });
      await service.getMessages(recruiterId, candidateId, { limit: '5' });

      expect(chain.limit).toHaveBeenNthCalledWith(1, HISTORY_MAX_LIMIT + 1);
      expect(chain.limit).toHaveBeenNthCalledWith(2, 6);
    });

    it.each([0, -1, 2.5, 'abc', {}])(
      'throws 400 for limit %j',
      async (limit) => {
        await expect(
          service.getMessages(recruiterId, candidateId, { limit }),
        ).rejects.toThrow(BadRequestException);
      },
    );

    it('throws 400 when the other user id is not an ObjectId', async () => {
      await expect(service.getMessages(recruiterId, 'nope')).rejects.toThrow(
        'Invalid user id',
      );
      expect(messageModel.find).not.toHaveBeenCalled();
    });

    it('throws 400 for a malformed cursor', async () => {
      await expect(
        service.getMessages(recruiterId, candidateId, { cursor: 'bad' }),
      ).rejects.toThrow('Invalid cursor');
    });

    it('throws 400 when the cursor message is not part of this conversation', async () => {
      const cursor = newId();
      messageModel.findOne.mockReturnValue(queryChain(null));

      await expect(
        service.getMessages(recruiterId, candidateId, { cursor }),
      ).rejects.toThrow('Invalid cursor');
      expect(messageModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: oid(cursor),
          $or: expect.any(Array) as unknown[],
        }),
      );
      expect(messageModel.find).not.toHaveBeenCalled();
    });

    it('applies a (createdAt, _id) keyset filter after the cursor', async () => {
      const cursorDoc = {
        _id: new Types.ObjectId(),
        createdAt: new Date('2026-10-02T08:00:00Z'),
      };
      messageModel.findOne.mockReturnValue(queryChain(cursorDoc));
      messageModel.find.mockReturnValue(queryChain([]));

      await service.getMessages(recruiterId, candidateId, {
        cursor: cursorDoc._id.toHexString(),
      });

      const [filter] = messageModel.find.mock.calls[0] as [
        { $and: [unknown, { $or: unknown[] }] },
      ];
      expect(filter.$and[1].$or).toEqual([
        { createdAt: { $lt: cursorDoc.createdAt } },
        { createdAt: cursorDoc.createdAt, _id: { $lt: cursorDoc._id } },
      ]);
    });
  });

  // ─── getConversations ───────────────────────────────────────────────────────

  describe('getConversations', () => {
    it('returns [] without looking up users when there is no message', async () => {
      messageModel.aggregate.mockReturnValue(queryChain([]));

      await expect(service.getConversations(recruiterId)).resolves.toEqual([]);
      expect(userModel.find).not.toHaveBeenCalled();
    });

    it('maps the aggregation with the other user public info, keeping the order', async () => {
      const otherCandidate = newId();
      const rows = [
        {
          _id: oid(candidateId),
          lastText: 'latest',
          lastCreatedAt: new Date('2026-10-03T10:00:00.000Z'),
          lastFrom: oid(candidateId),
          unreadCount: 3,
        },
        {
          _id: oid(otherCandidate),
          lastText: 'older',
          lastCreatedAt: new Date('2026-10-01T10:00:00.000Z'),
          lastFrom: oid(recruiterId),
          unreadCount: 0,
        },
      ];
      messageModel.aggregate.mockReturnValue(queryChain(rows));
      const usersChain = queryChain([
        {
          _id: oid(otherCandidate),
          firstName: 'Sara',
          lastName: 'B',
          avatarUrl: undefined,
        },
        {
          _id: oid(candidateId),
          firstName: 'Ali',
          lastName: 'K',
          avatarUrl: 'https://cdn/a.png',
        },
      ]);
      userModel.find.mockReturnValue(usersChain);

      const result = await service.getConversations(recruiterId);

      expect(usersChain.select).toHaveBeenCalledWith({
        firstName: 1,
        lastName: 1,
        avatarUrl: 1,
      });
      expect(result).toEqual([
        {
          user: {
            id: candidateId,
            firstName: 'Ali',
            lastName: 'K',
            avatarUrl: 'https://cdn/a.png',
          },
          lastMessage: {
            text: 'latest',
            createdAt: '2026-10-03T10:00:00.000Z',
            from: candidateId,
          },
          unreadCount: 3,
        },
        {
          user: {
            id: otherCandidate,
            firstName: 'Sara',
            lastName: 'B',
            avatarUrl: null,
          },
          lastMessage: {
            text: 'older',
            createdAt: '2026-10-01T10:00:00.000Z',
            from: recruiterId,
          },
          unreadCount: 0,
        },
      ]);
    });

    it('skips conversations whose user account no longer exists', async () => {
      messageModel.aggregate.mockReturnValue(
        queryChain([
          {
            _id: oid(candidateId),
            lastText: 'x',
            lastCreatedAt: new Date(),
            lastFrom: oid(candidateId),
            unreadCount: 1,
          },
        ]),
      );
      userModel.find.mockReturnValue(queryChain([]));

      await expect(service.getConversations(recruiterId)).resolves.toEqual([]);
    });

    it('scopes the aggregation to the current user and bounds the result', async () => {
      messageModel.aggregate.mockReturnValue(queryChain([]));

      await service.getConversations(recruiterId);

      const [pipeline] = messageModel.aggregate.mock.calls[0] as [
        Record<string, unknown>[],
      ];
      expect(pipeline[0]).toEqual({
        $match: { $or: [{ from: oid(recruiterId) }, { to: oid(recruiterId) }] },
      });
      expect(pipeline[pipeline.length - 1]).toEqual({
        $limit: CONVERSATIONS_MAX,
      });
    });

    it('throws 400 for an invalid user id', async () => {
      await expect(service.getConversations('nope')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── markAsRead ─────────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('marks only unread messages received from the other user and returns the count', async () => {
      messageModel.updateMany.mockReturnValue(queryChain({ modifiedCount: 4 }));

      await expect(
        service.markAsRead(recruiterId, candidateId),
      ).resolves.toEqual({
        updated: 4,
      });
      expect(messageModel.updateMany).toHaveBeenCalledWith(
        { from: oid(candidateId), to: oid(recruiterId), readAt: null },
        { $set: { readAt: expect.any(Date) as Date } },
      );
    });

    it('throws 400 for an invalid other user id', async () => {
      await expect(service.markAsRead(recruiterId, 'nope')).rejects.toThrow(
        BadRequestException,
      );
      expect(messageModel.updateMany).not.toHaveBeenCalled();
    });
  });

  // ─── Authorization helpers ──────────────────────────────────────────────────

  describe('canChatCached / resolveTypingTarget', () => {
    it('caches the authorization for its TTL, then checks again', async () => {
      allowChat();
      const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);

      await expect(service.canChatCached(candidate, recruiterId)).resolves.toBe(
        true,
      );
      await expect(service.canChatCached(candidate, recruiterId)).resolves.toBe(
        true,
      );
      expect(prisma.application.findFirst).toHaveBeenCalledTimes(1);

      now.mockReturnValue(1_000_000 + AUTHORIZATION_CACHE_TTL_MS + 1);
      await service.canChatCached(candidate, recruiterId);
      expect(prisma.application.findFirst).toHaveBeenCalledTimes(2);
    });

    it.each([
      ['invalid recipient', 'nope', true],
      ['non-boolean isTyping', newId(), 'yes'],
    ])(
      'drops typing with %s without any query',
      async (_label, to, isTyping) => {
        await expect(
          service.resolveTypingTarget(candidate, to, isTyping),
        ).resolves.toBeNull();
        expect(prisma.application.findFirst).not.toHaveBeenCalled();
      },
    );

    it('returns the typing target when the users may talk, null otherwise', async () => {
      allowChat();
      await expect(
        service.resolveTypingTarget(candidate, recruiterId, true),
      ).resolves.toEqual({ to: recruiterId, isTyping: true });

      prisma.application.findFirst.mockResolvedValue(null);
      await expect(
        service.resolveTypingTarget(recruiter, newId(), false),
      ).resolves.toBeNull();
    });
  });

  describe('getContactIds', () => {
    it('returns the distinct recruiters a candidate applied to', async () => {
      const otherRecruiter = newId();
      prisma.application.findMany.mockResolvedValue([
        { job: { recruiterId } },
        { job: { recruiterId } },
        { job: { recruiterId: otherRecruiter } },
        { job: { recruiterId: 'not-an-object-id' } },
      ]);

      await expect(service.getContactIds(candidate)).resolves.toEqual([
        recruiterId,
        otherRecruiter,
      ]);
      expect(prisma.application.findMany).toHaveBeenCalledWith({
        where: { applicantId: candidateId },
        select: { job: { select: { recruiterId: true } } },
      });
    });

    it('returns the distinct applicants of a recruiter', async () => {
      prisma.application.findMany.mockResolvedValue([
        { applicantId: candidateId },
      ]);

      await expect(service.getContactIds(recruiter)).resolves.toEqual([
        candidateId,
      ]);
      expect(prisma.application.findMany).toHaveBeenCalledWith({
        where: { job: { recruiterId } },
        select: { applicantId: true },
        distinct: ['applicantId'],
      });
    });

    it('returns [] for an unknown role without querying', async () => {
      await expect(
        service.getContactIds({ userId: candidateId, role: 'admin' }),
      ).resolves.toEqual([]);
      expect(prisma.application.findMany).not.toHaveBeenCalled();
    });
  });
});
