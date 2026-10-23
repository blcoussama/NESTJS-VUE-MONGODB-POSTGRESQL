import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void
}

const DEFAULT_TIMEOUT = 5000

export const useUiStore = defineStore('ui', () => {
  const toasts = ref<Toast[]>([])
  const mobileNavOpen = ref(false)
  const confirmState = ref<ConfirmState | null>(null)
  let nextId = 1
  const timers = new Map<number, ReturnType<typeof setTimeout>>()

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id)
    const timer = timers.get(id)
    if (timer) clearTimeout(timer)
    timers.delete(id)
  }

  function notify(message: string, kind: ToastKind = 'info', timeout = DEFAULT_TIMEOUT): number {
    const id = nextId++
    toasts.value = [...toasts.value.slice(-4), { id, kind, message }]
    if (timeout > 0) timers.set(id, setTimeout(() => dismiss(id), timeout))
    return id
  }

  const success = (message: string) => notify(message, 'success')
  const error = (message: string) => notify(message, 'error', 8000)
  const info = (message: string) => notify(message, 'info')

  function clearToasts(): void {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    toasts.value = []
  }

  /** Accessible confirmation dialog (rendered once in App.vue). Resolves to the user's choice. */
  function confirm(options: ConfirmOptions): Promise<boolean> {
    confirmState.value?.resolve(false)
    return new Promise<boolean>((resolve) => {
      confirmState.value = { ...options, resolve }
    })
  }

  function resolveConfirm(value: boolean): void {
    const state = confirmState.value
    confirmState.value = null
    state?.resolve(value)
  }

  return {
    toasts,
    mobileNavOpen,
    confirmState,
    notify,
    success,
    error,
    info,
    dismiss,
    clearToasts,
    confirm,
    resolveConfirm,
  }
})
