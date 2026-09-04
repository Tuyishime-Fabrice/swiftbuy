import { useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { BarePageShell } from '../layouts/PageShell'
import { Conversation, ConversationList } from '../components/Conversation'
import { ErrorState, Spinner, EmptyState } from '../components/UI'
import * as Icon from '../components/Icons'
import { useAuth } from '../context/auth-context'
import { ChatService } from '../services/messaging'
import { useAsyncData } from '../hooks/useAsyncData'

export default function Messages() {
  const { conversationId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const { status, data, error, retry } = useAsyncData(
    useCallback(() => ChatService.listConversations(user.id), [user.id])
  )

  const conversations = data ?? []
  const active = conversations.find((c) => c.id === conversationId) ?? null

  return (
    <BarePageShell title="Messages">
      <div
        className="container"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, paddingTop: 16, paddingBottom: 16 }}
      >
        <div
          style={{
            flex: 1, minHeight: 0, display: 'flex',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
            overflow: 'hidden', background: 'var(--surface)',
          }}
        >

          <div
            className={active ? 'only-desktop' : undefined}
            style={{
              width: active ? 300 : '100%',
              maxWidth: active ? 300 : undefined,
              flexShrink: 0,
              borderRight: active ? '1px solid var(--border)' : 'none',
              display: 'flex', flexDirection: 'column', minHeight: 0,
            }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <h1 style={{ fontSize: '1rem' }}>Messages</h1>
              <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>
                Your conversations with stores
              </p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {status === 'loading' && <Spinner label="Loading conversations" />}
              {status === 'error' && (
                <ErrorState title="We couldn't load your messages" description={error} onRetry={retry} />
              )}
              {status === 'ready' && (
                <ConversationList
                  conversations={conversations}
                  activeId={conversationId}
                  onSelect={(conversation) => navigate(`/messages/${conversation.id}`)}
                  emptyMessage="Message a store from any product page to start a conversation."
                />
              )}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0, display: active ? 'flex' : 'none', flexDirection: 'column' }}>
            {active && (
              <Conversation
                conversation={active}
                currentUserId={user.id}
                onBack={() => navigate('/messages')}
              />
            )}
          </div>

          {!active && conversations.length > 0 && (
            <div className="only-desktop" style={{ flex: 1, placeItems: 'center' }}>
              <EmptyState
                icon={Icon.Chat}
                title="Select a conversation"
                description="Choose a store on the left to read and reply."
              />
            </div>
          )}
        </div>

        {status === 'ready' && conversations.length === 0 && (
          <p style={{ textAlign: 'center', marginTop: 16, color: 'var(--text-subtle)', fontSize: '0.875rem' }}>
            <Link to="/" style={{ color: 'var(--accent-soft)' }}>Browse products</Link> and use
            “Message” on any product to reach its store.
          </p>
        )}
      </div>
    </BarePageShell>
  )
}
