<script setup lang="ts">
import type { Conversation } from '@/types/api'
import { formatChatTimestamp } from '@/utils/format'
import AvatarImage from '@/components/ui/AvatarImage.vue'

defineProps<{
  conversations: Conversation[]
  activeId: string | null
  online: Record<string, boolean>
  typing: Record<string, boolean>
  meId: string | null
}>()
const emit = defineEmits<{ select: [userId: string] }>()

function displayName(c: Conversation): string {
  return `${c.user.firstName} ${c.user.lastName}`.trim() || 'Utilisateur'
}
</script>

<template>
  <ul class="divide-y divide-slate-100" aria-label="Conversations">
    <li v-for="c in conversations" :key="c.user.id">
      <button
        type="button"
        class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 focus-visible:bg-slate-50"
        :class="{ 'bg-indigo-50 hover:bg-indigo-50': c.user.id === activeId }"
        :aria-current="c.user.id === activeId ? 'true' : undefined"
        :data-testid="`conversation-${c.user.id}`"
        @click="emit('select', c.user.id)"
      >
        <span class="relative">
          <AvatarImage :src="c.user.avatarUrl" :name="displayName(c)" />
          <span
            v-if="online[c.user.id]"
            class="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500"
            aria-hidden="true"
          />
        </span>
        <span class="min-w-0 flex-1">
          <span class="flex items-center justify-between gap-2">
            <span class="truncate font-medium text-slate-900" :class="{ 'font-semibold': c.unreadCount > 0 }">
              {{ displayName(c) }}
            </span>
            <time v-if="c.lastMessage" :datetime="c.lastMessage.createdAt" class="shrink-0 text-xs text-slate-400">
              {{ formatChatTimestamp(c.lastMessage.createdAt) }}
            </time>
          </span>
          <span class="flex items-center justify-between gap-2">
            <span v-if="typing[c.user.id]" class="truncate text-sm text-indigo-600 italic">en train d’écrire…</span>
            <span v-else class="truncate text-sm" :class="c.unreadCount > 0 ? 'text-slate-800' : 'text-slate-500'">
              <template v-if="c.lastMessage">
                {{ c.lastMessage.from === meId ? 'Vous : ' : '' }}{{ c.lastMessage.text }}
              </template>
              <template v-else>Nouvelle conversation</template>
            </span>
            <span
              v-if="c.unreadCount > 0"
              class="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-semibold text-white"
              :data-testid="`unread-${c.user.id}`"
            >
              {{ c.unreadCount }}<span class="sr-only"> message(s) non lu(s)</span>
            </span>
          </span>
          <span class="sr-only">{{ online[c.user.id] ? 'En ligne' : 'Hors ligne' }}</span>
        </span>
      </button>
    </li>
  </ul>
</template>
