import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { CompaniesService } from './companies.service';
import { PrismaService } from '../../database/prisma/prisma.service';

// ─── Module-level mocks ───────────────────────────────────────────────────────

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: jest.fn().mockImplementation((input: unknown) => input),
  DeleteObjectCommand: jest.fn().mockImplementation((input: unknown) => input),
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid-1234'),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createMockCompany(overrides: Record<string, unknown> = {}) {
  return {
    id: 'company-uuid-1',
    name: 'ALTEN Maroc',
    description: 'Engineering and technology consulting.',
    website: 'https://alten.ma',
    location: 'Casablanca, Maroc',
    logoUrl: null as string | null,
    ownerId: 'recruiter-uuid-1',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  };
}

function createMockFile(mimetype: string, size: number): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'logo.jpg',
    encoding: '7bit',
    mimetype,
    size,
    buffer: Buffer.from('fake-image-content'),
    stream: new Readable(),
    destination: '',
    filename: '',
    path: '',
  };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('CompaniesService', () => {
  let module: TestingModule;
  let service: CompaniesService;
  let prisma: {
    company: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let mockS3Send: jest.Mock;

  const configService = {
    get: jest.fn().mockImplementation((key: string) => {
      const values: Record<string, string> = {
        'aws.region': 'eu-west-3',
        'aws.bucketName': 'test-bucket',
        'aws.accessKeyId': 'test-key-id',
        'aws.secretAccessKey': 'test-secret-key',
      };
      return values[key] ?? null;
    }),
  };

  beforeEach(async () => {
    prisma = {
      company: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    module = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    mockS3Send = (service as any).s3.send as jest.Mock;
    mockS3Send.mockResolvedValue({});
  });

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = { name: 'ALTEN Maroc', location: 'Casablanca' };

    it('should throw BadRequestException if recruiter already has a company', async () => {
      prisma.company.findFirst.mockResolvedValue(createMockCompany());

      await expect(service.create('recruiter-uuid-1', dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.company.create).not.toHaveBeenCalled();
    });

    it('should create and return a new company', async () => {
      prisma.company.findFirst.mockResolvedValue(null);
      const created = createMockCompany();
      prisma.company.create.mockResolvedValue(created);

      const result = await service.create('recruiter-uuid-1', dto);

      expect(prisma.company.create).toHaveBeenCalledWith({
        data: { ...dto, ownerId: 'recruiter-uuid-1' },
      });
      expect(result).toEqual(created);
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all companies ordered by createdAt desc', async () => {
      const companies = [
        createMockCompany(),
        createMockCompany({ id: 'company-uuid-2' }),
      ];
      prisma.company.findMany.mockResolvedValue(companies);

      const result = await service.findAll();

      expect(prisma.company.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        select: expect.objectContaining({ id: true, name: true }) as object,
      });
      expect(result).toEqual(companies);
    });

    it('should return an empty array when no companies exist', async () => {
      prisma.company.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should throw NotFoundException if company does not exist', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(service.findOne('company-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return the company with its open jobs', async () => {
      const company = createMockCompany();
      prisma.company.findUnique.mockResolvedValue(company);

      const result = await service.findOne('company-uuid-1');

      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { id: 'company-uuid-1' },
        include: expect.objectContaining({
          jobs: expect.any(Object) as object,
        }) as object,
      });
      expect(result).toEqual(company);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    const dto = { name: 'ALTEN Maroc Updated' };

    it('should throw NotFoundException if company does not exist', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.update('company-uuid-1', 'recruiter-uuid-1', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if recruiter does not own the company', async () => {
      prisma.company.findUnique.mockResolvedValue(
        createMockCompany({ ownerId: 'other-recruiter-uuid' }),
      );

      await expect(
        service.update('company-uuid-1', 'recruiter-uuid-1', dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update and return the company', async () => {
      const company = createMockCompany();
      const updated = createMockCompany({ name: 'ALTEN Maroc Updated' });
      prisma.company.findUnique.mockResolvedValue(company);
      prisma.company.update.mockResolvedValue(updated);

      const result = await service.update(
        'company-uuid-1',
        'recruiter-uuid-1',
        dto,
      );

      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 'company-uuid-1' },
        data: dto,
      });
      expect(result).toEqual(updated);
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should throw NotFoundException if company does not exist', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.remove('company-uuid-1', 'recruiter-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if recruiter does not own the company', async () => {
      prisma.company.findUnique.mockResolvedValue(
        createMockCompany({ ownerId: 'other-recruiter-uuid' }),
      );

      await expect(
        service.remove('company-uuid-1', 'recruiter-uuid-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should delete company without logo and return success message', async () => {
      prisma.company.findUnique.mockResolvedValue(createMockCompany());
      prisma.company.delete.mockResolvedValue(undefined);

      const result = await service.remove('company-uuid-1', 'recruiter-uuid-1');

      expect(mockS3Send).not.toHaveBeenCalled();
      expect(prisma.company.delete).toHaveBeenCalledWith({
        where: { id: 'company-uuid-1' },
      });
      expect(result).toEqual({ message: 'Company deleted successfully.' });
    });

    it('should delete logo from S3 before deleting company', async () => {
      const logoUrl =
        'https://test-bucket.s3.eu-west-3.amazonaws.com/logos/some-logo.jpg';
      prisma.company.findUnique.mockResolvedValue(
        createMockCompany({ logoUrl }),
      );
      prisma.company.delete.mockResolvedValue(undefined);

      const result = await service.remove('company-uuid-1', 'recruiter-uuid-1');

      expect(mockS3Send).toHaveBeenCalledTimes(1);
      expect(prisma.company.delete).toHaveBeenCalledWith({
        where: { id: 'company-uuid-1' },
      });
      expect(result).toEqual({ message: 'Company deleted successfully.' });
    });
  });

  // ─── uploadLogo ───────────────────────────────────────────────────────────

  describe('uploadLogo', () => {
    const validFile = createMockFile('image/jpeg', 1024 * 1024); // 1MB JPEG

    it('should throw BadRequestException for invalid file type', async () => {
      const badFile = createMockFile('application/pdf', 500);

      await expect(
        service.uploadLogo('company-uuid-1', 'recruiter-uuid-1', badFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for files exceeding 2MB', async () => {
      const bigFile = createMockFile('image/png', 3 * 1024 * 1024); // 3MB

      await expect(
        service.uploadLogo('company-uuid-1', 'recruiter-uuid-1', bigFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if company does not exist', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.uploadLogo('company-uuid-1', 'recruiter-uuid-1', validFile),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if recruiter does not own the company', async () => {
      prisma.company.findUnique.mockResolvedValue(
        createMockCompany({ ownerId: 'other-recruiter-uuid' }),
      );

      await expect(
        service.uploadLogo('company-uuid-1', 'recruiter-uuid-1', validFile),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should upload logo to S3 and return logoUrl', async () => {
      prisma.company.findUnique.mockResolvedValue(createMockCompany());
      prisma.company.update.mockResolvedValue(createMockCompany());

      const result = await service.uploadLogo(
        'company-uuid-1',
        'recruiter-uuid-1',
        validFile,
      );

      expect(mockS3Send).toHaveBeenCalledTimes(1);
      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 'company-uuid-1' },
        data: {
          logoUrl:
            'https://test-bucket.s3.eu-west-3.amazonaws.com/logos/test-uuid-1234.jpeg',
        },
      });
      expect(result).toEqual({
        logoUrl:
          'https://test-bucket.s3.eu-west-3.amazonaws.com/logos/test-uuid-1234.jpeg',
      });
    });

    it('should delete old logo from S3 before uploading new one', async () => {
      const oldLogoUrl =
        'https://test-bucket.s3.eu-west-3.amazonaws.com/logos/old-logo.jpg';
      prisma.company.findUnique.mockResolvedValue(
        createMockCompany({ logoUrl: oldLogoUrl }),
      );
      prisma.company.update.mockResolvedValue(createMockCompany());

      await service.uploadLogo('company-uuid-1', 'recruiter-uuid-1', validFile);

      // First call: DeleteObjectCommand (old logo), second: PutObjectCommand (new logo)
      expect(mockS3Send).toHaveBeenCalledTimes(2);
    });

    it('should accept PNG and WebP file types', async () => {
      prisma.company.findUnique.mockResolvedValue(createMockCompany());
      prisma.company.update.mockResolvedValue(createMockCompany());

      const pngFile = createMockFile('image/png', 500 * 1024);
      await service.uploadLogo('company-uuid-1', 'recruiter-uuid-1', pngFile);
      expect(mockS3Send).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();
      mockS3Send.mockResolvedValue({});

      const webpFile = createMockFile('image/webp', 500 * 1024);
      await service.uploadLogo('company-uuid-1', 'recruiter-uuid-1', webpFile);
      expect(mockS3Send).toHaveBeenCalledTimes(1);
    });
  });

  // ─── deleteLogo ───────────────────────────────────────────────────────────

  describe('deleteLogo', () => {
    it('should throw NotFoundException if company does not exist', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteLogo('company-uuid-1', 'recruiter-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if recruiter does not own the company', async () => {
      prisma.company.findUnique.mockResolvedValue(
        createMockCompany({ ownerId: 'other-recruiter-uuid' }),
      );

      await expect(
        service.deleteLogo('company-uuid-1', 'recruiter-uuid-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if no logo exists', async () => {
      prisma.company.findUnique.mockResolvedValue(
        createMockCompany({ logoUrl: null }),
      );

      await expect(
        service.deleteLogo('company-uuid-1', 'recruiter-uuid-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete logo from S3 and clear logoUrl in DB', async () => {
      const logoUrl =
        'https://test-bucket.s3.eu-west-3.amazonaws.com/logos/some-logo.jpg';
      prisma.company.findUnique.mockResolvedValue(
        createMockCompany({ logoUrl }),
      );
      prisma.company.update.mockResolvedValue(
        createMockCompany({ logoUrl: null }),
      );

      const result = await service.deleteLogo(
        'company-uuid-1',
        'recruiter-uuid-1',
      );

      expect(mockS3Send).toHaveBeenCalledTimes(1);
      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 'company-uuid-1' },
        data: { logoUrl: null },
      });
      expect(result).toEqual({ message: 'Logo deleted successfully.' });
    });
  });
});
