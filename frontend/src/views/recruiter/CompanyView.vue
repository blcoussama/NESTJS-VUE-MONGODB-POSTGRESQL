<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useCompanyStore } from '@/stores/company'
import { useUiStore } from '@/stores/ui'
import { errorMessage } from '@/api/errors'
import type { Company, CompanyPayload } from '@/types/api'
import { validateImageFile, normalizeOptionalUrl } from '@/utils/validation'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import AlertMessage from '@/components/ui/AlertMessage.vue'
import FormField from '@/components/ui/FormField.vue'
import AvatarImage from '@/components/ui/AvatarImage.vue'
import ExternalLink from '@/components/ui/ExternalLink.vue'
import FileButton from '@/components/profile/FileButton.vue'

const store = useCompanyStore()
const ui = useUiStore()
const router = useRouter()
const { company, loaded, loading, error } = storeToRefs(store)

const form = reactive({ name: '', description: '', website: '', location: '' })
const errors = reactive<{ name: string | null; website: string | null }>({ name: null, website: null })
const saving = ref(false)
const saveError = ref<string | null>(null)
const logoBusy = ref(false)
const logoError = ref<string | null>(null)

function fill(c: Company | null) {
  form.name = c?.name ?? ''
  form.description = c?.description ?? ''
  form.website = c?.website ?? ''
  form.location = c?.location ?? ''
}

// Refill only when another company is loaded (a logo change must not wipe unsaved edits).
watch(
  () => company.value?.id,
  () => fill(company.value),
  { immediate: true },
)
onMounted(() => store.fetchMine(true))

async function save() {
  saveError.value = null
  errors.name = form.name.trim() ? null : 'Nom requis.'
  const website = normalizeOptionalUrl(form.website)
  errors.website = website.error
  if (errors.name || errors.website) return
  const payload: CompanyPayload = { name: form.name.trim() }
  if (form.description.trim()) payload.description = form.description.trim()
  if (website.value) payload.website = website.value
  if (form.location.trim()) payload.location = form.location.trim()
  saving.value = true
  try {
    if (company.value) {
      await store.update(payload)
      ui.success('Société mise à jour.')
    } else {
      await store.create(payload)
      ui.success('Société créée. Vous pouvez maintenant publier des offres.')
    }
  } catch (err) {
    saveError.value = errorMessage(err, 'L’enregistrement a échoué.')
  } finally {
    saving.value = false
  }
}

async function onLogo(file: File) {
  logoError.value = validateImageFile(file)
  if (logoError.value) return
  logoBusy.value = true
  try {
    await store.uploadLogo(file)
    ui.success('Logo mis à jour.')
  } catch (err) {
    logoError.value = errorMessage(err, 'Échec de l’envoi du logo.')
  } finally {
    logoBusy.value = false
  }
}

async function removeLogo() {
  const ok = await ui.confirm({ title: 'Supprimer le logo ?', confirmLabel: 'Supprimer', danger: true })
  if (!ok) return
  logoBusy.value = true
  logoError.value = null
  try {
    await store.deleteLogo()
    ui.success('Logo supprimé.')
  } catch (err) {
    logoError.value = errorMessage(err, 'Suppression impossible.')
  } finally {
    logoBusy.value = false
  }
}

async function removeCompany() {
  if (!company.value) return
  const ok = await ui.confirm({
    title: `Supprimer « ${company.value.name} » ?`,
    message: 'Toutes les offres de la société et leurs candidatures seront définitivement supprimées.',
    confirmLabel: 'Supprimer définitivement',
    danger: true,
  })
  if (!ok) return
  try {
    await store.remove()
    ui.success('Société supprimée.')
    await router.push('/recruiter/jobs')
  } catch (err) {
    ui.error(errorMessage(err, 'Suppression impossible.'))
  }
}
</script>

<template>
  <section aria-labelledby="company-title" class="space-y-6">
    <h1 id="company-title" class="page-title">{{ company ? 'Ma société' : 'Créer ma société' }}</h1>

    <AppSpinner v-if="loading && !loaded" label="Chargement de la société…" />
    <AlertMessage v-else-if="error" kind="error">
      {{ error }}
      <template #actions>
        <button type="button" class="btn btn-secondary btn-sm" @click="store.fetchMine(true)">Réessayer</button>
      </template>
    </AlertMessage>

    <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <aside class="card space-y-3 text-center" aria-label="Logo">
        <template v-if="company">
          <AvatarImage :src="company.logoUrl" :name="company.name" shape="square" size="xl" class="mx-auto" />
          <div class="flex flex-wrap justify-center gap-2" :aria-busy="logoBusy">
            <FileButton :label="company.logoUrl ? 'Changer le logo' : 'Ajouter un logo'" accept="image/jpeg,image/png,image/webp" :disabled="logoBusy" @select="onLogo" />
            <button v-if="company.logoUrl" type="button" class="btn btn-ghost btn-sm text-red-700" :disabled="logoBusy" @click="removeLogo">Supprimer</button>
          </div>
          <p class="text-xs text-slate-500">JPEG, PNG ou WebP · 2 Mo max.</p>
          <p v-if="logoError" role="alert" class="text-sm text-red-600">{{ logoError }}</p>
          <p v-if="company.website" class="text-sm"><ExternalLink :href="company.website" /></p>
        </template>
        <p v-else class="text-sm text-slate-600">
          Une société est nécessaire pour publier des offres. Le logo pourra être ajouté après la création.
        </p>
      </aside>

      <form class="card space-y-4 lg:col-span-2" novalidate @submit.prevent="save">
        <AlertMessage v-if="saveError" kind="error">{{ saveError }}</AlertMessage>
        <FormField v-slot="{ id, describedBy, invalid }" label="Nom de la société" :error="errors.name" required>
          <input :id="id" v-model="form.name" type="text" maxlength="100" class="input" autocomplete="organization" :aria-invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField v-slot="{ id }" label="Description" hint="2000 caractères maximum.">
          <textarea :id="id" v-model="form.description" rows="5" maxlength="2000" class="input" />
        </FormField>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField v-slot="{ id, describedBy, invalid }" label="Site web" :error="errors.website">
            <input :id="id" v-model="form.website" type="url" class="input" placeholder="https://…" :aria-invalid="invalid" :aria-describedby="describedBy" />
          </FormField>
          <FormField v-slot="{ id }" label="Localisation">
            <input :id="id" v-model="form.location" type="text" maxlength="100" class="input" />
          </FormField>
        </div>
        <div class="flex flex-wrap justify-between gap-2">
          <button v-if="company" type="button" class="btn btn-ghost text-red-700" @click="removeCompany">Supprimer la société</button>
          <span v-else />
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'Enregistrement…' : company ? 'Enregistrer' : 'Créer la société' }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>
