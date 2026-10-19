<script setup lang="ts">
import { ref } from 'vue'
import { useProfileStore } from '@/stores/profile'
import { useUiStore } from '@/stores/ui'
import { errorMessage } from '@/api/errors'
import { validateCvFile } from '@/utils/validation'
import { openInNewTab } from '@/utils/url'
import FileButton from './FileButton.vue'

defineProps<{ hasCv: boolean }>()
const profile = useProfileStore()
const ui = useUiStore()
const busy = ref(false)
const error = ref<string | null>(null)
const lastUrl = ref<string | null>(null)

async function onSelect(file: File) {
  error.value = validateCvFile(file)
  if (error.value) return
  busy.value = true
  try {
    await profile.uploadCv(file)
    lastUrl.value = null
    ui.success('CV enregistré.')
  } catch (err) {
    error.value = errorMessage(err, 'Échec de l’envoi du CV.')
  } finally {
    busy.value = false
  }
}

async function view() {
  busy.value = true
  error.value = null
  try {
    const url = await profile.getCvUrl()
    lastUrl.value = url
    openInNewTab(url)
  } catch (err) {
    error.value = errorMessage(err, 'Impossible d’obtenir le lien du CV.')
  } finally {
    busy.value = false
  }
}

async function remove() {
  const ok = await ui.confirm({ title: 'Supprimer votre CV ?', message: 'Les recruteurs ne pourront plus le télécharger.', confirmLabel: 'Supprimer', danger: true })
  if (!ok) return
  busy.value = true
  error.value = null
  try {
    await profile.deleteCv()
    lastUrl.value = null
    ui.success('CV supprimé.')
  } catch (err) {
    error.value = errorMessage(err, 'Suppression impossible.')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-3" :aria-busy="busy">
    <p class="text-sm" :class="hasCv ? 'text-emerald-700' : 'text-slate-600'">
      {{ hasCv ? 'Un CV (PDF) est associé à votre profil.' : 'Aucun CV pour le moment.' }}
    </p>
    <div class="flex flex-wrap gap-2">
      <button v-if="hasCv" type="button" class="btn btn-secondary btn-sm" :disabled="busy" @click="view">Voir mon CV</button>
      <FileButton :label="hasCv ? 'Remplacer' : 'Ajouter mon CV'" accept="application/pdf" :variant="hasCv ? 'secondary' : 'primary'" :disabled="busy" @select="onSelect" />
      <button v-if="hasCv" type="button" class="btn btn-ghost btn-sm text-red-700" :disabled="busy" @click="remove">Supprimer</button>
    </div>
    <p class="text-xs text-slate-500">PDF uniquement · 5 Mo max. Lien de consultation valable 15 minutes.</p>
    <p v-if="lastUrl" class="text-xs text-slate-500">
      Le CV ne s’est pas ouvert ?
      <a :href="lastUrl" target="_blank" rel="noopener noreferrer" class="link">Ouvrir le lien</a>
    </p>
    <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
  </div>
</template>
