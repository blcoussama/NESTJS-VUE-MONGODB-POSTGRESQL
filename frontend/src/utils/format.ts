import type {
  ApplicationStatus,
  ExperienceLevel,
  JobType,
  Salary,
  SalaryType,
  UserRole,
} from '@/types/api'

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  'full-time': 'Temps plein',
  'part-time': 'Temps partiel',
  internship: 'Stage',
  contract: 'CDD / Contrat',
  freelance: 'Freelance',
}

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  entry: 'Débutant',
  junior: 'Junior',
  mid: 'Confirmé',
  senior: 'Senior',
  lead: 'Lead / Expert',
}

export const SALARY_TYPE_LABELS: Record<SalaryType, string> = {
  fixed: 'Fixe',
  range: 'Fourchette',
  negotiable: 'À négocier',
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  PENDING: 'En attente',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Refusée',
  WITHDRAWN: 'Retirée',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  candidate: 'Candidat',
  recruiter: 'Recruteur',
}

export function labelOf<K extends string>(labels: Record<K, string>, key: string | null | undefined): string {
  if (!key) return ''
  return (labels as Record<string, string>)[key] ?? key
}

function formatAmount(value: number, currency?: string): string {
  const cur = (currency || 'MAD').toUpperCase()
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} ${cur}`
  }
}

/** Human readable salary according to its type. */
export function formatSalary(salaryType: SalaryType, salary?: Salary | null): string {
  if (salaryType === 'negotiable' || !salary) return 'Salaire à négocier'
  const { min, max, currency } = salary
  const hasMin = typeof min === 'number' && Number.isFinite(min)
  const hasMax = typeof max === 'number' && Number.isFinite(max)
  if (salaryType === 'fixed') {
    const value = hasMin ? min : hasMax ? max : undefined
    return value === undefined ? 'Salaire à négocier' : formatAmount(value, currency)
  }
  if (hasMin && hasMax) return `${formatAmount(min, currency)} – ${formatAmount(max, currency)}`
  if (hasMin) return `À partir de ${formatAmount(min, currency)}`
  if (hasMax) return `Jusqu’à ${formatAmount(max, currency)}`
  return 'Salaire à négocier'
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDate(value: string | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return ''
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}

export function formatMonthYear(value: string | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return ''
  return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(d)
}

export function formatTime(value: string | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return ''
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(d)
}

/** "à l’instant", "il y a 5 min", "il y a 3 j", then an absolute date. */
export function formatRelative(value: string | Date | null | undefined, now: Date = new Date()): string {
  const d = toDate(value)
  if (!d) return ''
  const diffSec = Math.round((now.getTime() - d.getTime()) / 1000)
  if (diffSec < 45) return 'à l’instant'
  const minutes = Math.round(diffSec / 60)
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 30) return `il y a ${days} j`
  return formatDate(d)
}

/** Short timestamp for a conversation list. */
export function formatChatTimestamp(value: string | Date | null | undefined, now: Date = new Date()): string {
  const d = toDate(value)
  if (!d) return ''
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return formatTime(d)
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d)
}

export function initials(firstName?: string | null, lastName?: string | null): string {
  const a = (firstName ?? '').trim().charAt(0)
  const b = (lastName ?? '').trim().charAt(0)
  return `${a}${b}`.toUpperCase() || '?'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

/** `YYYY-MM-DD` for `<input type="date">` from an ISO string. */
export function toDateInput(value: string | null | undefined): string {
  const d = toDate(value)
  if (!d) return ''
  return d.toISOString().slice(0, 10)
}
