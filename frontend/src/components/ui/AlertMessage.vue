<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{ kind?: 'error' | 'success' | 'info' | 'warning'; title?: string }>(),
  { kind: 'info' },
)

const classes = computed(
  () =>
    ({
      error: 'border-red-200 bg-red-50 text-red-800',
      success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      info: 'border-sky-200 bg-sky-50 text-sky-800',
      warning: 'border-amber-200 bg-amber-50 text-amber-900',
    })[props.kind],
)
</script>

<template>
  <div
    :role="kind === 'error' ? 'alert' : 'status'"
    class="rounded-lg border px-4 py-3 text-sm"
    :class="classes"
  >
    <p v-if="title" class="font-semibold">{{ title }}</p>
    <div :class="{ 'mt-1': title }"><slot /></div>
    <div v-if="$slots.actions" class="mt-3 flex flex-wrap gap-2"><slot name="actions" /></div>
  </div>
</template>
