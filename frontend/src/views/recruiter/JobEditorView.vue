<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useJobsStore } from '@/stores/jobs'
import { useCompanyStore } from '@/stores/company'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { errorMessage } from '@/api/errors'
import { jobsApi } from '@/api/jobs'
import type { Job, JobUpdatePayload } from '@/types/api'
import JobForm, { type JobFormValues } from '@/components/jobs/JobForm.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import AlertMessage from '@/components/ui/AlertMessage.vue'

const props = defineProps<{ id?: string }>()

const jobs = useJobsStore()
const companyStore = useCompanyStore()
const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

const isEdit = computed(() => Boolean(props.id))
const job = ref<Job | null>(null)
const loading = ref(false)
const loadError = ref<string | null>(null)
const submitting = ref(false)
const submitError = ref<string | null>(null)

async function load() {
  loading.value = true
  loadError.value = null
  job.value = null
  try {
    await companyStore.fetchMine()
    if (props.id) {
      if (!jobs.mineLoaded) await jobs.fetchMine()
      const found = jobs.mine.find((j) => j.id === props.id) ?? (await jobsApi.get(props.id))
      if (found.recruiterId && auth.user && found.recruiterId !== auth.user.id) {
        loadError.value = 'Vous ne pouvez modifier que vos propres offres.'
        return
      }
      job.value = found
    }
  } catch (error) {
    loadError.value = errorMessage(error, 'Impossible de charger l’offre.')
  } finally {
    loading.value = false
  }
}

watch(() => props.id, load, { immediate: true })

async function submit(values: JobFormValues) {
  submitError.value = null
  submitting.value = true
  try {
    if (props.id) {
      const payload: JobUpdatePayload = { ...values, salary: values.salary }
      await jobs.updateJob(props.id, payload)
      ui.success('Offre mise à jour.')
    } else {
      const company = companyStore.company
      if (!company) throw new Error('Créez d’abord votre société.')
      const { salary, ...rest } = values
      await jobs.createJob({ ...rest, ...(salary ? { salary } : {}), companyId: company.id })
      ui.success('Offre publiée.')
    }
    await router.push('/recruiter/jobs')
  } catch (error) {
    submitError.value = errorMessage(error, 'L’enregistrement a échoué.')
  } finally {
    submitting.value = false
  }
}

const cancel = () => router.push('/recruiter/jobs')
</script>

<template>
  <section aria-labelledby="editor-title" class="space-y-6">
    <RouterLink to="/recruiter/jobs" class="link text-sm">← Mes offres</RouterLink>
    <h1 id="editor-title" class="page-title">{{ isEdit ? 'Modifier l’offre' : 'Nouvelle offre' }}</h1>

    <AppSpinner v-if="loading" label="Chargement…" />
    <AlertMessage v-else-if="loadError" kind="error">
      {{ loadError }}
      <template #actions>
        <button type="button" class="btn btn-secondary btn-sm" @click="load">Réessayer</button>
      </template>
    </AlertMessage>
    <AlertMessage v-else-if="!isEdit && !companyStore.company" kind="warning" title="Société requise">
      Une offre est toujours rattachée à votre société.
      <template #actions>
        <RouterLink to="/recruiter/company" class="btn btn-primary btn-sm">Créer ma société</RouterLink>
      </template>
    </AlertMessage>
    <template v-else>
      <p v-if="companyStore.company" class="text-sm text-slate-600">
        Société : <strong>{{ companyStore.company.name }}</strong>
      </p>
      <AlertMessage v-if="submitError" kind="error">{{ submitError }}</AlertMessage>
      <JobForm
        :key="job?.id ?? 'new'"
        :initial="job"
        :submitting="submitting"
        :submit-label="isEdit ? 'Enregistrer les modifications' : 'Publier l’offre'"
        @submit="submit"
        @cancel="cancel"
      />
    </template>
  </section>
</template>
