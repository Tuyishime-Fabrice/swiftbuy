import { useState, useEffect, useRef } from 'react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { ChatService, UserService } from '../services/storage'
import { SellerSidebar } from './SellerDashboard'
import { EmptyState } from '../components/UI'

export default function SellerChats() {
  const { user } = useAuth()
  const [customers, setCustomers] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const bottomRef = useRef()

  useEffect(() => {
    document.title = 'Chats — SwiftBuy Seller'
    const load = async () => {
      const users = await UserService.getAll()
      const custs = await Promise.all(
        users.filter(u => u.role === 'user').map(async c => {
          const msgs = await ChatService.getMessages(user.id, c.id)
          return { ...c, msgs, lastMsg: msgs[msgs.length - 1] }
        })
      )
      setCustomers(custs.filter(c => c.msgs.length > 0))
    }
    load()
  }, [user.id])

  useEffect(() => {
    if (!selected) return
    const load = async () => {
      const msgs = await ChatService.getMessages(user.id, selected.id)
      setMessages(msgs)
    }
    load()
  }, [selected, user.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!text.trim() || !selected) return
    await ChatService.send(user.id, selected.id, text.trim(), user.name)
    const msgs = await ChatService.getMessages(user.id, selected.id)
    setMessages(msgs)
    setText('')
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ display: 'flex' }}>
        <SellerSidebar active="chats" />
        <div style={{ flex: 1, display: 'flex', height: 'calc(100vh - 62px)' }}>
          <div style={{ width: 280, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15 }}>Customer Chats</p>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {customers.length === 0
                ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>No chats yet</div>
                : customers.map(c => (
                  <div key={c.id} onClick={() => setSelected(c)} style={{
                    padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                    background: selected?.id === c.id ? 'rgba(91,76,255,0.1)' : 'transparent',
                    transition: 'background 0.15s',
                  }}>
                    <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>{c.name}</p>
                    <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastMsg?.text || '...'}</p>
                  </div>
                ))
              }
            </div>
          </div>

          {selected ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>
                  {selected.name[0]}
                </div>
                <div>
                  <p style={{ color: 'var(--text)', fontWeight: 700 }}>{selected.name}</p>
                  <p style={{ color: 'var(--text3)', fontSize: 12 }}>{selected.email}</p>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.map(msg => {
                  const mine = String(msg.senderId || msg.sender_id) === String(user.id)
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        background: mine ? 'var(--accent)' : 'var(--card2)', color: mine ? '#fff' : 'var(--text)',
                        padding: '10px 14px', borderRadius: mine ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                        maxWidth: '70%', fontSize: 14, lineHeight: 1.5,
                      }}>
                        {msg.text}
                        <p style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>
                          {msg.createdAt || (msg.created_at && new Date(msg.created_at).toLocaleTimeString())}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
                <input
                  value={text} onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && send()}
                  placeholder="Type a message..." className="input" style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={send} disabled={!text.trim()}>Send</button>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmptyState title="Select a conversation" subtitle="Choose a customer to start chatting" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
