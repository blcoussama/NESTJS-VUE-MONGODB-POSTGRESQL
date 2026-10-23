<script setup lang="ts">
import { nextTick, ref, useId } from 'vue'

const props = withDefaults(
  defineProps<{ label: string; addLabel?: string; placeholder?: string; max?: number }>(),
  { addLabel: 'Ajouter', placeholder: '', max: 30 },
)
const model = defineModel<string[]>({ required: true })
const baseId = useId()
const container = ref<HTMLElement | null>(null)

async function add() {
  if (model.value.length >= props.max) return
  model.value = [...model.value, '']
  await nextTick()
  const inputs = container.value?.querySelectorAll<HTMLInputElement>('input')
  inputs?.[inputs.length - 1]?.focus()
}

function update(index: number, value: string) {
  model.value = model.value.map((v, i) => (i === index ? value : v))
}

function remove(index: number) {
  model.value = model.value.filter((_, i) => i !== index)
}
</script>

<template>
  <div ref="container" class="space-y-2">
    <ul v-if="model.length" class="space-y-2">
      <li v-for="(item, index) in model" :key="index" class="flex items-center gap-2">
        <label :for="`${baseId}-${index}`" class="sr-only">{{ label }} {{ index + 1 }}</label>
        <input
          :id="`${baseId}-${index}`"
          :value="item"
          type="text"
          class="input"
          :placeholder="placeholder"
          @input="update(index, ($event.target as HTMLInputElement).value)"
          @keydown.enter.prevent="add"
        />
        <button
          type="button"
          class="btn btn-ghost btn-sm text-red-600"
          :aria-label="`Supprimer : ${label} ${index + 1}`"
          @click="remove(index)"
        >
          Supprimer
        </button>
      </li>
    </ul>
    <button type="button" class="btn btn-secondary btn-sm" :disabled="model.length >= max" @click="add">
      + {{ addLabel }}
    </button>
  </div>
</template>
