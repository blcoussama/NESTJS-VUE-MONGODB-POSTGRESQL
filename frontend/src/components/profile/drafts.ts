import type { Education, Experience } from '@/types/api'
import { toDateInput } from '@/utils/format'
import { emptyToNull } from '@/utils/validation'

export interface ExperienceDraft {
  title: string
  company: string
  location: string
  startDate: string
  endDate: string
  current: boolean
  description: string
}

export interface EducationDraft {
  school: string
  degree: string
  field: string
  startDate: string
  endDate: string
  current: boolean
}

export type DraftErrors = Record<number, Record<string, string>>

export const emptyExperience = (): ExperienceDraft => ({
  title: '',
  company: '',
  location: '',
  startDate: '',
  endDate: '',
  current: false,
  description: '',
})

export const emptyEducation = (): EducationDraft => ({
  school: '',
  degree: '',
  field: '',
  startDate: '',
  endDate: '',
  current: false,
})

export function experienceToDraft(e: Experience): ExperienceDraft {
  return {
    title: e.title ?? '',
    company: e.company ?? '',
    location: e.location ?? '',
    startDate: toDateInput(e.startDate),
    endDate: toDateInput(e.endDate ?? null),
    current: Boolean(e.current),
    description: e.description ?? '',
  }
}

export function educationToDraft(e: Education): EducationDraft {
  return {
    school: e.school ?? '',
    degree: e.degree ?? '',
    field: e.field ?? '',
    startDate: toDateInput(e.startDate),
    endDate: toDateInput(e.endDate ?? null),
    current: Boolean(e.current),
  }
}

function checkDates(start: string, end: string, current: boolean, errors: Record<string, string>) {
  if (!start) errors.startDate = 'Date de début requise.'
  if (!current && end && start && end < start) errors.endDate = 'La date de fin précède la date de début.'
}

export function validateExperiences(list: ExperienceDraft[]): DraftErrors {
  const result: DraftErrors = {}
  list.forEach((e, index) => {
    const errors: Record<string, string> = {}
    if (!e.title.trim()) errors.title = 'Intitulé requis.'
    if (!e.company.trim()) errors.company = 'Entreprise requise.'
    checkDates(e.startDate, e.endDate, e.current, errors)
    if (Object.keys(errors).length) result[index] = errors
  })
  return result
}

export function validateEducation(list: EducationDraft[]): DraftErrors {
  const result: DraftErrors = {}
  list.forEach((e, index) => {
    const errors: Record<string, string> = {}
    if (!e.school.trim()) errors.school = 'Établissement requis.'
    if (!e.degree.trim()) errors.degree = 'Diplôme requis.'
    checkDates(e.startDate, e.endDate, e.current, errors)
    if (Object.keys(errors).length) result[index] = errors
  })
  return result
}

export function draftToExperience(d: ExperienceDraft): Experience {
  return {
    title: d.title.trim(),
    company: d.company.trim(),
    location: emptyToNull(d.location),
    startDate: d.startDate,
    endDate: d.current ? null : emptyToNull(d.endDate),
    current: d.current,
    description: emptyToNull(d.description),
  }
}

export function draftToEducation(d: EducationDraft): Education {
  return {
    school: d.school.trim(),
    degree: d.degree.trim(),
    field: emptyToNull(d.field),
    startDate: d.startDate,
    endDate: d.current ? null : emptyToNull(d.endDate),
    current: d.current,
  }
}
