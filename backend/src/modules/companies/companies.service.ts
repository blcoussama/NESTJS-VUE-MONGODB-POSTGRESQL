import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Company } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import {
  LOGO_UPLOAD,
  validateUploadedFile,
} from '../../common/files/upload-rules';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ─── Create company ───────────────────────────────────────────────────────

  async create(recruiterId: string, dto: CreateCompanyDto) {
    const existing = await this.prisma.company.findFirst({
      where: { ownerId: recruiterId },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException(
        'You already have a company. Update it instead.',
      );
    }

    await this.assertNameAvailable(dto.name);

    // A concurrent duplicate still fails on the unique indexes (ownerId,
    // name) and is turned into a 409 by the global Prisma exception filter
    return this.prisma.company.create({
      data: { ...dto, ownerId: recruiterId },
    });
  }

  // ─── Get all companies ────────────────────────────────────────────────────

  async findAll() {
    return this.prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        website: true,
        location: true,
        logoUrl: true,
        createdAt: true,
        _count: { select: { jobs: true } },
      },
    });
  }

  // ─── Get the current recruiter's company ──────────────────────────────────

  async findMine(recruiterId: string) {
    const company = await this.prisma.company.findUnique({
      where: { ownerId: recruiterId },
      include: { _count: { select: { jobs: true } } },
    });

    if (!company) {
      throw new NotFoundException('You have not created a company yet.');
    }

    return company;
  }

  // ─── Get one company ──────────────────────────────────────────────────────

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        jobs: {
          where: { isOpen: true },
          select: {
            id: true,
            title: true,
            location: true,
            jobType: true,
            experienceLevel: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { jobs: true } },
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found.');
    }

    return company;
  }

  // ─── Update company ───────────────────────────────────────────────────────

  async update(id: string, recruiterId: string, dto: UpdateCompanyDto) {
    const company = await this.findOwnedCompany(id, recruiterId);

    if (dto.name !== undefined && dto.name !== company.name) {
      await this.assertNameAvailable(dto.name);
    }

    return this.prisma.company.update({
      where: { id },
      data: dto,
    });
  }

  // ─── Delete company ───────────────────────────────────────────────────────

  async remove(id: string, recruiterId: string) {
    const company = await this.findOwnedCompany(id, recruiterId);

    // Jobs, applications and saved jobs are removed by ON DELETE CASCADE
    await this.prisma.company.delete({ where: { id } });

    if (company.logoUrl) {
      await this.storage.deleteQuietly({ url: company.logoUrl }, 'logos');
    }

    return { message: 'Company deleted successfully.' };
  }

  // ─── Upload logo ──────────────────────────────────────────────────────────

  async uploadLogo(
    id: string,
    recruiterId: string,
    file: Express.Multer.File | undefined,
  ): Promise<{ logoUrl: string }> {
    const type = validateUploadedFile(file, LOGO_UPLOAD);
    const company = await this.findOwnedCompany(id, recruiterId);

    const key = await this.storage.upload('logos', file!.buffer, type);
    const logoUrl = this.storage.publicUrl(key);

    await this.prisma.company.update({
      where: { id },
      data: { logoUrl },
    });

    // Remove the replaced logo only once the new one is saved
    if (company.logoUrl) {
      await this.storage.deleteQuietly({ url: company.logoUrl }, 'logos');
    }

    return { logoUrl };
  }

  // ─── Delete logo ──────────────────────────────────────────────────────────

  async deleteLogo(
    id: string,
    recruiterId: string,
  ): Promise<{ message: string }> {
    const company = await this.findOwnedCompany(id, recruiterId);

    if (!company.logoUrl) {
      throw new BadRequestException('No logo to delete.');
    }

    await this.storage.deleteByPublicUrl(company.logoUrl, 'logos');

    await this.prisma.company.update({
      where: { id },
      data: { logoUrl: null },
    });

    return { message: 'Logo deleted successfully.' };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /** 404 if the company does not exist, 403 if the caller does not own it. */
  private async findOwnedCompany(
    id: string,
    recruiterId: string,
  ): Promise<Company> {
    const company = await this.prisma.company.findUnique({ where: { id } });

    if (!company) {
      throw new NotFoundException('Company not found.');
    }

    if (company.ownerId !== recruiterId) {
      throw new ForbiddenException('You do not own this company.');
    }

    return company;
  }

  private async assertNameAvailable(name: string): Promise<void> {
    const taken = await this.prisma.company.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException('A company with this name already exists.');
    }
  }
}
