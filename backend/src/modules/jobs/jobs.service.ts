import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Paginated, toPaginated } from '../../common/dto/paginated';
import { UserRole } from '../users/schemas/user.schema';
import type { AuthenticatedUser } from '../auth/strategies/jwt-access.strategy';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { JobSort, SalaryType } from './job.enums';
import { normalizeSalary, StoredSalary } from './salary.rules';

/** Public fields of a job, with its company summary (one JOIN, no N+1). */
export const JOB_SELECT = {
  id: true,
  title: true,
  description: true,
  location: true,
  jobType: true,
  experienceLevel: true,
  requirements: true,
  salaryType: true,
  salary: true,
  isOpen: true,
  companyId: true,
  recruiterId: true,
  createdAt: true,
  updatedAt: true,
  company: { select: { id: true, name: true, logoUrl: true } },
} satisfies Prisma.JobSelect;

export type JobView = Prisma.JobGetPayload<{ select: typeof JOB_SELECT }>;

/** Withdrawn applications are not counted as candidacies. */
const ACTIVE_APPLICATIONS = {
  status: { not: ApplicationStatus.WITHDRAWN },
} satisfies Prisma.ApplicationWhereInput;

function toJsonSalary(
  salary: StoredSalary | null,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return salary === null ? Prisma.DbNull : { ...salary };
}

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(recruiterId: string, dto: CreateJobDto): Promise<JobView> {
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
      select: { ownerId: true },
    });
    if (!company) {
      throw new NotFoundException('Company not found.');
    }
    if (company.ownerId !== recruiterId) {
      throw new ForbiddenException(
        'You can only post jobs for your own company.',
      );
    }

    const salary = normalizeSalary(dto.salaryType, dto.salary);

    return this.prisma.job.create({
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        jobType: dto.jobType,
        experienceLevel: dto.experienceLevel,
        requirements: dto.requirements,
        salaryType: dto.salaryType,
        salary: toJsonSalary(salary),
        companyId: dto.companyId,
        recruiterId,
      },
      select: JOB_SELECT,
    });
  }

  // ─── Public list (open jobs only) ─────────────────────────────────────────

  async findAll(query: QueryJobsDto): Promise<Paginated<JobView>> {
    const where: Prisma.JobWhereInput = { isOpen: true };

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.location) {
      where.location = { contains: query.location, mode: 'insensitive' };
    }
    if (query.jobType) where.jobType = query.jobType;
    if (query.experienceLevel) where.experienceLevel = query.experienceLevel;
    if (query.companyId) where.companyId = query.companyId;

    const order: Prisma.SortOrder =
      query.sort === JobSort.OLDEST ? 'asc' : 'desc';

    // Count + page in one transaction: consistent total for the page
    const [total, items] = await this.prisma.$transaction([
      this.prisma.job.count({ where }),
      this.prisma.job.findMany({
        where,
        select: JOB_SELECT,
        orderBy: [{ createdAt: order }, { id: order }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return toPaginated(items, total, query.page, query.limit);
  }

  // ─── Recruiter's own jobs (open AND closed) ───────────────────────────────

  async findMine(recruiterId: string) {
    const jobs = await this.prisma.job.findMany({
      where: { company: { ownerId: recruiterId } },
      select: {
        ...JOB_SELECT,
        _count: { select: { applications: { where: ACTIVE_APPLICATIONS } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return jobs.map(({ _count, ...job }) => ({
      ...job,
      applicationsCount: _count.applications,
    }));
  }

  // ─── Detail (public, personalised for a logged-in candidate) ──────────────

  async findOne(id: string, viewer?: AuthenticatedUser | null) {
    const isCandidate = viewer?.role === UserRole.CANDIDATE;

    const [job, application, saved] = await Promise.all([
      this.prisma.job.findUnique({ where: { id }, select: JOB_SELECT }),
      isCandidate
        ? this.prisma.application.findUnique({
            where: {
              jobId_applicantId: { jobId: id, applicantId: viewer.userId },
            },
            select: { id: true, status: true },
          })
        : null,
      isCandidate
        ? this.prisma.savedJob.findUnique({
            where: { jobId_userId: { jobId: id, userId: viewer.userId } },
            select: { id: true },
          })
        : null,
    ]);

    if (!job) {
      throw new NotFoundException('Job not found.');
    }

    if (!isCandidate) return job;

    return {
      ...job,
      isSaved: saved !== null,
      hasApplied: application !== null,
      applicationStatus: application?.status ?? null,
    };
  }

  // ─── Update (owner only) ──────────────────────────────────────────────────

  async update(
    id: string,
    recruiterId: string,
    dto: UpdateJobDto,
  ): Promise<JobView> {
    const job = await this.findOwnedJob(id, recruiterId);

    const data: Prisma.JobUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.jobType !== undefined) data.jobType = dto.jobType;
    if (dto.experienceLevel !== undefined)
      data.experienceLevel = dto.experienceLevel;
    if (dto.requirements !== undefined) data.requirements = dto.requirements;
    if (dto.isOpen !== undefined) data.isOpen = dto.isOpen;

    // Re-check salary rules against the resulting (type, salary) pair
    if (dto.salaryType !== undefined || dto.salary !== undefined) {
      const salaryType = dto.salaryType ?? (job.salaryType as SalaryType);
      const salary =
        dto.salary !== undefined
          ? dto.salary
          : (job.salary as StoredSalary | null);
      data.salaryType = salaryType;
      data.salary = toJsonSalary(normalizeSalary(salaryType, salary));
    }

    return this.prisma.job.update({
      where: { id },
      data,
      select: JOB_SELECT,
    });
  }

  // ─── Delete (owner only, cascades to applications and saved jobs) ─────────

  async remove(id: string, recruiterId: string) {
    await this.findOwnedJob(id, recruiterId);
    await this.prisma.job.delete({ where: { id } });
    return { message: 'Job deleted successfully.' };
  }

  // ─── Shared with the applications module ──────────────────────────────────

  /**
   * 404 if the job does not exist, 403 if the recruiter does not own the
   * company that published it.
   */
  async findOwnedJob(id: string, recruiterId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        isOpen: true,
        salaryType: true,
        salary: true,
        company: { select: { ownerId: true } },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found.');
    }
    if (job.company.ownerId !== recruiterId) {
      throw new ForbiddenException('You do not own this job.');
    }

    return job;
  }
}
