<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useJobsStore } from '@/stores/jobs'
import { useUiStore } from '@/stores/ui'
import { errorMessage } from '@/api/errors'
import { EXPERIENCE_LEVEL_LABELS, JOB_TYPE_LABELS, formatDate, labelOf } from '@/utils/format'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import AlertMessage from '@/components/ui/AlertMessage.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import AvatarImage from '@/components/ui/AvatarImage.vue'

const jobs = useJobsStore()
const ui = useUiStore()
const { saved, savedLoading, savedError, savedLoaded } = storeToRefs(jobs)

onMounted(() => jobs.fetchSaved(true))

async function remove(jobId: string) {
  try {
    await jobs.toggleSave(jobId)
    ui.success('Offre retirée des favoris.')
  } catch (error) {
    ui.error(errorMessage(error, 'Action impossible.'))
  }
}
</script>

<template>
  <section aria-labelledby="saved-title" class="space-y-6">
    <h1 id="saved-title" class="page-title">Offres enregistrées</h1>

    <AppSpinner v-if="savedLoading && !savedLoaded" label="Chargement des favoris…" />
    <AlertMessage v-else-if="savedError" kind="error">
      {{ savedError }}
      <template #actions>
        <button type="button" class="btn btn-secondary btn-sm" @click="jobs.fetchSaved(true)">Réessayer</button>
      </template>
    </AlertMessage>
    <EmptyState v-else-if="saved.length === 0" title="Aucune offre enregistrée" description="Enregistrez des offres pour les retrouver ici.">
      <RouterLink to="/jobs" class="btn btn-primary btn-sm">Parcourir les offres</RouterLink>
    </EmptyState>

    <ul v-else class="space-y-3">
      <li v-for="item in saved" :key="item.id" class="card flex flex-wrap items-center gap-4">
        <AvatarImage :src="item.job?.company?.logoUrl" :name="item.job?.company?.name ?? 'Société'" shape="square" />
        <div class="min-w-0 flex-1">
          <RouterLink :to="`/jobs/${item.jobId ?? item.job?.id}`" class="font-semibold text-slate-900 hover:text-indigo-700">
            {{ item.job?.title ?? 'Offre' }}
          </RouterLink>
          <p class="text-sm text-slate-600">
            <span v-if="item.job?.company?.name">{{ item.job.company.name }}</span>
            <span v-if="item.job?.location"> · {{ item.job.location }}</span>
            <span v-if="item.job?.jobType"> · {{ labelOf(JOB_TYPE_LABELS, item.job.jobType) }}</span>
            <span v-if="item.job?.experienceLevel"> · {{ labelOf(EXPERIENCE_LEVEL_LABELS, item.job.experienceLevel) }}</span>
          </p>
          <p class="text-xs text-slate-400">
            Enregistrée le {{ formatDate(item.createdAt) }}
            <span v-if="item.job?.isOpen === false" class="ml-2 font-medium text-red-600">Offre fermée</span>
          </p>
        </div>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          :disabled="jobs.isSaving(item.jobId ?? item.job?.id ?? '')"
          @click="remove(item.jobId ?? item.job?.id ?? '')"
        >
          Retirer
        </button>
      </li>
    </ul>
  </section>
</template>
