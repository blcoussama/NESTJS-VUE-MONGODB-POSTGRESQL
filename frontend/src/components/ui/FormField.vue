<script setup lang="ts">
import { computed, useId } from 'vue'

const props = defineProps<{
  label: string
  error?: string | null
  hint?: string
  required?: boolean
  /** Visually hide the label (it stays available to screen readers). */
  srOnlyLabel?: boolean
  id?: string
}>()

defineSlots<{
  default(props: { id: string; describedBy: string | undefined; invalid: boolean }): unknown
}>()

const generated = useId()
const inputId = computed(() => props.id ?? `field-${generated}`)
const errorId = computed(() => `${inputId.value}-error`)
const hintId = computed(() => `${inputId.value}-hint`)
const describedBy = computed(() =>
  props.error ? errorId.value : props.hint ? hintId.value : undefined,
)
const slotProps = computed(() => ({
  id: inputId.value,
  describedBy: describedBy.value,
  invalid: Boolean(props.error),
}))
</script>

<template>
  <div>
    <label :for="inputId" class="label" :class="{ 'sr-only': srOnlyLabel }">
      {{ label }}<span v-if="required" class="text-red-600" aria-hidden="true"> *</span>
    </label>
    <slot v-bind="slotProps" />
    <p v-if="hint && !error" :id="hintId" class="mt-1 text-xs text-slate-500">{{ hint }}</p>
    <p v-if="error" :id="errorId" class="mt-1 text-sm text-red-600">{{ error }}</p>
  </div>
</template>
