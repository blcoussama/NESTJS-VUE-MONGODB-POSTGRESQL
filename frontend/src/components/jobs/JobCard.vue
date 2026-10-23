<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Job } from '@/types/api'
import {
  EXPERIENCE_LEVEL_LABELS,
  JOB_TYPE_LABELS,
  formatRelative,
  formatSalary,
  labelOf,
} from '@/utils/format'
import AvatarImage from '@/components/ui/AvatarImage.vue'

const props = withDefaults(
  defineProps<{ job: Job; canSave?: boolean; saved?: boolean; saving?: boolean }>(),
  { canSave: false, saved: false, saving: false },
)
const emit = defineEmits<{ 'toggle-save': [jobId: string] }>()

const companyName = computed(() => props.job.company?.name ?? 'Société')
const salary = computed(() => formatSalary(props.job.salaryType, props.job.salary))
</script>

<template>
  <article class="card flex gap-4 transition hover:border-indigo-200 hover:shadow-md" :aria-labelledby="`job-${job.id}-title`">
    <AvatarImage :src="job.company?.logoUrl" :name="companyName" shape="square" size="lg" />
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0">
          <h2 :id="`job-${job.id}-title`" class="text-lg font-semibold text-slate-900">
            <RouterLink :to="`/jobs/${job.id}`" class="hover:text-indigo-700 focus-visible:text-indigo-700">
              {{ job.title }}
            </RouterLink>
          </h2>
          <p class="text-sm text-slate-600">{{ companyName }} · {{ job.location }}</p>
        </div>
        <button
          v-if="canSave"
          type="button"
          class="btn btn-sm"
          :class="saved ? 'btn-primary' : 'btn-secondary'"
          :aria-pressed="saved"
          :disabled="saving"
          :aria-label="saved ? `Retirer « ${job.title} » des favoris` : `Enregistrer « ${job.title} » en favori`"
          @click="emit('toggle-save', job.id)"
        >
          <span aria-hidden="true">{{ saved ? '★' : '☆' }}</span>
          {{ saved ? 'Enregistrée' : 'Enregistrer' }}
        </button>
      </div>
      <ul class="mt-3 flex flex-wrap gap-2" aria-label="Caractéristiques">
        <li class="chip">{{ labelOf(JOB_TYPE_LABELS, job.jobType) }}</li>
        <li class="chip">{{ labelOf(EXPERIENCE_LEVEL_LABELS, job.experienceLevel) }}</li>
        <li class="chip">{{ salary }}</li>
        <li v-if="job.isOpen === false" class="chip bg-red-100 text-red-700">Fermée</li>
      </ul>
      <p class="mt-3 line-clamp-2 text-sm text-slate-600">{{ job.description }}</p>
      <p class="mt-2 text-xs text-slate-400">
        Publiée <time :datetime="job.createdAt">{{ formatRelative(job.createdAt) }}</time>
      </p>
    </div>
  </article>
</template>
