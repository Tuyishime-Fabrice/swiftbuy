import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import AuthLayout from '../layouts/AuthLayout'
import { Field, SubmitButton, InlineNotice } from '../components/UI'
import { useAuth } from '../context/auth-context'
import { useToast } from '../context/toast-context'
import {
  validateEmail, validatePassword, validateFullName, validatePhone, collectErrors,
} from '../utils/validation'
import { DURATION, EASE } from '../lib/motion'
import * as Icon from '../components/Icons'

/**
 * Registration for customers and sellers.
 *
 * The role field is a convenience, not a privilege: the database trigger only
 * honours 'customer' and 'seller', and a seller's store is created in
 * 'pending' regardless of what the form sends.
 */
export default function Register() {
  const { signUp } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [role, setRole] = useState(params.get('role') === 'seller' ? 'seller' : 'customer')
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirm: '',
    storeName: '', momoNumber: '', bankName: '', bankAccount: '',
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(null)

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError(null)

    const found = collectErrors({
      name: validateFullName(form.name),
      email: validateEmail(form.email),
      password: validatePassword(form.password),
      confirm: form.password !== form.confirm ? 'Passwords do not match' : null,
      storeName: role === 'seller' && !form.storeName.trim() ? 'Store name is required' : null,
      momoNumber: role === 'seller' ? validatePhone(form.momoNumber, { required: false }) : null,
    })
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setLoading(true)
    const result = await signUp({
      name: form.name,
      email: form.email,
      password: form.password,
      role,
      store: {
        storeName: form.storeName,
        momoNumber: form.momoNumber,
        momoName: form.name,
        bankName: form.bankName,
        bankAccount: form.bankAccount,
      },
    })
    setLoading(false)

    if (!result.ok) {
      setFormError(result.message)
      return
    }

    if (result.needsConfirmation) {
      setDone({ kind: 'confirm', role: result.role })
      return
    }

    if (result.role === 'seller') {
      setDone({ kind: 'pending', role: 'seller' })
      return
    }

    toast.success('Your account is ready')
    navigate('/', { replace: true })
  }

  if (done) return <RegistrationComplete state={done} email={form.email} />

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Shop from verified Rwandan sellers, or open your own store"
      width={520}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent-soft)', fontWeight: 600 }}>Sign in</Link>
        </>
      }
    >
      <fieldset style={{ border: 0, marginBottom: 20 }}>
        <legend className="sr-only">What kind of account?</legend>
        <div
          style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
          }}
        >
          <RoleOption
            icon={Icon.Cart}
            title="I want to buy"
            description="Browse and order"
            selected={role === 'customer'}
            onSelect={() => setRole('customer')}
          />
          <RoleOption
            icon={Icon.Store}
            title="I want to sell"
            description="Open a store"
            selected={role === 'seller'}
            onSelect={() => setRole('seller')}
          />
        </div>
      </fieldset>

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        {formError && <InlineNotice tone="danger" title="Could not create your account">{formError}</InlineNotice>}

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

        <AnimatePresence initial={false}>
          {role === 'seller' && (
            <motion.div
              key="seller-fields"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: DURATION.base, ease: EASE }}
              style={{ overflow: 'hidden' }}
            >
              <div
                style={{
                  display: 'flex', flexDirection: 'column', gap: 15,
                  paddingTop: 15, borderTop: '1px solid var(--border)',
                }}
              >
                <p style={{ fontSize: '0.875rem', fontWeight: 700 }}>Your store</p>

                <Field label="Store name" required error={errors.storeName} htmlFor="reg-store">
                  <input
                    id="reg-store" className="input"
                    value={form.storeName} onChange={set('storeName')}
                    placeholder="e.g. Gigi Electronics"
                    aria-invalid={errors.storeName ? 'true' : undefined}
                  />
                </Field>

                <Field
                  label="Mobile Money number"
                  error={errors.momoNumber}
                  hint="Shown to customers so they can pay you. You can add this later."
                  htmlFor="reg-momo"
                >
                  <input
                    id="reg-momo" className="input" type="tel"
                    value={form.momoNumber} onChange={set('momoNumber')}
                    placeholder="+250 78 000 0000"
                    aria-invalid={errors.momoNumber ? 'true' : undefined}
                  />
                </Field>

                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
                  <Field label="Bank name" htmlFor="reg-bank">
                    <input
                      id="reg-bank" className="input"
                      value={form.bankName} onChange={set('bankName')}
                      placeholder="e.g. Bank of Kigali"
                    />
                  </Field>
                  <Field label="Account number" htmlFor="reg-account">
                    <input
                      id="reg-account" className="input"
                      value={form.bankAccount} onChange={set('bankAccount')}
                    />
                  </Field>
                </div>

                <InlineNotice tone="warning" title="Stores are reviewed before they go live">
                  A SwiftBuy administrator checks every application. You can sign in straight
                  away, and you will be able to list products once your store is approved.
                </InlineNotice>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <SubmitButton
          loading={loading}
          loadingLabel="Creating your account…"
          className="btn btn-primary btn-block"
        >
          {role === 'seller' ? 'Apply to sell on SwiftBuy' : 'Create account'}
        </SubmitButton>
      </form>
    </AuthLayout>
  )
}

function RoleOption({ icon: Glyph, title, description, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        textAlign: 'left', padding: '14px 15px', borderRadius: 'var(--radius)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        background: selected ? 'var(--accent-wash)' : 'var(--surface)',
        transition: 'border-color 140ms, background 140ms',
      }}
    >
      <span
        style={{
          display: 'flex', color: selected ? 'var(--accent-soft)' : 'var(--text-subtle)',
          marginBottom: 8,
        }}
      >
        <Glyph size={19} />
      </span>
      <span style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem' }}>{title}</span>
      <span style={{ display: 'block', color: 'var(--text-subtle)', fontSize: '0.75rem' }}>
        {description}
      </span>
    </button>
  )
}

function RegistrationComplete({ state, email }) {
  const confirming = state.kind === 'confirm'

  return (
    <AuthLayout
      title={confirming ? 'Check your email' : 'Application received'}
      subtitle={
        confirming
          ? 'One more step before you can sign in'
          : 'Your store is now waiting for review'
      }
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 52, height: 52, borderRadius: 'var(--radius-lg)', margin: '0 auto 16px',
            background: confirming ? 'var(--accent-wash)' : 'var(--success-wash)',
            color: confirming ? 'var(--accent-soft)' : 'var(--success)',
            display: 'grid', placeItems: 'center',
          }}
        >
          {confirming ? <Icon.Bell size={24} /> : <Icon.Check size={24} />}
        </div>

        {confirming ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
            We sent a confirmation link to <strong style={{ color: 'var(--text)' }}>{email}</strong>.
            Open it to activate your account, then sign in.
            {state.role === 'seller' && ' Your store will be reviewed after that.'}
          </p>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
            Thanks for applying. An administrator will review your store, and you will get a
            notification as soon as it is approved. You can sign in now — the seller dashboard
            will open up once you are approved.
          </p>
        )}

        <Link to="/login" className="btn btn-primary btn-block" style={{ marginTop: 22 }}>
          Go to sign in
        </Link>
      </div>
    </AuthLayout>
  )
}
