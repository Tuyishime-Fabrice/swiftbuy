import { useState } from 'react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { UserService } from '../services/storage'
import { PageHeader, FormField } from '../components/UI'

export default function EditProfile() {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const save = async () => {
    if (!name.trim()) return toast('Name is required', 'error')
    if (password && password !== confirm) return toast('Passwords do not match', 'error')
    if (password && password.length < 6) return toast('Password must be at least 6 characters', 'error')
    setLoading(true)
    await new Promise(r => setTimeout(r, 300))
    const changes = { name: name.trim(), email }
    if (password) changes.password = password
    await UserService.update(user.id, changes)
    refreshUser?.()
    toast('Profile updated!', 'success')
    setPassword('')
    setConfirm('')
    setLoading(false)
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '32px 24px' }}>
        <PageHeader title="My Profile" subtitle="Manage your account details" />

        {/* Avatar */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #7b6fff, #5b4cff)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: 32, fontWeight: 700, color: '#fff' }}>
            {name?.[0]?.toUpperCase() || '?'}
          </div>
          <p style={{ color: 'var(--text)', fontWeight: 700, marginTop: 12 }}>{user?.name}</p>
          <span style={{
            display: 'inline-block', marginTop: 6, padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: user?.role === 'admin' ? 'rgba(240,165,0,0.15)' : user?.role === 'seller' ? 'rgba(91,76,255,0.15)' : 'rgba(0,196,140,0.15)',
            color: user?.role === 'admin' ? 'var(--yellow)' : user?.role === 'seller' ? 'var(--accent-light)' : 'var(--green)',
          }}>
            {user?.role}
          </span>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <FormField label="Full Name">
            <input value={name} onChange={e => setName(e.target.value)} className="input" />
          </FormField>
          <FormField label="Email Address">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input" />
          </FormField>
          <div style={{ height: 1, background: 'var(--border)' }} />
          <p style={{ color: 'var(--text2)', fontSize: 13, fontWeight: 700 }}>Change Password (optional)</p>
          <FormField label="New Password">
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave blank to keep current" className="input" />
          </FormField>
          <FormField label="Confirm New Password">
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat new password" className="input" />
          </FormField>
          <button className="btn btn-primary" onClick={save} disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Account info */}
        <div className="card" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ color: 'var(--text2)', fontSize: 13, fontWeight: 700 }}>Account Info</p>
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>Member ID: <span style={{ color: 'var(--accent-light)', fontFamily: 'monospace' }}>#{user?.id}</span></p>
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>Role: <span style={{ color: 'var(--text)' }}>{user?.role}</span></p>
        </div>
      </div>
    </div>
  )
}
