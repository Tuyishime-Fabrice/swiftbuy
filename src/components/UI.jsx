import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { modalBackdrop, modalPanel, listContainer, listItem } from '../lib/motion'
import * as Icon from './Icons'

/* ══════════════════════════════════════════════════════════════════════════
   Shared building blocks. Every page draws from here so spacing, states and
   motion stay consistent, and a fix in one place fixes the whole app.
   ══════════════════════════════════════════════════════════════════════════ */

// ── Page furniture ──────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <header
      style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap', marginBottom: 24,
      }}
    >
      <div style={{ minWidth: 0 }}>
        {back && (
          <Link
            to={back.to}
            className="btn btn-ghost btn-sm"
            style={{ marginBottom: 8, marginLeft: -12 }}
          >
            <Icon.ArrowLeft size={16} /> {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {subtitle && (
          <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: '0.9375rem' }}>{subtitle}</p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </header>
  )
}

export function SectionTitle({ children, action }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginBottom: 14, flexWrap: 'wrap',
      }}
    >
      <h2 style={{ fontSize: '1.05rem' }}>{children}</h2>
      {action}
    </div>
  )
}

// ── Feedback states ─────────────────────────────────────────────────────────

/**
 * Empty states always name the next useful action. "Nothing here" alone
 * leaves the person stuck.
 */
export function EmptyState({ icon: Glyph = Icon.Package, title, description, action }) {
  return (
    <div
      style={{
        textAlign: 'center', padding: '56px 20px', display: 'flex',
        flexDirection: 'column', alignItems: 'center', gap: 10,
      }}
    >
      <div
        style={{
          width: 52, height: 52, borderRadius: 'var(--radius-lg)',
          background: 'var(--surface-raised)', border: '1px solid var(--border)',
          display: 'grid', placeItems: 'center', color: 'var(--text-subtle)',
        }}
      >
        <Glyph size={24} />
      </div>
      <p style={{ fontWeight: 700, fontSize: '1rem' }}>{title}</p>
      {description && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', maxWidth: 380 }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  )
}

/** A failure the person can do something about, with a way to retry. */
export function ErrorState({ title = 'Something went wrong', description, onRetry, action }) {
  return (
    <div
      role="alert"
      style={{
        textAlign: 'center', padding: '48px 20px', display: 'flex',
        flexDirection: 'column', alignItems: 'center', gap: 10,
      }}
    >
      <div
        style={{
          width: 52, height: 52, borderRadius: 'var(--radius-lg)',
          background: 'var(--danger-wash)', display: 'grid', placeItems: 'center',
          color: 'var(--danger)',
        }}
      >
        <Icon.Alert size={24} />
      </div>
      <p style={{ fontWeight: 700, fontSize: '1rem' }}>{title}</p>
      {description && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', maxWidth: 420 }}>
          {description}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {onRetry && (
          <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>
            Try again
          </button>
        )}
        {action}
      </div>
    </div>
  )
}

export function InlineNotice({ tone = 'info', title, children, action }) {
  const palette = {
    info: { bg: 'var(--accent-wash)', fg: 'var(--accent-soft)', Glyph: Icon.Info },
    success: { bg: 'var(--success-wash)', fg: 'var(--success)', Glyph: Icon.Check },
    warning: { bg: 'var(--warning-wash)', fg: 'var(--warning)', Glyph: Icon.Alert },
    danger: { bg: 'var(--danger-wash)', fg: 'var(--danger)', Glyph: Icon.Alert },
  }[tone]

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
        borderRadius: 'var(--radius)', background: palette.bg,
        border: '1px solid color-mix(in srgb, currentColor 22%, transparent)',
        color: palette.fg,
      }}
    >
      <palette.Glyph size={18} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>{title}</p>}
        {children && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: title ? 2 : 0 }}>
            {children}
          </div>
        )}
      </div>
      {action}
    </div>
  )
}

// ── Loading ─────────────────────────────────────────────────────────────────

export function Spinner({ label = 'Loading' }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', padding: 48, color: 'var(--accent)' }}>
      <div className="spinner" style={{ width: 26, height: 26, borderWidth: 2.5 }} />
      <span className="sr-only">{label}</span>
    </div>
  )
}

/**
 * Skeletons match the shape of what is loading, so the layout does not jump
 * when the real content lands.
 */
export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="grid-products" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card card-flush">
          <div className="skeleton" style={{ aspectRatio: '1', borderRadius: 0 }} />
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="skeleton" style={{ height: 10, width: '45%' }} />
            <div className="skeleton" style={{ height: 14, width: '85%' }} />
            <div className="skeleton" style={{ height: 16, width: '55%' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ count = 4, height = 84 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" style={{ height, borderRadius: 'var(--radius-lg)' }} />
      ))}
    </div>
  )
}

export function StatSkeleton({ count = 4 }) {
  return (
    <div
      style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 92, borderRadius: 'var(--radius-lg)' }} />
      ))}
    </div>
  )
}

// ── Data display ────────────────────────────────────────────────────────────

export function StatCard({ label, value, hint, tone = 'accent', icon: Glyph }) {
  const colour = {
    accent: 'var(--accent-soft)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
    neutral: 'var(--text-muted)',
  }[tone]

  return (
    <motion.div className="card" variants={listItem} style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {Glyph ? (
          <span style={{ color: colour, display: 'flex' }}><Glyph size={16} /></span>
        ) : (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: colour }} />
        )}
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 600 }}>{label}</p>
      </div>
      <p
        style={{
          fontFamily: "'Syne', sans-serif", fontSize: '1.4rem', fontWeight: 700,
          lineHeight: 1.1, letterSpacing: '-0.02em',
        }}
      >
        {value}
      </p>
      {hint && (
        <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem', marginTop: 4 }}>{hint}</p>
      )}
    </motion.div>
  )
}

export function StatGrid({ children }) {
  return (
    <motion.div
      variants={listContainer}
      initial="initial"
      animate="animate"
      style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}
    >
      {children}
    </motion.div>
  )
}

const STATUS_TONE = {
  // Orders
  pending: ['badge-warning', 'Pending'],
  confirmed: ['badge-info', 'Confirmed'],
  processing: ['badge-info', 'Processing'],
  ready_for_delivery: ['badge-info', 'Ready'],
  shipped: ['badge-info', 'On the way'],
  delivered: ['badge-success', 'Delivered'],
  cancelled: ['badge-neutral', 'Cancelled'],
  refunded: ['badge-neutral', 'Refunded'],
  // Fulfilment
  preparing: ['badge-info', 'Preparing'],
  ready_for_pickup: ['badge-info', 'Ready for pickup'],
  in_transit: ['badge-info', 'On the way'],
  // Payments
  initiated: ['badge-warning', 'Arranged'],
  awaiting_confirmation: ['badge-warning', 'Awaiting confirmation'],
  successful: ['badge-success', 'Paid'],
  failed: ['badge-danger', 'Not verified'],
  // Sellers
  approved: ['badge-success', 'Approved'],
  rejected: ['badge-danger', 'Rejected'],
  suspended: ['badge-danger', 'Suspended'],
  // Disputes
  opened: ['badge-warning', 'Open'],
  under_review: ['badge-info', 'Under review'],
  seller_response: ['badge-info', 'Seller replied'],
  resolved: ['badge-success', 'Resolved'],
  closed: ['badge-neutral', 'Closed'],
}

export function StatusBadge({ status, label }) {
  const [tone, defaultLabel] = STATUS_TONE[status] ?? ['badge-neutral', status]
  return <span className={`badge ${tone}`}>{label ?? defaultLabel ?? '—'}</span>
}

export function Rating({ value = 0, count, size = 14, showEmpty = false }) {
  const rounded = Math.round(Number(value) || 0)
  if (!count && !showEmpty) return null

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{ display: 'inline-flex', gap: 1, color: 'var(--warning)' }}
        role="img"
        aria-label={`Rated ${Number(value).toFixed(1)} out of 5`}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <Icon.Star key={n} size={size} filled={n <= rounded} />
        ))}
      </span>
      {count != null && (
        <span style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>
          {Number(value).toFixed(1)} ({count})
        </span>
      )}
    </span>
  )
}

// ── Forms ───────────────────────────────────────────────────────────────────

/**
 * A labelled field. The label is genuinely associated with the control and
 * errors are announced, so this works with a screen reader as well as by eye.
 */
export function Field({ label, error, hint, required, children, htmlFor }) {
  const generated = useId()
  const id = htmlFor ?? generated

  return (
    <div className="field">
      {label && (
        <label className="label" htmlFor={id}>
          {label}
          {required && <span style={{ color: 'var(--danger)' }} aria-hidden="true"> *</span>}
        </label>
      )}
      {typeof children === 'function'
        ? children({ id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined })
        : children}
      {hint && !error && <span className="field-hint" id={`${id}-hint`}>{hint}</span>}
      {error && (
        <span className="field-error" id={`${id}-error`} role="alert">{error}</span>
      )}
    </div>
  )
}

/** A button that shows its own progress and cannot be double-submitted. */
export function SubmitButton({ loading, children, loadingLabel, className = 'btn btn-primary', ...rest }) {
  return (
    <button type="submit" className={className} disabled={loading || rest.disabled} {...rest}>
      {loading && <span className="spinner" aria-hidden="true" />}
      {loading ? (loadingLabel ?? 'Working…') : children}
    </button>
  )
}

export function QuantityStepper({ value, min = 1, max, onChange, label = 'Quantity', compact }) {
  const size = compact ? 32 : 40
  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center',
        border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        overflow: 'hidden', background: 'var(--surface)',
      }}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Decrease ${label.toLowerCase()}`}
        style={{ width: size, height: size, display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}
      >
        <Icon.Minus size={15} />
      </button>
      <span
        aria-live="polite"
        style={{ minWidth: 34, textAlign: 'center', fontWeight: 600, fontSize: '0.9375rem' }}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(max ? Math.min(max, value + 1) : value + 1)}
        disabled={max != null && value >= max}
        aria-label={`Increase ${label.toLowerCase()}`}
        style={{ width: size, height: size, display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}
      >
        <Icon.Plus size={15} />
      </button>
    </div>
  )
}

// ── Overlays ────────────────────────────────────────────────────────────────

/**
 * A modal dialog that behaves like one: focus moves inside on open, Escape
 * closes it, the page behind it does not scroll, and focus returns to
 * whatever opened it.
 */
export function Modal({ title, description, onClose, children, width = 480, footer }) {
  const panelRef = useRef(null)
  const previouslyFocused = useRef(null)
  const titleId = useId()

  useEffect(() => {
    previouslyFocused.current = document.activeElement
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const focusable = panelRef.current?.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    focusable?.focus()

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      // Keep Tab inside the dialog while it is open.
      const items = panelRef.current?.querySelectorAll(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      )
      if (!items?.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = overflow
      previouslyFocused.current?.focus?.()
    }
  }, [onClose])

  return (
    <motion.div
      {...modalBackdrop}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000, background: 'var(--overlay)',
        display: 'grid', placeItems: 'center', padding: 16,
        backdropFilter: 'blur(3px)',
      }}
    >
      <motion.div
        {...modalPanel}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          width: '100%', maxWidth: width, maxHeight: '88dvh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <h3 id={titleId} style={{ fontSize: '1rem' }}>{title}</h3>
            {description && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 2 }}>
                {description}
              </p>
            )}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <Icon.Close size={18} />
          </button>
        </div>
        <div style={{ padding: 18, overflowY: 'auto' }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: '14px 18px', borderTop: '1px solid var(--border)',
              display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap',
            }}
          >
            {footer}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

/** Destructive actions ask first, and say exactly what will happen. */
export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', tone = 'danger', onConfirm, onCancel, loading }) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      width={420}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className={tone === 'danger' ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <span className="spinner" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>{message}</p>
    </Modal>
  )
}

// ── Navigation ──────────────────────────────────────────────────────────────

export function Tabs({ tabs, active, onChange, label = 'Sections' }) {
  return (
    <div className="scroll-x" role="tablist" aria-label={label} style={{ paddingBottom: 2 }}>
      <div
        style={{
          display: 'inline-flex', gap: 4, padding: 4, minWidth: 'max-content',
          background: 'var(--bg-sunk)', borderRadius: 'var(--radius)',
        }}
      >
        {tabs.map((tab) => {
          const selected = tab.key === active
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.key)}
              style={{
                position: 'relative', padding: '8px 15px', minHeight: 38,
                borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', fontWeight: 600,
                color: selected ? 'var(--text)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {selected && (
                <motion.span
                  layoutId={`tab-${label}`}
                  style={{
                    position: 'absolute', inset: 0, background: 'var(--surface)',
                    borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)',
                  }}
                  transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                />
              )}
              <span style={{ position: 'relative' }}>{tab.label}</span>
              {tab.count != null && (
                <span
                  style={{
                    position: 'relative', fontSize: '0.6875rem', fontWeight: 700,
                    padding: '1px 6px', borderRadius: 'var(--radius-pill)',
                    background: selected ? 'var(--accent)' : 'var(--surface-hover)',
                    color: selected ? 'var(--on-accent)' : 'var(--text-subtle)',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Pagination({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null

  const from = page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)

  return (
    <nav
      aria-label="Pagination"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginTop: 24, flexWrap: 'wrap',
      }}
    >
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        Showing <strong style={{ color: 'var(--text)' }}>{from}–{to}</strong> of {total}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onChange(page - 1)}
          disabled={page === 0}
        >
          <Icon.ArrowLeft size={15} /> Previous
        </button>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '0 4px' }}>
          {page + 1} / {pages}
        </span>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onChange(page + 1)}
          disabled={page + 1 >= pages}
        >
          Next <Icon.ArrowRight size={15} />
        </button>
      </div>
    </nav>
  )
}
