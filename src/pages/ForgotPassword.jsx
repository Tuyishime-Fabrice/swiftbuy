import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FormField } from '../components/UI'
import { useToast } from '../context/ToastContext'
import { supabase, isSupabaseReady } from '../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const { toast } = useToast()

  const submit = async (e) => {
    e.preventDefault()
    if (!email) return toast('Please enter your email', 'error')
    if (isSupabaseReady) {
      // redirectTo ensures the reset link points to the live site, not localhost
      const redirectTo = window.location.origin + '/login'
      await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    }
    setSent(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }} className="fade-up">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: 'var(--accent)' }}>SwiftBuy</span>
          </Link>
          <p style={{ color: 'var(--text3)', fontSize: 14, marginTop: 10 }}>Reset your password</p>
        </div>
        <div className="card" style={{ padding: 32 }}>
          {!sent ? (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <FormField label="Email Address">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="input" />
              </FormField>
              <button type="submit" className="btn btn-primary" style={{ padding: 12 }}>Send Reset Instructions</button>
            </form>
          ) : (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(0,196,140,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: 8 }}>Check your inbox</p>
              <p style={{ color: 'var(--text3)', fontSize: 14 }}>If <strong>{email}</strong> is registered, you will receive reset instructions shortly.</p>
            </div>
          )}
          <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text3)', fontSize: 14 }}>
            <Link to="/login" style={{ color: 'var(--accent-light)' }}>Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
