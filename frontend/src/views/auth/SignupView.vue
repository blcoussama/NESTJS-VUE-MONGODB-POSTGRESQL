<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/api/errors'
import type { UserRole } from '@/types/api'
import { isEmail, passwordStrength, validatePassword } from '@/utils/validation'
import AuthCard from '@/components/layout/AuthCard.vue'
import FormField from '@/components/ui/FormField.vue'
import AlertMessage from '@/components/ui/AlertMessage.vue'

const auth = useAuthStore()

const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'candidate' as UserRole,
})
type Field = 'firstName' | 'lastName' | 'email' | 'password' | 'confirmPassword'
const errors = reactive<Record<Field, string | null>>({
  firstName: null,
  lastName: null,
  email: null,
  password: null,
  confirmPassword: null,
})
const serverError = ref<string | null>(null)
const submitting = ref(false)
const done = ref<string | null>(null)

const strength = computed(() => passwordStrength(form.password))

const roles: { value: UserRole; title: string; description: string }[] = [
  { value: 'candidate', title: 'Candidat', description: 'Je cherche un emploi ou un stage.' },
  { value: 'recruiter', title: 'Recruteur', description: 'Je publie des offres pour ma société.' },
]

function validate(): boolean {
  errors.firstName = form.firstName.trim() ? null : 'Prénom requis.'
  errors.lastName = form.lastName.trim() ? null : 'Nom requis.'
  errors.email = isEmail(form.email) ? null : 'Adresse e-mail invalide.'
  errors.password = validatePassword(form.password)
  errors.confirmPassword =
    form.confirmPassword === form.password ? null : 'Les mots de passe ne correspondent pas.'
  return Object.values(errors).every((e) => e === null)
}

async function submit() {
  serverError.value = null
  if (!validate() || submitting.value) return
  submitting.value = true
  try {
    const result = await auth.signup({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      password: form.password,
      role: form.role,
    })
    done.value = result?.message ?? 'Compte créé. Vérifiez votre boîte mail pour activer votre compte.'
  } catch (error) {
    serverError.value = errorMessage(error, 'Inscription impossible.')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthCard v-if="done" title="Vérifiez votre e-mail">
    <AlertMessage kind="success" title="Compte créé">
      <p>{{ done }}</p>
      <p class="mt-2">Un lien de vérification a été envoyé à <strong>{{ form.email }}</strong>. Il expire dans 24 heures.</p>
    </AlertMessage>
    <RouterLink to="/login" class="btn btn-primary mt-6 w-full">Aller à la connexion</RouterLink>
  </AuthCard>

  <AuthCard v-else title="Créer un compte" subtitle="Rejoignez PROFYLE en tant que candidat ou recruteur.">
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <AlertMessage v-if="serverError" kind="error">{{ serverError }}</AlertMessage>

      <fieldset>
        <legend class="label">Je suis…</legend>
        <div class="grid grid-cols-2 gap-3">
          <label
            v-for="option in roles"
            :key="option.value"
            class="flex cursor-pointer flex-col rounded-lg border p-3 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500"
            :class="form.role === option.value ? 'border-indigo-600 bg-indigo-50' : 'border-slate-300 bg-white hover:border-slate-400'"
          >
            <span class="flex items-center gap-2 font-semibold text-slate-900">
              <input v-model="form.role" type="radio" name="role" :value="option.value" class="accent-indigo-600" />
              {{ option.title }}
            </span>
            <span class="mt-1 text-xs text-slate-500">{{ option.description }}</span>
          </label>
        </div>
      </fieldset>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField v-slot="{ id, describedBy, invalid }" label="Prénom" :error="errors.firstName" required>
          <input :id="id" v-model="form.firstName" type="text" autocomplete="given-name" class="input" required :aria-invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
        <FormField v-slot="{ id, describedBy, invalid }" label="Nom" :error="errors.lastName" required>
          <input :id="id" v-model="form.lastName" type="text" autocomplete="family-name" class="input" required :aria-invalid="invalid" :aria-describedby="describedBy" />
        </FormField>
      </div>

      <FormField v-slot="{ id, describedBy, invalid }" label="Adresse e-mail" :error="errors.email" required>
        <input :id="id" v-model="form.email" type="email" autocomplete="email" class="input" required :aria-invalid="invalid" :aria-describedby="describedBy" />
      </FormField>

      <FormField
        v-slot="{ id, describedBy, invalid }"
        label="Mot de passe"
        :error="errors.password"
        hint="8 caractères minimum. Mélangez majuscules, chiffres et symboles."
        required
      >
        <input :id="id" v-model="form.password" type="password" autocomplete="new-password" class="input" required minlength="8" :aria-invalid="invalid" :aria-describedby="describedBy" />
      </FormField>
      <div v-if="form.password" class="flex items-center gap-2" aria-live="polite">
        <div class="flex flex-1 gap-1" aria-hidden="true">
          <span
            v-for="n in 4"
            :key="n"
            class="h-1.5 flex-1 rounded-full"
            :class="n <= strength.score ? (strength.score >= 3 ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-slate-200'"
          />
        </div>
        <span class="text-xs text-slate-600">Robustesse : {{ strength.label }}</span>
      </div>

      <FormField v-slot="{ id, describedBy, invalid }" label="Confirmer le mot de passe" :error="errors.confirmPassword" required>
        <input :id="id" v-model="form.confirmPassword" type="password" autocomplete="new-password" class="input" required :aria-invalid="invalid" :aria-describedby="describedBy" />
      </FormField>

      <button type="submit" class="btn btn-primary w-full" :disabled="submitting">
        {{ submitting ? 'Création…' : 'Créer mon compte' }}
      </button>
    </form>
    <template #footer>
      Déjà inscrit ? <RouterLink to="/login" class="link">Se connecter</RouterLink>
    </template>
  </AuthCard>
</template>
