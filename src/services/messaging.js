import { supabase } from '../lib/supabase'
import { assertOk } from '../lib/errors'

let channelSequence = 0

function uniqueTopic(prefix) {
  channelSequence += 1
  return `${prefix}:${channelSequence}`
}

export const ChatService = {

  async openWithSeller(sellerId) {
    const { data, error } = await supabase.rpc('get_or_create_conversation', {
      p_seller_id: sellerId,
    })
    assertOk(error, 'open conversation')
    return data
  },

  async listConversations(userId) {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id, customer_id, seller_id, last_message_at,
        customer:profiles!conversations_customer_id_fkey ( full_name ),
        store:sellers!conversations_seller_id_fkey ( store_name )
      `)
      .order('last_message_at', { ascending: false })
    assertOk(error, 'load conversations')

    const rows = data ?? []
    if (rows.length === 0) return []

    const { data: unread } = await supabase
      .from('messages')
      .select('conversation_id')
      .is('read_at', null)
      .neq('sender_id', userId)
      .in('conversation_id', rows.map((r) => r.id))

    const unreadByConversation = new Map()
    for (const m of unread ?? []) {
      unreadByConversation.set(m.conversation_id, (unreadByConversation.get(m.conversation_id) ?? 0) + 1)
    }

    return rows.map((c) => ({
      id: c.id,
      customerId: c.customer_id,
      sellerId: c.seller_id,
      customerName: c.customer?.full_name ?? 'Customer',
      storeName: c.store?.store_name ?? 'Store',

      counterpartName: c.customer_id === userId
        ? (c.store?.store_name ?? 'Store')
        : (c.customer?.full_name ?? 'Customer'),
      lastMessageAt: c.last_message_at,
      unread: unreadByConversation.get(c.id) ?? 0,
    }))
  },

  async listMessages(conversationId, { limit = 30, before = null } = {}) {
    let q = supabase
      .from('messages')
      .select('id, conversation_id, sender_id, body, read_at, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) q = q.lt('created_at', before)

    const { data, error } = await q
    assertOk(error, 'load messages')
    const rows = (data ?? []).slice().reverse()
    return { messages: rows, hasMore: (data ?? []).length === limit }
  },

  async send(conversationId, senderId, body) {
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: senderId, body: body.trim() })
      .select('id, conversation_id, sender_id, body, read_at, created_at')
      .single()
    assertOk(error, 'send message')
    return data
  },

  async markRead(conversationId, userId) {
    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .is('read_at', null)

    if (error && import.meta.env.DEV) console.warn('[shop-mumu] mark read:', error.message)
  },

  subscribe(conversationId, onMessage) {
    const channel = supabase
      .channel(uniqueTopic(`conversation:${conversationId}`))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => onMessage(payload.new)
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  },
}

export const NotificationService = {
  async list(userId, { limit = 40 } = {}) {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, kind, title, body, link, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    assertOk(error, 'load notifications')
    return data ?? []
  },

  async unreadCount(userId) {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    if (error) return 0
    return count ?? 0
  },

  async markRead(id) {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    assertOk(error, 'mark notification read')
  },

  async markAllRead(userId) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    assertOk(error, 'mark notifications read')
  },

  subscribe(userId, onNotification) {
    const channel = supabase
      .channel(uniqueTopic(`notifications:${userId}`))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => onNotification(payload.new)
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  },
}
