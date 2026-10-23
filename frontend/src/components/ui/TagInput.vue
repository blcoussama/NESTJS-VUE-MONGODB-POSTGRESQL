<script setup lang="ts">
import { ref, useId } from 'vue'

const props = withDefaults(
  defineProps<{ label: string; placeholder?: string; max?: number; maxLength?: number }>(),
  { placeholder: 'Ajouter puis Entrée', max: 50, maxLength: 50 },
)
const model = defineModel<string[]>({ required: true })
const draft = ref('')
const id = useId()
const message = ref('')

function add() {
  const value = draft.value.trim().replace(/,$/, '').slice(0, props.maxLength)
  if (!value) return
  if (model.value.some((t) => t.toLowerCase() === value.toLowerCase())) {
    message.value = `« ${value} » est déjà présent.`
  } else if (model.value.length >= props.max) {
    message.value = `Maximum ${props.max} éléments.`
  } else {
    model.value = [...model.value, value]
    message.value = `« ${value} » ajouté.`
  }
  draft.value = ''
}

function remove(tag: string) {
  model.value = model.value.filter((t) => t !== tag)
  message.value = `« ${tag} » supprimé.`
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    add()
  } else if (event.key === 'Backspace' && draft.value === '' && model.value.length) {
    remove(model.value[model.value.length - 1]!)
  }
}
</script>

<template>
  <div>
    <label :for="`tag-${id}`" class="label">{{ label }}</label>
    <div class="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30">
      <ul class="contents" :aria-label="label">
        <li v-for="tag in model" :key="tag" class="chip bg-indigo-50 text-indigo-700">
          {{ tag }}
          <button type="button" class="ml-0.5 rounded-full px-1 hover:bg-indigo-100" :aria-label="`Retirer ${tag}`" @click="remove(tag)">
            ✕
          </button>
        </li>
      </ul>
      <input
        :id="`tag-${id}`"
        v-model="draft"
        type="text"
        class="min-w-32 flex-1 border-0 bg-transparent p-1 text-sm focus:outline-none"
        :placeholder="placeholder"
        :maxlength="maxLength"
        @keydown="onKeydown"
        @blur="add"
      />
    </div>
    <p class="sr-only" aria-live="polite">{{ message }}</p>
  </div>
</template>
