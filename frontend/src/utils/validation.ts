import { MAX_AVATAR_BYTES, MAX_CV_BYTES } from '@/config'
import { formatBytes } from './format'
import { safeHttpUrl, withProtocol } from './url'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

export const PASSWORD_MIN_LENGTH = 8

/** Mirrors the backend rule (min 8 characters) and gives a simple strength hint. */
export function passwordStrength(password: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let score = 0
  if (password.length >= PASSWORD_MIN_LENGTH) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  const labels = ['Trop court', 'Faible', 'Moyen', 'Bon', 'Excellent']
  const clamped = (password.length < PASSWORD_MIN_LENGTH ? 0 : score) as 0 | 1 | 2 | 3 | 4
  return { score: clamped, label: labels[clamped] ?? '' }
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`
  }
  return null
}

/** Empty → null (clears the field); otherwise a normalized http(s) URL or an error. */
export function normalizeOptionalUrl(value: string): { value: string | null; error: string | null } {
  const trimmed = value.trim()
  if (trimmed === '') return { value: null, error: null }
  const safe = safeHttpUrl(withProtocol(trimmed))
  if (!safe) return { value: null, error: 'URL invalide (http ou https uniquement).' }
  return { value: safe, error: null }
}

export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function validateImageFile(file: File, maxBytes = MAX_AVATAR_BYTES): string | null {
  if (!AVATAR_TYPES.includes(file.type)) return 'Formats acceptés : JPEG, PNG ou WebP.'
  if (file.size > maxBytes) return `Fichier trop volumineux (max ${formatBytes(maxBytes)}).`
  return null
}

export function validateCvFile(file: File): string | null {
  if (file.type !== 'application/pdf') return 'Le CV doit être un fichier PDF.'
  if (file.size > MAX_CV_BYTES) return `Fichier trop volumineux (max ${formatBytes(MAX_CV_BYTES)}).`
  return null
}

/** Trims and converts empty strings to null (so that the API clears the field). */
export function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}
