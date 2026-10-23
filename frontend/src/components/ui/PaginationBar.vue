<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ page: number; totalPages: number; disabled?: boolean }>()
const emit = defineEmits<{ 'update:page': [page: number] }>()

/** Page numbers with ellipsis, e.g. [1, '…', 4, 5, 6, '…', 12]. */
const pages = computed<(number | '…')[]>(() => {
  const total = props.totalPages
  const current = props.page
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const result: (number | '…')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) result.push('…')
  for (let p = start; p <= end; p++) result.push(p)
  if (end < total - 1) result.push('…')
  result.push(total)
  return result
})

function go(page: number) {
  if (props.disabled || page < 1 || page > props.totalPages || page === props.page) return
  emit('update:page', page)
}
</script>

<template>
  <nav v-if="totalPages > 1" aria-label="Pagination" class="flex items-center justify-center gap-1">
    <button
      type="button"
      class="btn btn-secondary btn-sm"
      :disabled="disabled || page <= 1"
      aria-label="Page précédente"
      @click="go(page - 1)"
    >
      ‹ Précédent
    </button>
    <ul class="flex items-center gap-1">
      <li v-for="(p, index) in pages" :key="`${p}-${index}`">
        <span v-if="p === '…'" class="px-2 text-slate-400" aria-hidden="true">…</span>
        <button
          v-else
          type="button"
          class="btn btn-sm min-w-9"
          :class="p === page ? 'btn-primary' : 'btn-ghost'"
          :aria-current="p === page ? 'page' : undefined"
          :aria-label="`Page ${p}`"
          :disabled="disabled"
          @click="go(p)"
        >
          {{ p }}
        </button>
      </li>
    </ul>
    <button
      type="button"
      class="btn btn-secondary btn-sm"
      :disabled="disabled || page >= totalPages"
      aria-label="Page suivante"
      @click="go(page + 1)"
    >
      Suivant ›
    </button>
  </nav>
</template>
