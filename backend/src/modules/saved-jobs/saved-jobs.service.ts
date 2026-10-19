import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

const SAVED_JOB_SELECT = {
  id: true,
  jobId: true,
  createdAt: true,
} satisfies Prisma.SavedJobSelect;

@Injectable()
export class SavedJobsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotent: saving an already saved job returns the existing entry. */
  async save(jobId: string, userId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true },
    });
    if (!job) {
      throw new NotFoundException('Job not found.');
    }

    const where = { jobId_userId: { jobId, userId } };
    try {
      return await this.prisma.savedJob.upsert({
        where,
        create: { jobId, userId },
        update: {},
        select: SAVED_JOB_SELECT,
      });
    } catch (error) {
      // Two concurrent upserts: the loser hits the unique index — still saved
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.prisma.savedJob.findUniqueOrThrow({
          where,
          select: SAVED_JOB_SELECT,
        });
      }
      throw error;
    }
  }

  /** Idempotent: removing a job that is not saved is not an error. */
  async unsave(jobId: string, userId: string) {
    await this.prisma.savedJob.deleteMany({ where: { jobId, userId } });
    return { message: 'Job removed from saved jobs.' };
  }

  async findMine(userId: string) {
    return this.prisma.savedJob.findMany({
      where: { userId },
      select: {
        ...SAVED_JOB_SELECT,
        job: {
          select: {
            id: true,
            title: true,
            location: true,
            jobType: true,
            experienceLevel: true,
            salaryType: true,
            salary: true,
            isOpen: true,
            createdAt: true,
            company: { select: { id: true, name: true, logoUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
