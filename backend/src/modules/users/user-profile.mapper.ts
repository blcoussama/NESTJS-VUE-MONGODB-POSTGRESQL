import { User, UserRole } from './schemas/user.schema';

type ProfileSource = Partial<User> & {
  _id: { toString(): string };
  createdAt?: Date;
  updatedAt?: Date;
};

/**
 * Explicit allow-list of what GET/PATCH /users/me return. The password hash,
 * token digests and the private S3 key of the CV are never part of it.
 */
export function toPublicProfile(user: ProfileSource) {
  const base = {
    _id: user._id.toString(), // kept for backward compatibility
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified ?? false,
    avatarUrl: user.avatarUrl ?? null,
    headline: user.headline ?? null,
    bio: user.bio ?? null,
    location: user.location ?? null,
    phone: user.phone ?? null,
    linkedinUrl: user.linkedinUrl ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  if (user.role === UserRole.RECRUITER) {
    return {
      ...base,
      companyName: user.companyName ?? null,
      companyWebsite: user.companyWebsite ?? null,
    };
  }

  return {
    ...base,
    skills: user.skills ?? [],
    githubUrl: user.githubUrl ?? null,
    portfolioUrl: user.portfolioUrl ?? null,
    isAvailable: user.isAvailable ?? false,
    experiences: user.experiences ?? [],
    education: user.education ?? [],
    hasCv: Boolean(user.cvKey),
  };
}

export type PublicProfile = ReturnType<typeof toPublicProfile>;
