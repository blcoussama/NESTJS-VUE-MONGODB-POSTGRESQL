<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useApplicationsStore } from '@/stores/applications'
import { useUiStore } from '@/stores/ui'
import { errorMessage } from '@/api/errors'
import { APPLICATION_STATUSES, type ApplicationStatus, type CandidateApplication } from '@/types/api'
import { EXPERIENCE_LEVEL_LABELS, STATUS_LABELS, formatDate, labelOf } from '@/utils/format'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import AlertMessage from '@/components/ui/AlertMessage.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import AvatarImage from '@/components/ui/AvatarImage.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

const applications = useApplicationsStore()
const ui = useUiStore()
const { mine, mineLoading, mineLoaded, mineError } = storeToRefs(applications)
const filter = ref<ApplicationStatus | 'ALL'>('ALL')

onMounted(() => applications.fetchMine(true))

const counts = computed(() => {
  const result: Record<string, number> = { ALL: mine.value.length }
  for (const s of APPLICATION_STATUSES) result[s] = mine.value.filter((a) => a.status === s).length
  return result
})

const visible = computed(() =>
  [...mine.value]
    .filter((a) => filter.value === 'ALL' || a.status === filter.value)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
)

async function withdraw(app: CandidateApplication) {
  const ok = await ui.confirm({
    title: 'Retirer cette candidature ?',
    message: `Votre candidature « ${app.job?.title ?? 'offre'} » sera retirée puis supprimée définitivement après 30 jours.`,
    confirmLabel: 'Retirer',
    danger: true,
  })
  if (!ok) return
  try {
    await applications.withdraw(app.id)
    ui.success('Candidature retirée.')
  } catch (error) {
    ui.error(errorMessage(error, 'Le retrait a échoué.'))
  }
}
</script>

<template>
  <section aria-labelledby="apps-title" class="space-y-6">
    <h1 id="apps-title" class="page-title">Mes candidatures</h1>

    <div role="group" aria-label="Filtrer par statut" class="flex flex-wrap gap-2">
      <button
        v-for="key in (['ALL', ...APPLICATION_STATUSES] as const)"
        :key="key"
        type="button"
        class="btn btn-sm"
        :class="filter === key ? 'btn-primary' : 'btn-secondary'"
        :aria-pressed="filter === key"
        @click="filter = key"
      >
        {{ key === 'ALL' ? 'Toutes' : STATUS_LABELS[key] }} ({{ counts[key] ?? 0 }})
      </button>
    </div>

    <AppSpinner v-if="mineLoading && !mineLoaded" label="Chargement des candidatures…" />
    <AlertMessage v-else-if="mineError" kind="error">
      {{ mineError }}
      <template #actions>
        <button type="button" class="btn btn-secondary btn-sm" @click="applications.fetchMine(true)">Réessayer</button>
      </template>
    </AlertMessage>
    <EmptyState
      v-else-if="visible.length === 0"
      :title="mine.length === 0 ? 'Aucune candidature pour le moment' : 'Aucune candidature avec ce statut'"
      :description="mine.length === 0 ? 'Postulez à une offre pour suivre son avancement ici.' : undefined"
    >
      <RouterLink v-if="mine.length === 0" to="/jobs" class="btn btn-primary btn-sm">Voir les offres</RouterLink>
    </EmptyState>

    <ul v-else class="space-y-3">
      <li v-for="app in visible" :key="app.id" class="card flex flex-wrap items-center gap-4">
        <AvatarImage :src="app.job?.company?.logoUrl" :name="app.job?.company?.name ?? 'Société'" shape="square" />
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <RouterLink :to="`/jobs/${app.jobId ?? app.job?.id}`" class="font-semibold text-slate-900 hover:text-indigo-700">
              {{ app.job?.title ?? 'Offre' }}
            </RouterLink>
            <StatusBadge :status="app.status" />
          </div>
          <p class="text-sm text-slate-600">
            <span v-if="app.job?.company?.name">{{ app.job.company.name }} · </span>
            {{ app.experienceYears }} an{{ app.experienceYears > 1 ? 's' : '' }} d’expérience ·
            {{ labelOf(EXPERIENCE_LEVEL_LABELS, app.experienceLevel) }}
          </p>
          <p class="text-xs text-slate-400">
            Envoyée le {{ formatDate(app.createdAt) }}
            <template v-if="app.status === 'WITHDRAWN' && app.expiresAt">
              · suppression automatique le {{ formatDate(app.expiresAt) }}
            </template>
          </p>
        </div>
        <button
          v-if="app.status === 'PENDING'"
          type="button"
          class="btn btn-secondary btn-sm text-red-700"
          :disabled="applications.isWithdrawing(app.id)"
          @click="withdraw(app)"
        >
          {{ applications.isWithdrawing(app.id) ? 'Retrait…' : 'Retirer' }}
        </button>
      </li>
    </ul>
  </section>
</template>
