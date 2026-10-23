import { watch } from 'vue'
import type { Router } from 'vue-router'
import { registerAuthHandlers } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useChatStore } from '@/stores/chat'
import { useJobsStore } from '@/stores/jobs'
import { useApplicationsStore } from '@/stores/applications'
import { useCompanyStore } from '@/stores/company'
import { useProfileStore } from '@/stores/profile'

/**
 * Wires the HTTP layer to the auth store (in-memory token) and reacts to login/logout:
 * opens the chat socket once authenticated, clears every user-specific store on logout.
 * Must be called after `app.use(pinia)`.
 */
export function installSession(router: Router): void {
  const auth = useAuthStore()
  const ui = useUiStore()
  const chat = useChatStore()

  registerAuthHandlers({
    getAccessToken: () => auth.accessToken,
    setAccessToken: (token) => auth.setAccessToken(token),
    onSessionExpired: () => {
      const wasAuthenticated = auth.isAuthenticated
      auth.clearSession()
      if (!wasAuthenticated) return
      ui.error('Votre session a expiré. Veuillez vous reconnecter.')
      const current = router.currentRoute.value
      if (current.meta.requiresAuth || current.meta.roles) {
        void router.push({ name: 'login', query: { redirect: current.fullPath } })
      }
    },
  })

  watch(
    () => auth.isAuthenticated,
    (authenticated) => {
      if (authenticated) {
        chat.connect()
        return
      }
      chat.reset()
      useJobsStore().reset()
      useApplicationsStore().reset()
      useCompanyStore().reset()
      useProfileStore().reset()
    },
    { immediate: true },
  )
}
