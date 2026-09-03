import { useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import SellerLayout from '../../layouts/SellerLayout'
import { Conversation, ConversationList } from '../../components/Conversation'
import { PageHeader, ErrorState, Spinner, EmptyState } from '../../components/UI'
import * as Icon from '../../components/Icons'
import { useAuth } from '../../context/auth-context'
import { ChatService } from '../../services/messaging'
import { useAsyncData } from '../../hooks/useAsyncData'

/**
 * The seller's side of customer messaging. Same conversation component the
 * customer uses — the participants differ, the behaviour does not.
 */
export default function SellerChats() {
  const { conversationId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const { status, data, error, retry } = useAsyncData(
    useCallback(() => ChatService.listConversations(user.id), [user.id])
  )

  const conversations = data ?? []
  const active = conversations.find((c) => c.id === conversationId) ?? null

  return (
    <SellerLayout title="Messages">
      <PageHeader title="Customer messages" subtitle="Questions from people shopping your store" />

      <div
        style={{
          display: 'flex', height: 'min(620px, 68vh)', minHeight: 380,
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          overflow: 'hidden', background: 'var(--surface)',
        }}
      >
        <div
          className={active ? 'only-desktop' : undefined}
          style={{
            width: active ? 272 : '100%',
            maxWidth: active ? 272 : undefined,
            flexShrink: 0,
            borderRight: active ? '1px solid var(--border)' : 'none',
            overflowY: 'auto',
          }}
        >
          {status === 'loading' && <Spinner label="Loading conversations" />}
          {status === 'error' && (
            <ErrorState title="We couldn't load your messages" description={error} onRetry={retry} />
          )}
          {status === 'ready' && (
            <ConversationList
              conversations={conversations}
              activeId={conversationId}
              onSelect={(conversation) => navigate(`/seller/chats/${conversation.id}`)}
              emptyMessage="When a customer messages your store from a product page, the conversation appears here."
            />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: active ? 'flex' : 'none', flexDirection: 'column' }}>
          {active && (
            <Conversation
              conversation={active}
              currentUserId={user.id}
              onBack={() => navigate('/seller/chats')}
            />
          )}
        </div>

        {!active && conversations.length > 0 && (
          <div className="only-desktop" style={{ flex: 1, placeItems: 'center' }}>
            <EmptyState
              icon={Icon.Chat}
              title="Select a conversation"
              description="Choose a customer on the left to read and reply."
            />
          </div>
        )}
      </div>
    </SellerLayout>
  )
}
