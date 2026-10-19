import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  PRESIGNED_URL_TTL_SECONDS,
  StorageService,
} from '../../common/storage/storage.service';
import { JobsService } from '../jobs/jobs.service';
import { UsersService } from '../users/users.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { RecruiterDecision } from './dto/update-application-status.dto';

/** A withdrawn application is purged 30 days after the withdrawal. */
export const WITHDRAWN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const APPLICATION_SELECT = {
  id: true,
  jobId: true,
  applicantId: true,
  experienceYears: true,
  experienceLevel: true,
  status: true,
  withdrawnAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ApplicationSelect;

/** Ownership chain used for every recruiter authorization check. */
const OWNERSHIP_SELECT = {
  id: true,
  status: true,
  applicantId: true,
  job: { select: { company: { select: { ownerId: true } } } },
} satisfies Prisma.ApplicationSelect;

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly usersService: UsersService,
    private readonly storage: StorageService,
  ) {}

  // ─── Apply (candidate) ────────────────────────────────────────────────────

  async apply(jobId: string, applicantId: string, dto: CreateApplicationDto) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { isOpen: true },
    });
    if (!job || !job.isOpen) {
      throw new NotFoundException('Job not found or no longer open.');
    }

    try {
      return await this.prisma.application.create({
        data: {
          jobId,
          applicantId,
          experienceYears: dto.experienceYears,
          experienceLevel: dto.experienceLevel,
        },
        select: APPLICATION_SELECT,
      });
    } catch (error) {
      // UNIQUE (jobId, applicantId): one application per job and candidate
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('You have already applied to this job.');
      }
      throw error;
    }
  }

  // ─── Candidate's applications ─────────────────────────────────────────────

  async findMine(applicantId: string) {
    return this.prisma.application.findMany({
      where: { applicantId },
      select: {
        ...APPLICATION_SELECT,
        job: {
          select: {
            id: true,
            title: true,
            location: true,
            jobType: true,
            isOpen: true,
            recruiterId: true,
            company: { select: { id: true, name: true, logoUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Applications of a job (owner recruiter) ──────────────────────────────

  async findForJob(jobId: string, recruiterId: string) {
    await this.jobsService.findOwnedJob(jobId, recruiterId);

    // Withdrawn applications are hidden from the recruiter
    const applications = await this.prisma.application.findMany({
      where: { jobId, status: { not: ApplicationStatus.WITHDRAWN } },
      select: APPLICATION_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    // One MongoDB query for all applicants (no N+1)
    const applicants = await this.usersService.findApplicantSummaries(
      applications.map((application) => application.applicantId),
    );

    return applications.map((application) => ({
      ...application,
      applicant: applicants.get(application.applicantId) ?? null,
    }));
  }

  // ─── Accept / reject (owner recruiter, PENDING only, transactional) ───────

  async updateStatus(
    id: string,
    recruiterId: string,
    status: RecruiterDecision,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const application = await tx.application.findUnique({
        where: { id },
        select: OWNERSHIP_SELECT,
      });
      if (!application) {
        throw new NotFoundException('Application not found.');
      }
      if (application.job.company.ownerId !== recruiterId) {
        throw new ForbiddenException(
          'You do not own the job of this application.',
        );
      }
      if (application.status !== ApplicationStatus.PENDING) {
        throw new ConflictException(
          `Only PENDING applications can be updated (current: ${application.status}).`,
        );
      }

      // Conditional update = compare-and-set: a concurrent change makes it a no-op
      const { count } = await tx.application.updateMany({
        where: { id, status: ApplicationStatus.PENDING },
        data: { status },
      });
      if (count === 0) {
        throw new ConflictException('Application status changed concurrently.');
      }

      return tx.application.findUniqueOrThrow({
        where: { id },
        select: APPLICATION_SELECT,
      });
    });
  }

  // ─── Withdraw (owner candidate, PENDING only) ─────────────────────────────

  async withdraw(id: string, applicantId: string) {
    return this.prisma.$transaction(async (tx) => {
      const application = await tx.application.findUnique({
        where: { id },
        select: { applicantId: true, status: true },
      });
      if (!application) {
        throw new NotFoundException('Application not found.');
      }
      if (application.applicantId !== applicantId) {
        throw new ForbiddenException('This is not your application.');
      }
      if (application.status !== ApplicationStatus.PENDING) {
        throw new ConflictException(
          `Only PENDING applications can be withdrawn (current: ${application.status}).`,
        );
      }

      const now = new Date();
      const { count } = await tx.application.updateMany({
        where: { id, applicantId, status: ApplicationStatus.PENDING },
        data: {
          status: ApplicationStatus.WITHDRAWN,
          withdrawnAt: now,
          expiresAt: new Date(now.getTime() + WITHDRAWN_RETENTION_MS),
        },
      });
      if (count === 0) {
        throw new ConflictException('Application status changed concurrently.');
      }

      return tx.application.findUniqueOrThrow({
        where: { id },
        select: APPLICATION_SELECT,
      });
    });
  }

  // ─── Candidate CV for the owner recruiter ─────────────────────────────────

  async getCvUrl(
    id: string,
    recruiterId: string,
  ): Promise<{ url: string; expiresIn: number }> {
    const application = await this.prisma.application.findUnique({
      where: { id },
      select: OWNERSHIP_SELECT,
    });
    if (!application) {
      throw new NotFoundException('Application not found.');
    }
    if (application.job.company.ownerId !== recruiterId) {
      throw new ForbiddenException(
        'You do not own the job of this application.',
      );
    }
    if (application.status === ApplicationStatus.WITHDRAWN) {
      throw new ForbiddenException('The candidate withdrew this application.');
    }

    const cvKey = await this.usersService.getCvKey(application.applicantId);
    if (!cvKey) {
      throw new NotFoundException('This candidate has not uploaded a CV.');
    }

    const url = await this.storage.presignDownload(cvKey, 'cvs');
    return { url, expiresIn: PRESIGNED_URL_TTL_SECONDS };
  }

  // ─── Daily purge (see ApplicationsCleanupService) ─────────────────────────

  async purgeExpired(now: Date): Promise<number> {
    const { count } = await this.prisma.application.deleteMany({
      where: {
        status: ApplicationStatus.WITHDRAWN,
        expiresAt: { lt: now },
      },
    });
    return count;
  }
}
