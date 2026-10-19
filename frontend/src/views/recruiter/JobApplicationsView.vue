<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useApplicationsStore } from '@/stores/applications'
import { useJobsStore } from '@/stores/jobs'
import { useUiStore } from '@/stores/ui'
import { errorMessage } from '@/api/errors'
import { jobsApi } from '@/api/jobs'
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
  type RecruiterApplication,
  type ReviewStatus,
} from '@/types/api'
import { EXPERIENCE_LEVEL_LABELS, STATUS_LABELS, formatDate, labelOf } from '@/utils/format'
import { openInNewTab } from '@/utils/url'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import AlertMessage from '@/components/ui/AlertMessage.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import AvatarImage from '@/components/ui/AvatarImage.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

const props = defineProps<{ id: string }>()

const applications = useApplicationsStore()
const jobs = useJobsStore()
const ui = useUiStore()
const jobTitle = ref<string | null>(null)
const filter = ref<ApplicationStatus | 'ALL'>('ALL')
const cvLoadingId = ref<string | null>(null)
const cvLinks = ref<Record<string, string>>({})

const list = computed(() => applications.byJob[props.id] ?? [])
const loading = computed(() => applications.byJobLoading[props.id] ?? false)
const loadError = computed(() => applications.byJobError[props.id] ?? null)
const visible = computed(() =>
  [...list.value]
    .filter((a) => filter.value === 'ALL' || a.status === filter.value)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
)
const counts = computed(() => {
  const result: Record<string, number> = { ALL: list.value.length }
  for (const s of APPLICATION_STATUSES) result[s] = list.value.filter((a) => a.status === s).length
  return result
})

async function loadTitle() {
  const cached = jobs.mine.find((j) => j.id === props.id) ?? (jobs.current?.id === props.id ? jobs.current : null)
  if (cached) {
    jobTitle.value = cached.title
    return
  }
  try {
    jobTitle.value = (await jobsApi.get(props.id)).title
  } catch {
    jobTitle.value = null
  }
}

watch(
  () => props.id,
  () => {
    void applications.fetchForJob(props.id)
    void loadTitle()
  },
  { immediate: true },
)

function applicantName(app: RecruiterApplication): string {
  return app.applicant ? `${app.applicant.firstName} ${app.applicant.lastName}`.trim() : 'Candidat'
}

async function review(app: RecruiterApplication, status: ReviewStatus) {
  const accept = status === 'ACCEPTED'
  const ok = await ui.confirm({
    title: accept ? `Accepter la candidature de ${applicantName(app)} ?` : `Refuser la candidature de ${applicantName(app)} ?`,
    message: 'Cette décision est définitive.',
    confirmLabel: accept ? 'Accepter' : 'Refuser',
    danger: !accept,
  })
  if (!ok) return
  try {
    await applications.updateStatus(props.id, app.id, status)
    ui.success(accept ? 'Candidature acceptée.' : 'Candidature refusée.')
  } catch (error) {
    ui.error(error instanceof Error ? error.message : 'La mise à jour a échoué.')
    void applications.fetchForJob(props.id)
  }
}

async function downloadCv(app: RecruiterApplication) {
  cvLoadingId.value = app.id
  try {
    const url = await applications.getCvUrl(app.id)
    cvLinks.value = { ...cvLinks.value, [app.id]: url }
    openInNewTab(url)
  } catch (error) {
    ui.error(errorMessage(error, 'Impossible d’obtenir le CV.'))
  } finally {
    cvLoadingId.value = null
  }
}

function chatLink(app: RecruiterApplication) {
  return { name: 'chat', query: { with: app.applicantId ?? app.applicant?.id, name: applicantName(app) } }
}
</script>

<template>
  <section aria-labelledby="japps-title" class="space-y-6">
    <RouterLink to="/recruiter/jobs" class="link text-sm">← Mes offres</RouterLink>
    <header>
      <h1 id="japps-title" class="page-title">Candidatures reçues</h1>
      <p v-if="jobTitle" class="mt-1 text-slate-600">
        Offre : <RouterLink :to="`/jobs/${id}`" class="link">{{ jobTitle }}</RouterLink>
      </p>
    </header>

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

    <AppSpinner v-if="loading && list.length === 0" label="Chargement des candidatures…" />
    <AlertMessage v-else-if="loadError" kind="error">
      {{ loadError }}
      <template #actions>
        <button type="button" class="btn btn-secondary btn-sm" @click="applications.fetchForJob(id)">Réessayer</button>
      </template>
    </AlertMessage>
    <EmptyState v-else-if="visible.length === 0" :title="list.length ? 'Aucune candidature avec ce statut' : 'Aucune candidature pour cette offre'" />

    <ul v-else class="space-y-3">
      <li v-for="app in visible" :key="app.id" class="card" :aria-busy="applications.isUpdating(app.id)">
        <div class="flex flex-wrap items-start gap-4">
          <AvatarImage :src="app.applicant?.avatarUrl" :name="applicantName(app)" size="lg" />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="font-semibold text-slate-900">{{ applicantName(app) }}</h2>
              <StatusBadge :status="app.status" />
            </div>
            <p v-if="app.applicant?.email" class="text-sm">
              <a :href="`mailto:${app.applicant.email}`" class="link">{{ app.applicant.email }}</a>
            </p>
            <p class="text-sm text-slate-600">
              {{ app.experienceYears }} an{{ app.experienceYears > 1 ? 's' : '' }} d’expérience ·
              {{ labelOf(EXPERIENCE_LEVEL_LABELS, app.experienceLevel) }}
            </p>
            <p class="text-xs text-slate-400">Reçue le {{ formatDate(app.createdAt) }}</p>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <template v-if="app.status === 'PENDING'">
            <button type="button" class="btn btn-success btn-sm" :disabled="applications.isUpdating(app.id)" @click="review(app, 'ACCEPTED')">Accepter</button>
            <button type="button" class="btn btn-danger btn-sm" :disabled="applications.isUpdating(app.id)" @click="review(app, 'REJECTED')">Refuser</button>
          </template>
          <button
            v-if="app.applicant?.hasCv"
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="cvLoadingId === app.id"
            @click="downloadCv(app)"
          >
            {{ cvLoadingId === app.id ? 'Préparation…' : 'Télécharger le CV' }}
          </button>
          <span v-else class="text-xs text-slate-500">Pas de CV</span>
          <RouterLink :to="chatLink(app)" class="btn btn-ghost btn-sm">Envoyer un message</RouterLink>
          <a v-if="cvLinks[app.id]" :href="cvLinks[app.id]" target="_blank" rel="noopener noreferrer" class="link text-xs">
            Lien du CV (15 min)
          </a>
        </div>
      </li>
    </ul>
  </section>
</template>
