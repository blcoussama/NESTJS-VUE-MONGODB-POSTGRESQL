import { defineStore } from 'pinia'
import { ref } from 'vue'
import { companiesApi } from '@/api/companies'
import { errorMessage, hasStatus } from '@/api/errors'
import type { Company, CompanyPayload } from '@/types/api'

/** The recruiter's own company (`GET /companies/mine`, 404 when none). */
export const useCompanyStore = defineStore('company', () => {
  const company = ref<Company | null>(null)
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let pending: Promise<void> | null = null

  function fetchMine(force = false): Promise<void> {
    if (loaded.value && !force) return Promise.resolve()
    if (pending) return pending
    loading.value = true
    error.value = null
    pending = (async () => {
      try {
        company.value = await companiesApi.mine()
        loaded.value = true
      } catch (err) {
        if (hasStatus(err, 404)) {
          company.value = null
          loaded.value = true
        } else {
          error.value = errorMessage(err, 'Impossible de charger votre société.')
        }
      } finally {
        loading.value = false
        pending = null
      }
    })()
    return pending
  }

  async function create(payload: CompanyPayload): Promise<Company> {
    const created = await companiesApi.create(payload)
    company.value = created
    loaded.value = true
    return created
  }

  async function update(payload: Partial<CompanyPayload>): Promise<Company> {
    if (!company.value) throw new Error('Aucune société à mettre à jour.')
    const updated = await companiesApi.update(company.value.id, payload)
    company.value = { ...company.value, ...updated }
    return company.value
  }

  async function remove(): Promise<void> {
    if (!company.value) return
    await companiesApi.remove(company.value.id)
    company.value = null
  }

  async function uploadLogo(file: File): Promise<void> {
    if (!company.value) throw new Error('Créez d’abord votre société.')
    const { logoUrl } = await companiesApi.uploadLogo(company.value.id, file)
    company.value = { ...company.value, logoUrl }
  }

  async function deleteLogo(): Promise<void> {
    if (!company.value) return
    await companiesApi.deleteLogo(company.value.id)
    company.value = { ...company.value, logoUrl: null }
  }

  function reset(): void {
    company.value = null
    loaded.value = false
    error.value = null
  }

  return { company, loaded, loading, error, fetchMine, create, update, remove, uploadLogo, deleteLogo, reset }
})
