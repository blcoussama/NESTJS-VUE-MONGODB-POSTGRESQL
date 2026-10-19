import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { SavedJobsService } from './saved-jobs.service';
import { PrismaService } from '../../database/prisma/prisma.service';

/** Typed access to the arguments of a recorded mock call. */
function arg(mock: jest.Mock, call = 0, index = 0): unknown {
  return (mock.mock.calls as unknown[][])[call][index];
}

const USER = '6710f0c2a1b2c3d4e5f6071a';
const JOB_ID = '9b2f1c3e-4d5a-4b6c-8d7e-0f1a2b3c4d5e';

describe('SavedJobsService', () => {
  let module: TestingModule;
  let service: SavedJobsService;
  let prisma: {
    job: { findUnique: jest.Mock };
    savedJob: {
      upsert: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      deleteMany: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      job: { findUnique: jest.fn().mockResolvedValue({ id: JOB_ID }) },
      savedJob: {
        upsert: jest.fn().mockResolvedValue({ id: 'saved', jobId: JOB_ID }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'saved' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    module = await Test.createTestingModule({
      providers: [
        SavedJobsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(SavedJobsService);
  });

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
  });

  describe('save', () => {
    it('throws NotFoundException for an unknown job', async () => {
      prisma.job.findUnique.mockResolvedValue(null);

      await expect(service.save(JOB_ID, USER)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.savedJob.upsert).not.toHaveBeenCalled();
    });

    it('is idempotent: upsert on the (jobId, userId) unique key', async () => {
      const result = await service.save(JOB_ID, USER);

      expect(prisma.savedJob.upsert).toHaveBeenCalledWith({
        where: { jobId_userId: { jobId: JOB_ID, userId: USER } },
        create: { jobId: JOB_ID, userId: USER },
        update: {},
        select: { id: true, jobId: true, createdAt: true },
      });
      expect(result).toEqual({ id: 'saved', jobId: JOB_ID });
    });

    it('returns the existing entry when a concurrent save wins the race (P2002)', async () => {
      prisma.savedJob.upsert.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.save(JOB_ID, USER)).resolves.toEqual({
        id: 'saved',
      });
    });

    it('rethrows other errors', async () => {
      prisma.savedJob.upsert.mockRejectedValue(new Error('db down'));

      await expect(service.save(JOB_ID, USER)).rejects.toThrow('db down');
    });
  });

  describe('unsave', () => {
    it('is idempotent: deleteMany scoped to the current user', async () => {
      prisma.savedJob.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.unsave(JOB_ID, USER);

      expect(prisma.savedJob.deleteMany).toHaveBeenCalledWith({
        where: { jobId: JOB_ID, userId: USER },
      });
      expect(result).toEqual({ message: 'Job removed from saved jobs.' });
    });
  });

  describe('findMine', () => {
    it("lists the user's saved jobs, newest first, with a job summary", async () => {
      await service.findMine(USER);

      const args = arg(prisma.savedJob.findMany, 0, 0) as {
        where: unknown;
        orderBy: unknown;
        select: { job: { select: Record<string, unknown> } };
      };
      expect(args.where).toEqual({ userId: USER });
      expect(args.orderBy).toEqual({ createdAt: 'desc' });
      expect(args.select.job.select).toMatchObject({
        id: true,
        title: true,
        isOpen: true,
        company: { select: { id: true, name: true, logoUrl: true } },
      });
    });
  });
});
