import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import {
  ApplicationsService,
  WITHDRAWN_RETENTION_MS,
} from './applications.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { UsersService } from '../users/users.service';
import { StorageService } from '../../common/storage/storage.service';
import { ExperienceLevel } from '../jobs/job.enums';

/** Typed access to the arguments of a recorded mock call. */
function arg(mock: jest.Mock, call = 0, index = 0): unknown {
  return (mock.mock.calls as unknown[][])[call][index];
}

const RECRUITER = '6710f0c2a1b2c3d4e5f60718';
const OTHER_RECRUITER = '6710f0c2a1b2c3d4e5f60719';
const CANDIDATE = '6710f0c2a1b2c3d4e5f6071a';
const JOB_ID = '9b2f1c3e-4d5a-4b6c-8d7e-0f1a2b3c4d5e';
const APP_ID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function ownedApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: APP_ID,
    status: 'PENDING',
    applicantId: CANDIDATE,
    job: { company: { ownerId: RECRUITER } },
    ...overrides,
  };
}

describe('ApplicationsService', () => {
  let module: TestingModule;
  let service: ApplicationsService;

  // The same mock serves as the root client and as the transaction client
  let prisma: {
    $transaction: jest.Mock;
    job: { findUnique: jest.Mock };
    application: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      updateMany: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
  let jobsService: { findOwnedJob: jest.Mock };
  let usersService: {
    findApplicantSummaries: jest.Mock;
    getCvKey: jest.Mock;
  };
  let storage: { presignDownload: jest.Mock };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      job: { findUnique: jest.fn() },
      application: {
        create: jest.fn().mockResolvedValue({ id: APP_ID }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: APP_ID }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    prisma.$transaction.mockImplementation(
      (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );
    jobsService = { findOwnedJob: jest.fn().mockResolvedValue({ id: JOB_ID }) };
    usersService = {
      findApplicantSummaries: jest.fn().mockResolvedValue(new Map()),
      getCvKey: jest.fn(),
    };
    storage = { presignDownload: jest.fn().mockResolvedValue('https://cv') };

    module = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: JobsService, useValue: jobsService },
        { provide: UsersService, useValue: usersService },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = module.get(ApplicationsService);
  });

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
  });

  // ─── apply ────────────────────────────────────────────────────────────────

  describe('apply', () => {
    const dto = { experienceYears: 2, experienceLevel: ExperienceLevel.JUNIOR };

    it('throws NotFoundException if the job does not exist', async () => {
      prisma.job.findUnique.mockResolvedValue(null);

      await expect(service.apply(JOB_ID, CANDIDATE, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException if the job is closed', async () => {
      prisma.job.findUnique.mockResolvedValue({ isOpen: false });

      await expect(service.apply(JOB_ID, CANDIDATE, dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.application.create).not.toHaveBeenCalled();
    });

    it('creates a PENDING application for the current candidate', async () => {
      prisma.job.findUnique.mockResolvedValue({ isOpen: true });

      await service.apply(JOB_ID, CANDIDATE, dto);

      const args = arg(prisma.application.create, 0, 0) as {
        data: unknown;
      };
      expect(args.data).toEqual({
        jobId: JOB_ID,
        applicantId: CANDIDATE,
        experienceYears: 2,
        experienceLevel: 'junior',
      });
    });

    it('maps the unique (jobId, applicantId) violation to 409', async () => {
      prisma.job.findUnique.mockResolvedValue({ isOpen: true });
      prisma.application.create.mockRejectedValue(uniqueViolation());

      await expect(service.apply(JOB_ID, CANDIDATE, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rethrows unexpected errors', async () => {
      prisma.job.findUnique.mockResolvedValue({ isOpen: true });
      prisma.application.create.mockRejectedValue(new Error('db down'));

      await expect(service.apply(JOB_ID, CANDIDATE, dto)).rejects.toThrow(
        'db down',
      );
    });
  });

  // ─── findMine ─────────────────────────────────────────────────────────────

  describe('findMine', () => {
    it("returns the candidate's applications with a job + company summary", async () => {
      await service.findMine(CANDIDATE);

      const args = arg(prisma.application.findMany, 0, 0) as {
        where: unknown;
        select: { job: { select: Record<string, unknown> } };
      };
      expect(args.where).toEqual({ applicantId: CANDIDATE });
      expect(args.select.job.select).toMatchObject({
        id: true,
        title: true,
        recruiterId: true,
        company: { select: { id: true, name: true, logoUrl: true } },
      });
    });
  });

  // ─── findForJob ───────────────────────────────────────────────────────────

  describe('findForJob', () => {
    it('propagates the ownership check (403/404) of the job', async () => {
      jobsService.findOwnedJob.mockRejectedValue(new ForbiddenException());

      await expect(service.findForJob(JOB_ID, OTHER_RECRUITER)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.application.findMany).not.toHaveBeenCalled();
    });

    it('hides withdrawn applications and attaches applicants loaded in ONE query', async () => {
      prisma.application.findMany.mockResolvedValue([
        { id: 'a1', applicantId: CANDIDATE },
        { id: 'a2', applicantId: 'deleted-user' },
      ]);
      const summary = {
        id: CANDIDATE,
        firstName: 'C',
        lastName: 'D',
        email: 'c@example.com',
        avatarUrl: null,
        hasCv: true,
      };
      usersService.findApplicantSummaries.mockResolvedValue(
        new Map([[CANDIDATE, summary]]),
      );

      const result = await service.findForJob(JOB_ID, RECRUITER);

      const args = arg(prisma.application.findMany, 0, 0) as {
        where: unknown;
      };
      expect(args.where).toEqual({
        jobId: JOB_ID,
        status: { not: 'WITHDRAWN' },
      });
      expect(usersService.findApplicantSummaries).toHaveBeenCalledTimes(1);
      expect(usersService.findApplicantSummaries).toHaveBeenCalledWith([
        CANDIDATE,
        'deleted-user',
      ]);
      expect(result).toEqual([
        { id: 'a1', applicantId: CANDIDATE, applicant: summary },
        { id: 'a2', applicantId: 'deleted-user', applicant: null },
      ]);
    });
  });

  // ─── updateStatus ─────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('runs inside a Prisma interactive transaction', async () => {
      prisma.application.findUnique.mockResolvedValue(ownedApplication());

      await service.updateStatus(APP_ID, RECRUITER, 'ACCEPTED');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException for an unknown application', async () => {
      prisma.application.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus(APP_ID, RECRUITER, 'ACCEPTED'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if the recruiter does not own the job', async () => {
      prisma.application.findUnique.mockResolvedValue(ownedApplication());

      await expect(
        service.updateStatus(APP_ID, OTHER_RECRUITER, 'ACCEPTED'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.application.updateMany).not.toHaveBeenCalled();
    });

    it.each(['ACCEPTED', 'REJECTED', 'WITHDRAWN'])(
      'throws ConflictException when the application is already %s',
      async (status) => {
        prisma.application.findUnique.mockResolvedValue(
          ownedApplication({ status }),
        );

        await expect(
          service.updateStatus(APP_ID, RECRUITER, 'REJECTED'),
        ).rejects.toThrow(ConflictException);
      },
    );

    it('uses a conditional update (status = PENDING) and returns the updated application', async () => {
      prisma.application.findUnique.mockResolvedValue(ownedApplication());
      prisma.application.findUniqueOrThrow.mockResolvedValue({
        id: APP_ID,
        status: 'ACCEPTED',
      });

      const result = await service.updateStatus(APP_ID, RECRUITER, 'ACCEPTED');

      expect(prisma.application.updateMany).toHaveBeenCalledWith({
        where: { id: APP_ID, status: 'PENDING' },
        data: { status: 'ACCEPTED' },
      });
      expect(result).toEqual({ id: APP_ID, status: 'ACCEPTED' });
    });

    it('throws ConflictException if a concurrent update changed the status first', async () => {
      prisma.application.findUnique.mockResolvedValue(ownedApplication());
      prisma.application.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateStatus(APP_ID, RECRUITER, 'ACCEPTED'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── withdraw ─────────────────────────────────────────────────────────────

  describe('withdraw', () => {
    it('throws NotFoundException for an unknown application', async () => {
      prisma.application.findUnique.mockResolvedValue(null);

      await expect(service.withdraw(APP_ID, CANDIDATE)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ForbiddenException for another candidate's application", async () => {
      prisma.application.findUnique.mockResolvedValue({
        applicantId: 'someone-else',
        status: 'PENDING',
      });

      await expect(service.withdraw(APP_ID, CANDIDATE)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ConflictException if the application is not PENDING', async () => {
      prisma.application.findUnique.mockResolvedValue({
        applicantId: CANDIDATE,
        status: 'ACCEPTED',
      });

      await expect(service.withdraw(APP_ID, CANDIDATE)).rejects.toThrow(
        ConflictException,
      );
    });

    it('sets WITHDRAWN, withdrawnAt = now and expiresAt = now + 30 days', async () => {
      prisma.application.findUnique.mockResolvedValue({
        applicantId: CANDIDATE,
        status: 'PENDING',
      });

      await service.withdraw(APP_ID, CANDIDATE);

      const args = arg(prisma.application.updateMany, 0, 0) as {
        where: unknown;
        data: { status: string; withdrawnAt: Date; expiresAt: Date };
      };
      expect(args.where).toEqual({
        id: APP_ID,
        applicantId: CANDIDATE,
        status: 'PENDING',
      });
      expect(args.data.status).toBe('WITHDRAWN');
      expect(
        args.data.expiresAt.getTime() - args.data.withdrawnAt.getTime(),
      ).toBe(WITHDRAWN_RETENTION_MS);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException if the conditional update matched nothing', async () => {
      prisma.application.findUnique.mockResolvedValue({
        applicantId: CANDIDATE,
        status: 'PENDING',
      });
      prisma.application.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.withdraw(APP_ID, CANDIDATE)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─── getCvUrl ─────────────────────────────────────────────────────────────

  describe('getCvUrl', () => {
    it('throws NotFoundException for an unknown application', async () => {
      prisma.application.findUnique.mockResolvedValue(null);

      await expect(service.getCvUrl(APP_ID, RECRUITER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException for a recruiter who does not own the job', async () => {
      prisma.application.findUnique.mockResolvedValue(ownedApplication());

      await expect(service.getCvUrl(APP_ID, OTHER_RECRUITER)).rejects.toThrow(
        ForbiddenException,
      );
      expect(storage.presignDownload).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException once the candidate has withdrawn', async () => {
      prisma.application.findUnique.mockResolvedValue(
        ownedApplication({ status: 'WITHDRAWN' }),
      );

      await expect(service.getCvUrl(APP_ID, RECRUITER)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException if the candidate has no CV', async () => {
      prisma.application.findUnique.mockResolvedValue(ownedApplication());
      usersService.getCvKey.mockResolvedValue(null);

      await expect(service.getCvUrl(APP_ID, RECRUITER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("returns a 15-minute presigned URL of the applicant's CV", async () => {
      prisma.application.findUnique.mockResolvedValue(ownedApplication());
      usersService.getCvKey.mockResolvedValue('cvs/key.pdf');

      const result = await service.getCvUrl(APP_ID, RECRUITER);

      expect(usersService.getCvKey).toHaveBeenCalledWith(CANDIDATE);
      expect(storage.presignDownload).toHaveBeenCalledWith(
        'cvs/key.pdf',
        'cvs',
      );
      expect(result).toEqual({ url: 'https://cv', expiresIn: 900 });
    });
  });

  // ─── purgeExpired ─────────────────────────────────────────────────────────

  describe('purgeExpired', () => {
    it('deletes withdrawn applications whose expiresAt has passed', async () => {
      prisma.application.deleteMany.mockResolvedValue({ count: 3 });
      const now = new Date('2026-10-19T03:00:00Z');

      await expect(service.purgeExpired(now)).resolves.toBe(3);
      expect(prisma.application.deleteMany).toHaveBeenCalledWith({
        where: { status: 'WITHDRAWN', expiresAt: { lt: now } },
      });
    });
  });
});
