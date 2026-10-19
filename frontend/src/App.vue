<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import AppHeader from '@/components/layout/AppHeader.vue'
import ToastContainer from '@/components/layout/ToastContainer.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'

const auth = useAuthStore()
const { status } = storeToRefs(auth)
const route = useRoute()
const mainRef = ref<HTMLElement | null>(null)

// Move focus to the main region when the page (path) changes, for keyboard/screen-reader users.
watch(
  () => route.path,
  async (path, previous) => {
    if (!previous || path === previous) return
    await nextTick()
    mainRef.value?.focus({ preventScroll: true })
  },
)
</script>

<template>
  <a
    href="#main"
    class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow"
  >
    Aller au contenu
  </a>
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <main id="main" ref="mainRef" tabindex="-1" class="mx-auto w-full max-w-6xl flex-1 px-4 py-8 focus:outline-none">
      <AppSpinner v-if="status !== 'ready'" size="lg" label="Restauration de la session…" />
      <RouterView v-else />
    </main>
    <footer class="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
      PROFYLE v2 — plateforme de recrutement (Vue 3 · NestJS · Socket.io)
    </footer>
  </div>
  <ToastContainer />
  <ConfirmDialog />
</template>
