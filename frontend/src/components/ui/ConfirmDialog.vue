<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const { confirmState } = storeToRefs(ui)
const dialogRef = ref<HTMLElement | null>(null)
const confirmButton = ref<HTMLButtonElement | null>(null)
const cancelButton = ref<HTMLButtonElement | null>(null)
let previouslyFocused: HTMLElement | null = null

watch(confirmState, async (state, previous) => {
  if (state && !previous) {
    previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    // Destructive actions: focus "Annuler" first.
    ;(state.danger ? cancelButton.value : confirmButton.value)?.focus()
  } else if (!state && previous) {
    previouslyFocused?.focus()
    previouslyFocused = null
  }
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    ui.resolveConfirm(false)
    return
  }
  if (event.key !== 'Tab' || !dialogRef.value) return
  // Minimal focus trap between the dialog's focusable elements.
  const focusables = Array.from(dialogRef.value.querySelectorAll<HTMLElement>('button'))
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (!first || !last) return
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <div
    v-if="confirmState"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    @click.self="ui.resolveConfirm(false)"
  >
    <div
      ref="dialogRef"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      :aria-describedby="confirmState.message ? 'confirm-message' : undefined"
      class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      @keydown="onKeydown"
    >
      <h2 id="confirm-title" class="text-lg font-semibold text-slate-900">{{ confirmState.title }}</h2>
      <p v-if="confirmState.message" id="confirm-message" class="mt-2 text-sm text-slate-600">
        {{ confirmState.message }}
      </p>
      <div class="mt-6 flex justify-end gap-2">
        <button ref="cancelButton" type="button" class="btn btn-secondary" @click="ui.resolveConfirm(false)">
          {{ confirmState.cancelLabel ?? 'Annuler' }}
        </button>
        <button
          ref="confirmButton"
          type="button"
          class="btn"
          :class="confirmState.danger ? 'btn-danger' : 'btn-primary'"
          @click="ui.resolveConfirm(true)"
        >
          {{ confirmState.confirmLabel ?? 'Confirmer' }}
        </button>
      </div>
    </div>
  </div>
</template>
