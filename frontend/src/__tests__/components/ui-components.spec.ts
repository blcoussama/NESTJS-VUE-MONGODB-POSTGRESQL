import { describe, expect, it } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import ExternalLink from '@/components/ui/ExternalLink.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import AvatarImage from '@/components/ui/AvatarImage.vue'
import FormField from '@/components/ui/FormField.vue'
import JobCard from '@/components/jobs/JobCard.vue'
import ApplyForm from '@/components/jobs/ApplyForm.vue'
import { makeJob } from '../helpers'
import type { Job } from '@/types/api'

describe('PaginationBar', () => {
  it('émet la page choisie et marque la page courante (aria-current)', async () => {
    const wrapper = mount(PaginationBar, { props: { page: 2, totalPages: 5 } })
    expect(wrapper.get('[aria-current="page"]').text()).toBe('2')
    await wrapper.get('button[aria-label="Page suivante"]').trigger('click')
    await wrapper.get('button[aria-label="Page 5"]').trigger('click')
    expect(wrapper.emitted('update:page')).toEqual([[3], [5]])
  })

  it('masquée s’il n’y a qu’une page', () => {
    expect(mount(PaginationBar, { props: { page: 1, totalPages: 1 } }).find('nav').exists()).toBe(false)
  })
})

describe('ExternalLink', () => {
  it('ajoute target=_blank et rel="noopener noreferrer"', () => {
    const a = mount(ExternalLink, { props: { href: 'https://github.com/blcoussama' } }).get('a')
    expect(a.attributes('target')).toBe('_blank')
    expect(a.attributes('rel')).toBe('noopener noreferrer')
  })

  it('n’affiche jamais un lien javascript:', () => {
    const wrapper = mount(ExternalLink, { props: { href: 'javascript:alert(1)' } })
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.text()).toContain('javascript:alert(1)')
  })
})

describe('StatusBadge / AvatarImage / FormField', () => {
  it('StatusBadge affiche le libellé français', () => {
    expect(mount(StatusBadge, { props: { status: 'ACCEPTED' } }).text()).toBe('Acceptée')
  })

  it('AvatarImage : initiales en repli et src non-http ignoré', () => {
    const wrapper = mount(AvatarImage, { props: { name: 'Oussama Belcadi', src: 'javascript:alert(1)' } })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('OB')
  })

  it('FormField relie label, champ et message d’erreur (aria-describedby)', () => {
    const wrapper = mount(FormField, {
      props: { label: 'E-mail', error: 'Adresse invalide' },
      slots: {
        default: `<template #default="{ id, describedBy, invalid }"><input :id="id" :aria-describedby="describedBy" :aria-invalid="invalid" /></template>`,
      },
    })
    const input = wrapper.get('input')
    const label = wrapper.get('label')
    expect(label.attributes('for')).toBe(input.attributes('id'))
    const errorId = input.attributes('aria-describedby')
    expect(wrapper.get(`#${errorId}`).text()).toBe('Adresse invalide')
    expect(input.attributes('aria-invalid')).toBe('true')
  })
})

describe('JobCard', () => {
  const stubs = { RouterLink: RouterLinkStub }

  it('affiche les données de l’API en texte (aucune interprétation HTML)', () => {
    const job = makeJob({ title: '<img src=x onerror=alert(1)>Dev', description: '<script>alert(1)</script>' }) as Job
    const wrapper = mount(JobCard, { props: { job }, global: { stubs } })
    expect(wrapper.find('img[src="x"]').exists()).toBe(false)
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>Dev')
    expect(wrapper.text()).toContain('Temps plein')
    expect(wrapper.getComponent(RouterLinkStub).props('to')).toBe(`/jobs/${job.id}`)
  })

  it('bouton favori : visible pour un candidat, émet toggle-save, aria-pressed', async () => {
    const job = makeJob() as Job
    const wrapper = mount(JobCard, { props: { job, canSave: true, saved: true }, global: { stubs } })
    const button = wrapper.get('button')
    expect(button.attributes('aria-pressed')).toBe('true')
    await button.trigger('click')
    expect(wrapper.emitted('toggle-save')).toEqual([[job.id]])
  })

  it('pas de bouton favori sinon', () => {
    const wrapper = mount(JobCard, { props: { job: makeJob() as Job }, global: { stubs } })
    expect(wrapper.find('button').exists()).toBe(false)
  })
})

describe('ApplyForm', () => {
  it('refuse un nombre d’années invalide', async () => {
    const wrapper = mount(ApplyForm)
    await wrapper.get('input[name="experienceYears"]').setValue('-2')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toMatch(/nombre entier/)
  })

  it('émet { experienceYears: entier, experienceLevel }', async () => {
    const wrapper = mount(ApplyForm, { props: { defaultLevel: 'mid' } })
    await wrapper.get('input[name="experienceYears"]').setValue('3')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]).toEqual([{ experienceYears: 3, experienceLevel: 'mid' }])
  })
})
