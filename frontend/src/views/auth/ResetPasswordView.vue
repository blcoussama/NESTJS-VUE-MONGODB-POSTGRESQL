<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/api/errors'
import { validatePassword } from '@/utils/validation'
import AuthCard from '@/components/layout/AuthCard.vue'
import FormField from '@/components/ui/FormField.vue'
import AlertMessage from '@/components/ui/AlertMessage.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const form = reactive({
  token: typeof route.query.token === 'string' ? route.query.token : '',
  password: '',
  confirm: '',
})
const errors = reactive<{ token: string | null; password: string | null; confirm: string | null }>({
  token: null,
  password: null,
  confirm: null,
})
const serverError = ref<string | null>(null)
const success = ref<string | null>(null)
const submitting = ref(false)
const tokenFromLink = Boolean(form.token)

onMounted(() => {
  // Keep the token in memory only: remove it from the URL / history.
  if (tokenFromLink) void router.replace({ name: 'reset-password' })
})

async function submit() {
  serverError.value = null
  errors.token = form.token.trim() ? null : 'Code de réinitialisation requis.'
  errors.password = validatePassword(form.password)
  errors.confirm = form.confirm === form.password ? null : 'Les mots de passe ne correspondent pas.'
  if (errors.token || errors.password || errors.confirm || submitting.value) return
  submitting.value = true
  try {
    const result = await auth.resetPassword(form.token.trim(), form.password)
    success.value = result?.message ?? 'Mot de passe réinitialisé. Vous pouvez vous connecter.'
  } catch (error) {
    serverError.value = errorMessage(error, 'Lien invalide ou expiré.')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthCard title="Nouveau mot de passe">
    <template v-if="success">
      <AlertMessage kind="success">{{ success }}</AlertMessage>
      <RouterLink to="/login" class="btn btn-primary mt-6 w-full">Se connecter</RouterLink>
    </template>
    <form v-else class="space-y-4" novalidate @submit.prevent="submit">
      <AlertMessage v-if="serverError" kind="error">{{ serverError }}</AlertMessage>
      <FormField v-if="!tokenFromLink" v-slot="{ id, describedBy, invalid }" label="Code de réinitialisation" :error="errors.token" required>
        <input :id="id" v-model="form.token" type="text" class="input" autocomplete="one-time-code" :aria-invalid="invalid" :aria-describedby="describedBy" />
      </FormField>
      <FormField v-slot="{ id, describedBy, invalid }" label="Nouveau mot de passe" :error="errors.password" hint="8 caractères minimum." required>
        <input :id="id" v-model="form.password" type="password" autocomplete="new-password" class="input" :aria-invalid="invalid" :aria-describedby="describedBy" />
      </FormField>
      <FormField v-slot="{ id, describedBy, invalid }" label="Confirmer le mot de passe" :error="errors.confirm" required>
        <input :id="id" v-model="form.confirm" type="password" autocomplete="new-password" class="input" :aria-invalid="invalid" :aria-describedby="describedBy" />
      </FormField>
      <button type="submit" class="btn btn-primary w-full" :disabled="submitting">
        {{ submitting ? 'Enregistrement…' : 'Réinitialiser le mot de passe' }}
      </button>
    </form>
    <template #footer>
      <RouterLink to="/login" class="link">Retour à la connexion</RouterLink>
    </template>
  </AuthCard>
</template>
