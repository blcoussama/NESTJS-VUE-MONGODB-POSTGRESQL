<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { errorMessage } from '@/api/errors'
import { isEmail } from '@/utils/validation'
import { safeRedirectPath } from '@/utils/url'
import AuthCard from '@/components/layout/AuthCard.vue'
import FormField from '@/components/ui/FormField.vue'
import AlertMessage from '@/components/ui/AlertMessage.vue'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()
const route = useRoute()

const form = reactive({ email: '', password: '' })
const errors = reactive<{ email: string | null; password: string | null }>({ email: null, password: null })
const serverError = ref<string | null>(null)
const submitting = ref(false)

function validate(): boolean {
  errors.email = isEmail(form.email) ? null : 'Adresse e-mail invalide.'
  errors.password = form.password ? null : 'Mot de passe requis.'
  return !errors.email && !errors.password
}

async function submit() {
  serverError.value = null
  if (!validate() || submitting.value) return
  submitting.value = true
  try {
    const user = await auth.login({ email: form.email.trim(), password: form.password })
    ui.success(`Bienvenue, ${user.firstName} !`)
    const target = safeRedirectPath(route.query.redirect) ?? auth.homeRoute
    await router.replace(target)
  } catch (error) {
    serverError.value = errorMessage(error, 'Connexion impossible.')
    form.password = ''
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthCard title="Connexion" subtitle="Accédez à vos offres, candidatures et messages.">
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <AlertMessage v-if="serverError" kind="error">{{ serverError }}</AlertMessage>

      <FormField v-slot="{ id, describedBy, invalid }" label="Adresse e-mail" :error="errors.email" required>
        <input
          :id="id"
          v-model="form.email"
          type="email"
          name="email"
          autocomplete="email"
          class="input"
          required
          :aria-invalid="invalid"
          :aria-describedby="describedBy"
        />
      </FormField>

      <FormField v-slot="{ id, describedBy, invalid }" label="Mot de passe" :error="errors.password" required>
        <input
          :id="id"
          v-model="form.password"
          type="password"
          name="password"
          autocomplete="current-password"
          class="input"
          required
          :aria-invalid="invalid"
          :aria-describedby="describedBy"
        />
      </FormField>

      <div class="flex justify-end">
        <RouterLink to="/forgot-password" class="link text-sm">Mot de passe oublié ?</RouterLink>
      </div>

      <button type="submit" class="btn btn-primary w-full" :disabled="submitting">
        {{ submitting ? 'Connexion…' : 'Se connecter' }}
      </button>
    </form>
    <template #footer>
      Pas encore de compte ?
      <RouterLink to="/signup" class="link">Créer un compte</RouterLink>
    </template>
  </AuthCard>
</template>
