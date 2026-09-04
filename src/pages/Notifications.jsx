import { useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import PageShell from '../layouts/PageShell'
import { PageHeader, EmptyState, ErrorState, ListSkeleton } from '../components/UI'
import * as Icon from '../components/Icons'
import { useAuth } from '../context/auth-context'
import { NotificationService } from '../services/messaging'
import { formatRelative } from '../utils/format'
import { listContainer, listItem } from '../lib/motion'
import { useAsyncData } from '../hooks/useAsyncData'

const KIND_ICON = {
  'order.placed': Icon.Package,
  'order.received': Icon.Store,
  'order.fulfilment': Icon.Truck,
  'order.cancelled': Icon.Alert,
  'payment.declared': Icon.Receipt,
  'payment.confirmed': Icon.Check,
  'payment.rejected': Icon.Alert,
  'payment.refunded': Icon.Receipt,
  'seller.status': Icon.Shield,
  'message.new': Icon.Chat,
  'dispute.opened': Icon.Scale,
  'dispute.response': Icon.Scale,
  'dispute.updated': Icon.Scale,
}

export default function Notifications() {
  const { user } = useAuth()
  const { status, data, error, retry, setData } = useAsyncData(
    useCallback(() => NotificationService.list(user.id), [user.id])
  )

  const items = data ?? []

  useEffect(() => {
    if (!user) return undefined
    return NotificationService.subscribe(user.id, (incoming) => {
      setData((current) => [incoming, ...(current ?? [])])
    })
  }, [user, setData])

  const unread = items.filter((n) => !n.is_read).length

  const markAllRead = async () => {
    await NotificationService.markAllRead(user.id)
    setData((current) => (current ?? []).map((n) => ({ ...n, is_read: true })))
  }

  const open = async (notification) => {
    if (!notification.is_read) {
      await NotificationService.markRead(notification.id)
      setData((current) =>
        (current ?? []).map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      )
    }
  }

  if (status === 'loading') {
    return (
      <PageShell title="Notifications" width="narrow">
        <PageHeader title="Notifications" />
        <ListSkeleton count={5} height={74} />
      </PageShell>
    )
  }

  if (status === 'error') {
    return (
      <PageShell title="Notifications" width="narrow">
        <PageHeader title="Notifications" />
        <ErrorState title="We couldn't load your notifications" description={error} onRetry={retry} />
      </PageShell>
    )
  }

  return (
    <PageShell title="Notifications" width="narrow">
      <PageHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'You are all caught up'}
        actions={
          unread > 0 && (
            <button type="button" className="btn btn-outline btn-sm" onClick={markAllRead}>
              Mark all as read
            </button>
          )
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Icon.Bell}
          title="No notifications yet"
          description="Order updates, payment confirmations and new messages will show up here."
        />
      ) : (
        <motion.ul
          variants={listContainer}
          initial="initial"
          animate="animate"
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {items.map((notification) => {
            const Glyph = KIND_ICON[notification.kind] ?? Icon.Bell
            const body = (
              <div
                className="card"
                style={{
                  padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
                  borderLeft: `3px solid ${notification.is_read ? 'transparent' : 'var(--accent)'}`,
                }}
              >
                <span
                  style={{
                    width: 32, height: 32, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                    background: notification.is_read ? 'var(--surface-hover)' : 'var(--accent-wash)',
                    color: notification.is_read ? 'var(--text-subtle)' : 'var(--accent-soft)',
                    display: 'grid', placeItems: 'center',
                  }}
                >
                  <Glyph size={16} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: notification.is_read ? 500 : 700, fontSize: '0.9375rem' }}>
                    {notification.title}
                  </p>
                  {notification.body && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 2 }}>
                      {notification.body}
                    </p>
                  )}
                  <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem', marginTop: 4 }}>
                    {formatRelative(notification.created_at)}
                  </p>
                </div>
              </div>
            )

            return (
              <motion.li key={notification.id} variants={listItem}>
                {notification.link ? (
                  <Link to={notification.link} onClick={() => open(notification)}>{body}</Link>
                ) : (
                  <button type="button" onClick={() => open(notification)} style={{ display: 'block', width: '100%', textAlign: 'left' }}>
                    {body}
                  </button>
                )}
              </motion.li>
            )
          })}
        </motion.ul>
      )}
    </PageShell>
  )
}
