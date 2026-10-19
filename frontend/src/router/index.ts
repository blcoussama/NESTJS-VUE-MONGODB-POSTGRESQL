import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
  type RouterHistory,
} from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { resolveGuard } from './guards'

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/jobs' },

  // ─── Auth ──────────────────────────────────────────────────────────────────
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { guestOnly: true, title: 'Connexion' },
  },
  {
    path: '/signup',
    name: 'signup',
    component: () => import('@/views/auth/SignupView.vue'),
    meta: { guestOnly: true, title: 'Créer un compte' },
  },
  {
    path: '/verify-email',
    name: 'verify-email',
    component: () => import('@/views/auth/VerifyEmailView.vue'),
    meta: { title: 'Vérification de l’e-mail' },
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('@/views/auth/ForgotPasswordView.vue'),
    meta: { guestOnly: true, title: 'Mot de passe oublié' },
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('@/views/auth/ResetPasswordView.vue'),
    meta: { title: 'Nouveau mot de passe' },
  },

  // ─── Jobs (public) ─────────────────────────────────────────────────────────
  {
    path: '/jobs',
    name: 'jobs',
    component: () => import('@/views/JobsView.vue'),
    meta: { title: 'Offres d’emploi' },
  },
  {
    path: '/jobs/:id',
    name: 'job-detail',
    component: () => import('@/views/JobDetailView.vue'),
    props: true,
    meta: { title: 'Détail de l’offre' },
  },

  // ─── Authenticated ─────────────────────────────────────────────────────────
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: { requiresAuth: true, title: 'Mon profil' },
  },
  {
    path: '/chat',
    name: 'chat',
    component: () => import('@/views/ChatView.vue'),
    meta: { requiresAuth: true, title: 'Messages' },
  },

  // ─── Candidate ─────────────────────────────────────────────────────────────
  {
    path: '/saved',
    name: 'saved',
    component: () => import('@/views/candidate/SavedJobsView.vue'),
    meta: { roles: ['candidate'], title: 'Offres enregistrées' },
  },
  {
    path: '/applications',
    name: 'applications',
    component: () => import('@/views/candidate/ApplicationsView.vue'),
    meta: { roles: ['candidate'], title: 'Mes candidatures' },
  },

  // ─── Recruiter ─────────────────────────────────────────────────────────────
  {
    path: '/recruiter/company',
    name: 'recruiter-company',
    component: () => import('@/views/recruiter/CompanyView.vue'),
    meta: { roles: ['recruiter'], title: 'Ma société' },
  },
  {
    path: '/recruiter/jobs',
    name: 'recruiter-jobs',
    component: () => import('@/views/recruiter/RecruiterJobsView.vue'),
    meta: { roles: ['recruiter'], title: 'Mes offres' },
  },
  {
    path: '/recruiter/jobs/new',
    name: 'recruiter-job-new',
    component: () => import('@/views/recruiter/JobEditorView.vue'),
    meta: { roles: ['recruiter'], title: 'Nouvelle offre' },
  },
  {
    path: '/recruiter/jobs/:id/edit',
    name: 'recruiter-job-edit',
    component: () => import('@/views/recruiter/JobEditorView.vue'),
    props: true,
    meta: { roles: ['recruiter'], title: 'Modifier l’offre' },
  },
  {
    path: '/recruiter/jobs/:id/applications',
    name: 'recruiter-job-applications',
    component: () => import('@/views/recruiter/JobApplicationsView.vue'),
    props: true,
    meta: { roles: ['recruiter'], title: 'Candidatures reçues' },
  },

  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: 'Page introuvable' },
  },
]

export function createAppRouter(history: RouterHistory = createWebHistory(import.meta.env.BASE_URL)) {
  const router = createRouter({
    history,
    routes,
    scrollBehavior(to, from, saved) {
      if (saved) return saved
      if (to.path === from.path) return false // filters/pagination change the query only
      return { top: 0 }
    },
  })

  router.beforeEach(async (to) => {
    const auth = useAuthStore()
    // Wait for the silent session restore (refresh cookie) before deciding.
    await auth.init()
    const decision = resolveGuard(to, {
      isAuthenticated: auth.isAuthenticated,
      role: auth.role,
      homeRoute: auth.homeRoute,
    })
    if (decision.allow) return true
    if (decision.message) useUiStore().error(decision.message)
    return decision.redirect
  })

  router.afterEach((to) => {
    document.title = to.meta.title ? `${to.meta.title} · PROFYLE` : 'PROFYLE'
  })

  return router
}
