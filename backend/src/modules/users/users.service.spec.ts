import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Readable } from 'stream';
import { UsersService } from './users.service';
import { User, UserRole } from './schemas/user.schema';
import { StorageService } from '../../common/storage/storage.service';

/** Typed access to the arguments of a recorded mock call. */
function arg(mock: jest.Mock, call = 0, index = 0): unknown {
  return (mock.mock.calls as unknown[][])[call][index];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = '6710f0c2a1b2c3d4e5f60718';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ\n', 'latin1');

interface QueryMock {
  select: jest.Mock;
  lean: jest.Mock;
  exec: jest.Mock;
}

function query<T>(value: T): QueryMock {
  const chain = { exec: jest.fn().mockResolvedValue(value) } as QueryMock;
  chain.select = jest.fn().mockReturnValue(chain);
  chain.lean = jest.fn().mockReturnValue(chain);
  return chain;
}

function createMockUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(USER_ID),
    firstName: 'Oussama',
    lastName: 'Belcadi',
    email: 'test@example.com',
    role: UserRole.CANDIDATE,
    isEmailVerified: true,
    avatarUrl: null as string | null,
    cvKey: null as string | null,
    skills: [],
    ...overrides,
  };
}

function createMockFile(
  buffer: Buffer,
  size = buffer.length,
  mimetype = 'image/png',
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'file',
    encoding: '7bit',
    mimetype,
    size,
    buffer,
    stream: new Readable(),
    destination: '',
    filename: '',
    path: '',
  };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('UsersService', () => {
  let module: TestingModule;
  let service: UsersService;
  let userModel: {
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    updateOne: jest.Mock;
    find: jest.Mock;
  };
  let storage: {
    upload: jest.Mock;
    publicUrl: jest.Mock;
    delete: jest.Mock;
    deleteByPublicUrl: jest.Mock;
    deleteQuietly: jest.Mock;
    presignDownload: jest.Mock;
  };

  beforeEach(async () => {
    userModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      updateOne: jest.fn().mockReturnValue(query({ modifiedCount: 1 })),
      find: jest.fn(),
    };
    storage = {
      upload: jest.fn().mockResolvedValue('avatars/new-key.png'),
      publicUrl: jest.fn((key: string) => `https://bucket.example/${key}`),
      delete: jest.fn().mockResolvedValue(undefined),
      deleteByPublicUrl: jest.fn().mockResolvedValue(undefined),
      deleteQuietly: jest.fn().mockResolvedValue(undefined),
      presignDownload: jest.fn().mockResolvedValue('https://presigned/cv'),
    };

    module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
  });

  // ─── getMyProfile ──────────────────────────────────────────────────────────

  describe('getMyProfile', () => {
    it('throws NotFoundException if the user does not exist', async () => {
      userModel.findById.mockReturnValue(query(null));

      await expect(service.getMyProfile(USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns an allow-listed profile: hasCv instead of the private S3 key', async () => {
      userModel.findById.mockReturnValue(
        query(
          createMockUser({
            cvKey: 'cvs/secret.pdf',
            password: 'hash',
            passwordResetToken: 'digest',
          }),
        ),
      );

      const profile = await service.getMyProfile(USER_ID);

      expect(profile).toMatchObject({
        id: USER_ID,
        email: 'test@example.com',
        hasCv: true,
      });
      expect(profile).not.toHaveProperty('cvKey');
      expect(profile).not.toHaveProperty('password');
      expect(profile).not.toHaveProperty('passwordResetToken');
    });

    it('returns recruiter-specific fields for a recruiter', async () => {
      userModel.findById.mockReturnValue(
        query(
          createMockUser({
            role: UserRole.RECRUITER,
            companyName: 'ALTEN Maroc',
          }),
        ),
      );

      const profile = await service.getMyProfile(USER_ID);

      expect(profile).toMatchObject({ companyName: 'ALTEN Maroc' });
      expect(profile).not.toHaveProperty('skills');
      expect(profile).not.toHaveProperty('hasCv');
    });
  });

  // ─── updateMyProfile (V2-01 regression) ───────────────────────────────────

  describe('updateMyProfile', () => {
    function givenRole(role: UserRole) {
      userModel.findById.mockReturnValue(query({ _id: USER_ID, role }));
      userModel.findByIdAndUpdate.mockReturnValue(
        query(createMockUser({ role })),
      );
    }

    function lastSet(): Record<string, unknown> {
      const [, update] = userModel.findByIdAndUpdate.mock.calls[0] as [
        string,
        { $set: Record<string, unknown> },
      ];
      return update.$set;
    }

    it('throws NotFoundException if the user does not exist', async () => {
      userModel.findById.mockReturnValue(query(null));

      await expect(
        service.updateMyProfile(USER_ID, { headline: 'Dev' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates allowed candidate fields with an explicit $set', async () => {
      givenRole(UserRole.CANDIDATE);

      await service.updateMyProfile(USER_ID, {
        headline: 'Full-Stack Developer',
        skills: ['NestJS'],
        githubUrl: 'https://github.com/blcoussama',
      });

      expect(lastSet()).toEqual({
        headline: 'Full-Stack Developer',
        skills: ['NestJS'],
        githubUrl: 'https://github.com/blcoussama',
      });
      expect(arg(userModel.findByIdAndUpdate, 0, 2)).toMatchObject({
        runValidators: true,
      });
    });

    it.each([
      ['role', 'recruiter'],
      ['email', 'attacker@example.com'],
      ['password', 'plaintext'],
      ['cvKey', 'logos/victim.png'],
      ['avatarUrl', 'https://bucket.s3.eu-west-3.amazonaws.com/logos/x.png'],
      ['isEmailVerified', true],
      ['refreshToken', 'x'],
      ['passwordResetToken', 'x'],
      ['_id', '6710f0c2a1b2c3d4e5f60719'],
    ])('rejects the sensitive field "%s" with 400', async (field, value) => {
      givenRole(UserRole.CANDIDATE);

      await expect(
        service.updateMyProfile(USER_ID, { headline: 'ok', [field]: value }),
      ).rejects.toThrow(BadRequestException);
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('rejects candidate-only fields for a recruiter', async () => {
      givenRole(UserRole.RECRUITER);

      await expect(
        service.updateMyProfile(USER_ID, { skills: ['NestJS'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects recruiter-only fields for a candidate', async () => {
      givenRole(UserRole.CANDIDATE);

      await expect(
        service.updateMyProfile(USER_ID, { companyName: 'ACME' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts recruiter fields for a recruiter', async () => {
      givenRole(UserRole.RECRUITER);

      await service.updateMyProfile(USER_ID, {
        companyName: 'ALTEN Maroc',
        companyWebsite: 'https://alten.ma',
      });

      expect(lastSet()).toEqual({
        companyName: 'ALTEN Maroc',
        companyWebsite: 'https://alten.ma',
      });
    });

    it('uses the role stored in the database, not a role sent by the client', async () => {
      givenRole(UserRole.RECRUITER);

      await expect(
        service.updateMyProfile(USER_ID, { skills: ['x'], role: 'candidate' }),
      ).rejects.toThrow(BadRequestException);
    });

    it.each(['javascript:alert(1)', 'ftp://example.com', 'not-a-url'])(
      'rejects the non-http(s) URL %s',
      async (url) => {
        givenRole(UserRole.CANDIDATE);

        await expect(
          service.updateMyProfile(USER_ID, { linkedinUrl: url }),
        ).rejects.toThrow(BadRequestException);
      },
    );

    it('rejects a non-object body', async () => {
      givenRole(UserRole.CANDIDATE);

      await expect(
        service.updateMyProfile(USER_ID, [{ headline: 'x' }]),
      ).rejects.toThrow('Request body must be a JSON object');
    });

    it('rejects null for a required field (firstName)', async () => {
      givenRole(UserRole.CANDIDATE);

      await expect(
        service.updateMyProfile(USER_ID, { firstName: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it('validates nested experiences (missing title → 400 with a path)', async () => {
      givenRole(UserRole.CANDIDATE);

      const error = await service
        .updateMyProfile(USER_ID, {
          experiences: [{ company: 'ACME', startDate: '2024-01-01' }],
        })
        .catch((e: BadRequestException) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      const body = (error as BadRequestException).getResponse() as {
        message: string[];
      };
      expect(body.message.some((m) => m.startsWith('experiences.0.'))).toBe(
        true,
      );
    });

    it('stores nested experiences as plain objects', async () => {
      givenRole(UserRole.CANDIDATE);

      await service.updateMyProfile(USER_ID, {
        experiences: [
          { title: 'Dev', company: 'ACME', startDate: '2024-01-01' },
        ],
      });

      const experiences = lastSet().experiences as object[];
      expect(Object.getPrototypeOf(experiences[0])).toBe(Object.prototype);
    });

    it('turns null array fields into empty arrays', async () => {
      givenRole(UserRole.CANDIDATE);

      await service.updateMyProfile(USER_ID, { skills: null });

      expect(lastSet()).toEqual({ skills: [] });
    });

    it('rejects too many skills', async () => {
      givenRole(UserRole.CANDIDATE);

      await expect(
        service.updateMyProfile(USER_ID, {
          skills: Array.from({ length: 51 }, (_, i) => `skill-${i}`),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── uploadAvatar ──────────────────────────────────────────────────────────

  describe('uploadAvatar', () => {
    it('throws BadRequestException when no file is sent', async () => {
      await expect(service.uploadAvatar(USER_ID, undefined)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a file whose content is not an image, whatever its declared type', async () => {
      const fake = createMockFile(Buffer.from('<svg onload=alert(1)>'));

      await expect(service.uploadAvatar(USER_ID, fake)).rejects.toThrow(
        BadRequestException,
      );
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('throws PayloadTooLargeException above 2MB', async () => {
      const big = createMockFile(PNG, 3 * 1024 * 1024);

      await expect(service.uploadAvatar(USER_ID, big)).rejects.toThrow(
        PayloadTooLargeException,
      );
    });

    it('throws NotFoundException if the user does not exist', async () => {
      userModel.findById.mockReturnValue(query(null));

      await expect(
        service.uploadAvatar(USER_ID, createMockFile(PNG)),
      ).rejects.toThrow(NotFoundException);
    });

    it('uploads with the DETECTED type, saves the URL, then removes the old avatar', async () => {
      const oldUrl = 'https://bucket.example/avatars/old.png';
      userModel.findById.mockReturnValue(
        query(createMockUser({ avatarUrl: oldUrl })),
      );

      const result = await service.uploadAvatar(
        USER_ID,
        createMockFile(PNG, PNG.length, 'image/jpeg'),
      );

      expect(storage.upload).toHaveBeenCalledWith('avatars', PNG, 'image/png');
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: USER_ID },
        { $set: { avatarUrl: 'https://bucket.example/avatars/new-key.png' } },
      );
      expect(storage.deleteQuietly).toHaveBeenCalledWith(
        { url: oldUrl },
        'avatars',
      );
      expect(result).toEqual({
        avatarUrl: 'https://bucket.example/avatars/new-key.png',
      });
    });
  });

  // ─── deleteAvatar ──────────────────────────────────────────────────────────

  describe('deleteAvatar', () => {
    it('throws NotFoundException if the user does not exist', async () => {
      userModel.findById.mockReturnValue(query(null));

      await expect(service.deleteAvatar(USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException if there is no avatar', async () => {
      userModel.findById.mockReturnValue(query(createMockUser()));

      await expect(service.deleteAvatar(USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deletes the S3 object (prefix-checked) and clears avatarUrl', async () => {
      const url = 'https://bucket.example/avatars/a.png';
      userModel.findById.mockReturnValue(
        query(createMockUser({ avatarUrl: url })),
      );

      const result = await service.deleteAvatar(USER_ID);

      expect(storage.deleteByPublicUrl).toHaveBeenCalledWith(url, 'avatars');
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: USER_ID },
        { $set: { avatarUrl: null } },
      );
      expect(result.message).toBe('Avatar deleted successfully.');
    });
  });

  // ─── uploadCv ─────────────────────────────────────────────────────────────

  describe('uploadCv', () => {
    it('throws ForbiddenException for a recruiter', async () => {
      await expect(
        service.uploadCv(USER_ID, UserRole.RECRUITER, createMockFile(PDF)),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a non-PDF file even if declared application/pdf', async () => {
      const fake = createMockFile(PNG, PNG.length, 'application/pdf');

      await expect(
        service.uploadCv(USER_ID, UserRole.CANDIDATE, fake),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws PayloadTooLargeException above 5MB', async () => {
      const big = createMockFile(PDF, 6 * 1024 * 1024);

      await expect(
        service.uploadCv(USER_ID, UserRole.CANDIDATE, big),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('throws NotFoundException if the user does not exist', async () => {
      userModel.findById.mockReturnValue(query(null));

      await expect(
        service.uploadCv(USER_ID, UserRole.CANDIDATE, createMockFile(PDF)),
      ).rejects.toThrow(NotFoundException);
    });

    it('uploads the PDF, saves the key and removes the previous CV', async () => {
      userModel.findById.mockReturnValue(
        query(createMockUser({ cvKey: 'cvs/old.pdf' })),
      );
      storage.upload.mockResolvedValue('cvs/new.pdf');

      const result = await service.uploadCv(
        USER_ID,
        UserRole.CANDIDATE,
        createMockFile(PDF),
      );

      expect(storage.upload).toHaveBeenCalledWith(
        'cvs',
        PDF,
        'application/pdf',
      );
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: USER_ID },
        { $set: { cvKey: 'cvs/new.pdf' } },
      );
      expect(storage.deleteQuietly).toHaveBeenCalledWith(
        { key: 'cvs/old.pdf' },
        'cvs',
      );
      expect(result.message).toBe('CV uploaded successfully.');
    });
  });

  // ─── getCvPresignedUrl ────────────────────────────────────────────────────

  describe('getCvPresignedUrl', () => {
    it('throws ForbiddenException for a recruiter', async () => {
      await expect(
        service.getCvPresignedUrl(USER_ID, UserRole.RECRUITER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException if the user does not exist', async () => {
      userModel.findById.mockReturnValue(query(null));

      await expect(
        service.getCvPresignedUrl(USER_ID, UserRole.CANDIDATE),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if no CV was uploaded', async () => {
      userModel.findById.mockReturnValue(query(createMockUser()));

      await expect(
        service.getCvPresignedUrl(USER_ID, UserRole.CANDIDATE),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns a 15-minute presigned URL for the own CV', async () => {
      userModel.findById.mockReturnValue(
        query(createMockUser({ cvKey: 'cvs/mine.pdf' })),
      );

      const result = await service.getCvPresignedUrl(
        USER_ID,
        UserRole.CANDIDATE,
      );

      expect(storage.presignDownload).toHaveBeenCalledWith(
        'cvs/mine.pdf',
        'cvs',
      );
      expect(result).toEqual({ url: 'https://presigned/cv', expiresIn: 900 });
    });
  });

  // ─── deleteCv ─────────────────────────────────────────────────────────────

  describe('deleteCv', () => {
    it('throws ForbiddenException for a recruiter', async () => {
      await expect(
        service.deleteCv(USER_ID, UserRole.RECRUITER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if there is no CV', async () => {
      userModel.findById.mockReturnValue(query(createMockUser()));

      await expect(
        service.deleteCv(USER_ID, UserRole.CANDIDATE),
      ).rejects.toThrow(BadRequestException);
    });

    it('deletes the CV object and clears the key', async () => {
      userModel.findById.mockReturnValue(
        query(createMockUser({ cvKey: 'cvs/mine.pdf' })),
      );

      const result = await service.deleteCv(USER_ID, UserRole.CANDIDATE);

      expect(storage.delete).toHaveBeenCalledWith('cvs/mine.pdf', 'cvs');
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: USER_ID },
        { $set: { cvKey: null } },
      );
      expect(result.message).toBe('CV deleted successfully.');
    });
  });

  // ─── Helpers for other modules ────────────────────────────────────────────

  describe('findApplicantSummaries', () => {
    it('loads all applicants in ONE query and exposes hasCv, never the key', async () => {
      const other = '6710f0c2a1b2c3d4e5f60719';
      const findChain = query([
        createMockUser({ cvKey: 'cvs/a.pdf' }),
        createMockUser({ _id: new Types.ObjectId(other), cvKey: null }),
      ]);
      userModel.find.mockReturnValue(findChain);

      const result = await service.findApplicantSummaries([
        USER_ID,
        other,
        USER_ID,
      ]);

      expect(userModel.find).toHaveBeenCalledTimes(1);
      expect(userModel.find).toHaveBeenCalledWith({
        _id: { $in: [USER_ID, other] },
      });
      expect(result.get(USER_ID)).toEqual({
        id: USER_ID,
        firstName: 'Oussama',
        lastName: 'Belcadi',
        email: 'test@example.com',
        avatarUrl: null,
        hasCv: true,
      });
      expect(result.get(other)?.hasCv).toBe(false);
    });

    it('ignores invalid ObjectIds and skips the query when nothing is left', async () => {
      const result = await service.findApplicantSummaries(['not-an-id']);

      expect(userModel.find).not.toHaveBeenCalled();
      expect(result.size).toBe(0);
    });
  });

  describe('getCvKey', () => {
    it('throws NotFoundException for an unknown user', async () => {
      userModel.findById.mockReturnValue(query(null));

      await expect(service.getCvKey(USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the key (or null)', async () => {
      userModel.findById.mockReturnValue(
        query(createMockUser({ cvKey: 'cvs/x.pdf' })),
      );

      await expect(service.getCvKey(USER_ID)).resolves.toBe('cvs/x.pdf');
    });
  });
});
