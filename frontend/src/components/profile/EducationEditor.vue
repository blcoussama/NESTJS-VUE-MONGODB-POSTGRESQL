<script setup lang="ts">
import { emptyEducation, type DraftErrors, type EducationDraft } from './drafts'
import FormField from '@/components/ui/FormField.vue'

defineProps<{ errors?: DraftErrors }>()
const model = defineModel<EducationDraft[]>({ required: true })

function add() {
  model.value = [...model.value, emptyEducation()]
}
function remove(index: number) {
  model.value = model.value.filter((_, i) => i !== index)
}
</script>

<template>
  <div class="space-y-4">
    <p v-if="model.length === 0" class="text-sm text-slate-500">Aucune formation renseignée.</p>
    <fieldset v-for="(edu, index) in model" :key="index" class="rounded-lg border border-slate-200 p-4">
      <legend class="px-1 text-sm font-semibold text-slate-700">Formation {{ index + 1 }}</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField v-slot="{ id, describedBy, invalid }" label="Établissement" :error="errors?.[index]?.school" required>
          <input :id="id" v-model="edu.school" type="text" class="input" :aria-invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField v-slot="{ id, describedBy, invalid }" label="Diplôme" :error="errors?.[index]?.degree" required>
          <input :id="id" v-model="edu.degree" type="text" class="input" :aria-invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField v-slot="{ id }" label="Spécialité">
          <input :id="id" v-model="edu.field" type="text" class="input" />
        </FormField>
        <div class="flex items-end pb-2">
          <label class="flex items-center gap-2 text-sm">
            <input v-model="edu.current" type="checkbox" class="accent-indigo-600" />
            En cours
          </label>
        </div>
        <FormField v-slot="{ id, describedBy, invalid }" label="Début" :error="errors?.[index]?.startDate" required>
          <input :id="id" v-model="edu.startDate" type="date" class="input" :aria-invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField v-if="!edu.current" v-slot="{ id, describedBy, invalid }" label="Fin" :error="errors?.[index]?.endDate">
          <input :id="id" v-model="edu.endDate" type="date" class="input" :aria-invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
      </div>
      <div class="mt-3 flex justify-end">
        <button type="button" class="btn btn-ghost btn-sm text-red-700" @click="remove(index)">
          Supprimer la formation {{ index + 1 }}
        </button>
      </div>
    </fieldset>
    <button type="button" class="btn btn-secondary btn-sm" @click="add">+ Ajouter une formation</button>
  </div>
</template>
