<script setup lang="ts">
withDefaults(defineProps<{ label?: string; size?: 'sm' | 'md' | 'lg'; inline?: boolean }>(), {
  label: 'Chargement…',
  size: 'md',
  inline: false,
})
</script>

<template>
  <div
    role="status"
    aria-live="polite"
    :class="inline ? 'inline-flex items-center gap-2' : 'flex items-center justify-center gap-3 py-10'"
  >
    <span
      aria-hidden="true"
      class="animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"
      :class="{ 'h-4 w-4': size === 'sm', 'h-6 w-6': size === 'md', 'h-10 w-10': size === 'lg' }"
    />
    <span :class="inline ? 'text-sm text-slate-600' : 'text-sm text-slate-600'">{{ label }}</span>
  </div>
</template>
