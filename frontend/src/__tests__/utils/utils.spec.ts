import { describe, expect, it } from 'vitest'
import { safeHttpUrl, safeRedirectPath, withProtocol } from '@/utils/url'
import {
  formatRelative,
  formatSalary,
  initials,
  labelOf,
  JOB_TYPE_LABELS,
  toDateInput,
} from '@/utils/format'
import {
  isEmail,
  normalizeOptionalUrl,
  passwordStrength,
  validateCvFile,
  validateImageFile,
  validatePassword,
} from '@/utils/validation'

describe('utils/url — sécurité des liens', () => {
  it('safeHttpUrl n’accepte que http(s)', () => {
    expect(safeHttpUrl('https://alten.ma')).toBe('https://alten.ma/')
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpUrl('JaVaScRiPt:alert(1)')).toBeNull()
    expect(safeHttpUrl('data:text/html,<script>')).toBeNull()
    expect(safeHttpUrl('/relative')).toBeNull()
    expect(safeHttpUrl(null)).toBeNull()
  })

  it('safeRedirectPath bloque les redirections ouvertes', () => {
    expect(safeRedirectPath('/jobs?page=2')).toBe('/jobs?page=2')
    expect(safeRedirectPath('//evil.com')).toBeNull()
    expect(safeRedirectPath('/\\evil.com')).toBeNull()
    expect(safeRedirectPath('https://evil.com')).toBeNull()
    expect(safeRedirectPath(['/jobs'])).toBeNull()
  })

  it('withProtocol ajoute https:// à un domaine nu', () => {
    expect(withProtocol('alten.ma')).toBe('https://alten.ma')
    expect(withProtocol('http://x.y')).toBe('http://x.y')
  })
})

describe('utils/format', () => {
  it('formatSalary selon le type', () => {
    expect(formatSalary('negotiable', null)).toBe('Salaire à négocier')
    expect(formatSalary('fixed', { min: 9000, currency: 'MAD' })).toMatch(/9\s?000/)
    const range = formatSalary('range', { min: 8000, max: 12000, currency: 'EUR' })
    expect(range).toMatch(/8\s?000/)
    expect(range).toMatch(/12\s?000/)
    expect(formatSalary('range', { min: 5000 })).toMatch(/^À partir de/)
  })

  it('libellés, initiales et dates', () => {
    expect(labelOf(JOB_TYPE_LABELS, 'internship')).toBe('Stage')
    expect(labelOf(JOB_TYPE_LABELS, 'unknown')).toBe('unknown')
    expect(initials('oussama', 'belcadi')).toBe('OB')
    expect(toDateInput('2024-07-01T00:00:00.000Z')).toBe('2024-07-01')
    const now = new Date('2026-10-19T12:00:00Z')
    expect(formatRelative('2026-10-19T11:59:50Z', now)).toBe('à l’instant')
    expect(formatRelative('2026-10-19T11:30:00Z', now)).toBe('il y a 30 min')
    expect(formatRelative('2026-10-16T12:00:00Z', now)).toBe('il y a 3 j')
  })
})

describe('utils/validation', () => {
  it('e-mail et mot de passe (règle backend : 8 caractères min.)', () => {
    expect(isEmail('a@b.co')).toBe(true)
    expect(isEmail('nope')).toBe(false)
    expect(validatePassword('short')).not.toBeNull()
    expect(validatePassword('LongEnough1!')).toBeNull()
    expect(passwordStrength('abc').score).toBe(0)
    expect(passwordStrength('Abcdefg1!').score).toBe(4)
  })

  it('URL optionnelle : vide → null, invalide → erreur', () => {
    expect(normalizeOptionalUrl('')).toEqual({ value: null, error: null })
    expect(normalizeOptionalUrl('github.com/blcoussama').value).toBe('https://github.com/blcoussama')
    expect(normalizeOptionalUrl('javascript:alert(1)').error).not.toBeNull()
  })

  it('fichiers : avatar (image ≤ 2 Mo) et CV (PDF ≤ 5 Mo)', () => {
    const png = new File(['x'], 'a.png', { type: 'image/png' })
    const gif = new File(['x'], 'a.gif', { type: 'image/gif' })
    const bigPdf = new File([new Uint8Array(6 * 1024 * 1024)], 'cv.pdf', { type: 'application/pdf' })
    expect(validateImageFile(png)).toBeNull()
    expect(validateImageFile(gif)).not.toBeNull()
    expect(validateCvFile(new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' }))).toBeNull()
    expect(validateCvFile(bigPdf)).toMatch(/volumineux/)
    expect(validateCvFile(png)).toMatch(/PDF/)
  })
})
