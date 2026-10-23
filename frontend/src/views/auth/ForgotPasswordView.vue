<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/api/errors'
import { isEmail } from '@/utils/validation'
import AuthCard from '@/components/layout/AuthCard.vue'
import FormField from '@/components/ui/FormField.vue'
import AlertMessage from '@/components/ui/AlertMessage.vue'

const auth = useAuthStore()
const email = ref('')
const fieldError = ref<string | null>(null)
const serverError = ref<string | null>(null)
const sent = ref<string | null>(null)
const submitting = ref(false)

async function submit() {
  serverError.value = null
  fieldError.value = isEmail(email.value) ? null : 'Adresse e-mail invalide.'
  if (fieldError.value || submitting.value) return
  submitting.value = true
  try {
    const result = await auth.forgotPassword(email.value.trim())
    sent.value = result?.message ?? 'Si cette adresse existe, un lien de réinitialisation a été envoyé.'
  } catch (error) {
    serverError.value = errorMessage(error, 'Envoi impossible.')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthCard title="Mot de passe oublié" subtitle="Recevez un lien de réinitialisation valable 1 heure.">
    <AlertMessage v-if="sent" kind="success">{{ sent }}</AlertMessage>
    <form v-else class="space-y-4" novalidate @submit.prevent="submit">
      <AlertMessage v-if="serverError" kind="error">{{ serverError }}</AlertMessage>
      <FormField v-slot="{ id, describedBy, invalid }" label="Adresse e-mail" :error="fieldError" required>
        <input :id="id" v-model="email" type="email" autocomplete="email" class="input" required :aria-invalid="invalid" :aria-describedby="describedBy" />
      </FormField>
      <button type="submit" class="btn btn-primary w-full" :disabled="submitting">
        {{ submitting ? 'Envoi…' : 'Envoyer le lien' }}
      </button>
    </form>
    <template #footer>
      <RouterLink to="/login" class="link">Retour à la connexion</RouterLink>
    </template>
  </AuthCard>
</template>
