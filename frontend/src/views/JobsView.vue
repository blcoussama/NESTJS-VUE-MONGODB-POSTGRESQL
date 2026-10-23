<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery, type LocationQueryRaw } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useJobsStore } from '@/stores/jobs'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { errorMessage } from '@/api/errors'
import { EXPERIENCE_LEVELS, JOB_TYPES, type ExperienceLevel, type JobType } from '@/types/api'
import JobFilters, { type FilterValues } from '@/components/jobs/JobFilters.vue'
import JobCard from '@/components/jobs/JobCard.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import AlertMessage from '@/components/ui/AlertMessage.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const jobs = useJobsStore()
const auth = useAuthStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const { items, total, page, totalPages, listLoading, listError } = storeToRefs(jobs)

function str(value: LocationQuery[string] | undefined): string {
  return typeof value === 'string' ? value : ''
}

function filtersFromQuery(query: LocationQuery): FilterValues & { page: number } {
  const jobType = str(query.jobType)
  const level = str(query.experienceLevel)
  const pageNumber = Number.parseInt(str(query.page), 10)
  return {
    search: str(query.search),
    location: str(query.location),
    jobType: (JOB_TYPES as readonly string[]).includes(jobType) ? (jobType as JobType) : '',
    experienceLevel: (EXPERIENCE_LEVELS as readonly string[]).includes(level) ? (level as ExperienceLevel) : '',
    sort: str(query.sort) === 'oldest' ? 'oldest' : 'recent',
    page: Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1,
  }
}

const current = computed(() => filtersFromQuery(route.query))
const filterValues = computed<FilterValues>(() => {
  const { page: _page, ...rest } = current.value
  void _page
  return rest
})
const hasActiveFilters = computed(() => {
  const f = current.value
  return Boolean(f.search || f.location || f.jobType || f.experienceLevel)
})

function toQuery(values: FilterValues & { page: number }): LocationQueryRaw {
  const query: LocationQueryRaw = {}
  if (values.search.trim()) query.search = values.search.trim()
  if (values.location.trim()) query.location = values.location.trim()
  if (values.jobType) query.jobType = values.jobType
  if (values.experienceLevel) query.experienceLevel = values.experienceLevel
  if (values.sort !== 'recent') query.sort = values.sort
  if (values.page > 1) query.page = String(values.page)
  return query
}

// Refetch only when the effective filters change (and not while navigating away).
watch(
  () => (route.name === 'jobs' ? JSON.stringify(current.value) : null),
  (key) => {
    if (key) void jobs.fetchJobs(current.value)
  },
  { immediate: true },
)

onMounted(() => {
  if (auth.isCandidate) void jobs.fetchSaved()
})

function onFilters(values: FilterValues) {
  void router.replace({ query: toQuery({ ...values, page: 1 }) })
}

function resetFilters() {
  void router.replace({ query: {} })
}

function onPage(next: number) {
  void router.push({ query: toQuery({ ...current.value, page: next }) })
}

async function toggleSave(jobId: string) {
  try {
    const saved = await jobs.toggleSave(jobId)
    ui.success(saved ? 'Offre enregistrée dans vos favoris.' : 'Offre retirée des favoris.')
  } catch (error) {
    ui.error(errorMessage(error, 'Action impossible.'))
  }
}

const retry = () => jobs.fetchJobs(current.value)
</script>

<template>
  <section aria-labelledby="jobs-title" class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 id="jobs-title" class="page-title">Offres d’emploi</h1>
        <p class="mt-1 text-sm text-slate-500">Trouvez votre prochain poste ou stage.</p>
      </div>
      <p v-if="!listLoading && !listError" class="text-sm text-slate-600" aria-live="polite">
        {{ total }} offre{{ total > 1 ? 's' : '' }} trouvée{{ total > 1 ? 's' : '' }}
      </p>
    </header>

    <JobFilters :model-value="filterValues" @update:model-value="onFilters" @reset="resetFilters" />

    <div :aria-busy="listLoading">
      <AppSpinner v-if="listLoading && items.length === 0" label="Chargement des offres…" />

      <AlertMessage v-else-if="listError" kind="error" title="Erreur de chargement">
        {{ listError }}
        <template #actions>
          <button type="button" class="btn btn-secondary btn-sm" @click="retry">Réessayer</button>
        </template>
      </AlertMessage>

      <EmptyState
        v-else-if="items.length === 0"
        title="Aucune offre ne correspond"
        :description="hasActiveFilters ? 'Essayez d’élargir vos critères de recherche.' : 'Aucune offre ouverte pour le moment.'"
      >
        <button v-if="hasActiveFilters" type="button" class="btn btn-secondary btn-sm" @click="resetFilters">
          Réinitialiser les filtres
        </button>
      </EmptyState>

      <template v-else>
        <ul class="space-y-4" :class="{ 'opacity-60': listLoading }">
          <li v-for="job in items" :key="job.id">
            <JobCard
              :job="job"
              :can-save="auth.isCandidate"
              :saved="jobs.isSaved(job.id)"
              :saving="jobs.isSaving(job.id)"
              @toggle-save="toggleSave"
            />
          </li>
        </ul>
        <PaginationBar class="mt-6" :page="page" :total-pages="totalPages" :disabled="listLoading" @update:page="onPage" />
      </template>
    </div>
  </section>
</template>
