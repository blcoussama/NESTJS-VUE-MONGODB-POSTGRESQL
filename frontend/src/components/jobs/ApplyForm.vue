<script setup lang="ts">
import { reactive, ref } from 'vue'
import { EXPERIENCE_LEVELS, type ApplyPayload, type ExperienceLevel } from '@/types/api'
import { EXPERIENCE_LEVEL_LABELS } from '@/utils/format'
import FormField from '@/components/ui/FormField.vue'

const props = withDefaults(
  defineProps<{ submitting?: boolean; defaultLevel?: ExperienceLevel }>(),
  { submitting: false, defaultLevel: 'junior' },
)
const emit = defineEmits<{ submit: [payload: ApplyPayload] }>()

const form = reactive({ experienceYears: '0', experienceLevel: props.defaultLevel })
const error = ref<string | null>(null)

function submit() {
  const raw = String(form.experienceYears).trim()
  const years = Number(raw)
  if (raw === '' || !Number.isInteger(years) || years < 0 || years > 60) {
    error.value = 'Indiquez un nombre entier d’années (0 ou plus).'
    return
  }
  error.value = null
  emit('submit', { experienceYears: years, experienceLevel: form.experienceLevel })
}
</script>

<template>
  <form class="space-y-4" novalidate aria-label="Postuler à l’offre" @submit.prevent="submit">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField v-slot="{ id, describedBy, invalid }" label="Années d’expérience" :error="error" required>
        <input
          :id="id"
          v-model="form.experienceYears"
          type="number"
          inputmode="numeric"
          min="0"
          max="60"
          step="1"
          class="input"
          name="experienceYears"
          :aria-invalid="invalid"
          :aria-describedby="describedBy"
        />
      </FormField>
      <FormField v-slot="{ id }" label="Votre niveau" required>
        <select :id="id" v-model="form.experienceLevel" class="input" name="experienceLevel">
          <option v-for="l in EXPERIENCE_LEVELS" :key="l" :value="l">{{ EXPERIENCE_LEVEL_LABELS[l] }}</option>
        </select>
      </FormField>
    </div>
    <button type="submit" class="btn btn-primary w-full sm:w-auto" :disabled="submitting">
      {{ submitting ? 'Envoi…' : 'Envoyer ma candidature' }}
    </button>
  </form>
</template>
