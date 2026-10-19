<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import AlertMessage from '@/components/ui/AlertMessage.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import AvatarImage from '@/components/ui/AvatarImage.vue'
import ConversationList from '@/components/chat/ConversationList.vue'
import MessageThread from '@/components/chat/MessageThread.vue'
import MessageComposer from '@/components/chat/MessageComposer.vue'

const chat = useChatStore()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const {
  sortedConversations,
  conversationsLoaded,
  conversationsLoading,
  conversationsError,
  activeUserId,
  activeThread,
  activeContact,
  typing,
  online,
  status,
  sendError,
} = storeToRefs(chat)

const meId = computed(() => auth.user?.id ?? null)
const contactName = computed(() =>
  activeContact.value
    ? `${activeContact.value.firstName} ${activeContact.value.lastName}`.trim()
    : 'votre interlocuteur',
)

const statusLabel = computed(
  () =>
    ({
      connected: 'Connecté en temps réel',
      connecting: 'Connexion…',
      reconnecting: 'Reconnexion…',
      disconnected: 'Hors ligne (envoi via l’API)',
      error: 'Connexion temps réel indisponible',
    })[status.value],
)

/** `/chat?with=<userId>&name=<display name>` opens (or starts) a conversation. */
async function openFromQuery() {
  const withId = typeof route.query.with === 'string' ? route.query.with : null
  if (!withId) return
  const name = typeof route.query.name === 'string' ? route.query.name.slice(0, 80) : 'Contact'
  const [firstName = name, ...rest] = name.split(' ')
  await chat.openConversation(withId, { id: withId, firstName, lastName: rest.join(' '), avatarUrl: null })
}

onMounted(async () => {
  if (!chat.conversationsLoaded) await chat.fetchConversations()
  await openFromQuery()
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  chat.closeConversation()
  document.removeEventListener('visibilitychange', onVisibility)
})

watch(() => route.query.with, () => void openFromQuery())

function onVisibility() {
  if (document.visibilityState === 'visible' && activeUserId.value) void chat.markRead(activeUserId.value)
}

function select(userId: string) {
  void router.replace({ name: 'chat', query: {} })
  void chat.openConversation(userId)
}

function back() {
  chat.closeConversation()
  void router.replace({ name: 'chat', query: {} })
}

async function send(text: string) {
  if (!activeUserId.value) return
  await chat.sendMessage(activeUserId.value, text)
}

function onTyping() {
  if (activeUserId.value) chat.userTyping(activeUserId.value)
}
</script>

<template>
  <section aria-labelledby="chat-title" class="space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-2">
      <h1 id="chat-title" class="page-title">Messages</h1>
      <p class="flex items-center gap-2 text-xs text-slate-500" role="status">
        <span
          class="h-2 w-2 rounded-full"
          :class="{
            'bg-emerald-500': status === 'connected',
            'bg-amber-400': status === 'connecting' || status === 'reconnecting',
            'bg-slate-400': status === 'disconnected',
            'bg-red-500': status === 'error',
          }"
          aria-hidden="true"
        />
        {{ statusLabel }}
        <button v-if="status === 'error'" type="button" class="link" @click="chat.reconnect()">Réessayer</button>
      </p>
    </header>

    <p class="text-sm text-slate-500">
      Les échanges sont possibles entre un recruteur et un candidat ayant postulé à l’une de ses offres.
    </p>

    <div class="grid h-[70vh] min-h-[28rem] grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:grid-cols-3">
      <!-- Conversations -->
      <div class="flex flex-col overflow-hidden border-slate-200 md:border-r" :class="{ 'hidden md:flex': activeUserId }">
        <h2 class="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Conversations</h2>
        <div class="flex-1 overflow-y-auto">
          <AppSpinner v-if="conversationsLoading && !conversationsLoaded" size="sm" label="Chargement…" />
          <div v-else-if="conversationsError" class="p-4">
            <AlertMessage kind="error">
              {{ conversationsError }}
              <template #actions>
                <button type="button" class="btn btn-secondary btn-sm" @click="chat.fetchConversations()">Réessayer</button>
              </template>
            </AlertMessage>
          </div>
          <p v-else-if="sortedConversations.length === 0" class="p-4 text-sm text-slate-500">
            Aucune conversation pour le moment.
          </p>
          <ConversationList
            v-else
            :conversations="sortedConversations"
            :active-id="activeUserId"
            :online="online"
            :typing="typing"
            :me-id="meId"
            @select="select"
          />
        </div>
      </div>

      <!-- Thread -->
      <div class="flex flex-col overflow-hidden bg-slate-50 md:col-span-2" :class="{ 'hidden md:flex': !activeUserId }">
        <template v-if="activeUserId && activeThread">
          <div class="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <button type="button" class="btn btn-ghost btn-sm md:hidden" aria-label="Retour aux conversations" @click="back">←</button>
            <AvatarImage :src="activeContact?.avatarUrl" :name="contactName" size="sm" />
            <div class="min-w-0">
              <h2 class="truncate text-sm font-semibold text-slate-900">{{ contactName }}</h2>
              <p class="text-xs" :class="online[activeUserId] ? 'text-emerald-600' : 'text-slate-400'">
                {{ online[activeUserId] ? 'En ligne' : 'Hors ligne' }}
              </p>
            </div>
          </div>

          <AppSpinner v-if="activeThread.loading && !activeThread.loaded" label="Chargement des messages…" />
          <div v-else-if="activeThread.error && !activeThread.loaded" class="p-4">
            <AlertMessage kind="error">
              {{ activeThread.error }}
              <template #actions>
                <button type="button" class="btn btn-secondary btn-sm" @click="chat.loadInitial(activeUserId)">Réessayer</button>
              </template>
            </AlertMessage>
          </div>
          <template v-else>
            <MessageThread
              :messages="activeThread.messages"
              :me-id="meId"
              :contact-name="contactName"
              :typing="Boolean(typing[activeUserId])"
              :has-more="activeThread.hasMore"
              :loading-older="activeThread.loadingOlder"
              @load-older="chat.loadOlder(activeUserId)"
              @retry="(tempId) => activeUserId && chat.retryMessage(activeUserId, tempId)"
              @discard="(tempId) => activeUserId && chat.discardMessage(activeUserId, tempId)"
            />
            <p v-if="activeThread.error" class="px-4 pb-2 text-xs text-red-600" role="alert">{{ activeThread.error }}</p>
            <p v-if="sendError" class="px-4 pb-2 text-xs text-red-600" role="alert">{{ sendError }}</p>
            <MessageComposer :disabled="!activeThread.loaded" @send="send" @typing="onTyping" />
          </template>
        </template>
        <div v-else class="flex flex-1 items-center justify-center p-6">
          <EmptyState title="Sélectionnez une conversation" description="Choisissez un contact dans la liste pour afficher l’historique." />
        </div>
      </div>
    </div>
  </section>
</template>
