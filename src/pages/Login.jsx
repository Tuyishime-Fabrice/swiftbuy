import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import AuthLayout from '../layouts/AuthLayout'
import { Field, SubmitButton, InlineNotice } from '../components/UI'
import { useAuth } from '../context/auth-context'
import { useToast } from '../context/toast-context'
import { homeFor } from '../lib/routes'
import { validateEmail, collectErrors } from '../utils/validation'
import * as Icon from '../components/Icons'

export default function Login() {
  const { signIn } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError(null)

    const found = collectErrors({
      email: validateEmail(email),
      password: password ? null : 'Password is required',
    })
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setLoading(true)
    const result = await signIn(email, password)
    setLoading(false)

    if (!result.ok) {
      setFormError(result.message)
      return
    }

    toast.success(`Welcome back, ${result.user.name.split(' ')[0]}`)
    // Return them to wherever the guard interrupted, or to their home surface.
    const destination = location.state?.from ?? homeFor(result.user.role)
    navigate(destination, { replace: true })
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back to SwiftBuy"
      footer={
        <>
          New to SwiftBuy?{' '}
          <Link to="/register" style={{ color: 'var(--accent-soft)', fontWeight: 600 }}>
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {formError && <InlineNotice tone="danger" title="Could not sign in">{formError}</InlineNotice>}

        <Field label="Email address" error={errors.email} htmlFor="login-email">
          <input
            id="login-email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-invalid={errors.email ? 'true' : undefined}
          />
        </Field>

        <Field label="Password" error={errors.password} htmlFor="login-password">
          <div style={{ position: 'relative' }}>
            <input
              id="login-password"
              className="input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              style={{ paddingRight: 46 }}
              aria-invalid={errors.password ? 'true' : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                width: 34, height: 34, display: 'grid', placeItems: 'center',
                color: 'var(--text-subtle)', borderRadius: 'var(--radius-sm)',
              }}
            >
              {showPassword ? <Icon.Moon size={16} /> : <Icon.Sun size={16} />}
            </button>
          </div>
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Link to="/forgot-password" style={{ color: 'var(--accent-soft)', fontSize: '0.875rem' }}>
            Forgot your password?
          </Link>
        </div>

        <SubmitButton loading={loading} loadingLabel="Signing in…" className="btn btn-primary btn-block">
          Sign in
        </SubmitButton>
      </form>
    </AuthLayout>
  )
}
