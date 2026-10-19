import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from '@/stores/ui'

describe('stores/ui', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('les notifications disparaissent automatiquement', () => {
    vi.useFakeTimers()
    const ui = useUiStore()
    ui.success('Enregistré')
    expect(ui.toasts).toHaveLength(1)
    vi.advanceTimersByTime(5000)
    expect(ui.toasts).toHaveLength(0)
    vi.useRealTimers()
  })

  it('confirm() renvoie le choix de l’utilisateur', async () => {
    const ui = useUiStore()
    const answer = ui.confirm({ title: 'Supprimer ?' })
    expect(ui.confirmState?.title).toBe('Supprimer ?')
    ui.resolveConfirm(true)
    await expect(answer).resolves.toBe(true)
    expect(ui.confirmState).toBeNull()
  })
})
