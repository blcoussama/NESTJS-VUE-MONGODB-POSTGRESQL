<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/api/errors'
import AuthCard from '@/components/layout/AuthCard.vue'
import FormField from '@/components/ui/FormField.vue'
import AlertMessage from '@/components/ui/AlertMessage.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const token = ref(typeof route.query.token === 'string' ? route.query.token : '')
const state = ref<'idle' | 'verifying' | 'success' | 'error'>('idle')
const message = ref<string | null>(null)

async function verify() {
  const value = token.value.trim()
  if (!value || state.value === 'verifying') return
  state.value = 'verifying'
  message.value = null
  try {
    const result = await auth.verifyEmail(value)
    state.value = 'success'
    message.value = result?.message ?? 'Adresse e-mail vérifiée. Vous pouvez vous connecter.'
    // Remove the token from the address bar / history.
    void router.replace({ name: 'verify-email' })
  } catch (error) {
    state.value = 'error'
    message.value = errorMessage(error, 'Lien de vérification invalide ou expiré.')
  }
}

onMounted(() => {
  if (token.value) void verify()
})
</script>

<template>
  <AuthCard title="Vérification de l’e-mail">
    <AppSpinner v-if="state === 'verifying'" label="Vérification en cours…" />

    <template v-else-if="state === 'success'">
      <AlertMessage kind="success">{{ message }}</AlertMessage>
      <RouterLink to="/login" class="btn btn-primary mt-6 w-full">Se connecter</RouterLink>
    </template>

    <template v-else>
      <AlertMessage v-if="state === 'error'" kind="error" class="mb-4">{{ message }}</AlertMessage>
      <p class="text-sm text-slate-600">
        Ouvrez le lien reçu par e-mail après l’inscription. Vous pouvez aussi coller ici le code de
        vérification contenu dans ce lien.
      </p>
      <form class="mt-4 space-y-4" @submit.prevent="verify">
        <FormField v-slot="{ id, describedBy }" label="Code de vérification">
          <input :id="id" v-model="token" type="text" class="input" autocomplete="one-time-code" :aria-describedby="describedBy" />
        </FormField>
        <button type="submit" class="btn btn-primary w-full" :disabled="!token.trim()">Vérifier</button>
      </form>
    </template>
  </AuthCard>
</template>
