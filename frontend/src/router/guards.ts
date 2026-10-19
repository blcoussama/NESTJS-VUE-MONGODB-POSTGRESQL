import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import type { UserRole } from '@/types/api'
import { ROLE_LABELS } from '@/utils/format'

declare module 'vue-router' {
  interface RouteMeta {
    /** Authenticated users only. */
    requiresAuth?: boolean
    /** Restricts the route to these roles (implies requiresAuth). */
    roles?: UserRole[]
    /** Login/signup…: redirect authenticated users to their home page. */
    guestOnly?: boolean
    /** Document title. */
    title?: string
  }
}

export interface GuardAuthState {
  isAuthenticated: boolean
  role: UserRole | null
  homeRoute: string
}

export type GuardDecision =
  | { allow: true }
  | { allow: false; redirect: RouteLocationRaw; reason: 'auth' | 'role' | 'guest'; message?: string }

type GuardTarget = Pick<RouteLocationNormalized, 'meta' | 'fullPath'>

/**
 * Client-side route protection (UX only: the API remains the authority and answers 401/403).
 */
export function resolveGuard(to: GuardTarget, auth: GuardAuthState): GuardDecision {
  const { requiresAuth, roles, guestOnly } = to.meta

  if (guestOnly && auth.isAuthenticated) {
    return { allow: false, redirect: auth.homeRoute, reason: 'guest' }
  }

  if ((requiresAuth || (roles && roles.length > 0)) && !auth.isAuthenticated) {
    return {
      allow: false,
      redirect: { name: 'login', query: { redirect: to.fullPath } },
      reason: 'auth',
    }
  }

  if (roles && roles.length > 0 && (!auth.role || !roles.includes(auth.role))) {
    const allowed = roles.map((r) => ROLE_LABELS[r].toLowerCase() + 's').join(' et ')
    return {
      allow: false,
      redirect: auth.homeRoute,
      reason: 'role',
      message: `Cette page est réservée aux ${allowed}.`,
    }
  }

  return { allow: true }
}
