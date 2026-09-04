import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const channels = []

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    channel(topic) {
      const existing = channels.find((c) => c.topic === topic)
      if (existing) return existing
      const created = { topic, bindings: [], removed: false }
      created.on = (type, filter, callback) => {
        const duplicate = created.bindings.some(
          (b) => JSON.stringify(b.filter) === JSON.stringify(filter)
        )
        if (!duplicate) created.bindings.push({ type, filter, callback })
        return created
      }
      created.subscribe = () => created
      channels.push(created)
      return created
    },
    removeChannel(channel) {
      channel.removed = true
    },
  },
  isConfigured: false,
  publicUrl: () => null,
  productImageUrl: () => null,
}))

const { ChatService, NotificationService } = await import('../src/services/messaging')

const root = resolve(import.meta.dirname, '..')
const accountsSource = readFileSync(resolve(root, 'src/services/accounts.js'), 'utf8')
const coreSchema = readFileSync(resolve(root, 'supabase/migrations/0001_core_schema.sql'), 'utf8')

describe('realtime channel topics', () => {
  beforeEach(() => {
    channels.length = 0
  })

  it('gives two notification subscribers for one user separate channels', () => {
    const navbar = vi.fn()
    const page = vi.fn()

    NotificationService.subscribe('user-1', navbar)
    NotificationService.subscribe('user-1', page)

    expect(channels).toHaveLength(2)
    expect(channels[0].topic).not.toBe(channels[1].topic)
    expect(channels[0].bindings).toHaveLength(1)
    expect(channels[1].bindings).toHaveLength(1)
  })

  it('delivers an insert to every notification subscriber for that user', () => {
    const navbar = vi.fn()
    const page = vi.fn()

    NotificationService.subscribe('user-1', navbar)
    NotificationService.subscribe('user-1', page)

    for (const channel of channels) {
      channel.bindings[0].callback({ new: { id: 'n1' } })
    }

    expect(navbar).toHaveBeenCalledWith({ id: 'n1' })
    expect(page).toHaveBeenCalledWith({ id: 'n1' })
  })

  it('unsubscribing one notification listener leaves the other subscribed', () => {
    const stopNavbar = NotificationService.subscribe('user-1', vi.fn())
    NotificationService.subscribe('user-1', vi.fn())

    stopNavbar()

    expect(channels[0].removed).toBe(true)
    expect(channels[1].removed).toBe(false)
  })

  it('keeps the notification filter scoped to the subscribing user', () => {
    NotificationService.subscribe('user-42', vi.fn())

    expect(channels[0].bindings[0].filter).toEqual({
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: 'user_id=eq.user-42',
    })
  })

  it('gives remounted conversation subscribers separate channels', () => {
    const stopFirst = ChatService.subscribe('conversation-1', vi.fn())
    ChatService.subscribe('conversation-1', vi.fn())
    stopFirst()

    expect(channels).toHaveLength(2)
    expect(channels[0].topic).not.toBe(channels[1].topic)
    expect(channels[1].bindings).toHaveLength(1)
    expect(channels[1].removed).toBe(false)
  })

  it('keeps the message filter scoped to the conversation', () => {
    ChatService.subscribe('conversation-9', vi.fn())

    expect(channels[0].bindings[0].filter).toEqual({
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: 'conversation_id=eq.conversation-9',
    })
  })
})

describe('seller to profile embeds', () => {
  it('sellers really does hold two foreign keys to profiles', () => {
    const table = coreSchema.match(/create table if not exists public\.sellers \(([\s\S]*?)\n\);/)
    expect(table).not.toBeNull()

    const references = table[1]
      .split('\n')
      .filter((line) => /references public\.profiles\(id\)/.test(line))
      .map((line) => line.trim().split(/\s+/)[0])

    expect(references).toEqual(['id', 'approved_by'])
  })

  it('names the owner relationship on every seller embed of profiles', () => {
    const embeds = accountsSource.match(/profiles[^\s(]*\s*\([^)]*\)/g) ?? []
    const sellerEmbeds = embeds.filter((embed) => embed.includes('!'))

    expect(sellerEmbeds).toHaveLength(2)
    for (const embed of sellerEmbeds) {
      expect(embed.startsWith('profiles!sellers_id_fkey')).toBe(true)
    }
  })

  it('leaves no bare profiles embed inside a sellers query', () => {
    const sellerQueries = accountsSource.match(/\.from\('sellers'\)[\s\S]*?`\)/g) ?? []

    expect(sellerQueries).toHaveLength(2)
    for (const query of sellerQueries) {
      expect(query).toMatch(/profiles!sellers_id_fkey/)
      expect(query).not.toMatch(/\bprofiles\s*\(/)
    }
  })
})
