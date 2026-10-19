<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const { toasts } = storeToRefs(ui)
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:right-4 sm:left-auto sm:items-end"
    aria-live="polite"
    aria-relevant="additions"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      :role="toast.kind === 'error' ? 'alert' : 'status'"
      class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg"
      :class="{
        'border-red-200 bg-red-50 text-red-800': toast.kind === 'error',
        'border-emerald-200 bg-emerald-50 text-emerald-800': toast.kind === 'success',
        'border-slate-200 bg-white text-slate-800': toast.kind === 'info',
      }"
    >
      <p class="flex-1">{{ toast.message }}</p>
      <button
        type="button"
        class="rounded p-0.5 text-current opacity-70 hover:opacity-100"
        aria-label="Fermer la notification"
        @click="ui.dismiss(toast.id)"
      >
        ✕
      </button>
    </div>
  </div>
</template>
