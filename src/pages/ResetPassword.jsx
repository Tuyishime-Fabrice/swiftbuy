import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../layouts/AuthLayout'
import { Field, SubmitButton, InlineNotice } from '../components/UI'
import { useToast } from '../context/toast-context'
import { ProfileService } from '../services/accounts'
import { supabase } from '../lib/supabase'
import { validatePassword, collectErrors } from '../utils/validation'

/**
 * Where the emailed reset link lands.
 *
 * Supabase turns the link into a recovery session automatically
 * (detectSessionInUrl), so by the time this page renders the visitor is
 * briefly authenticated and may set a new password — nothing here needs to
 * handle the token itself.
 */
export default function ResetPassword() {
  const toast = useToast()
  const navigate = useNavigate()

  const [ready, setReady] = useState(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)))
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError(null)

    const found = collectErrors({
      password: validatePassword(password),
      confirm: password !== confirm ? 'Passwords do not match' : null,
    })
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setLoading(true)
    try {
      await ProfileService.changePassword(password)
      toast.success('Your password has been updated')
      navigate('/login', { replace: true })
    } catch (err) {
      setFormError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (ready === false) {
    return (
      <AuthLayout title="This link has expired" subtitle="Reset links can only be used once, and not for long">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
          Request a new reset link and use it as soon as it arrives.
        </p>
        <Link to="/forgot-password" className="btn btn-primary btn-block" style={{ marginTop: 20 }}>
          Request a new link
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Set a new password" subtitle="Choose something you have not used elsewhere">
      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {formError && <InlineNotice tone="danger" title="Could not update your password">{formError}</InlineNotice>}

        <Field
          label="New password"
          required
          error={errors.password}
          hint="At least 8 characters, including letters and numbers"
          htmlFor="new-password"
        >
          <input
            id="new-password" className="input" type="password" autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            aria-invalid={errors.password ? 'true' : undefined}
          />
        </Field>

        <Field label="Confirm new password" required error={errors.confirm} htmlFor="confirm-password">
          <input
            id="confirm-password" className="input" type="password" autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={errors.confirm ? 'true' : undefined}
          />
        </Field>

        <SubmitButton loading={loading} loadingLabel="Updating…" className="btn btn-primary btn-block">
          Update password
        </SubmitButton>
      </form>
    </AuthLayout>
  )
}
