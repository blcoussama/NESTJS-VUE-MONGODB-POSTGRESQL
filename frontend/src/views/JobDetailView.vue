<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useJobsStore } from '@/stores/jobs'
import { useAuthStore } from '@/stores/auth'
import { useApplicationsStore } from '@/stores/applications'
import { useUiStore } from '@/stores/ui'
import { errorMessage } from '@/api/errors'
import type { ApplyPayload } from '@/types/api'
import {
  EXPERIENCE_LEVEL_LABELS,
  JOB_TYPE_LABELS,
  formatDate,
  formatSalary,
  labelOf,
} from '@/utils/format'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import AlertMessage from '@/components/ui/AlertMessage.vue'
import AvatarImage from '@/components/ui/AvatarImage.vue'
import ApplyForm from '@/components/jobs/ApplyForm.vue'

const props = defineProps<{ id: string }>()

const jobs = useJobsStore()
const auth = useAuthStore()
const applications = useApplicationsStore()
const ui = useUiStore()
const route = useRoute()
const { current: job, currentLoading, currentError, currentNotFound } = storeToRefs(jobs)

const applying = ref(false)
const applyError = ref<string | null>(null)

async function load() {
  applyError.value = null
  await jobs.fetchJob(props.id)
  if (auth.isCandidate) {
    void jobs.fetchSaved()
    void applications.fetchMine()
  }
}

watch(() => props.id, load, { immediate: true })

const isOwner = computed(() => Boolean(job.value && auth.user && job.value.recruiterId === auth.user.id))
const hasApplied = computed(() =>
  Boolean(job.value && (job.value.hasApplied || applications.hasAppliedTo(job.value.id))),
)
const saved = computed(() => Boolean(job.value && (jobs.isSaved(job.value.id) || job.value.isSaved)))
const companyName = computed(() => job.value?.company?.name ?? 'Société')
const loginLink = computed(() => ({ name: 'login', query: { redirect: route.fullPath } }))
const contactLink = computed(() =>
  job.value
    ? { name: 'chat', query: { with: job.value.recruiterId, name: `Recruteur · ${companyName.value}` } }
    : '/chat',
)

async function apply(payload: ApplyPayload) {
  if (!job.value || applying.value) return
  applying.value = true
  applyError.value = null
  try {
    await applications.apply(job.value.id, payload)
    ui.success('Candidature envoyée !')
  } catch (error) {
    applyError.value = error instanceof Error ? error.message : 'La candidature n’a pas pu être envoyée.'
  } finally {
    applying.value = false
  }
}

async function toggleSave() {
  if (!job.value) return
  try {
    const nowSaved = await jobs.toggleSave(job.value.id)
    ui.success(nowSaved ? 'Offre enregistrée dans vos favoris.' : 'Offre retirée des favoris.')
  } catch (error) {
    ui.error(errorMessage(error, 'Action impossible.'))
  }
}
</script>

<template>
  <div>
    <RouterLink to="/jobs" class="link text-sm">← Retour aux offres</RouterLink>

    <AppSpinner v-if="currentLoading && !job" label="Chargement de l’offre…" />

    <AlertMessage v-else-if="currentError" :kind="currentNotFound ? 'warning' : 'error'" class="mt-6">
      {{ currentError }}
      <template #actions>
        <button v-if="!currentNotFound" type="button" class="btn btn-secondary btn-sm" @click="load">Réessayer</button>
        <RouterLink to="/jobs" class="btn btn-secondary btn-sm">Voir les offres</RouterLink>
      </template>
    </AlertMessage>

    <article v-else-if="job" class="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3" aria-labelledby="job-title">
      <div class="space-y-6 lg:col-span-2">
        <header class="card flex gap-4">
          <AvatarImage :src="job.company?.logoUrl" :name="companyName" shape="square" size="xl" />
          <div class="min-w-0 flex-1">
            <h1 id="job-title" class="page-title">{{ job.title }}</h1>
            <p class="mt-1 text-slate-600">{{ companyName }} · {{ job.location }}</p>
            <ul class="mt-3 flex flex-wrap gap-2" aria-label="Caractéristiques">
              <li class="chip">{{ labelOf(JOB_TYPE_LABELS, job.jobType) }}</li>
              <li class="chip">{{ labelOf(EXPERIENCE_LEVEL_LABELS, job.experienceLevel) }}</li>
              <li class="chip">{{ formatSalary(job.salaryType, job.salary) }}</li>
              <li v-if="!job.isOpen" class="chip bg-red-100 text-red-700">Offre fermée</li>
            </ul>
            <p class="mt-3 text-xs text-slate-400">
              Publiée le <time :datetime="job.createdAt">{{ formatDate(job.createdAt) }}</time>
            </p>
          </div>
        </header>

        <section class="card" aria-labelledby="job-desc">
          <h2 id="job-desc" class="text-base font-semibold">Description du poste</h2>
          <!-- Plain text interpolation (escaped) — line breaks preserved with CSS. -->
          <p class="mt-3 text-sm leading-relaxed whitespace-pre-line text-slate-700">{{ job.description }}</p>
        </section>

        <section v-if="job.requirements?.length" class="card" aria-labelledby="job-req">
          <h2 id="job-req" class="text-base font-semibold">Profil recherché</h2>
          <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li v-for="(req, index) in job.requirements" :key="index">{{ req }}</li>
          </ul>
        </section>
      </div>

      <aside class="space-y-4" aria-label="Actions">
        <!-- Candidate -->
        <template v-if="auth.isCandidate">
          <div class="card space-y-3">
            <button
              type="button"
              class="btn w-full"
              :class="saved ? 'btn-primary' : 'btn-secondary'"
              :aria-pressed="saved"
              :disabled="jobs.isSaving(job.id)"
              @click="toggleSave"
            >
              <span aria-hidden="true">{{ saved ? '★' : '☆' }}</span>
              {{ saved ? 'Enregistrée dans vos favoris' : 'Enregistrer en favori' }}
            </button>
          </div>

          <div class="card space-y-4">
            <h2 class="text-base font-semibold">Postuler</h2>
            <template v-if="hasApplied">
              <AlertMessage kind="success">Vous avez déjà postulé à cette offre.</AlertMessage>
              <div class="flex flex-wrap gap-2">
                <RouterLink to="/applications" class="btn btn-secondary btn-sm">Mes candidatures</RouterLink>
                <RouterLink :to="contactLink" class="btn btn-secondary btn-sm">Contacter le recruteur</RouterLink>
              </div>
            </template>
            <AlertMessage v-else-if="!job.isOpen" kind="warning">Cette offre n’accepte plus de candidatures.</AlertMessage>
            <template v-else>
              <AlertMessage v-if="applyError" kind="error">{{ applyError }}</AlertMessage>
              <ApplyForm :submitting="applying" :default-level="job.experienceLevel" @submit="apply" />
            </template>
          </div>
        </template>

        <!-- Recruiter owner -->
        <div v-else-if="isOwner" class="card space-y-3">
          <h2 class="text-base font-semibold">Votre offre</h2>
          <RouterLink :to="`/recruiter/jobs/${job.id}/applications`" class="btn btn-primary w-full">Voir les candidatures</RouterLink>
          <RouterLink :to="`/recruiter/jobs/${job.id}/edit`" class="btn btn-secondary w-full">Modifier l’offre</RouterLink>
        </div>

        <!-- Other recruiter -->
        <div v-else-if="auth.isRecruiter" class="card text-sm text-slate-600">
          Seuls les candidats peuvent postuler aux offres.
        </div>

        <!-- Anonymous -->
        <div v-else class="card space-y-3">
          <h2 class="text-base font-semibold">Intéressé·e ?</h2>
          <p class="text-sm text-slate-600">Connectez-vous avec un compte candidat pour postuler et enregistrer cette offre.</p>
          <RouterLink :to="loginLink" class="btn btn-primary w-full">Se connecter pour postuler</RouterLink>
          <RouterLink to="/signup" class="btn btn-secondary w-full">Créer un compte</RouterLink>
        </div>
      </aside>
    </article>
  </div>
</template>
