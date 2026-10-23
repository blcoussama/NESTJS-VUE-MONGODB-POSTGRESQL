<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  EXPERIENCE_LEVELS,
  JOB_TYPES,
  SALARY_TYPES,
  type ExperienceLevel,
  type Job,
  type JobType,
  type Salary,
  type SalaryType,
} from '@/types/api'
import { EXPERIENCE_LEVEL_LABELS, JOB_TYPE_LABELS, SALARY_TYPE_LABELS } from '@/utils/format'
import FormField from '@/components/ui/FormField.vue'
import ListInput from '@/components/ui/ListInput.vue'

export interface JobFormValues {
  title: string
  description: string
  location: string
  jobType: JobType
  experienceLevel: ExperienceLevel
  requirements: string[]
  salaryType: SalaryType
  salary: Salary | null
}

const props = withDefaults(
  defineProps<{ initial?: Job | null; submitting?: boolean; submitLabel?: string }>(),
  { initial: null, submitting: false, submitLabel: 'Publier l’offre' },
)
const emit = defineEmits<{ submit: [values: JobFormValues]; cancel: [] }>()

function numberToInput(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

const form = reactive({
  title: props.initial?.title ?? '',
  description: props.initial?.description ?? '',
  location: props.initial?.location ?? '',
  jobType: (props.initial?.jobType ?? 'full-time') as JobType,
  experienceLevel: (props.initial?.experienceLevel ?? 'junior') as ExperienceLevel,
  requirements: [...(props.initial?.requirements ?? [])],
  salaryType: (props.initial?.salaryType ?? 'negotiable') as SalaryType,
  salaryMin: numberToInput(props.initial?.salary?.min ?? undefined),
  salaryMax: numberToInput(props.initial?.salary?.max ?? undefined),
  currency: props.initial?.salary?.currency ?? 'MAD',
})

type Field = 'title' | 'description' | 'location' | 'requirements' | 'salaryMin' | 'salaryMax' | 'currency'
const errors = reactive<Record<Field, string | null>>({
  title: null,
  description: null,
  location: null,
  requirements: null,
  salaryMin: null,
  salaryMax: null,
  currency: null,
})
const formError = ref<string | null>(null)

const showMin = computed(() => form.salaryType === 'fixed' || form.salaryType === 'range')
const showMax = computed(() => form.salaryType === 'range')

function parseAmount(raw: string | number): number | null | 'invalid' {
  const text = String(raw).trim()
  if (text === '') return null
  const value = Number(text)
  return Number.isFinite(value) && value >= 0 ? value : 'invalid'
}

function buildSalary(): Salary | null | 'invalid' {
  errors.salaryMin = null
  errors.salaryMax = null
  errors.currency = null
  if (form.salaryType === 'negotiable') return null
  const currency = form.currency.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) {
    errors.currency = 'Code devise sur 3 lettres (MAD, EUR…).'
    return 'invalid'
  }
  const min = parseAmount(form.salaryMin)
  if (min === 'invalid' || min === null) {
    errors.salaryMin = form.salaryType === 'fixed' ? 'Montant requis (≥ 0).' : 'Minimum requis (≥ 0).'
    return 'invalid'
  }
  if (form.salaryType === 'fixed') return { min, currency }
  const max = parseAmount(form.salaryMax)
  if (max === 'invalid' || max === null) {
    errors.salaryMax = 'Maximum requis (≥ 0).'
    return 'invalid'
  }
  if (max < min) {
    errors.salaryMax = 'Le maximum doit être supérieur ou égal au minimum.'
    return 'invalid'
  }
  return { min, max, currency }
}

function submit() {
  formError.value = null
  errors.title = form.title.trim() ? null : 'Titre requis.'
  errors.description = form.description.trim().length >= 20 ? null : 'Description requise (20 caractères minimum).'
  errors.location = form.location.trim() ? null : 'Lieu requis.'
  const requirements = form.requirements.map((r) => r.trim()).filter(Boolean)
  errors.requirements = requirements.length > 0 ? null : 'Ajoutez au moins une exigence.'
  const salary = buildSalary()
  if (Object.values(errors).some(Boolean) || salary === 'invalid') {
    formError.value = 'Corrigez les champs signalés.'
    return
  }
  emit('submit', {
    title: form.title.trim(),
    description: form.description.trim(),
    location: form.location.trim(),
    jobType: form.jobType,
    experienceLevel: form.experienceLevel,
    requirements,
    salaryType: form.salaryType,
    salary,
  })
}
</script>

<template>
  <form class="space-y-6" novalidate @submit.prevent="submit">
    <p v-if="formError" role="alert" class="text-sm font-medium text-red-600">{{ formError }}</p>

    <section class="card space-y-4" aria-labelledby="job-form-general">
      <h2 id="job-form-general" class="text-base font-semibold">Informations générales</h2>
      <FormField v-slot="{ id, describedBy, invalid }" label="Intitulé du poste" :error="errors.title" required>
        <input :id="id" v-model="form.title" type="text" maxlength="150" class="input" :aria-invalid="invalid" :aria-describedby="describedBy" />
      </FormField>
      <FormField v-slot="{ id, describedBy, invalid }" label="Description" :error="errors.description" hint="Missions, contexte, équipe… (les retours à la ligne sont conservés)." required>
        <textarea :id="id" v-model="form.description" rows="8" class="input" :aria-invalid="invalid" :aria-describedby="describedBy" />
      </FormField>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField v-slot="{ id, describedBy, invalid }" label="Lieu" :error="errors.location" required>
          <input :id="id" v-model="form.location" type="text" class="input" placeholder="Tanger, Maroc" :aria-invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField v-slot="{ id }" label="Type de contrat" required>
          <select :id="id" v-model="form.jobType" class="input">
            <option v-for="t in JOB_TYPES" :key="t" :value="t">{{ JOB_TYPE_LABELS[t] }}</option>
          </select>
        </FormField>
        <FormField v-slot="{ id }" label="Niveau d’expérience" required>
          <select :id="id" v-model="form.experienceLevel" class="input">
            <option v-for="l in EXPERIENCE_LEVELS" :key="l" :value="l">{{ EXPERIENCE_LEVEL_LABELS[l] }}</option>
          </select>
        </FormField>
      </div>
    </section>

    <section class="card space-y-3" aria-labelledby="job-form-req">
      <h2 id="job-form-req" class="text-base font-semibold">Exigences</h2>
      <ListInput v-model="form.requirements" label="Exigence" add-label="Ajouter une exigence" placeholder="Ex. : 2 ans d’expérience avec Vue.js" />
      <p v-if="errors.requirements" class="text-sm text-red-600" role="alert">{{ errors.requirements }}</p>
    </section>

    <section class="card space-y-4" aria-labelledby="job-form-salary">
      <h2 id="job-form-salary" class="text-base font-semibold">Rémunération</h2>
      <fieldset>
        <legend class="label">Type de salaire</legend>
        <div class="flex flex-wrap gap-4">
          <label v-for="s in SALARY_TYPES" :key="s" class="flex items-center gap-2 text-sm">
            <input v-model="form.salaryType" type="radio" name="salaryType" :value="s" class="accent-indigo-600" />
            {{ SALARY_TYPE_LABELS[s] }}
          </label>
        </div>
      </fieldset>
      <div v-if="showMin" class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField v-slot="{ id, describedBy, invalid }" :label="showMax ? 'Minimum' : 'Montant'" :error="errors.salaryMin" required>
          <input :id="id" v-model="form.salaryMin" type="number" min="0" step="100" class="input" :aria-invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField v-if="showMax" v-slot="{ id, describedBy, invalid }" label="Maximum" :error="errors.salaryMax" required>
          <input :id="id" v-model="form.salaryMax" type="number" min="0" step="100" class="input" :aria-invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField v-slot="{ id, describedBy, invalid }" label="Devise" :error="errors.currency" required>
          <input :id="id" v-model="form.currency" type="text" maxlength="3" class="input uppercase" :aria-invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
      </div>
    </section>

    <div class="flex justify-end gap-2">
      <button type="button" class="btn btn-secondary" @click="emit('cancel')">Annuler</button>
      <button type="submit" class="btn btn-primary" :disabled="submitting">
        {{ submitting ? 'Enregistrement…' : submitLabel }}
      </button>
    </div>
  </form>
</template>
