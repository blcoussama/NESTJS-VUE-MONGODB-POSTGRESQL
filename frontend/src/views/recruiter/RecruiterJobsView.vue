<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useJobsStore } from '@/stores/jobs'
import { useCompanyStore } from '@/stores/company'
import { useUiStore } from '@/stores/ui'
import { errorMessage } from '@/api/errors'
import type { Job } from '@/types/api'
import { EXPERIENCE_LEVEL_LABELS, JOB_TYPE_LABELS, formatDate, labelOf } from '@/utils/format'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import AlertMessage from '@/components/ui/AlertMessage.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const jobs = useJobsStore()
const companyStore = useCompanyStore()
const ui = useUiStore()
const { mine, mineLoading, mineLoaded, mineError } = storeToRefs(jobs)
const filter = ref<'all' | 'open' | 'closed'>('all')
const busyIds = ref<Set<string>>(new Set())

onMounted(() => {
  void jobs.fetchMine()
  void companyStore.fetchMine()
})

const visible = computed(() =>
  mine.value
    .filter((j) => filter.value === 'all' || (filter.value === 'open' ? j.isOpen : !j.isOpen))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
)
const openCount = computed(() => mine.value.filter((j) => j.isOpen).length)

async function withBusy(id: string, action: () => Promise<void>) {
  if (busyIds.value.has(id)) return
  busyIds.value.add(id)
  try {
    await action()
  } finally {
    busyIds.value.delete(id)
  }
}

async function toggleOpen(job: Job) {
  const wasOpen = job.isOpen
  if (wasOpen) {
    const ok = await ui.confirm({
      title: 'Fermer cette offre ?',
      message: 'Elle disparaîtra de la liste publique et n’acceptera plus de candidatures. Vous pourrez la rouvrir.',
      confirmLabel: 'Fermer l’offre',
    })
    if (!ok) return
  }
  await withBusy(job.id, async () => {
    try {
      await jobs.setOpen(job.id, !wasOpen)
      ui.success(wasOpen ? 'Offre fermée.' : 'Offre rouverte.')
    } catch (error) {
      ui.error(errorMessage(error, 'Mise à jour impossible.'))
    }
  })
}

async function remove(job: Job) {
  const ok = await ui.confirm({
    title: `Supprimer « ${job.title} » ?`,
    message: 'Les candidatures et favoris associés seront définitivement supprimés.',
    confirmLabel: 'Supprimer',
    danger: true,
  })
  if (!ok) return
  await withBusy(job.id, async () => {
    try {
      await jobs.deleteJob(job.id)
      ui.success('Offre supprimée.')
    } catch (error) {
      ui.error(errorMessage(error, 'Suppression impossible.'))
    }
  })
}
</script>

<template>
  <section aria-labelledby="rjobs-title" class="space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 id="rjobs-title" class="page-title">Mes offres</h1>
        <p v-if="mineLoaded" class="mt-1 text-sm text-slate-500">{{ mine.length }} offre(s) · {{ openCount }} ouverte(s)</p>
      </div>
      <RouterLink v-if="companyStore.company" to="/recruiter/jobs/new" class="btn btn-primary">+ Nouvelle offre</RouterLink>
    </header>

    <AlertMessage v-if="companyStore.loaded && !companyStore.company" kind="warning" title="Aucune société">
      Créez votre société avant de publier une offre.
      <template #actions>
        <RouterLink to="/recruiter/company" class="btn btn-primary btn-sm">Créer ma société</RouterLink>
      </template>
    </AlertMessage>

    <div role="group" aria-label="Filtrer les offres" class="flex gap-2">
      <button
        v-for="option in ([['all', 'Toutes'], ['open', 'Ouvertes'], ['closed', 'Fermées']] as const)"
        :key="option[0]"
        type="button"
        class="btn btn-sm"
        :class="filter === option[0] ? 'btn-primary' : 'btn-secondary'"
        :aria-pressed="filter === option[0]"
        @click="filter = option[0]"
      >
        {{ option[1] }}
      </button>
    </div>

    <AppSpinner v-if="mineLoading && !mineLoaded" label="Chargement de vos offres…" />
    <AlertMessage v-else-if="mineError" kind="error">
      {{ mineError }}
      <template #actions>
        <button type="button" class="btn btn-secondary btn-sm" @click="jobs.fetchMine()">Réessayer</button>
      </template>
    </AlertMessage>
    <EmptyState v-else-if="visible.length === 0" :title="mine.length ? 'Aucune offre dans cette catégorie' : 'Vous n’avez publié aucune offre'">
      <RouterLink v-if="!mine.length && companyStore.company" to="/recruiter/jobs/new" class="btn btn-primary btn-sm">Publier une offre</RouterLink>
    </EmptyState>

    <ul v-else class="space-y-3">
      <li v-for="job in visible" :key="job.id" class="card" :aria-busy="busyIds.has(job.id)">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <RouterLink :to="`/jobs/${job.id}`" class="text-lg font-semibold text-slate-900 hover:text-indigo-700">{{ job.title }}</RouterLink>
              <span class="chip" :class="job.isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'">
                {{ job.isOpen ? 'Ouverte' : 'Fermée' }}
              </span>
            </div>
            <p class="text-sm text-slate-600">
              {{ job.location }} · {{ labelOf(JOB_TYPE_LABELS, job.jobType) }} · {{ labelOf(EXPERIENCE_LEVEL_LABELS, job.experienceLevel) }}
            </p>
            <p class="text-xs text-slate-400">Publiée le {{ formatDate(job.createdAt) }}</p>
          </div>
          <RouterLink :to="`/recruiter/jobs/${job.id}/applications`" class="btn btn-secondary btn-sm">
            {{ job.applicationsCount ?? 0 }} candidature{{ (job.applicationsCount ?? 0) > 1 ? 's' : '' }}
          </RouterLink>
        </div>
        <div class="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <RouterLink :to="`/recruiter/jobs/${job.id}/edit`" class="btn btn-ghost btn-sm">Modifier</RouterLink>
          <button type="button" class="btn btn-ghost btn-sm" :disabled="busyIds.has(job.id)" @click="toggleOpen(job)">
            {{ job.isOpen ? 'Fermer' : 'Rouvrir' }}
          </button>
          <button type="button" class="btn btn-ghost btn-sm text-red-700" :disabled="busyIds.has(job.id)" @click="remove(job)">Supprimer</button>
        </div>
      </li>
    </ul>
  </section>
</template>
