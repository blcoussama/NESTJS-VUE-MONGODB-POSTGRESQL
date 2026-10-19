/**
 * Types derived from CLAUDE-CODE/API-V2-CONTRACT.md (PROFYLE v2).
 * Dates are ISO-8601 strings as serialized by the API.
 */

// ─── Common ──────────────────────────────────────────────────────────────────

export type UserRole = 'candidate' | 'recruiter'

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/** NestJS error payload: `{ statusCode, message, error }` (message may be a list). */
export interface ApiErrorBody {
  statusCode: number
  message: string | string[]
  error?: string
}

export interface MessageResponse {
  message: string
}

export interface PresignedUrlResponse {
  url: string
  expiresIn?: number
}

// ─── Auth / users ────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role: UserRole
  avatarUrl?: string | null
}

export interface SignupPayload {
  firstName: string
  lastName: string
  email: string
  password: string
  role: UserRole
}

export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  user: AuthUser
}

export interface RefreshResponse {
  accessToken: string
}

export interface Experience {
  title: string
  company: string
  location?: string | null
  startDate: string
  endDate?: string | null
  current?: boolean
  description?: string | null
}

export interface Education {
  school: string
  degree: string
  field?: string | null
  startDate: string
  endDate?: string | null
  current?: boolean
}

export interface UserProfile extends AuthUser {
  isEmailVerified?: boolean
  headline?: string | null
  bio?: string | null
  location?: string | null
  phone?: string | null
  linkedinUrl?: string | null
  // candidate
  skills?: string[]
  githubUrl?: string | null
  portfolioUrl?: string | null
  hasCv?: boolean
  isAvailable?: boolean
  experiences?: Experience[]
  education?: Education[]
  // recruiter
  companyName?: string | null
  companyWebsite?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface UpdateCommonProfilePayload {
  headline?: string | null
  bio?: string | null
  location?: string | null
  phone?: string | null
  linkedinUrl?: string | null
}

export interface UpdateCandidateProfilePayload extends UpdateCommonProfilePayload {
  githubUrl?: string | null
  portfolioUrl?: string | null
  skills?: string[]
  isAvailable?: boolean
  experiences?: Experience[]
  education?: Education[]
}

export interface UpdateRecruiterProfilePayload extends UpdateCommonProfilePayload {
  companyName?: string | null
  companyWebsite?: string | null
}

export type UpdateProfilePayload = UpdateCandidateProfilePayload | UpdateRecruiterProfilePayload

// ─── Companies ───────────────────────────────────────────────────────────────

export interface Company {
  id: string
  name: string
  description: string | null
  website: string | null
  location: string | null
  logoUrl: string | null
  ownerId: string
  createdAt: string
  updatedAt: string
}

export interface CompanyPayload {
  name: string
  description?: string
  website?: string
  location?: string
}

export interface CompanySummary {
  id: string
  name: string
  logoUrl: string | null
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

export const JOB_TYPES = ['full-time', 'part-time', 'internship', 'contract', 'freelance'] as const
export type JobType = (typeof JOB_TYPES)[number]

export const EXPERIENCE_LEVELS = ['entry', 'junior', 'mid', 'senior', 'lead'] as const
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number]

export const SALARY_TYPES = ['fixed', 'range', 'negotiable'] as const
export type SalaryType = (typeof SALARY_TYPES)[number]

export interface Salary {
  min?: number
  max?: number
  currency?: string
}

export interface Job {
  id: string
  title: string
  description: string
  location: string
  jobType: JobType
  experienceLevel: ExperienceLevel
  requirements: string[]
  salaryType: SalaryType
  salary?: Salary | null
  isOpen: boolean
  companyId: string
  recruiterId: string
  createdAt: string
  updatedAt: string
  company?: CompanySummary
  /** Only for an authenticated candidate on `GET /jobs/:id` (optional). */
  isSaved?: boolean
  hasApplied?: boolean
  /** Only on `GET /jobs/mine`. */
  applicationsCount?: number
}

export type JobSort = 'recent' | 'oldest'

export interface JobFilters {
  search?: string
  location?: string
  jobType?: JobType | ''
  experienceLevel?: ExperienceLevel | ''
  companyId?: string
  page?: number
  limit?: number
  sort?: JobSort
}

export interface JobPayload {
  title: string
  description: string
  location: string
  jobType: JobType
  experienceLevel: ExperienceLevel
  requirements: string[]
  salaryType: SalaryType
  salary?: Salary | null
  companyId: string
}

export type JobUpdatePayload = Partial<Omit<JobPayload, 'companyId'>> & { isOpen?: boolean }

// ─── Applications ────────────────────────────────────────────────────────────

export const APPLICATION_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export interface Application {
  id: string
  jobId: string
  applicantId: string
  experienceYears: number
  experienceLevel: ExperienceLevel
  status: ApplicationStatus
  withdrawnAt?: string | null
  expiresAt?: string | null
  createdAt: string
  updatedAt?: string
}

export interface ApplyPayload {
  experienceYears: number
  experienceLevel: ExperienceLevel
}

export interface CandidateApplication extends Application {
  job?: {
    id: string
    title: string
    company?: { name: string; logoUrl: string | null }
  }
}

export interface Applicant {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl: string | null
  hasCv: boolean
}

export interface RecruiterApplication extends Application {
  applicant?: Applicant
}

export type ReviewStatus = Extract<ApplicationStatus, 'ACCEPTED' | 'REJECTED'>

// ─── Saved jobs ──────────────────────────────────────────────────────────────

export interface SavedJob {
  id: string
  jobId: string
  createdAt: string
  job?: Partial<Job> & { id: string; title: string }
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  from: string
  to: string
  text: string
  createdAt: string
  readAt: string | null
}

export interface ChatUser {
  id: string
  firstName: string
  lastName: string
  avatarUrl: string | null
}

export interface Conversation {
  user: ChatUser
  lastMessage: { text: string; createdAt: string; from: string } | null
  unreadCount: number
}

export interface MessagesPage {
  items: ChatMessage[]
  nextCursor: string | null
}

export type SendAck = { ok: true; message: ChatMessage } | { ok: false; error: string }
