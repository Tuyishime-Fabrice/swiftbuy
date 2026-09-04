import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../layouts/AuthLayout'
import { Field, SubmitButton } from '../components/UI'
import { useAuth } from '../context/auth-context'
import { validateEmail } from '../utils/validation'
import * as Icon from '../components/Icons'

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    const problem = validateEmail(email)
    setError(problem)
    if (problem) return

    setLoading(true)
    await requestPasswordReset(email)
    setLoading(false)

    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout title="Check your inbox" subtitle="If that address has an account, a reset link is on its way">
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 52, height: 52, borderRadius: 'var(--radius-lg)', margin: '0 auto 16px',
              background: 'var(--success-wash)', color: 'var(--success)',
              display: 'grid', placeItems: 'center',
            }}
          >
            <Icon.Check size={24} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
            We have sent reset instructions to <strong style={{ color: 'var(--text)' }}>{email}</strong> if
            an account exists for it. The link expires after a short while, so use it soon.
          </p>
          <Link to="/login" className="btn btn-outline btn-block" style={{ marginTop: 22 }}>
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We will email you a link to set a new one"
      footer={<Link to="/login" style={{ color: 'var(--accent-soft)' }}>Back to sign in</Link>}
    >
      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Email address" error={error} htmlFor="reset-email">
          <input
            id="reset-email" className="input" type="email" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-invalid={error ? 'true' : undefined}
          />
        </Field>
        <SubmitButton loading={loading} loadingLabel="Sending…" className="btn btn-primary btn-block">
          Send reset link
        </SubmitButton>
      </form>
    </AuthLayout>
  )
}
