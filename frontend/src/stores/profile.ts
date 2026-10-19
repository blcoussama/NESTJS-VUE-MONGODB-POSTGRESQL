import { defineStore } from 'pinia'
import { ref } from 'vue'
import { usersApi } from '@/api/users'
import { errorMessage } from '@/api/errors'
import { safeHttpUrl } from '@/utils/url'
import { useAuthStore } from './auth'
import type { UpdateProfilePayload, UserProfile } from '@/types/api'

/** Full profile of the current user (`GET|PATCH /users/me`, avatar, CV). */
export const useProfileStore = defineStore('profile', () => {
  const profile = ref<UserProfile | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetch(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      profile.value = await usersApi.me()
    } catch (err) {
      error.value = errorMessage(err, 'Impossible de charger votre profil.')
    } finally {
      loading.value = false
    }
  }

  async function update(payload: UpdateProfilePayload): Promise<UserProfile> {
    const updated = await usersApi.updateMe(payload)
    profile.value = updated
    useAuthStore().patchUser(updated)
    return updated
  }

  async function uploadAvatar(file: File): Promise<void> {
    const { avatarUrl } = await usersApi.uploadAvatar(file)
    if (profile.value) profile.value = { ...profile.value, avatarUrl }
    useAuthStore().patchUser({ avatarUrl })
  }

  async function deleteAvatar(): Promise<void> {
    await usersApi.deleteAvatar()
    if (profile.value) profile.value = { ...profile.value, avatarUrl: null }
    useAuthStore().patchUser({ avatarUrl: null })
  }

  async function uploadCv(file: File): Promise<void> {
    await usersApi.uploadCv(file)
    if (profile.value) profile.value = { ...profile.value, hasCv: true }
  }

  async function deleteCv(): Promise<void> {
    await usersApi.deleteCv()
    if (profile.value) profile.value = { ...profile.value, hasCv: false }
  }

  async function getCvUrl(): Promise<string> {
    const { url } = await usersApi.cvUrl()
    const safe = safeHttpUrl(url)
    if (!safe) throw new Error('URL de CV invalide.')
    return safe
  }

  function reset(): void {
    profile.value = null
    error.value = null
  }

  return { profile, loading, error, fetch, update, uploadAvatar, deleteAvatar, uploadCv, deleteCv, getCvUrl, reset }
})
