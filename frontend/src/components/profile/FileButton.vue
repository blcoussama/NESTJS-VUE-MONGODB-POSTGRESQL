<script setup lang="ts">
import { useId } from 'vue'

withDefaults(
  defineProps<{ label: string; accept: string; disabled?: boolean; variant?: 'primary' | 'secondary' }>(),
  { disabled: false, variant: 'secondary' },
)
const emit = defineEmits<{ select: [file: File] }>()
const id = useId()

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) emit('select', file)
  target.value = '' // allow selecting the same file again
}
</script>

<template>
  <span class="inline-flex">
    <!-- The native input stays focusable (keyboard / screen readers); the label is its visual button. -->
    <input :id="`file-${id}`" type="file" class="peer sr-only" :accept="accept" :disabled="disabled" @change="onChange" />
    <label
      :for="`file-${id}`"
      class="btn btn-sm cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2"
      :class="[variant === 'primary' ? 'btn-primary' : 'btn-secondary', { 'pointer-events-none opacity-60': disabled }]"
    >
      {{ label }}
    </label>
  </span>
</template>
