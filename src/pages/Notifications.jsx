import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { NotificationService } from '../services/storage'
import { PageHeader, EmptyState } from '../components/UI'

export default function Notifications() {
  const { user } = useAuth()
  const [notifs, setNotifs] = useState([])

  useEffect(() => {
    document.title = 'Notifications — SwiftBuy'
    const load = async () => {
      const n = await NotificationService.getByUser(user.id)
      setNotifs(n)
      await NotificationService.markRead(user.id)
    }
    load()
  }, [user.id])

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
        <PageHeader title="Notifications" subtitle={`${notifs.filter(n => !n.read && !n.is_read).length} unread`} />
        {notifs.length === 0 ? (
          <EmptyState title="No notifications" subtitle="Updates about your orders will appear here." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notifs.map(n => (
              <div key={n.id} className="card fade-in" style={{ display: 'flex', gap: 14, padding: '16px 18px', borderLeft: '3px solid var(--accent)' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.5 }}>{n.message}</p>
                  <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>
                    {n.createdAt || (n.created_at && new Date(n.created_at).toLocaleString())}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
