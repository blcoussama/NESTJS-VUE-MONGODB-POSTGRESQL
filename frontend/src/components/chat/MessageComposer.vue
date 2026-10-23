<script setup lang="ts">
import { computed, ref } from 'vue'
import { MAX_MESSAGE_LENGTH } from '@/config'

const props = withDefaults(defineProps<{ disabled?: boolean; placeholder?: string }>(), {
  disabled: false,
  placeholder: 'Écrire un message…',
})
const emit = defineEmits<{ send: [text: string]; typing: [] }>()
const text = ref('')
const remaining = computed(() => MAX_MESSAGE_LENGTH - text.value.length)
const canSend = computed(() => !props.disabled && text.value.trim().length > 0 && remaining.value >= 0)

function submit() {
  if (!canSend.value) return
  emit('send', text.value)
  text.value = ''
}

function onKeydown(event: KeyboardEvent) {
  // Enter sends, Shift+Enter inserts a new line.
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    submit()
  }
}
</script>

<template>
  <form class="border-t border-slate-200 bg-white p-3" @submit.prevent="submit">
    <label for="chat-composer" class="sr-only">Votre message</label>
    <div class="flex items-end gap-2">
      <textarea
        id="chat-composer"
        v-model="text"
        rows="2"
        class="input resize-none"
        :maxlength="MAX_MESSAGE_LENGTH"
        :placeholder="placeholder"
        :disabled="disabled"
        aria-describedby="chat-composer-hint"
        @keydown="onKeydown"
        @input="emit('typing')"
      />
      <button type="submit" class="btn btn-primary" :disabled="!canSend">Envoyer</button>
    </div>
    <p id="chat-composer-hint" class="mt-1 flex justify-between text-xs text-slate-400">
      <span>Entrée pour envoyer · Maj+Entrée pour un retour à la ligne</span>
      <span :class="{ 'text-red-600': remaining < 100 }">{{ remaining }}</span>
    </p>
  </form>
</template>
