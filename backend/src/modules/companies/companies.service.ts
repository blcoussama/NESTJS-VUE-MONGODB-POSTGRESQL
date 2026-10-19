import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.region = this.config.get<string>('aws.region')!;
    this.bucket = this.config.get<string>('aws.bucketName')!;
    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.config.get<string>('aws.accessKeyId')!,
        secretAccessKey: this.config.get<string>('aws.secretAccessKey')!,
      },
    });
  }

  // ─── Create company ───────────────────────────────────────────────────────

  async create(recruiterId: string, dto: CreateCompanyDto) {
    const existing = await this.prisma.company.findFirst({
      where: { ownerId: recruiterId },
    });

    if (existing) {
      throw new BadRequestException(
        'You already have a company. Update it instead.',
      );
    }

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
    const company = await this.prisma.company.findUnique({ where: { id } });

    if (!company) {
      throw new NotFoundException('Company not found.');
    }

    if (company.ownerId !== recruiterId) {
      throw new ForbiddenException('You do not own this company.');
    }

    return this.prisma.company.update({
      where: { id },
      data: dto,
    });
  }

  // ─── Delete company ───────────────────────────────────────────────────────

  async remove(id: string, recruiterId: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });

    if (!company) {
      throw new NotFoundException('Company not found.');
    }

    if (company.ownerId !== recruiterId) {
      throw new ForbiddenException('You do not own this company.');
    }

    // Delete logo from S3 if it exists
    if (company.logoUrl) {
      await this.deleteLogoFromS3(company.logoUrl);
    }

    await this.prisma.company.delete({ where: { id } });

    return { message: 'Company deleted successfully.' };
  }

  // ─── Upload logo ──────────────────────────────────────────────────────────

  async uploadLogo(
    id: string,
    recruiterId: string,
    file: Express.Multer.File,
  ): Promise<{ logoUrl: string }> {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG and WebP are allowed.',
      );
    }

    const maxSize = 2 * 1024 * 1024; // 2 MB
    if (file.size > maxSize) {
      throw new BadRequestException('File too large. Maximum size is 2MB.');
    }

    const company = await this.prisma.company.findUnique({ where: { id } });

    if (!company) {
      throw new NotFoundException('Company not found.');
    }

    if (company.ownerId !== recruiterId) {
      throw new ForbiddenException('You do not own this company.');
    }

    // Delete old logo from S3 if it exists
    if (company.logoUrl) {
      await this.deleteLogoFromS3(company.logoUrl);
    }

    const extension = file.mimetype.split('/')[1];
    const key = `logos/${uuidv4()}.${extension}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const logoUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

    await this.prisma.company.update({
      where: { id },
      data: { logoUrl },
    });

    return { logoUrl };
  }

  // ─── Delete logo ──────────────────────────────────────────────────────────

  async deleteLogo(
    id: string,
    recruiterId: string,
  ): Promise<{ message: string }> {
    const company = await this.prisma.company.findUnique({ where: { id } });

    if (!company) {
      throw new NotFoundException('Company not found.');
    }

    if (company.ownerId !== recruiterId) {
      throw new ForbiddenException('You do not own this company.');
    }

    if (!company.logoUrl) {
      throw new BadRequestException('No logo to delete.');
    }

    await this.deleteLogoFromS3(company.logoUrl);

    await this.prisma.company.update({
      where: { id },
      data: { logoUrl: null },
    });

    return { message: 'Logo deleted successfully.' };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async deleteLogoFromS3(logoUrl: string): Promise<void> {
    const url = new URL(logoUrl);
    const key = url.pathname.slice(1);

    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
