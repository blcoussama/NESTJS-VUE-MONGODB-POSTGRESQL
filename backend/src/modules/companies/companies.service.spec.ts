import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Readable } from 'stream';
import { CompaniesService } from './companies.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';

/** Typed access to the arguments of a recorded mock call. */
function arg(mock: jest.Mock, call = 0, index = 0): unknown {
  return (mock.mock.calls as unknown[][])[call][index];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const OWNER = '6710f0c2a1b2c3d4e5f60718';
const OTHER = '6710f0c2a1b2c3d4e5f60719';
const COMPANY_ID = '1b4e28ba-2fa1-4d3b-a3f5-ef19b5a7633b';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const WEBP = Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ', 'latin1');

function createMockCompany(overrides: Record<string, unknown> = {}) {
  return {
    id: COMPANY_ID,
    name: 'ALTEN Maroc',
    description: 'Engineering and technology consulting.',
    website: 'https://alten.ma',
    location: 'Casablanca, Maroc',
    logoUrl: null as string | null,
    ownerId: OWNER,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  };
}

function createMockFile(buffer: Buffer, size = buffer.length) {
  return {
    fieldname: 'file',
    originalname: 'logo',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size,
    buffer,
    stream: new Readable(),
    destination: '',
    filename: '',
    path: '',
  } as Express.Multer.File;
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
  let storage: {
    upload: jest.Mock;
    publicUrl: jest.Mock;
    deleteByPublicUrl: jest.Mock;
    deleteQuietly: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      company: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    storage = {
      upload: jest.fn().mockResolvedValue('logos/new.jpeg'),
      publicUrl: jest.fn((key: string) => `https://bucket.example/${key}`),
      deleteByPublicUrl: jest.fn().mockResolvedValue(undefined),
      deleteQuietly: jest.fn().mockResolvedValue(undefined),
    };

    module = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = module.get(CompaniesService);
  });

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = { name: 'ALTEN Maroc', location: 'Casablanca' };

    it('throws BadRequestException if the recruiter already has a company', async () => {
      prisma.company.findFirst.mockResolvedValueOnce({ id: COMPANY_ID });

      await expect(service.create(OWNER, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.company.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException if the name is taken (case-insensitive)', async () => {
      prisma.company.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'other' });

      await expect(service.create(OWNER, dto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.company.findFirst).toHaveBeenLastCalledWith({
        where: { name: { equals: 'ALTEN Maroc', mode: 'insensitive' } },
        select: { id: true },
      });
    });

    it('creates the company with the current recruiter as owner', async () => {
      const created = createMockCompany();
      prisma.company.create.mockResolvedValue(created);

      const result = await service.create(OWNER, dto);

      expect(prisma.company.create).toHaveBeenCalledWith({
        data: { ...dto, ownerId: OWNER },
      });
      expect(result).toEqual(created);
    });
  });

  // ─── findAll / findMine / findOne ─────────────────────────────────────────

  describe('findAll', () => {
    it('returns all companies ordered by createdAt desc', async () => {
      const companies = [createMockCompany()];
      prisma.company.findMany.mockResolvedValue(companies);

      const result = await service.findAll();

      expect(prisma.company.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        select: expect.objectContaining({ id: true, name: true }) as object,
      });
      expect(result).toEqual(companies);
    });
  });

  describe('findMine', () => {
    it("returns the recruiter's company (unique ownerId)", async () => {
      const company = createMockCompany();
      prisma.company.findUnique.mockResolvedValue(company);

      const result = await service.findMine(OWNER);

      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { ownerId: OWNER },
        include: { _count: { select: { jobs: true } } },
      });
      expect(result).toEqual(company);
    });

    it('throws NotFoundException if the recruiter has no company yet', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(service.findMine(OWNER)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException if the company does not exist', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(service.findOne(COMPANY_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the company with its open jobs only', async () => {
      prisma.company.findUnique.mockResolvedValue(createMockCompany());

      await service.findOne(COMPANY_ID);

      const args = arg(prisma.company.findUnique, 0, 0) as {
        include: { jobs: { where: unknown } };
      };
      expect(args.include.jobs.where).toEqual({ isOpen: true });
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws NotFoundException if the company does not exist', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.update(COMPANY_ID, OWNER, { location: 'Rabat' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for a recruiter who is not the owner', async () => {
      prisma.company.findUnique.mockResolvedValue(createMockCompany());

      await expect(
        service.update(COMPANY_ID, OTHER, { location: 'Rabat' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.company.update).not.toHaveBeenCalled();
    });

    it('checks the new name is available when it changes', async () => {
      prisma.company.findUnique.mockResolvedValue(createMockCompany());
      prisma.company.findFirst.mockResolvedValue({ id: 'other' });

      await expect(
        service.update(COMPANY_ID, OWNER, { name: 'Taken' }),
      ).rejects.toThrow(ConflictException);
    });

    it('updates and returns the company', async () => {
      const updated = createMockCompany({ location: 'Rabat' });
      prisma.company.findUnique.mockResolvedValue(createMockCompany());
      prisma.company.update.mockResolvedValue(updated);

      const result = await service.update(COMPANY_ID, OWNER, {
        location: 'Rabat',
        name: 'ALTEN Maroc',
      });

      expect(prisma.company.findFirst).not.toHaveBeenCalled();
      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: COMPANY_ID },
        data: { location: 'Rabat', name: 'ALTEN Maroc' },
      });
      expect(result).toEqual(updated);
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('throws ForbiddenException for a non-owner', async () => {
      prisma.company.findUnique.mockResolvedValue(createMockCompany());

      await expect(service.remove(COMPANY_ID, OTHER)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.company.delete).not.toHaveBeenCalled();
    });

    it('deletes the company (cascade) without touching S3 when there is no logo', async () => {
      prisma.company.findUnique.mockResolvedValue(createMockCompany());

      const result = await service.remove(COMPANY_ID, OWNER);

      expect(prisma.company.delete).toHaveBeenCalledWith({
        where: { id: COMPANY_ID },
      });
      expect(storage.deleteQuietly).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'Company deleted successfully.' });
    });

    it('also removes the logo from S3', async () => {
      const logoUrl = 'https://bucket.example/logos/a.png';
      prisma.company.findUnique.mockResolvedValue(
        createMockCompany({ logoUrl }),
      );

      await service.remove(COMPANY_ID, OWNER);

      expect(storage.deleteQuietly).toHaveBeenCalledWith(
        { url: logoUrl },
        'logos',
      );
    });
  });

  // ─── uploadLogo ───────────────────────────────────────────────────────────

  describe('uploadLogo', () => {
    it('throws BadRequestException without a file', async () => {
      await expect(
        service.uploadLogo(COMPANY_ID, OWNER, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects content that is not a JPEG/PNG/WebP image', async () => {
      await expect(
        service.uploadLogo(
          COMPANY_ID,
          OWNER,
          createMockFile(Buffer.from('%PDF-1.4')),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws PayloadTooLargeException above 2MB', async () => {
      await expect(
        service.uploadLogo(
          COMPANY_ID,
          OWNER,
          createMockFile(JPEG, 3 * 1024 * 1024),
        ),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('throws NotFoundException / ForbiddenException before uploading', async () => {
      prisma.company.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.uploadLogo(COMPANY_ID, OWNER, createMockFile(JPEG)),
      ).rejects.toThrow(NotFoundException);

      prisma.company.findUnique.mockResolvedValueOnce(createMockCompany());
      await expect(
        service.uploadLogo(COMPANY_ID, OTHER, createMockFile(JPEG)),
      ).rejects.toThrow(ForbiddenException);

      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('uploads the logo, saves its URL and removes the previous logo', async () => {
      const oldUrl = 'https://bucket.example/logos/old.png';
      prisma.company.findUnique.mockResolvedValue(
        createMockCompany({ logoUrl: oldUrl }),
      );

      const result = await service.uploadLogo(
        COMPANY_ID,
        OWNER,
        createMockFile(JPEG),
      );

      expect(storage.upload).toHaveBeenCalledWith('logos', JPEG, 'image/jpeg');
      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: COMPANY_ID },
        data: { logoUrl: 'https://bucket.example/logos/new.jpeg' },
      });
      expect(storage.deleteQuietly).toHaveBeenCalledWith(
        { url: oldUrl },
        'logos',
      );
      expect(result).toEqual({
        logoUrl: 'https://bucket.example/logos/new.jpeg',
      });
    });

    it('accepts WebP content', async () => {
      prisma.company.findUnique.mockResolvedValue(createMockCompany());

      await service.uploadLogo(COMPANY_ID, OWNER, createMockFile(WEBP));

      expect(storage.upload).toHaveBeenCalledWith('logos', WEBP, 'image/webp');
    });
  });

  // ─── deleteLogo ───────────────────────────────────────────────────────────

  describe('deleteLogo', () => {
    it('throws ForbiddenException for a non-owner', async () => {
      prisma.company.findUnique.mockResolvedValue(createMockCompany());

      await expect(service.deleteLogo(COMPANY_ID, OTHER)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException if there is no logo', async () => {
      prisma.company.findUnique.mockResolvedValue(createMockCompany());

      await expect(service.deleteLogo(COMPANY_ID, OWNER)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deletes the logo (prefix-checked) and clears logoUrl', async () => {
      const logoUrl = 'https://bucket.example/logos/a.png';
      prisma.company.findUnique.mockResolvedValue(
        createMockCompany({ logoUrl }),
      );

      const result = await service.deleteLogo(COMPANY_ID, OWNER);

      expect(storage.deleteByPublicUrl).toHaveBeenCalledWith(logoUrl, 'logos');
      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: COMPANY_ID },
        data: { logoUrl: null },
      });
      expect(result).toEqual({ message: 'Logo deleted successfully.' });
    });
  });
});
