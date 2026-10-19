<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useUiStore } from '@/stores/ui'
import AvatarImage from '@/components/ui/AvatarImage.vue'

const auth = useAuthStore()
const chat = useChatStore()
const ui = useUiStore()
const router = useRouter()
const route = useRoute()
const { isAuthenticated, isCandidate, isRecruiter, fullName, user } = storeToRefs(auth)
const { totalUnread } = storeToRefs(chat)
const menuOpen = ref(false)
const loggingOut = ref(false)

watch(
  () => route.fullPath,
  () => (menuOpen.value = false),
)

interface NavItem {
  to: string
  label: string
  badge?: number
}

const links = computed<NavItem[]>(() => {
  if (!isAuthenticated.value) return [{ to: '/jobs', label: 'Offres' }]
  const messages: NavItem = { to: '/chat', label: 'Messages', badge: totalUnread.value }
  if (isRecruiter.value) {
    return [
      { to: '/recruiter/jobs', label: 'Mes offres' },
      { to: '/recruiter/company', label: 'Ma société' },
      { to: '/jobs', label: 'Toutes les offres' },
      messages,
    ]
  }
  if (isCandidate.value) {
    return [
      { to: '/jobs', label: 'Offres' },
      { to: '/saved', label: 'Favoris' },
      { to: '/applications', label: 'Candidatures' },
      messages,
    ]
  }
  return [{ to: '/jobs', label: 'Offres' }]
})

async function logout() {
  if (loggingOut.value) return
  loggingOut.value = true
  try {
    await auth.logout()
    ui.success('Vous êtes déconnecté.')
    await router.push({ name: 'login' })
  } finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
    <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
      <RouterLink
        :to="isRecruiter ? '/recruiter/jobs' : '/jobs'"
        class="flex items-center gap-2 text-lg font-extrabold tracking-tight text-indigo-700"
      >
        <span aria-hidden="true" class="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white">P</span>
        PROFYLE
      </RouterLink>

      <nav aria-label="Navigation principale" class="hidden md:block">
        <ul class="flex items-center gap-1">
          <li v-for="link in links" :key="link.to">
            <RouterLink
              :to="link.to"
              class="relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              active-class="bg-indigo-50 text-indigo-700"
            >
              {{ link.label }}
              <span
                v-if="link.badge"
                class="inline-flex min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-semibold text-white"
              >
                {{ link.badge > 99 ? '99+' : link.badge }}
                <span class="sr-only"> message(s) non lu(s)</span>
              </span>
            </RouterLink>
          </li>
        </ul>
      </nav>

      <div class="hidden items-center gap-2 md:flex">
        <template v-if="isAuthenticated && user">
          <RouterLink
            to="/profile"
            class="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100"
            active-class="bg-indigo-50"
          >
            <AvatarImage :src="user.avatarUrl" :name="fullName" size="sm" />
            <span class="max-w-40 truncate">{{ fullName }}</span>
          </RouterLink>
          <button type="button" class="btn btn-ghost btn-sm" :disabled="loggingOut" @click="logout">
            Déconnexion
          </button>
        </template>
        <template v-else>
          <RouterLink to="/login" class="btn btn-ghost btn-sm">Connexion</RouterLink>
          <RouterLink to="/signup" class="btn btn-primary btn-sm">Créer un compte</RouterLink>
        </template>
      </div>

      <button
        type="button"
        class="btn btn-ghost btn-sm md:hidden"
        :aria-expanded="menuOpen"
        aria-controls="mobile-nav"
        @click="menuOpen = !menuOpen"
      >
        <span aria-hidden="true">☰</span>
        <span>Menu</span>
        <span v-if="totalUnread" class="rounded-full bg-indigo-600 px-1.5 text-xs text-white">
          {{ totalUnread }}
        </span>
      </button>
    </div>

    <nav
      v-show="menuOpen"
      id="mobile-nav"
      aria-label="Navigation mobile"
      class="border-t border-slate-200 bg-white px-4 py-3 md:hidden"
    >
      <ul class="flex flex-col gap-1">
        <li v-for="link in links" :key="link.to">
          <RouterLink
            :to="link.to"
            class="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            active-class="bg-indigo-50 text-indigo-700"
          >
            {{ link.label }}
            <span v-if="link.badge" class="rounded-full bg-indigo-600 px-1.5 text-xs text-white">
              {{ link.badge }}<span class="sr-only"> non lu(s)</span>
            </span>
          </RouterLink>
        </li>
        <template v-if="isAuthenticated">
          <li>
            <RouterLink to="/profile" class="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Mon profil
            </RouterLink>
          </li>
          <li>
            <button
              type="button"
              class="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50"
              :disabled="loggingOut"
              @click="logout"
            >
              Déconnexion
            </button>
          </li>
        </template>
        <template v-else>
          <li><RouterLink to="/login" class="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100">Connexion</RouterLink></li>
          <li><RouterLink to="/signup" class="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100">Créer un compte</RouterLink></li>
        </template>
      </ul>
    </nav>
  </header>
</template>
