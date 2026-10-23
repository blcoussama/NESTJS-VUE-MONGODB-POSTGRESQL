import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { Prisma } from '@prisma/client';
import { JobsService } from './jobs.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UserRole } from '../users/schemas/user.schema';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { ExperienceLevel, JobSort, JobType, SalaryType } from './job.enums';

/** Typed access to the arguments of a recorded mock call. */
function arg(mock: jest.Mock, call = 0, index = 0): unknown {
  return (mock.mock.calls as unknown[][])[call][index];
}

const OWNER = '6710f0c2a1b2c3d4e5f60718';
const OTHER = '6710f0c2a1b2c3d4e5f60719';
const COMPANY_ID = '1b4e28ba-2fa1-4d3b-a3f5-ef19b5a7633b';
const JOB_ID = '9b2f1c3e-4d5a-4b6c-8d7e-0f1a2b3c4d5e';

function createDto(overrides: Partial<CreateJobDto> = {}): CreateJobDto {
  return {
    title: 'Backend Developer',
    description: 'Build REST APIs with NestJS.',
    location: 'Tanger',
    jobType: JobType.FULL_TIME,
    experienceLevel: ExperienceLevel.JUNIOR,
    requirements: ['TypeScript'],
    salaryType: SalaryType.RANGE,
    salary: { min: 8000, max: 12000, currency: 'MAD' },
    companyId: COMPANY_ID,
    ...overrides,
  };
}

function query(plain: Record<string, unknown> = {}): QueryJobsDto {
  return plainToInstance(QueryJobsDto, plain);
}

describe('JobsService', () => {
  let module: TestingModule;
  let service: JobsService;
  let prisma: {
    $transaction: jest.Mock;
    company: { findUnique: jest.Mock };
    job: {
      create: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    application: { findUnique: jest.Mock };
    savedJob: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      // Array form: resolve each query promise in order
      $transaction: jest.fn((queries: Promise<unknown>[]) =>
        Promise.all(queries),
      ),
      company: { findUnique: jest.fn() },
      job: {
        create: jest.fn().mockResolvedValue({ id: JOB_ID }),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: JOB_ID }),
        delete: jest.fn().mockResolvedValue({ id: JOB_ID }),
      },
      application: { findUnique: jest.fn().mockResolvedValue(null) },
      savedJob: { findUnique: jest.fn().mockResolvedValue(null) },
    };

    module = await Test.createTestingModule({
      providers: [JobsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(JobsService);
  });

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('throws NotFoundException if the company does not exist', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(service.create(OWNER, createDto())).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ForbiddenException when posting for someone else's company", async () => {
      prisma.company.findUnique.mockResolvedValue({ ownerId: OTHER });

      await expect(service.create(OWNER, createDto())).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.job.create).not.toHaveBeenCalled();
    });

    it('creates the job with recruiterId = current user and returns it with its company', async () => {
      prisma.company.findUnique.mockResolvedValue({ ownerId: OWNER });

      await service.create(OWNER, createDto());

      const args = arg(prisma.job.create, 0, 0) as {
        data: Record<string, unknown>;
        select: Record<string, unknown>;
      };
      expect(args.data).toMatchObject({
        title: 'Backend Developer',
        recruiterId: OWNER,
        companyId: COMPANY_ID,
        salary: { min: 8000, max: 12000, currency: 'MAD' },
      });
      expect(args.select.company).toEqual({
        select: { id: true, name: true, logoUrl: true },
      });
    });

    it('stores NULL salary for a negotiable job', async () => {
      prisma.company.findUnique.mockResolvedValue({ ownerId: OWNER });

      await service.create(
        OWNER,
        createDto({ salaryType: SalaryType.NEGOTIABLE, salary: undefined }),
      );

      const args = arg(prisma.job.create, 0, 0) as {
        data: { salary: unknown };
      };
      expect(args.data.salary).toBe(Prisma.DbNull);
    });

    it('rejects an inconsistent range salary (min > max)', async () => {
      prisma.company.findUnique.mockResolvedValue({ ownerId: OWNER });

      await expect(
        service.create(
          OWNER,
          createDto({ salary: { min: 15000, max: 10000 } }),
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('lists open jobs only, newest first, page 1 / limit 10 by default', async () => {
      await service.findAll(query());

      const args = arg(prisma.job.findMany, 0, 0) as Record<string, unknown>;
      expect(args.where).toEqual({ isOpen: true });
      expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
      expect(args.skip).toBe(0);
      expect(args.take).toBe(10);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('applies every filter (search on title OR description, case-insensitive)', async () => {
      await service.findAll(
        query({
          search: 'nest',
          location: 'Tanger',
          jobType: 'internship',
          experienceLevel: 'entry',
          companyId: COMPANY_ID,
        }),
      );

      const args = arg(prisma.job.count, 0, 0) as { where: unknown };
      expect(args.where).toEqual({
        isOpen: true,
        OR: [
          { title: { contains: 'nest', mode: 'insensitive' } },
          { description: { contains: 'nest', mode: 'insensitive' } },
        ],
        location: { contains: 'Tanger', mode: 'insensitive' },
        jobType: 'internship',
        experienceLevel: 'entry',
        companyId: COMPANY_ID,
      });
    });

    it('paginates and computes totalPages', async () => {
      prisma.job.count.mockResolvedValue(23);
      prisma.job.findMany.mockResolvedValue([{ id: 'a' }]);

      const result = await service.findAll(query({ page: '3', limit: '5' }));

      const args = arg(prisma.job.findMany, 0, 0) as {
        skip: number;
        take: number;
      };
      expect(args.skip).toBe(10);
      expect(args.take).toBe(5);
      expect(result).toEqual({
        items: [{ id: 'a' }],
        total: 23,
        page: 3,
        limit: 5,
        totalPages: 5,
      });
    });

    it('sorts oldest first with sort=oldest', async () => {
      await service.findAll(query({ sort: JobSort.OLDEST }));

      const args = arg(prisma.job.findMany, 0, 0) as {
        orderBy: unknown;
      };
      expect(args.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
    });
  });

  // ─── findMine ─────────────────────────────────────────────────────────────

  describe('findMine', () => {
    it("returns the recruiter's open AND closed jobs with applicationsCount (non-withdrawn)", async () => {
      prisma.job.findMany.mockResolvedValue([
        { id: 'a', isOpen: false, _count: { applications: 4 } },
      ]);

      const result = await service.findMine(OWNER);

      const args = arg(prisma.job.findMany, 0, 0) as {
        where: unknown;
        select: { _count: unknown };
      };
      expect(args.where).toEqual({ company: { ownerId: OWNER } });
      expect(args.select._count).toEqual({
        select: {
          applications: { where: { status: { not: 'WITHDRAWN' } } },
        },
      });
      expect(result).toEqual([
        { id: 'a', isOpen: false, applicationsCount: 4 },
      ]);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('throws NotFoundException for an unknown job', async () => {
      prisma.job.findUnique.mockResolvedValue(null);

      await expect(service.findOne(JOB_ID)).rejects.toThrow(NotFoundException);
    });

    it('returns the job without personal flags for an anonymous visitor', async () => {
      prisma.job.findUnique.mockResolvedValue({ id: JOB_ID });

      const result = await service.findOne(JOB_ID, null);

      expect(result).toEqual({ id: JOB_ID });
      expect(prisma.application.findUnique).not.toHaveBeenCalled();
    });

    it('adds isSaved / hasApplied / applicationStatus for a candidate', async () => {
      prisma.job.findUnique.mockResolvedValue({ id: JOB_ID });
      prisma.application.findUnique.mockResolvedValue({
        id: 'app',
        status: 'PENDING',
      });
      prisma.savedJob.findUnique.mockResolvedValue({ id: 'saved' });

      const result = await service.findOne(JOB_ID, {
        userId: OWNER,
        email: 'c@example.com',
        role: UserRole.CANDIDATE,
      });

      expect(prisma.application.findUnique).toHaveBeenCalledWith({
        where: { jobId_applicantId: { jobId: JOB_ID, applicantId: OWNER } },
        select: { id: true, status: true },
      });
      expect(result).toEqual({
        id: JOB_ID,
        isSaved: true,
        hasApplied: true,
        applicationStatus: 'PENDING',
      });
    });

    it('does not add candidate flags for a recruiter', async () => {
      prisma.job.findUnique.mockResolvedValue({ id: JOB_ID });

      const result = await service.findOne(JOB_ID, {
        userId: OWNER,
        email: 'r@example.com',
        role: UserRole.RECRUITER,
      });

      expect(result).not.toHaveProperty('isSaved');
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    const ownedJob = {
      id: JOB_ID,
      title: 'Dev',
      isOpen: true,
      salaryType: 'range',
      salary: { min: 1000, max: 2000 },
      company: { ownerId: OWNER },
    };

    it('throws NotFoundException for an unknown job', async () => {
      prisma.job.findUnique.mockResolvedValue(null);

      await expect(
        service.update(JOB_ID, OWNER, { isOpen: false }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for a recruiter who does not own the company', async () => {
      prisma.job.findUnique.mockResolvedValue(ownedJob);

      await expect(
        service.update(JOB_ID, OTHER, { isOpen: false }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.job.update).not.toHaveBeenCalled();
    });

    it('closes a job (isOpen=false) without touching other fields', async () => {
      prisma.job.findUnique.mockResolvedValue(ownedJob);

      await service.update(JOB_ID, OWNER, { isOpen: false });

      const args = arg(prisma.job.update, 0, 0) as { data: unknown };
      expect(args.data).toEqual({ isOpen: false });
    });

    it('re-validates the salary against the stored salaryType', async () => {
      prisma.job.findUnique.mockResolvedValue(ownedJob);

      await expect(
        service.update(JOB_ID, OWNER, { salary: { min: 5000 } }),
      ).rejects.toThrow(BadRequestException);
    });

    it('switching to negotiable with the stored amounts is rejected, with salary:null it is accepted', async () => {
      prisma.job.findUnique.mockResolvedValue(ownedJob);

      await expect(
        service.update(JOB_ID, OWNER, { salaryType: SalaryType.NEGOTIABLE }),
      ).rejects.toThrow(BadRequestException);

      await service.update(JOB_ID, OWNER, {
        salaryType: SalaryType.NEGOTIABLE,
        salary: null,
      });
      const args = arg(prisma.job.update, 0, 0) as {
        data: { salary: unknown; salaryType: string };
      };
      expect(args.data.salaryType).toBe('negotiable');
      expect(args.data.salary).toBe(Prisma.DbNull);
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('throws ForbiddenException for a non-owner', async () => {
      prisma.job.findUnique.mockResolvedValue({
        id: JOB_ID,
        company: { ownerId: OWNER },
      });

      await expect(service.remove(JOB_ID, OTHER)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.job.delete).not.toHaveBeenCalled();
    });

    it('deletes the job (applications and saved jobs cascade in the DB)', async () => {
      prisma.job.findUnique.mockResolvedValue({
        id: JOB_ID,
        company: { ownerId: OWNER },
      });

      const result = await service.remove(JOB_ID, OWNER);

      expect(prisma.job.delete).toHaveBeenCalledWith({ where: { id: JOB_ID } });
      expect(result).toEqual({ message: 'Job deleted successfully.' });
    });
  });
});
