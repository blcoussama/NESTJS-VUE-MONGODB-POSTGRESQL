import type { AuthUser, Paginated, UserProfile, UserRole } from '@/types/api'

type RawRecord = Record<string, unknown>

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function optStr(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

/**
 * Mongo documents may be serialized with `_id` (lean documents) or `id`; the client
 * always works with `id`.
 */
export function normalizeId(raw: RawRecord): string {
  return str(raw.id ?? raw._id)
}

export function normalizeAuthUser(raw: unknown): AuthUser {
  const r = isRecord(raw) ? raw : {}
  return {
    id: normalizeId(r),
    firstName: str(r.firstName),
    lastName: str(r.lastName),
    email: str(r.email),
    role: (r.role === 'recruiter' ? 'recruiter' : 'candidate') as UserRole,
    avatarUrl: optStr(r.avatarUrl),
  }
}

/** `GET /users/me` → profile, without ever keeping internal fields (cvKey, tokens…). */
export function normalizeProfile(raw: unknown): UserProfile {
  const r = isRecord(raw) ? raw : {}
  const base = normalizeAuthUser(r)
  const hasCv = typeof r.hasCv === 'boolean' ? r.hasCv : Boolean(r.cvKey)
  return {
    ...base,
    isEmailVerified: typeof r.isEmailVerified === 'boolean' ? r.isEmailVerified : undefined,
    headline: optStr(r.headline),
    bio: optStr(r.bio),
    location: optStr(r.location),
    phone: optStr(r.phone),
    linkedinUrl: optStr(r.linkedinUrl),
    skills: Array.isArray(r.skills) ? r.skills.filter((s): s is string => typeof s === 'string') : [],
    githubUrl: optStr(r.githubUrl),
    portfolioUrl: optStr(r.portfolioUrl),
    hasCv,
    isAvailable: Boolean(r.isAvailable),
    experiences: Array.isArray(r.experiences) ? (r.experiences as UserProfile['experiences']) : [],
    education: Array.isArray(r.education) ? (r.education as UserProfile['education']) : [],
    companyName: optStr(r.companyName),
    companyWebsite: optStr(r.companyWebsite),
    createdAt: optStr(r.createdAt) ?? undefined,
    updatedAt: optStr(r.updatedAt) ?? undefined,
  }
}

/** Lists may be returned as a bare array or as a paginated envelope. */
export function asList<T>(data: T[] | Paginated<T> | { items?: T[] } | null | undefined): T[] {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.items)) return data.items
  return []
}
