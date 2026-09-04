import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthLayout from '../layouts/AuthLayout'
import { Field, SubmitButton, InlineNotice } from '../components/UI'
import { useAuth } from '../context/auth-context'
import { useToast } from '../context/toast-context'
import { validateEmail, validatePassword, validateFullName, collectErrors } from '../utils/validation'
import * as Icon from '../components/Icons'

export default function Register() {
  const { signUp } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const wantsToSell = params.get('intent') === 'sell'

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [confirmationSentTo, setConfirmationSentTo] = useState(null)

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError(null)

    const found = collectErrors({
      name: validateFullName(form.name),
      email: validateEmail(form.email),
      password: validatePassword(form.password),
      confirm: form.password !== form.confirm ? 'Passwords do not match' : null,
    })
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setLoading(true)
    const result = await signUp({
      name: form.name,
      email: form.email,
      password: form.password,
    })
    setLoading(false)

    if (!result.ok) {
      setFormError(result.message)
      return
    }

    if (result.needsConfirmation) {
      setConfirmationSentTo(form.email)
      return
    }

    toast.success('Your account is ready')
    navigate(wantsToSell ? '/sell/apply' : '/', { replace: true })
  }

  if (confirmationSentTo) {
    return <ConfirmationSent email={confirmationSentTo} wantsToSell={wantsToSell} />
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Shop from verified Rwandan sellers"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent-soft)', fontWeight: 600 }}>Sign in</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        {formError && <InlineNotice tone="danger" title="Could not create your account">{formError}</InlineNotice>}

        {wantsToSell && (
          <InlineNotice tone="info" title="First, your SHOP MUMU account">
            Everyone starts with a customer account. Once you are signed in we will take you
            straight to the seller application, where an administrator reviews your store before
            it goes live.
          </InlineNotice>
        )}

        <Field label="Full name" required error={errors.name} htmlFor="reg-name">
          <input
            id="reg-name" className="input" autoComplete="name"
            value={form.name} onChange={set('name')} placeholder="e.g. Amina Uwase"
            aria-invalid={errors.name ? 'true' : undefined}
          />
        </Field>

        <Field label="Email address" required error={errors.email} htmlFor="reg-email">
          <input
            id="reg-email" className="input" type="email" autoComplete="email"
            value={form.email} onChange={set('email')} placeholder="you@example.com"
            aria-invalid={errors.email ? 'true' : undefined}
          />
        </Field>

        <Field
          label="Password"
          required
          error={errors.password}
          hint="At least 8 characters, including letters and numbers"
          htmlFor="reg-password"
        >
          <input
            id="reg-password" className="input" type="password" autoComplete="new-password"
            value={form.password} onChange={set('password')}
            aria-invalid={errors.password ? 'true' : undefined}
          />
        </Field>

        <Field label="Confirm password" required error={errors.confirm} htmlFor="reg-confirm">
          <input
            id="reg-confirm" className="input" type="password" autoComplete="new-password"
            value={form.confirm} onChange={set('confirm')}
            aria-invalid={errors.confirm ? 'true' : undefined}
          />
        </Field>

        <SubmitButton
          loading={loading}
          loadingLabel="Creating your account…"
          className="btn btn-primary btn-block"
        >
          Create account
        </SubmitButton>
      </form>

      {!wantsToSell && (
        <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 10 }}>
            Want to sell on SHOP MUMU? Create your account first — you can apply for a store from
            it at any time, and you keep shopping either way.
          </p>
          <Link to="/register?intent=sell" className="btn btn-outline btn-sm">
            <Icon.Store size={15} /> I want to sell
          </Link>
        </div>
      )}
    </AuthLayout>
  )
}

function ConfirmationSent({ email, wantsToSell }) {
  return (
    <AuthLayout title="Check your email" subtitle="One more step before you can sign in">
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 52, height: 52, borderRadius: 'var(--radius-lg)', margin: '0 auto 16px',
            background: 'var(--accent-wash)', color: 'var(--accent-soft)',
            display: 'grid', placeItems: 'center',
          }}
        >
          <Icon.Bell size={24} />
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
          We sent a confirmation link to <strong style={{ color: 'var(--text)' }}>{email}</strong>.
          Open it to activate your account, then sign in.
          {wantsToSell && ' You can start your seller application straight afterwards.'}
        </p>

        <Link to="/login" className="btn btn-primary btn-block" style={{ marginTop: 22 }}>
          Go to sign in
        </Link>
      </div>
    </AuthLayout>
  )
}
