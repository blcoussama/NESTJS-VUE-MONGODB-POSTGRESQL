import axios from 'axios'
import type { ApiErrorBody } from '@/types/api'

export interface NormalizedError {
  /** HTTP status, or null for network/unknown errors. */
  status: number | null
  /** Human readable message, safe to render as text. */
  message: string
  /** Individual messages (NestJS validation errors are returned as a list). */
  details: string[]
}

const STATUS_FALLBACKS: Record<number, string> = {
  400: 'Requête invalide.',
  401: 'Authentification requise.',
  403: 'Accès refusé.',
  404: 'Ressource introuvable.',
  409: 'Conflit : cette action a déjà été effectuée.',
  413: 'Fichier trop volumineux.',
  422: 'Données invalides.',
  429: 'Trop de requêtes, réessayez dans un instant.',
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && 'message' in value
}

function fallbackFor(status: number | null, fallback?: string): string {
  if (status !== null && STATUS_FALLBACKS[status]) return STATUS_FALLBACKS[status]
  if (status !== null && status >= 500) return 'Erreur serveur, réessayez plus tard.'
  return fallback ?? 'Une erreur inattendue est survenue.'
}

export function normalizeError(error: unknown, fallback?: string): NormalizedError {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      const message =
        error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
          ? 'Le serveur met trop de temps à répondre.'
          : 'Impossible de joindre le serveur. Vérifiez votre connexion.'
      return { status: null, message, details: [] }
    }
    const status = error.response.status
    const body: unknown = error.response.data
    if (isApiErrorBody(body)) {
      const raw = Array.isArray(body.message) ? body.message : [body.message]
      const details = raw.filter((m): m is string => typeof m === 'string' && m.trim() !== '')
      if (details.length > 0) {
        return { status, message: details.join(' · '), details }
      }
    }
    return { status, message: fallbackFor(status, fallback), details: [] }
  }
  if (error instanceof Error && error.message) {
    return { status: null, message: error.message, details: [] }
  }
  return { status: null, message: fallback ?? 'Une erreur inattendue est survenue.', details: [] }
}

export function errorMessage(error: unknown, fallback?: string): string {
  return normalizeError(error, fallback).message
}

export function hasStatus(error: unknown, status: number): boolean {
  return axios.isAxiosError(error) && error.response?.status === status
}
