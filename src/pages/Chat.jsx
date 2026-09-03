import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { ChatService, UserService } from '../services/storage'

export default function Chat() {
  const { sellerId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [seller, setSeller] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const bottomRef = useRef()

  useEffect(() => {
    const load = async () => {
      const users = await UserService.getAll()
      const s = users.find(u => String(u.id) === String(sellerId))
      if (!s) { navigate('/'); return }
      setSeller(s)
      const msgs = await ChatService.getMessages(user.id, s.id)
      setMessages(msgs)
    }
    load()
  }, [sellerId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    if (!text.trim() || !seller) return
    await ChatService.send(user.id, seller.id, text.trim(), user.name)
    const msgs = await ChatService.getMessages(user.id, seller.id)
    setMessages(msgs)
    setText('')
  }

  if (!seller) return null

  return (
    <div style={{ background: 'var(--bg)', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 720, margin: '0 auto', width: '100%', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
        <div style={{ padding: '16px 20px', background: 'var(--card)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 20 }}>←</button>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
            {seller.name[0]}
          </div>
          <div>
            <p style={{ color: 'var(--text)', fontWeight: 700 }}>{seller.name}</p>
            <p style={{ color: 'var(--green)', fontSize: 12 }}>● Online</p>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 0' }}>
              <p style={{ fontSize: 14, marginBottom: 8, fontWeight: 600 }}>Start a conversation with {seller.name}</p>
              <p style={{ fontSize: 13 }}>Ask about products, delivery, or anything else!</p>
            </div>
          )}
          {messages.map(msg => {
            const mine = String(msg.senderId || msg.sender_id) === String(user.id)
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  background: mine ? 'var(--accent)' : 'var(--card2)', color: mine ? '#fff' : 'var(--text)',
                  padding: '10px 14px', borderRadius: mine ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                  maxWidth: '72%', fontSize: 14, lineHeight: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}>
                  {msg.text}
                  <p style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: 'right' }}>
                    {msg.createdAt || (msg.created_at && new Date(msg.created_at).toLocaleTimeString())}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: '12px 16px', background: 'var(--card)', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <input
            value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder={`Message ${seller.name}...`} className="input" style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={send} disabled={!text.trim()}>Send</button>
        </div>
      </div>
    </div>
  )
}
