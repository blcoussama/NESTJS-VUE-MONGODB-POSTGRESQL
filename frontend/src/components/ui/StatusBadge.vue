<script setup lang="ts">
import { computed } from 'vue'
import type { ApplicationStatus } from '@/types/api'
import { STATUS_LABELS } from '@/utils/format'

const props = defineProps<{ status: ApplicationStatus }>()

const classes = computed(
  () =>
    ({
      PENDING: 'bg-amber-100 text-amber-800 ring-amber-200',
      ACCEPTED: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
      REJECTED: 'bg-red-100 text-red-800 ring-red-200',
      WITHDRAWN: 'bg-slate-100 text-slate-700 ring-slate-200',
    })[props.status] ?? 'bg-slate-100 text-slate-700 ring-slate-200',
)
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset"
    :class="classes"
    :data-status="status"
  >
    {{ STATUS_LABELS[status] ?? status }}
  </span>
</template>
