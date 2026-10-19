import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { errorMessage, hasStatus, normalizeError } from '@/api/errors'
import { asList, normalizeProfile } from '@/api/normalize'
import { toJobQuery } from '@/api/jobs'

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig

function httpError(status: number, data?: unknown) {
  const response = { status, data, statusText: '', headers: {}, config } as AxiosResponse
  return new AxiosError('fail', 'ERR_BAD_REQUEST', config, {}, response)
}

describe('api/errors — messages d’erreur serveur', () => {
  it('reprend le message NestJS (chaîne)', () => {
    expect(errorMessage(httpError(409, { statusCode: 409, message: 'Email already in use', error: 'Conflict' }))).toBe(
      'Email already in use',
    )
  })

  it('agrège les erreurs de validation (liste)', () => {
    const n = normalizeError(httpError(400, { statusCode: 400, message: ['email must be an email', 'password too short'] }))
    expect(n.details).toHaveLength(2)
    expect(n.message).toContain('email must be an email')
    expect(n.status).toBe(400)
  })

  it('erreur réseau / délai dépassé → message lisible, status null', () => {
    expect(normalizeError(new AxiosError('Network Error', 'ERR_NETWORK', config))).toMatchObject({ status: null })
    expect(errorMessage(new AxiosError('timeout', 'ECONNABORTED', config))).toMatch(/trop de temps/)
  })

  it('repli par statut quand le corps est vide', () => {
    expect(errorMessage(httpError(500))).toMatch(/Erreur serveur/)
    expect(errorMessage(httpError(403, ''))).toBe('Accès refusé.')
    expect(errorMessage('weird', 'Repli')).toBe('Repli')
    expect(errorMessage(new Error('boom'))).toBe('boom')
  })

  it('hasStatus', () => {
    expect(hasStatus(httpError(404), 404)).toBe(true)
    expect(hasStatus(new Error('x'), 404)).toBe(false)
  })
})

describe('api/normalize', () => {
  it('normalise _id → id et dérive hasCv sans exposer cvKey', () => {
    const profile = normalizeProfile({
      _id: '64b7f0c2a1b2c3d4e5f60718',
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.c',
      role: 'candidate',
      cvKey: 'cvs/secret.pdf',
      skills: ['Vue', 3],
    })
    expect(profile.id).toBe('64b7f0c2a1b2c3d4e5f60718')
    expect(profile.hasCv).toBe(true)
    expect(profile.skills).toEqual(['Vue'])
    expect(profile).not.toHaveProperty('cvKey')
  })

  it('asList accepte un tableau, une enveloppe paginée ou rien', () => {
    expect(asList([1, 2])).toEqual([1, 2])
    expect(asList({ items: [3], total: 1, page: 1, limit: 10, totalPages: 1 })).toEqual([3])
    expect(asList(null)).toEqual([])
  })

  it('toJobQuery supprime les filtres vides et plafonne limit à 50', () => {
    expect(
      toJobQuery({ search: '  vue ', location: '', jobType: '', experienceLevel: 'mid', page: 2, limit: 500, sort: 'recent' }),
    ).toEqual({ search: 'vue', experienceLevel: 'mid', page: 2, limit: 50, sort: 'recent' })
  })
})
