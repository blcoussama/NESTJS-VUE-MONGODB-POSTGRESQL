import { http } from './http'
import type { ChatMessage, Conversation, MessagesPage } from '@/types/api'
import { MESSAGES_PAGE_SIZE } from '@/config'

export const chatApi = {
  async conversations(): Promise<Conversation[]> {
    const { data } = await http.get<Conversation[]>('/chat/conversations')
    return Array.isArray(data) ? data : []
  },

  async messages(
    otherUserId: string,
    cursor?: string | null,
    limit = MESSAGES_PAGE_SIZE,
  ): Promise<MessagesPage> {
    const params: Record<string, string | number> = { limit }
    if (cursor) params.cursor = cursor
    const { data } = await http.get<MessagesPage>(
      `/chat/messages/${encodeURIComponent(otherUserId)}`,
      { params },
    )
    return { items: Array.isArray(data?.items) ? data.items : [], nextCursor: data?.nextCursor ?? null }
  },

  async send(to: string, text: string): Promise<ChatMessage> {
    const { data } = await http.post<ChatMessage>('/chat/messages', { to, text })
    return data
  },

  async markRead(otherUserId: string): Promise<{ updated: number }> {
    const { data } = await http.patch<{ updated: number }>(
      `/chat/messages/${encodeURIComponent(otherUserId)}/read`,
    )
    return data
  },
}
