import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import PageShell from '../layouts/PageShell'
import {
  PageHeader, Field, SubmitButton, InlineNotice, ListSkeleton, ErrorState,
  StatusBadge, EmptyState, ConfirmDialog,
} from '../components/UI'
import * as Icon from '../components/Icons'
import { useAuth } from '../context/auth-context'
import { useToast } from '../context/toast-context'
import {
  SellerApplicationService, SellerDocumentService,
  SELLER_STATUS_LABEL, DOCUMENT_TYPES, DOCUMENT_TYPE_LABEL,
} from '../services/accounts'
import { useAsyncData } from '../hooks/useAsyncData'
import { formatDateTime } from '../utils/format'
import {
  validateStoreName, validatePhone, validateDocumentFile, collectErrors,
  ACCEPTED_DOCUMENT_TYPES, LIMITS,
} from '../utils/validation'
import { riseIn } from '../lib/motion'

export default function SellerApply() {
  const { user, refresh } = useAuth()
  const toast = useToast()

  const { status, data, error, reload, retry } = useAsyncData(
    useCallback(async () => {
      const application = await SellerApplicationService.mine()
      const documents = application ? await SellerDocumentService.list(user.id) : []
      return { application, documents }
    }, [user.id])
  )

  const application = data?.application ?? null
  const documents = data?.documents ?? []

  const afterChange = async () => {
    await refresh()
    reload()
  }

  if (status === 'loading') {
    return (
      <PageShell title="Sell on SwiftBuy" width="narrow">
        <PageHeader title="Sell on SwiftBuy" />
        <ListSkeleton count={2} height={220} />
      </PageShell>
    )
  }

  if (status === 'error') {
    return (
      <PageShell title="Sell on SwiftBuy" width="narrow">
        <PageHeader title="Sell on SwiftBuy" />
        <ErrorState title="We couldn't load your application" description={error} onRetry={retry} />
      </PageShell>
    )
  }

  return (
    <PageShell title="Sell on SwiftBuy" width="narrow">
      <PageHeader
        title="Sell on SwiftBuy"
        subtitle={
          application
            ? 'Your application and where it has got to'
            : 'Tell us about your store and an administrator will review it'
        }
      />

      {application && (
        <ApplicationStatus application={application} documentCount={documents.length} />
      )}

      {!application && <HowItWorks />}

      {(!application || application.status === 'rejected') && (
        <ApplicationForm
          application={application}
          defaultName={user.name}
          onSubmitted={async () => {
            toast.success('Your application has been submitted for review')
            await afterChange()
          }}
        />
      )}

      {application && (
        <DocumentSection
          sellerId={user.id}
          documents={documents}
          editable={application.status !== 'approved' && application.status !== 'suspended'}
          onChanged={afterChange}
        />
      )}

      {application?.status === 'approved' && (
        <div style={{ marginTop: 16 }}>
          <InlineNotice
            tone="success"
            title="Your store is live"
            action={<Link to="/seller" className="btn btn-primary btn-sm">Open seller tools</Link>}
          >
            You can list products, manage orders and message customers. Your customer account is
            unchanged — you can still shop on SwiftBuy exactly as before.
          </InlineNotice>
        </div>
      )}
    </PageShell>
  )
}

const STAGES = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'review', label: 'Under review' },
  { key: 'decision', label: 'Decision' },
]

function ApplicationStatus({ application, documentCount }) {
  const tone =
    application.status === 'approved' ? 'success'
      : application.status === 'pending' ? 'warning'
      : 'danger'

  const reached =
    application.status === 'pending' ? 1
      : application.status === 'approved' || application.status === 'rejected' ? 2
      : 2

  return (
    <motion.section {...riseIn} className="card" style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 12, flexWrap: 'wrap',
        }}
      >
        <div>
          <p
            style={{
              fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em',
              color: 'var(--text-subtle)',
            }}
          >
            APPLICATION STATUS
          </p>
          <h2 style={{ fontSize: '1.1rem', marginTop: 6 }}>{application.storeName}</h2>
        </div>
        <StatusBadge status={application.status} label={SELLER_STATUS_LABEL[application.status]} />
      </div>

      <ol style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '18px 0' }}>
        {STAGES.map((stage, index) => {
          const done = index < reached
          const current = index === reached
          return (
            <li
              key={stage.key}
              style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}
            >
              <span
                style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  display: 'grid', placeItems: 'center', fontSize: '0.6875rem', fontWeight: 700,
                  background: done ? 'var(--success)' : current ? 'var(--accent)' : 'var(--surface-hover)',
                  color: done || current ? '#fff' : 'var(--text-subtle)',
                }}
              >
                {done ? <Icon.Check size={13} /> : index + 1}
              </span>
              <span
                style={{
                  fontSize: '0.75rem', whiteSpace: 'nowrap',
                  color: done || current ? 'var(--text)' : 'var(--text-subtle)',
                  fontWeight: current ? 600 : 500,
                }}
              >
                {stage.label}
              </span>
              {index < STAGES.length - 1 && (
                <span
                  aria-hidden="true"
                  style={{
                    flex: 1, height: 1, minWidth: 8,
                    background: done ? 'var(--success)' : 'var(--border)',
                  }}
                />
              )}
            </li>
          )
        })}
      </ol>

      <dl style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.875rem' }}>
        <Row label="Submitted" value={formatDateTime(application.appliedAt)} />
        {application.approvedAt && (
          <Row label="Approved" value={formatDateTime(application.approvedAt)} />
        )}
        <Row
          label="Verification documents"
          value={documentCount === 0 ? 'None attached yet' : `${documentCount} attached`}
        />
      </dl>

      <div style={{ marginTop: 14 }}>
        {application.status === 'pending' && (
          <InlineNotice tone={tone} title="Waiting for review">
            An administrator will check your store details and any documents you attached. Until
            they approve it you keep full customer access, and the seller tools stay closed.
          </InlineNotice>
        )}
        {application.status === 'rejected' && (
          <InlineNotice tone="danger" title="Not approved">
            {application.statusReason
              ? application.statusReason
              : 'No reason was recorded. Update your details below and submit again.'}
          </InlineNotice>
        )}
        {application.status === 'suspended' && (
          <InlineNotice tone="danger" title="Store suspended">
            {application.statusReason ?? 'Contact SwiftBuy support to resolve this.'}
          </InlineNotice>
        )}
        {application.status === 'approved' && (
          <InlineNotice tone="success" title="Approved">
            Your store is visible on the marketplace and you can list products.
          </InlineNotice>
        )}
      </div>
    </motion.section>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <dt style={{ color: 'var(--text-muted)' }}>{label}</dt>
      <dd style={{ fontWeight: 600 }}>{value}</dd>
    </div>
  )
}

function HowItWorks() {
  const steps = [
    'Tell us your store name and how customers should pay you.',
    'Attach a verification document so an administrator can check who you are.',
    'Submit — your application goes into the review queue as pending.',
    'Once approved, the seller tools open and you can list products.',
  ]

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: '1rem', marginBottom: 12 }}>How it works</h2>
      <ol style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.map((step, index) => (
          <li key={step} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <span
              style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent-wash)', color: 'var(--accent-soft)',
                display: 'grid', placeItems: 'center', fontSize: '0.6875rem', fontWeight: 700,
              }}
            >
              {index + 1}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>{step}</span>
          </li>
        ))}
      </ol>
      <div style={{ marginTop: 14 }}>
        <InlineNotice tone="info" title="You stay a customer">
          Applying does not change your account. You can carry on shopping, and you keep your cart,
          orders and wishlist whatever the outcome.
        </InlineNotice>
      </div>
    </section>
  )
}

function ApplicationForm({ application, defaultName, onSubmitted }) {
  const [form, setForm] = useState({
    storeName: application?.storeName ?? '',
    description: application?.description ?? '',
    momoNumber: application?.momoNumber ?? '',
    momoName: application?.momoName ?? defaultName ?? '',
    bankName: application?.bankName ?? '',
    bankAccount: application?.bankAccount ?? '',
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setFormError(null)

    const found = collectErrors({
      storeName: validateStoreName(form.storeName),
      momoNumber: validatePhone(form.momoNumber, { required: false }),
    })
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    try {
      await SellerApplicationService.submit(form)
      await onSubmitted()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      className="card"
      onSubmit={submit}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <h2 style={{ fontSize: '1rem' }}>
        {application ? 'Update and apply again' : 'Your store'}
      </h2>

      {formError && <InlineNotice tone="danger" title="Could not submit">{formError}</InlineNotice>}

      <Field label="Store name" required error={errors.storeName} htmlFor="apply-store-name">
        <input
          id="apply-store-name" className="input"
          value={form.storeName} onChange={set('storeName')}
          maxLength={LIMITS.storeNameMax}
          placeholder="e.g. Gigi Electronics"
          aria-invalid={errors.storeName ? 'true' : undefined}
        />
      </Field>

      <Field
        label="About your store"
        hint="What do you sell, and what should buyers know? Shown on your store page once approved."
        htmlFor="apply-description"
      >
        <textarea
          id="apply-description" className="input" rows={3} maxLength={2000}
          value={form.description} onChange={set('description')}
        />
      </Field>

      <div>
        <h3 style={{ fontSize: '0.9375rem', marginBottom: 4 }}>How customers pay you</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 12 }}>
          SwiftBuy does not hold your money — buyers pay you directly and you confirm each payment.
          You can fill these in later from your store settings.
        </p>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <Field label="Mobile Money number" error={errors.momoNumber} htmlFor="apply-momo">
            <input
              id="apply-momo" className="input" type="tel"
              value={form.momoNumber} onChange={set('momoNumber')}
              placeholder="+250 78 000 0000"
              aria-invalid={errors.momoNumber ? 'true' : undefined}
            />
          </Field>
          <Field label="Name on the MoMo account" htmlFor="apply-momo-name">
            <input id="apply-momo-name" className="input" value={form.momoName} onChange={set('momoName')} />
          </Field>
          <Field label="Bank name" htmlFor="apply-bank">
            <input
              id="apply-bank" className="input"
              value={form.bankName} onChange={set('bankName')}
              placeholder="e.g. Bank of Kigali"
            />
          </Field>
          <Field label="Bank account number" htmlFor="apply-account">
            <input id="apply-account" className="input" value={form.bankAccount} onChange={set('bankAccount')} />
          </Field>
        </div>
      </div>

      <InlineNotice tone="info" title="What happens when you submit">
        Your application is created as <strong>pending</strong> and goes to a SwiftBuy
        administrator. You can attach verification documents after submitting, and you will be
        notified of the decision.
      </InlineNotice>

      <SubmitButton
        loading={submitting}
        loadingLabel="Submitting…"
        className="btn btn-primary btn-block"
      >
        {application ? 'Submit application again' : 'Submit application'}
      </SubmitButton>
    </form>
  )
}

function DocumentSection({ sellerId, documents, editable, onChanged }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0].value)
  const [file, setFile] = useState(null)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [opening, setOpening] = useState(null)

  const choose = (event) => {
    const chosen = event.target.files?.[0] ?? null
    setError(chosen ? validateDocumentFile(chosen) : null)
    setFile(chosen)
  }

  const upload = async (event) => {
    event.preventDefault()
    const problem = validateDocumentFile(file)
    if (problem) {
      setError(problem)
      return
    }

    setUploading(true)
    try {
      await SellerDocumentService.upload({ file, sellerId, docType })
      setFile(null)
      event.target.reset()
      toast.success('Document attached to your application')
      await onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const open = async (document) => {
    setOpening(document.id)
    try {
      const url = await SellerDocumentService.openUrl(document.storagePath)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setOpening(null)
    }
  }

  const confirmRemove = async () => {
    try {
      await SellerDocumentService.remove({
        documentId: removing.id,
        storagePath: removing.storagePath,
      })
      setRemoving(null)
      toast.info('Document removed')
      await onChanged()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: '1rem', marginBottom: 4 }}>Verification documents</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 14 }}>
        Attach something an administrator can use to verify your store, such as a business or
        licence document. Files are private: only you and SwiftBuy administrators can open them.
      </p>

      {documents.length === 0 ? (
        <EmptyState
          icon={Icon.Receipt}
          title="No documents attached"
          description={
            editable
              ? 'An application with no supporting document is harder to approve.'
              : 'Nothing was attached to this application.'
          }
        />
      ) : (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {documents.map((document) => (
            <li
              key={document.id}
              className="panel"
              style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
            >
              <span style={{ color: 'var(--accent-soft)', display: 'flex' }}>
                <Icon.Receipt size={18} />
              </span>
              <div style={{ flex: 1, minWidth: 160 }}>
                <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {DOCUMENT_TYPE_LABEL[document.docType] ?? document.docType}
                </p>
                <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>
                  {document.fileName ?? 'Document'} · {formatDateTime(document.createdAt)}
                </p>
              </div>
              {document.reviewedAt && (
                <span className="badge badge-success">
                  <Icon.Check size={11} /> Reviewed
                </span>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => open(document)}
                  disabled={opening === document.id}
                >
                  {opening === document.id ? <span className="spinner" aria-hidden="true" /> : null}
                  View
                </button>
                {editable && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setRemoving(document)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <form onSubmit={upload} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <InlineNotice tone="danger" title="Could not attach">{error}</InlineNotice>}

          <Field label="Document type" htmlFor="document-type">
            <select
              id="document-type"
              className="input"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </Field>

          <Field
            label="File"
            hint={`PDF, JPEG, PNG or WebP · up to ${Math.round(LIMITS.documentBytes / 1024 / 1024)} MB`}
            htmlFor="document-file"
          >
            <input
              id="document-file"
              className="input"
              type="file"
              accept={ACCEPTED_DOCUMENT_TYPES.join(',')}
              onChange={choose}
              style={{ padding: 8 }}
            />
          </Field>

          <SubmitButton
            loading={uploading}
            loadingLabel="Uploading…"
            disabled={!file}
            className="btn btn-outline"
            style={{ alignSelf: 'flex-start' }}
          >
            <Icon.Plus size={15} /> Attach document
          </SubmitButton>
        </form>
      )}

      <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
          <Icon.ArrowLeft size={15} /> Back to the shop
        </button>
      </div>

      <AnimatePresence>
        {removing && (
          <ConfirmDialog
            title="Remove this document?"
            message="It will be deleted from your application and from SwiftBuy's storage. You can attach a different one afterwards."
            confirmLabel="Remove document"
            onConfirm={confirmRemove}
            onCancel={() => setRemoving(null)}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
