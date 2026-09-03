import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { EmptyState, ErrorState, Spinner, InlineNotice } from './UI'
import { useAsyncData } from '../hooks/useAsyncData'
import * as Icon from './Icons'
import { ChatService } from '../services/messaging'
import { formatRelative, initials } from '../utils/format'
import { LIMITS } from '../utils/validation'
import { useReducedMotion, scrollBehavior } from '../hooks/useReducedMotion'

/**
 * A single conversation thread, shared by the customer and seller message
 * screens.
 *
 * Messages arrive over Supabase Realtime, history pages backwards on demand
 * rather than loading a whole thread at once, and read receipts are marked
 * when the thread is opened. Access is not enforced here — a conversation you
 * are not part of returns no rows at all.
 */
export function Conversation({ conversation, currentUserId, onBack }) {
  const reducedMotion = useReducedMotion()

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sendError, setSendError] = useState(null)

  const bottomRef = useRef(null)

  const { status, data, error, retry, setData } = useAsyncData(
    useCallback(async () => {
      const page = await ChatService.listMessages(conversation.id)
      // Opening a thread is what marks it read; doing it here keeps the
      // receipt tied to the fetch rather than to a separate effect.
      ChatService.markRead(conversation.id, currentUserId)
      return page
    }, [conversation.id, currentUserId])
  )

  // Memoised so the scroll-to-bottom effect below does not see a new array
  // identity on every render.
  const messages = useMemo(() => data?.messages ?? [], [data])
  const hasMore = data?.hasMore ?? false

  // Live delivery. The guard keeps a message you just sent from appearing
  // twice when the realtime echo arrives after the insert response.
  useEffect(() => {
    return ChatService.subscribe(conversation.id, (incoming) => {
      setData((current) => {
        const existing = current?.messages ?? []
        if (existing.some((m) => m.id === incoming.id)) return current
        return { ...current, messages: [...existing, incoming] }
      })
      if (incoming.sender_id !== currentUserId) {
        ChatService.markRead(conversation.id, currentUserId)
      }
    })
  }, [conversation.id, currentUserId, setData])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: scrollBehavior(reducedMotion) })
  }, [messages, reducedMotion])

  const loadOlder = async () => {
    if (messages.length === 0) return
    setLoadingMore(true)
    try {
      const page = await ChatService.listMessages(conversation.id, { before: messages[0].created_at })
      setData((current) => ({
        messages: [...page.messages, ...(current?.messages ?? [])],
        hasMore: page.hasMore,
      }))
    } catch (err) {
      setSendError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }

  const send = async (event) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body || sending) return

    setSending(true)
    setDraft('')
    setSendError(null)
    try {
      const message = await ChatService.send(conversation.id, currentUserId, body)
      setData((current) => {
        const existing = current?.messages ?? []
        if (existing.some((m) => m.id === message.id)) return current
        return { ...current, messages: [...existing, message] }
      })
    } catch (err) {
      // Put the text back so nothing the person typed is lost.
      setDraft(body)
      setSendError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <header
        style={{
          display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px',
          borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0,
        }}
      >
        {onBack && (
          <button type="button" className="icon-btn only-mobile" onClick={onBack} aria-label="Back to conversations">
            <Icon.ArrowLeft size={18} />
          </button>
        )}
        <span
          style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: 'var(--accent)', color: '#fff', display: 'grid',
            placeItems: 'center', fontWeight: 700, fontSize: '0.8125rem',
          }}
        >
          {initials(conversation.counterpartName)}
        </span>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{conversation.counterpartName}</p>
          <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>
            {conversation.lastMessageAt ? `Active ${formatRelative(conversation.lastMessageAt)}` : 'New conversation'}
          </p>
        </div>
      </header>

      <div
        style={{
          flex: 1, overflowY: 'auto', padding: 16,
          display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0,
        }}
      >
        {status === 'loading' && <Spinner label="Loading messages" />}

        {status === 'error' && (
          <ErrorState title="We couldn't load this conversation" description={error} onRetry={retry} />
        )}

        {status === 'ready' && (
          <>
            {hasMore && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={loadOlder}
                disabled={loadingMore}
                style={{ alignSelf: 'center' }}
              >
                {loadingMore ? <span className="spinner" aria-hidden="true" /> : null}
                {loadingMore ? 'Loading…' : 'Load earlier messages'}
              </button>
            )}

            {messages.length === 0 && (
              <EmptyState
                icon={Icon.Chat}
                title={`Start the conversation with ${conversation.counterpartName}`}
                description="Ask about availability, delivery or anything else about the products."
              />
            )}

            <AnimatePresence initial={false}>
              {messages.map((message) => {
                const mine = message.sender_id === currentUserId
                return (
                  <motion.div
                    key={message.id}
                    layout
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}
                  >
                    <div
                      style={{
                        maxWidth: 'min(74%, 460px)', padding: '9px 13px',
                        borderRadius: mine ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                        background: mine ? 'var(--accent)' : 'var(--surface-raised)',
                        color: mine ? 'var(--on-accent)' : 'var(--text)',
                        border: mine ? 'none' : '1px solid var(--border)',
                        fontSize: '0.9375rem', lineHeight: 1.5, wordBreak: 'break-word',
                      }}
                    >
                      {message.body}
                      <p
                        style={{
                          fontSize: '0.6875rem', opacity: 0.7, marginTop: 3,
                          textAlign: 'right', display: 'flex', gap: 4,
                          justifyContent: 'flex-end', alignItems: 'center',
                        }}
                      >
                        {formatRelative(message.created_at)}
                        {mine && message.read_at && <Icon.Check size={11} />}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {sendError && (
        <div style={{ padding: '10px 12px 0', flexShrink: 0 }}>
          <InlineNotice tone="danger" title="Message not sent">{sendError}</InlineNotice>
        </div>
      )}

      <form
        onSubmit={send}
        style={{
          display: 'flex', gap: 8, padding: 12, flexShrink: 0,
          borderTop: '1px solid var(--border)', background: 'var(--surface)',
        }}
      >
        <label htmlFor="message-input" className="sr-only">Message</label>
        <input
          id="message-input"
          className="input"
          value={draft}
          maxLength={LIMITS.messageMax}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${conversation.counterpartName}…`}
          style={{ flex: 1 }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!draft.trim() || sending}
          aria-label="Send message"
          style={{ width: 46, padding: 0 }}
        >
          {sending ? <span className="spinner" aria-hidden="true" /> : <Icon.Send size={17} />}
        </button>
      </form>
    </div>
  )
}

/** The conversation list beside a thread, or on its own on mobile. */
export function ConversationList({ conversations, activeId, onSelect, emptyMessage }) {
  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={Icon.Chat}
        title="No conversations yet"
        description={emptyMessage}
      />
    )
  }

  return (
    <ul>
      {conversations.map((conversation) => (
        <li key={conversation.id}>
          <button
            type="button"
            onClick={() => onSelect(conversation)}
            aria-current={conversation.id === activeId}
            style={{
              display: 'flex', gap: 11, alignItems: 'center', width: '100%',
              padding: '13px 15px', textAlign: 'left', minHeight: 64,
              borderBottom: '1px solid var(--border)',
              background: conversation.id === activeId ? 'var(--accent-wash)' : 'transparent',
              transition: 'background 140ms',
            }}
          >
            <span
              style={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                background: 'var(--surface-hover)', color: 'var(--accent-soft)',
                display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '0.8125rem',
              }}
            >
              {initials(conversation.counterpartName)}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: 'block', fontWeight: conversation.unread ? 700 : 600,
                  fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {conversation.counterpartName}
              </span>
              <span style={{ display: 'block', color: 'var(--text-subtle)', fontSize: '0.75rem' }}>
                {formatRelative(conversation.lastMessageAt)}
              </span>
            </span>
            {conversation.unread > 0 && (
              <span
                style={{
                  minWidth: 19, height: 19, padding: '0 5px', borderRadius: 'var(--radius-pill)',
                  background: 'var(--accent)', color: '#fff', fontSize: '0.6875rem',
                  fontWeight: 700, display: 'grid', placeItems: 'center',
                }}
              >
                {conversation.unread}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
