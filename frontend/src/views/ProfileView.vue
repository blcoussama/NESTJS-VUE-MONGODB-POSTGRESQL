<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useProfileStore } from '@/stores/profile'
import { useAuthStore } from '@/stores/auth'
import { useCompanyStore } from '@/stores/company'
import { useUiStore } from '@/stores/ui'
import { errorMessage } from '@/api/errors'
import type {
  UpdateCandidateProfilePayload,
  UpdateRecruiterProfilePayload,
  UserProfile,
} from '@/types/api'
import { ROLE_LABELS } from '@/utils/format'
import { emptyToNull, normalizeOptionalUrl } from '@/utils/validation'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import AlertMessage from '@/components/ui/AlertMessage.vue'
import FormField from '@/components/ui/FormField.vue'
import TagInput from '@/components/ui/TagInput.vue'
import AvatarImage from '@/components/ui/AvatarImage.vue'
import ExternalLink from '@/components/ui/ExternalLink.vue'
import AvatarUploader from '@/components/profile/AvatarUploader.vue'
import CvManager from '@/components/profile/CvManager.vue'
import ExperienceEditor from '@/components/profile/ExperienceEditor.vue'
import EducationEditor from '@/components/profile/EducationEditor.vue'
import {
  draftToEducation,
  draftToExperience,
  educationToDraft,
  experienceToDraft,
  validateEducation,
  validateExperiences,
  type DraftErrors,
  type EducationDraft,
  type ExperienceDraft,
} from '@/components/profile/drafts'

const profileStore = useProfileStore()
const auth = useAuthStore()
const companyStore = useCompanyStore()
const ui = useUiStore()
const { profile, loading, error } = storeToRefs(profileStore)
const isCandidate = computed(() => (profile.value?.role ?? auth.role) === 'candidate')

const form = reactive({
  headline: '',
  bio: '',
  location: '',
  phone: '',
  linkedinUrl: '',
  githubUrl: '',
  portfolioUrl: '',
  isAvailable: false,
  skills: [] as string[],
  companyName: '',
  companyWebsite: '',
})
const experiences = ref<ExperienceDraft[]>([])
const education = ref<EducationDraft[]>([])
const urlErrors = reactive<Record<string, string | null>>({})
const experienceErrors = ref<DraftErrors>({})
const educationErrors = ref<DraftErrors>({})
const saving = ref(false)
const saveError = ref<string | null>(null)

function fill(p: UserProfile) {
  form.headline = p.headline ?? ''
  form.bio = p.bio ?? ''
  form.location = p.location ?? ''
  form.phone = p.phone ?? ''
  form.linkedinUrl = p.linkedinUrl ?? ''
  form.githubUrl = p.githubUrl ?? ''
  form.portfolioUrl = p.portfolioUrl ?? ''
  form.isAvailable = Boolean(p.isAvailable)
  form.skills = [...(p.skills ?? [])]
  form.companyName = p.companyName ?? ''
  form.companyWebsite = p.companyWebsite ?? ''
  experiences.value = (p.experiences ?? []).map(experienceToDraft)
  education.value = (p.education ?? []).map(educationToDraft)
}

// Fill the form once per loaded profile: avatar/CV updates must not wipe unsaved edits.
let filledFor: string | null = null
watch(
  profile,
  (p) => {
    if (p && filledFor !== p.id) {
      fill(p)
      filledFor = p.id
    }
  },
  { immediate: true },
)

onMounted(async () => {
  if (auth.isRecruiter) void companyStore.fetchMine()
  await profileStore.fetch()
  // Fresh data from the server replaces a possibly stale cached profile.
  if (profile.value) {
    fill(profile.value)
    filledFor = profile.value.id
  }
})

function checkUrls(fields: ('linkedinUrl' | 'githubUrl' | 'portfolioUrl' | 'companyWebsite')[]) {
  const values: Record<string, string | null> = {}
  for (const f of fields) {
    const { value, error: err } = normalizeOptionalUrl(form[f])
    urlErrors[f] = err
    values[f] = value
  }
  return { values, ok: fields.every((f) => !urlErrors[f]) }
}

async function save() {
  saveError.value = null
  const common = {
    headline: emptyToNull(form.headline),
    bio: emptyToNull(form.bio),
    location: emptyToNull(form.location),
    phone: emptyToNull(form.phone),
  }
  let payload: UpdateCandidateProfilePayload | UpdateRecruiterProfilePayload
  if (isCandidate.value) {
    const { values, ok } = checkUrls(['linkedinUrl', 'githubUrl', 'portfolioUrl'])
    experienceErrors.value = validateExperiences(experiences.value)
    educationErrors.value = validateEducation(education.value)
    if (!ok || Object.keys(experienceErrors.value).length || Object.keys(educationErrors.value).length) {
      saveError.value = 'Corrigez les champs signalés avant d’enregistrer.'
      return
    }
    payload = {
      ...common,
      linkedinUrl: values.linkedinUrl ?? null,
      githubUrl: values.githubUrl ?? null,
      portfolioUrl: values.portfolioUrl ?? null,
      isAvailable: form.isAvailable,
      skills: form.skills,
      experiences: experiences.value.map(draftToExperience),
      education: education.value.map(draftToEducation),
    }
  } else {
    const { values, ok } = checkUrls(['linkedinUrl', 'companyWebsite']) // gitleaks:allow (noms de champs, pas un identifiant)
    if (!ok) {
      saveError.value = 'Corrigez les champs signalés avant d’enregistrer.'
      return
    }
    payload = {
      ...common,
      linkedinUrl: values.linkedinUrl ?? null,
      companyName: emptyToNull(form.companyName),
      companyWebsite: values.companyWebsite ?? null,
    }
  }
  saving.value = true
  try {
    await profileStore.update(payload)
    ui.success('Profil enregistré.')
  } catch (err) {
    saveError.value = errorMessage(err, 'L’enregistrement a échoué.')
  } finally {
    saving.value = false
  }
}

const fullName = computed(() =>
  profile.value ? `${profile.value.firstName} ${profile.value.lastName}` : auth.fullName,
)
</script>

<template>
  <section aria-labelledby="profile-title" class="space-y-6">
    <h1 id="profile-title" class="page-title">Mon profil</h1>

    <AppSpinner v-if="loading && !profile" label="Chargement du profil…" />
    <AlertMessage v-else-if="error && !profile" kind="error">
      {{ error }}
      <template #actions>
        <button type="button" class="btn btn-secondary btn-sm" @click="profileStore.fetch()">Réessayer</button>
      </template>
    </AlertMessage>

    <div v-else-if="profile" class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <aside class="space-y-6" aria-label="Identité et documents">
        <div class="card space-y-4">
          <AvatarUploader :src="profile.avatarUrl" :name="fullName" />
          <div class="text-center">
            <p class="text-lg font-semibold">{{ fullName }}</p>
            <p class="text-sm text-slate-500">{{ profile.email }}</p>
            <p class="mt-1"><span class="chip">{{ ROLE_LABELS[profile.role] }}</span></p>
          </div>
        </div>

        <div v-if="isCandidate" class="card space-y-3">
          <h2 class="text-base font-semibold">Mon CV</h2>
          <CvManager :has-cv="Boolean(profile.hasCv)" />
        </div>

        <div v-else class="card space-y-3">
          <h2 class="text-base font-semibold">Ma société</h2>
          <AppSpinner v-if="companyStore.loading" size="sm" inline label="Chargement…" />
          <div v-else-if="companyStore.company" class="flex items-center gap-3">
            <AvatarImage :src="companyStore.company.logoUrl" :name="companyStore.company.name" shape="square" />
            <div class="min-w-0">
              <p class="font-medium">{{ companyStore.company.name }}</p>
              <ExternalLink v-if="companyStore.company.website" :href="companyStore.company.website" class="text-sm" />
            </div>
          </div>
          <p v-else class="text-sm text-slate-600">Vous n’avez pas encore créé votre société.</p>
          <RouterLink to="/recruiter/company" class="btn btn-secondary btn-sm">
            {{ companyStore.company ? 'Gérer la société et son logo' : 'Créer ma société' }}
          </RouterLink>
        </div>
      </aside>

      <form class="space-y-6 lg:col-span-2" novalidate @submit.prevent="save">
        <AlertMessage v-if="saveError" kind="error">{{ saveError }}</AlertMessage>

        <section class="card space-y-4" aria-labelledby="profile-general">
          <h2 id="profile-general" class="text-base font-semibold">Informations générales</h2>
          <FormField v-slot="{ id }" label="Titre professionnel">
            <input :id="id" v-model="form.headline" type="text" class="input" :placeholder="isCandidate ? 'Développeur Full-Stack | Vue & NestJS' : 'Responsable recrutement'" />
          </FormField>
          <FormField v-slot="{ id }" label="Présentation">
            <textarea :id="id" v-model="form.bio" rows="4" class="input" />
          </FormField>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField v-slot="{ id }" label="Ville">
              <input :id="id" v-model="form.location" type="text" class="input" autocomplete="address-level2" />
            </FormField>
            <FormField v-slot="{ id }" label="Téléphone">
              <input :id="id" v-model="form.phone" type="tel" class="input" autocomplete="tel" />
            </FormField>
          </div>
          <FormField v-slot="{ id, describedBy, invalid }" label="Profil LinkedIn" :error="urlErrors.linkedinUrl">
            <input :id="id" v-model="form.linkedinUrl" type="url" class="input" placeholder="https://linkedin.com/in/…" :aria-invalid="invalid" :aria-describedby="describedBy" />
          </FormField>
        </section>

        <template v-if="isCandidate">
          <section class="card space-y-4" aria-labelledby="profile-candidate">
            <h2 id="profile-candidate" class="text-base font-semibold">Profil candidat</h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField v-slot="{ id, describedBy, invalid }" label="GitHub" :error="urlErrors.githubUrl">
                <input :id="id" v-model="form.githubUrl" type="url" class="input" placeholder="https://github.com/…" :aria-invalid="invalid" :aria-describedby="describedBy" />
              </FormField>
              <FormField v-slot="{ id, describedBy, invalid }" label="Portfolio" :error="urlErrors.portfolioUrl">
                <input :id="id" v-model="form.portfolioUrl" type="url" class="input" :aria-invalid="invalid" :aria-describedby="describedBy" />
              </FormField>
            </div>
            <label class="flex items-center gap-2 text-sm">
              <input v-model="form.isAvailable" type="checkbox" class="accent-indigo-600" />
              Je suis disponible pour de nouvelles opportunités
            </label>
            <TagInput v-model="form.skills" label="Compétences" placeholder="Ex. : Vue.js puis Entrée" />
          </section>

          <section class="card space-y-4" aria-labelledby="profile-exp">
            <h2 id="profile-exp" class="text-base font-semibold">Expériences</h2>
            <ExperienceEditor v-model="experiences" :errors="experienceErrors" />
          </section>

          <section class="card space-y-4" aria-labelledby="profile-edu">
            <h2 id="profile-edu" class="text-base font-semibold">Formations</h2>
            <EducationEditor v-model="education" :errors="educationErrors" />
          </section>
        </template>

        <section v-else class="card space-y-4" aria-labelledby="profile-recruiter">
          <h2 id="profile-recruiter" class="text-base font-semibold">Profil recruteur</h2>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField v-slot="{ id }" label="Entreprise (affichée sur votre profil)">
              <input :id="id" v-model="form.companyName" type="text" class="input" autocomplete="organization" />
            </FormField>
            <FormField v-slot="{ id, describedBy, invalid }" label="Site de l’entreprise" :error="urlErrors.companyWebsite">
              <input :id="id" v-model="form.companyWebsite" type="url" class="input" :aria-invalid="invalid" :aria-describedby="describedBy" />
            </FormField>
          </div>
        </section>

        <div class="flex justify-end">
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'Enregistrement…' : 'Enregistrer le profil' }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>
