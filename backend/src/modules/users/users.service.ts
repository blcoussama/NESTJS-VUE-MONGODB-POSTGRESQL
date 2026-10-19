import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { User, UserDocument, UserRole } from './schemas/user.schema';
import {
  CANDIDATE_PROFILE_FIELDS,
  UpdateCandidateProfileDto,
} from './dto/update-candidate-profile.dto';
import {
  RECRUITER_PROFILE_FIELDS,
  UpdateRecruiterProfileDto,
} from './dto/update-recruiter-profile.dto';
import { PublicProfile, toPublicProfile } from './user-profile.mapper';
import { validateDto } from '../../common/validation/validate-dto';
import {
  PRESIGNED_URL_TTL_SECONDS,
  StorageService,
} from '../../common/storage/storage.service';
import {
  AVATAR_UPLOAD,
  CV_UPLOAD,
  validateUploadedFile,
} from '../../common/files/upload-rules';

/** Public data about a candidate shown to a recruiter (never the CV key). */
export interface ApplicantSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  hasCv: boolean;
}

const ARRAY_FIELDS = new Set(['skills', 'experiences', 'education']);

/**
 * Copies ONLY the allow-listed fields that are present in the validated DTO.
 * Nested DTO instances are converted to plain objects for MongoDB.
 */
function pickAllowedFields(
  dto: object,
  fields: readonly string[],
): Record<string, unknown> {
  const source = dto as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  for (const field of fields) {
    const value = source[field];
    if (value === undefined) continue;
    if (value === null && ARRAY_FIELDS.has(field)) {
      update[field] = [];
    } else if (Array.isArray(value)) {
      update[field] = JSON.parse(JSON.stringify(value)) as unknown[];
    } else {
      update[field] = value;
    }
  }
  return update;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly storage: StorageService,
  ) {}

  // ─── Get profile ──────────────────────────────────────────────────────────

  async getMyProfile(userId: string): Promise<PublicProfile> {
    const user = await this.userModel
      .findById(userId)
      .select('+cvKey')
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return toPublicProfile(user);
  }

  // ─── Update profile ───────────────────────────────────────────────────────

  /**
   * The body is validated HERE, against the DTO of the user's role as stored
   * in the database: a TypeScript union type would be emitted as `Object`
   * and skipped by the global ValidationPipe (mass-assignment).
   */
  async updateMyProfile(userId: string, body: unknown): Promise<PublicProfile> {
    const current = await this.userModel
      .findById(userId)
      .select('role')
      .lean()
      .exec();

    if (!current) {
      throw new NotFoundException('User not found');
    }

    const update =
      current.role === UserRole.RECRUITER
        ? pickAllowedFields(
            await validateDto(UpdateRecruiterProfileDto, body),
            RECRUITER_PROFILE_FIELDS,
          )
        : pickAllowedFields(
            await validateDto(UpdateCandidateProfileDto, body),
            CANDIDATE_PROFILE_FIELDS,
          );

    const updated = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: update },
        { returnDocument: 'after', runValidators: true },
      )
      .select('+cvKey')
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    return toPublicProfile(updated);
  }

  // ─── Upload avatar ────────────────────────────────────────────────────────

  async uploadAvatar(
    userId: string,
    file: Express.Multer.File | undefined,
  ): Promise<{ avatarUrl: string }> {
    const type = validateUploadedFile(file, AVATAR_UPLOAD);

    const user = await this.userModel
      .findById(userId)
      .select('avatarUrl')
      .lean()
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const key = await this.storage.upload('avatars', file!.buffer, type);
    const avatarUrl = this.storage.publicUrl(key);
    await this.userModel
      .updateOne({ _id: userId }, { $set: { avatarUrl } })
      .exec();

    // Remove the replaced avatar only once the new one is saved
    if (user.avatarUrl) {
      await this.storage.deleteQuietly({ url: user.avatarUrl }, 'avatars');
    }

    return { avatarUrl };
  }

  // ─── Delete avatar ────────────────────────────────────────────────────────

  async deleteAvatar(userId: string): Promise<{ message: string }> {
    const user = await this.userModel
      .findById(userId)
      .select('avatarUrl')
      .lean()
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.avatarUrl) {
      throw new BadRequestException('No avatar to delete.');
    }

    await this.storage.deleteByPublicUrl(user.avatarUrl, 'avatars');
    await this.userModel
      .updateOne({ _id: userId }, { $set: { avatarUrl: null } })
      .exec();

    return { message: 'Avatar deleted successfully.' };
  }

  // ─── Upload CV (candidates only) ──────────────────────────────────────────

  async uploadCv(
    userId: string,
    role: UserRole,
    file: Express.Multer.File | undefined,
  ): Promise<{ message: string }> {
    if (role !== UserRole.CANDIDATE) {
      throw new ForbiddenException('Only candidates can upload a CV.');
    }

    const type = validateUploadedFile(file, CV_UPLOAD);

    const user = await this.userModel
      .findById(userId)
      .select('+cvKey')
      .lean()
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const key = await this.storage.upload('cvs', file!.buffer, type);
    await this.userModel
      .updateOne({ _id: userId }, { $set: { cvKey: key } })
      .exec();

    if (user.cvKey) {
      await this.storage.deleteQuietly({ key: user.cvKey }, 'cvs');
    }

    return { message: 'CV uploaded successfully.' };
  }

  // ─── Get CV presigned URL (candidates only) ───────────────────────────────

  async getCvPresignedUrl(
    userId: string,
    role: UserRole,
  ): Promise<{ url: string; expiresIn: number }> {
    if (role !== UserRole.CANDIDATE) {
      throw new ForbiddenException('Only candidates can access a CV.');
    }

    const cvKey = await this.getCvKey(userId);
    if (!cvKey) {
      throw new BadRequestException('No CV uploaded yet.');
    }

    const url = await this.storage.presignDownload(cvKey, 'cvs');
    return { url, expiresIn: PRESIGNED_URL_TTL_SECONDS };
  }

  // ─── Delete CV (candidates only) ──────────────────────────────────────────

  async deleteCv(userId: string, role: UserRole): Promise<{ message: string }> {
    if (role !== UserRole.CANDIDATE) {
      throw new ForbiddenException('Only candidates can delete a CV.');
    }

    const cvKey = await this.getCvKey(userId);
    if (!cvKey) {
      throw new BadRequestException('No CV to delete.');
    }

    await this.storage.delete(cvKey, 'cvs');
    await this.userModel
      .updateOne({ _id: userId }, { $set: { cvKey: null } })
      .exec();

    return { message: 'CV deleted successfully.' };
  }

  // ─── Used by other modules (applications) ─────────────────────────────────

  /** CV key of a user. Throws 404 if the user does not exist. */
  async getCvKey(userId: string): Promise<string | null> {
    const user = await this.userModel
      .findById(userId)
      .select('+cvKey')
      .lean()
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.cvKey ?? null;
  }

  /** Public summaries of several users in ONE query (no N+1). */
  async findApplicantSummaries(
    userIds: string[],
  ): Promise<Map<string, ApplicantSummary>> {
    const ids = [...new Set(userIds)].filter((id) => isValidObjectId(id));
    if (ids.length === 0) return new Map();

    const users = await this.userModel
      .find({ _id: { $in: ids } })
      .select('firstName lastName email avatarUrl cvKey')
      .lean()
      .exec();

    return new Map(
      users.map((user) => {
        const id = user._id.toString();
        return [
          id,
          {
            id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            avatarUrl: user.avatarUrl ?? null,
            hasCv: Boolean(user.cvKey),
          },
        ];
      }),
    );
  }
}
