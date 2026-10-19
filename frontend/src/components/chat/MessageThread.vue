<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { LocalMessage } from '@/stores/chat'
import { formatDate, formatTime } from '@/utils/format'

const props = defineProps<{
  messages: LocalMessage[]
  meId: string | null
  contactName: string
  typing: boolean
  hasMore: boolean
  loadingOlder: boolean
}>()
const emit = defineEmits<{ 'load-older': []; retry: [tempId: string]; discard: [tempId: string] }>()

const scroller = ref<HTMLElement | null>(null)

interface Row {
  key: string
  day?: string
  message?: LocalMessage
}

/** Messages with a day separator whenever the date changes. */
const rows = computed<Row[]>(() => {
  const result: Row[] = []
  let lastDay = ''
  for (const m of props.messages) {
    const day = formatDate(m.createdAt)
    if (day !== lastDay) {
      result.push({ key: `day-${day}`, day })
      lastDay = day
    }
    result.push({ key: m.tempId ?? m.id, message: m })
  }
  return result
})

function isNearBottom(): boolean {
  const el = scroller.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < 120
}

function scrollToBottom() {
  const el = scroller.value
  if (el) el.scrollTop = el.scrollHeight
}

let previousFirstId: string | undefined
let previousHeight = 0

watch(
  () => props.messages,
  async (messages, old) => {
    const el = scroller.value
    const prepended = Boolean(old?.length && messages[0] && messages[0].id !== previousFirstId && previousFirstId)
    const stick = isNearBottom()
    previousHeight = el?.scrollHeight ?? 0
    await nextTick()
    if (!el) return
    if (prepended) {
      // Older page loaded: keep the visible message in place.
      el.scrollTop += el.scrollHeight - previousHeight
    } else if (stick || messages[messages.length - 1]?.from === props.meId) {
      scrollToBottom()
    }
    previousFirstId = messages[0]?.id
  },
)

watch(
  () => props.typing,
  async (typing) => {
    if (typing && isNearBottom()) {
      await nextTick()
      scrollToBottom()
    }
  },
)

onMounted(() => {
  previousFirstId = props.messages[0]?.id
  scrollToBottom()
})
</script>

<template>
  <div ref="scroller" class="flex-1 space-y-2 overflow-y-auto px-4 py-4">
    <div v-if="hasMore" class="flex justify-center">
      <button type="button" class="btn btn-secondary btn-sm" :disabled="loadingOlder" @click="emit('load-older')">
        {{ loadingOlder ? 'Chargement…' : 'Charger les messages précédents' }}
      </button>
    </div>
    <p v-if="messages.length === 0" class="py-10 text-center text-sm text-slate-500">
      Aucun message. Écrivez le premier message à {{ contactName }}.
    </p>

    <ol role="log" aria-live="polite" aria-relevant="additions" :aria-label="`Conversation avec ${contactName}`" class="space-y-2">
      <li v-for="row in rows" :key="row.key">
        <p v-if="row.day" class="my-3 text-center text-xs font-medium text-slate-400">{{ row.day }}</p>
        <div
          v-else-if="row.message"
          class="flex"
          :class="row.message.from === meId ? 'justify-end' : 'justify-start'"
        >
          <div
            class="max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm"
            :class="[
              row.message.from === meId ? 'rounded-br-sm bg-indigo-600 text-white' : 'rounded-bl-sm bg-white text-slate-800 ring-1 ring-slate-200',
              { 'opacity-70': row.message.pending, 'bg-red-50 text-red-900 ring-1 ring-red-300': row.message.failed },
            ]"
          >
            <span class="sr-only">{{ row.message.from === meId ? 'Vous' : contactName }} :</span>
            <p class="break-words whitespace-pre-wrap">{{ row.message.text }}</p>
            <p class="mt-1 text-right text-[11px]" :class="row.message.from === meId && !row.message.failed ? 'text-indigo-100' : 'text-slate-400'">
              <time :datetime="row.message.createdAt">{{ formatTime(row.message.createdAt) }}</time>
              <template v-if="row.message.pending"> · envoi…</template>
              <template v-else-if="row.message.from === meId && !row.message.failed && row.message.readAt"> · lu</template>
            </p>
            <div v-if="row.message.failed && row.message.tempId" class="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span role="alert">{{ row.message.errorText ?? 'Échec de l’envoi.' }}</span>
              <button type="button" class="font-semibold underline" @click="emit('retry', row.message.tempId)">Réessayer</button>
              <button type="button" class="underline" @click="emit('discard', row.message.tempId)">Supprimer</button>
            </div>
          </div>
        </div>
      </li>
    </ol>

    <p v-if="typing" class="text-xs text-slate-500 italic" aria-live="polite" data-testid="typing-indicator">
      {{ contactName }} est en train d’écrire…
    </p>
  </div>
</template>
