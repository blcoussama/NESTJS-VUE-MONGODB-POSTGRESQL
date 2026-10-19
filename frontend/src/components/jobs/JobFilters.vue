<script setup lang="ts">
import { reactive, watch } from 'vue'
import { EXPERIENCE_LEVELS, JOB_TYPES, type JobFilters } from '@/types/api'
import { EXPERIENCE_LEVEL_LABELS, JOB_TYPE_LABELS } from '@/utils/format'

export type FilterValues = Required<Pick<JobFilters, 'search' | 'location' | 'jobType' | 'experienceLevel' | 'sort'>>

const props = defineProps<{ modelValue: FilterValues; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: FilterValues]; reset: [] }>()

const local = reactive<FilterValues>({ ...props.modelValue })
watch(
  () => props.modelValue,
  (value) => Object.assign(local, value),
  { deep: true },
)

let debounce: ReturnType<typeof setTimeout> | null = null
function emitNow() {
  if (debounce) clearTimeout(debounce)
  debounce = null
  emit('update:modelValue', { ...local })
}
/** Text inputs are debounced so that typing does not fire one request per keystroke. */
function emitDebounced() {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(emitNow, 400)
}
</script>

<template>
  <form class="card grid grid-cols-1 gap-4 md:grid-cols-6" role="search" aria-label="Filtrer les offres" @submit.prevent="emitNow">
    <div class="md:col-span-2">
      <label for="filter-search" class="label">Mots-clés</label>
      <input
        id="filter-search"
        v-model="local.search"
        type="search"
        class="input"
        placeholder="Titre, technologie…"
        :disabled="disabled"
        @input="emitDebounced"
      />
    </div>
    <div class="md:col-span-1">
      <label for="filter-location" class="label">Lieu</label>
      <input
        id="filter-location"
        v-model="local.location"
        type="text"
        class="input"
        placeholder="Tanger…"
        :disabled="disabled"
        @input="emitDebounced"
      />
    </div>
    <div>
      <label for="filter-type" class="label">Contrat</label>
      <select id="filter-type" v-model="local.jobType" class="input" :disabled="disabled" @change="emitNow">
        <option value="">Tous</option>
        <option v-for="t in JOB_TYPES" :key="t" :value="t">{{ JOB_TYPE_LABELS[t] }}</option>
      </select>
    </div>
    <div>
      <label for="filter-level" class="label">Niveau</label>
      <select id="filter-level" v-model="local.experienceLevel" class="input" :disabled="disabled" @change="emitNow">
        <option value="">Tous</option>
        <option v-for="l in EXPERIENCE_LEVELS" :key="l" :value="l">{{ EXPERIENCE_LEVEL_LABELS[l] }}</option>
      </select>
    </div>
    <div>
      <label for="filter-sort" class="label">Tri</label>
      <select id="filter-sort" v-model="local.sort" class="input" :disabled="disabled" @change="emitNow">
        <option value="recent">Plus récentes</option>
        <option value="oldest">Plus anciennes</option>
      </select>
    </div>
    <div class="flex items-end justify-end gap-2 md:col-span-6">
      <button type="button" class="btn btn-ghost btn-sm" @click="emit('reset')">Réinitialiser</button>
      <button type="submit" class="btn btn-primary btn-sm">Rechercher</button>
    </div>
  </form>
</template>
