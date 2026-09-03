import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { FormField } from '../components/UI'

export default function Register() {
  const { register } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [role, setRole] = useState('user')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [momoNumber, setMomoNumber] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankName, setBankName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name || !email || !password) return toast('Please fill all required fields', 'error')
    if (password !== confirm) return toast('Passwords do not match', 'error')
    if (password.length < 6) return toast('Password must be at least 6 characters', 'error')

    const extra = role === 'seller'
      ? { momoNumber, momoName: name, bankAccount, bankName }
      : {}

    setLoading(true)
    const result = await register(name, email, password, role, extra)
    setLoading(false)

    if (!result.success) return toast(result.message, 'error')
    if (role === 'seller') {
      toast('Seller application submitted. Await admin approval.', 'info')
      navigate('/login')
    } else {
      toast('Account created successfully!', 'success')
      navigate('/')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 500 }} className="fade-up">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: 'var(--accent)' }}>SwiftBuy</span>
          </Link>
          <p style={{ color: 'var(--text3)', fontSize: 14, marginTop: 10 }}>Create your account</p>
        </div>

        {/* Role selector */}
        <div style={{ display: 'flex', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
          {[{ value: 'user', label: 'Customer', desc: 'Browse and buy products' }, { value: 'seller', label: 'Seller', desc: 'List and sell products' }].map(opt => (
            <button key={opt.value} type="button" onClick={() => setRole(opt.value)}
              style={{
                flex: 1, padding: '16px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: role === opt.value ? 'rgba(91,76,255,0.12)' : 'transparent',
                borderRight: opt.value === 'user' ? '1px solid var(--border)' : 'none',
                transition: 'background 0.2s',
              }}>
              <p style={{ color: role === opt.value ? 'var(--accent-light)' : 'var(--text2)', fontWeight: 700, fontSize: 14 }}>{opt.label}</p>
              <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 2 }}>{opt.desc}</p>
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: 32 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FormField label="Full Name *">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" className="input" />
            </FormField>
            <FormField label="Email Address *">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="input" />
            </FormField>
            <FormField label="Password *">
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" className="input" />
            </FormField>
            <FormField label="Confirm Password *">
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" className="input" />
            </FormField>

            {role === 'seller' && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ color: 'var(--text2)', fontSize: 13, fontWeight: 700 }}>Payment Details</p>
                <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: -8 }}>These are shown to customers so they can pay you.</p>
                <FormField label="MoMo Number (MTN/Airtel)">
                  <input value={momoNumber} onChange={e => setMomoNumber(e.target.value)} placeholder="+250 7XX XXX XXX" className="input" />
                </FormField>
                <FormField label="Bank Name">
                  <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. Bank of Kigali" className="input" />
                </FormField>
                <FormField label="Bank Account Number">
                  <input value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="Account number" className="input" />
                </FormField>
                <div style={{ background: 'rgba(240,165,0,0.08)', border: '1px solid rgba(240,165,0,0.25)', borderRadius: 10, padding: '12px 14px' }}>
                  <p style={{ color: 'var(--yellow)', fontSize: 13, fontWeight: 600 }}>Seller accounts require admin approval before you can list products.</p>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '13px', fontSize: 15, marginTop: 4 }}>
              {loading ? 'Creating account...' : role === 'seller' ? 'Submit Seller Application' : 'Create Account'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 22, color: 'var(--text3)', fontSize: 14 }}>
            Already have an account? <Link to="/login" style={{ color: 'var(--accent-light)', fontWeight: 600 }}>Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
