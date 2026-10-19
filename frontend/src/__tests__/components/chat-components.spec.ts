import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ConversationList from '@/components/chat/ConversationList.vue'
import MessageThread from '@/components/chat/MessageThread.vue'
import MessageComposer from '@/components/chat/MessageComposer.vue'
import type { Conversation } from '@/types/api'
import type { LocalMessage } from '@/stores/chat'

const me = 'me-id'
const other = 'other-id'

const conversations: Conversation[] = [
  {
    user: { id: other, firstName: 'Sara', lastName: 'R', avatarUrl: null },
    lastMessage: { text: 'Bonjour', createdAt: '2026-10-19T09:00:00.000Z', from: other },
    unreadCount: 3,
  },
]

describe('ConversationList', () => {
  it('affiche le badge de non-lus et la présence, émet select', async () => {
    const wrapper = mount(ConversationList, {
      props: { conversations, activeId: null, online: { [other]: true }, typing: {}, meId: me },
    })
    expect(wrapper.get(`[data-testid="unread-${other}"]`).text()).toContain('3')
    expect(wrapper.text()).toContain('En ligne')
    await wrapper.get(`[data-testid="conversation-${other}"]`).trigger('click')
    expect(wrapper.emitted('select')).toEqual([[other]])
  })

  it('montre « en train d’écrire… » à la place du dernier message', () => {
    const wrapper = mount(ConversationList, {
      props: { conversations, activeId: other, online: {}, typing: { [other]: true }, meId: me },
    })
    expect(wrapper.text()).toContain('en train d’écrire')
    expect(wrapper.find('[aria-current="true"]').exists()).toBe(true)
  })
})

describe('MessageThread', () => {
  const messages: LocalMessage[] = [
    { id: 'm1', from: other, to: me, text: '<b>gras</b>', createdAt: '2026-10-19T09:00:00.000Z', readAt: null },
    { id: 'm2', from: me, to: other, text: 'Réponse', createdAt: '2026-10-19T09:01:00.000Z', readAt: '2026-10-19T09:02:00.000Z' },
    {
      id: 'tmp-1',
      tempId: 'tmp-1',
      from: me,
      to: other,
      text: 'Échoué',
      createdAt: '2026-10-19T09:03:00.000Z',
      readAt: null,
      failed: true,
      errorText: 'Vous envoyez trop de messages.',
    },
  ]

  it('rend le texte échappé, l’état « lu » et l’indicateur de saisie', () => {
    const wrapper = mount(MessageThread, {
      props: { messages, meId: me, contactName: 'Sara R', typing: true, hasMore: false, loadingOlder: false },
    })
    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.text()).toContain('<b>gras</b>')
    expect(wrapper.text()).toContain('lu')
    expect(wrapper.get('[data-testid="typing-indicator"]').text()).toContain('Sara R est en train d’écrire')
    expect(wrapper.get('[role="log"]').attributes('aria-live')).toBe('polite')
  })

  it('message en échec : Réessayer / Supprimer ; bouton « messages précédents »', async () => {
    const wrapper = mount(MessageThread, {
      props: { messages, meId: me, contactName: 'Sara R', typing: false, hasMore: true, loadingOlder: false },
    })
    expect(wrapper.text()).toContain('Vous envoyez trop de messages.')
    await wrapper.findAll('button').find((b) => b.text() === 'Réessayer')!.trigger('click')
    await wrapper.findAll('button').find((b) => b.text() === 'Supprimer')!.trigger('click')
    await wrapper.findAll('button').find((b) => b.text().includes('précédents'))!.trigger('click')
    expect(wrapper.emitted('retry')).toEqual([['tmp-1']])
    expect(wrapper.emitted('discard')).toEqual([['tmp-1']])
    expect(wrapper.emitted('load-older')).toHaveLength(1)
  })
})

describe('MessageComposer', () => {
  it('Entrée envoie, Maj+Entrée non ; émet typing à la saisie', async () => {
    const wrapper = mount(MessageComposer)
    const textarea = wrapper.get('textarea')
    await textarea.setValue('Bonjour')
    expect(wrapper.emitted('typing')).toBeTruthy()
    await textarea.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(wrapper.emitted('send')).toBeUndefined()
    await textarea.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('send')).toEqual([['Bonjour']])
    expect((textarea.element as HTMLTextAreaElement).value).toBe('')
  })

  it('bouton désactivé pour un message vide ou si désactivé', async () => {
    const wrapper = mount(MessageComposer)
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ disabled: true })
    expect(wrapper.get('textarea').attributes('disabled')).toBeDefined()
  })
})
