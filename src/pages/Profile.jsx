import { useState, useEffect } from 'react'
import PageShell from '../layouts/PageShell'
import { PageHeader, Field, SubmitButton, InlineNotice, ListSkeleton } from '../components/UI'
import * as Icon from '../components/Icons'
import { useAuth } from '../context/auth-context'
import { useToast } from '../context/toast-context'
import { ProfileService } from '../services/accounts'
import { initials, formatDate } from '../utils/format'
import {
  validateFullName, validatePhone, validatePassword, collectErrors,
} from '../utils/validation'

export default function Profile() {
  const { user, refresh } = useAuth()
  const toast = useToast()

  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ fullName: '', phone: '', address: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordErrors, setPasswordErrors] = useState({})
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    ProfileService.get(user.id).then((data) => {
      setProfile(data)
      setForm({
        fullName: data?.full_name ?? '',
        phone: data?.phone ?? '',
        address: data?.address ?? '',
      })
    })
  }, [user.id])

  const saveProfile = async (event) => {
    event.preventDefault()
    const found = collectErrors({
      fullName: validateFullName(form.fullName),
      phone: validatePhone(form.phone, { required: false }),
    })
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    try {
      await ProfileService.update(user.id, form)
      await refresh()
      toast.success('Your details have been saved')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async (event) => {
    event.preventDefault()
    const found = collectErrors({
      password: validatePassword(password),
      confirm: password !== confirm ? 'Passwords do not match' : null,
    })
    setPasswordErrors(found)
    if (Object.keys(found).length > 0) return

    setChangingPassword(true)
    try {
      await ProfileService.changePassword(password)
      setPassword('')
      setConfirm('')
      toast.success('Your password has been changed')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setChangingPassword(false)
    }
  }

  if (!profile) {
    return (
      <PageShell title="My profile" width="narrow">
        <PageHeader title="My profile" />
        <ListSkeleton count={2} height={220} />
      </PageShell>
    )
  }

  return (
    <PageShell title="My profile" width="narrow">
      <PageHeader title="My profile" subtitle="Your details and how you sign in" />

      <section
        className="card"
        style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}
      >
        <span
          style={{
            width: 60, height: 60, borderRadius: '50%', flexShrink: 0,
            background: 'var(--accent)', color: '#fff', display: 'grid',
            placeItems: 'center', fontFamily: "'Syne', sans-serif",
            fontWeight: 800, fontSize: '1.25rem',
          }}
        >
          {initials(profile.full_name)}
        </span>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: '1.0625rem' }}>{profile.full_name}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{profile.email}</p>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <span className="badge badge-accent">{profile.role}</span>
            {user.store && <span className="badge badge-neutral">Store {user.store.status}</span>}
            <span className="badge badge-neutral">Joined {formatDate(profile.created_at)}</span>
          </div>
        </div>
      </section>

      <form className="card" onSubmit={saveProfile} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: '1rem' }}>Your details</h2>

        <Field label="Full name" required error={errors.fullName} htmlFor="profile-name">
          <input
            id="profile-name" className="input" autoComplete="name"
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            aria-invalid={errors.fullName ? 'true' : undefined}
          />
        </Field>

        <Field
          label="Phone number"
          error={errors.phone}
          hint="Used to prefill your delivery details at checkout"
          htmlFor="profile-phone"
        >
          <input
            id="profile-phone" className="input" type="tel" autoComplete="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+250 78 000 0000"
            aria-invalid={errors.phone ? 'true' : undefined}
          />
        </Field>

        <Field label="Default delivery address" htmlFor="profile-address">
          <textarea
            id="profile-address" className="input" rows={3} autoComplete="street-address"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
        </Field>

        <SubmitButton loading={saving} loadingLabel="Saving…" style={{ alignSelf: 'flex-start' }}>
          Save details
        </SubmitButton>
      </form>

      <form className="card" onSubmit={changePassword} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ fontSize: '1rem' }}>Change password</h2>

        <Field
          label="New password"
          error={passwordErrors.password}
          hint="At least 8 characters, including letters and numbers"
          htmlFor="profile-password"
        >
          <input
            id="profile-password" className="input" type="password" autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            aria-invalid={passwordErrors.password ? 'true' : undefined}
          />
        </Field>

        <Field label="Confirm new password" error={passwordErrors.confirm} htmlFor="profile-confirm">
          <input
            id="profile-confirm" className="input" type="password" autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={passwordErrors.confirm ? 'true' : undefined}
          />
        </Field>

        <SubmitButton
          loading={changingPassword}
          loadingLabel="Updating…"
          disabled={!password}
          style={{ alignSelf: 'flex-start' }}
        >
          Change password
        </SubmitButton>
      </form>

      <div style={{ marginTop: 16 }}>
        <InlineNotice tone="info" title="About your email and role">
          Your email address is how you sign in and is changed through account recovery, not here.
          Your role on SwiftBuy is set by the platform — it cannot be changed from this page, and
          the database refuses any attempt to do so.
        </InlineNotice>
      </div>
    </PageShell>
  )
}
