<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useProfileStore } from '@/stores/profile'
import { useUiStore } from '@/stores/ui'
import { errorMessage } from '@/api/errors'
import { validateImageFile } from '@/utils/validation'
import AvatarImage from '@/components/ui/AvatarImage.vue'
import FileButton from './FileButton.vue'

const props = defineProps<{ src?: string | null; name: string }>()
const profile = useProfileStore()
const ui = useUiStore()
const busy = ref(false)
const error = ref<string | null>(null)
const preview = ref<string | null>(null)

function clearPreview() {
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = null
}
onBeforeUnmount(clearPreview)

async function onSelect(file: File) {
  error.value = validateImageFile(file)
  if (error.value) return
  clearPreview()
  preview.value = URL.createObjectURL(file)
  busy.value = true
  try {
    await profile.uploadAvatar(file)
    ui.success('Photo de profil mise à jour.')
  } catch (err) {
    error.value = errorMessage(err, 'Échec de l’envoi de la photo.')
  } finally {
    clearPreview()
    busy.value = false
  }
}

async function remove() {
  const ok = await ui.confirm({ title: 'Supprimer votre photo de profil ?', confirmLabel: 'Supprimer', danger: true })
  if (!ok) return
  busy.value = true
  error.value = null
  try {
    await profile.deleteAvatar()
    ui.success('Photo supprimée.')
  } catch (err) {
    error.value = errorMessage(err, 'Suppression impossible.')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-3 text-center">
    <AvatarImage :src="preview ?? props.src" :name="name" size="xl" :allow-blob="Boolean(preview)" />
    <div class="flex flex-wrap justify-center gap-2" :aria-busy="busy">
      <FileButton :label="src ? 'Changer la photo' : 'Ajouter une photo'" accept="image/jpeg,image/png,image/webp" :disabled="busy" @select="onSelect" />
      <button v-if="src" type="button" class="btn btn-ghost btn-sm text-red-700" :disabled="busy" @click="remove">Supprimer</button>
    </div>
    <p class="text-xs text-slate-500">JPEG, PNG ou WebP · 2 Mo max.</p>
    <p v-if="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
  </div>
</template>
