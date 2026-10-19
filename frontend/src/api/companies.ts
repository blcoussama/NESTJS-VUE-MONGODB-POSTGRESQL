import { http } from './http'
import { fileForm } from './users'
import { asList } from './normalize'
import type { Company, CompanyPayload } from '@/types/api'

export const companiesApi = {
  async mine(): Promise<Company> {
    const { data } = await http.get<Company>('/companies/mine')
    return data
  },

  async list(): Promise<Company[]> {
    const { data } = await http.get<Company[]>('/companies')
    return asList(data)
  },

  async get(id: string): Promise<Company> {
    const { data } = await http.get<Company>(`/companies/${encodeURIComponent(id)}`)
    return data
  },

  async create(payload: CompanyPayload): Promise<Company> {
    const { data } = await http.post<Company>('/companies', payload)
    return data
  },

  async update(id: string, payload: Partial<CompanyPayload>): Promise<Company> {
    const { data } = await http.patch<Company>(`/companies/${encodeURIComponent(id)}`, payload)
    return data
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/companies/${encodeURIComponent(id)}`)
  },

  async uploadLogo(id: string, file: File): Promise<{ logoUrl: string }> {
    const { data } = await http.post<{ logoUrl: string }>(
      `/companies/${encodeURIComponent(id)}/logo`,
      fileForm(file),
    )
    return data
  },

  async deleteLogo(id: string): Promise<void> {
    await http.delete(`/companies/${encodeURIComponent(id)}/logo`)
  },
}
