<script setup lang="ts">
import { emptyExperience, type DraftErrors, type ExperienceDraft } from './drafts'
import FormField from '@/components/ui/FormField.vue'

defineProps<{ errors?: DraftErrors }>()
const model = defineModel<ExperienceDraft[]>({ required: true })

function add() {
  model.value = [...model.value, emptyExperience()]
}
function remove(index: number) {
  model.value = model.value.filter((_, i) => i !== index)
}
</script>

<template>
  <div class="space-y-4">
    <p v-if="model.length === 0" class="text-sm text-slate-500">Aucune expérience renseignée.</p>
    <fieldset v-for="(exp, index) in model" :key="index" class="rounded-lg border border-slate-200 p-4">
      <legend class="px-1 text-sm font-semibold text-slate-700">Expérience {{ index + 1 }}</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField v-slot="{ id, describedBy, invalid }" label="Intitulé du poste" :error="errors?.[index]?.title" required>
          <input :id="id" v-model="exp.title" type="text" class="input" :aria-invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField v-slot="{ id, describedBy, invalid }" label="Entreprise" :error="errors?.[index]?.company" required>
          <input :id="id" v-model="exp.company" type="text" class="input" :aria-invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField v-slot="{ id }" label="Lieu">
          <input :id="id" v-model="exp.location" type="text" class="input" />
        </FormField>
        <div class="flex items-end pb-2">
          <label class="flex items-center gap-2 text-sm">
            <input v-model="exp.current" type="checkbox" class="accent-indigo-600" />
            Poste actuel
          </label>
        </div>
        <FormField v-slot="{ id, describedBy, invalid }" label="Début" :error="errors?.[index]?.startDate" required>
          <input :id="id" v-model="exp.startDate" type="date" class="input" :aria-invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField v-if="!exp.current" v-slot="{ id, describedBy, invalid }" label="Fin" :error="errors?.[index]?.endDate">
          <input :id="id" v-model="exp.endDate" type="date" class="input" :aria-invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField v-slot="{ id }" label="Description" class="sm:col-span-2">
          <textarea :id="id" v-model="exp.description" rows="3" class="input" />
        </FormField>
      </div>
      <div class="mt-3 flex justify-end">
        <button type="button" class="btn btn-ghost btn-sm text-red-700" @click="remove(index)">
          Supprimer l’expérience {{ index + 1 }}
        </button>
      </div>
    </fieldset>
    <button type="button" class="btn btn-secondary btn-sm" @click="add">+ Ajouter une expérience</button>
  </div>
</template>
