import { useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import PageShell from '../layouts/PageShell'
import {
  PageHeader, Field, EmptyState, ErrorState, ListSkeleton, InlineNotice, SubmitButton,
} from '../components/UI'
import * as Icon from '../components/Icons'
import { useAuth } from '../context/auth-context'
import { useToast } from '../context/toast-context'
import { CartService, OrderService, PAYMENT_METHODS } from '../services/commerce'
import { SettingsService, ProfileService } from '../services/accounts'
import { productImageUrl } from '../lib/supabase'
import { formatRwf } from '../utils/format'
import { validateFullName, validatePhone, validateAddress, collectErrors } from '../utils/validation'
import { stepVariants } from '../lib/motion'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useAsyncData } from '../hooks/useAsyncData'

/**
 * Checkout.
 *
 * Three steps — delivery, payment method, review — then one call to
 * place_order. The client sends where to deliver and how the buyer intends to
 * pay; the server decides what it costs. A ref guards against a double
 * submission producing two orders if the button is pressed twice.
 */

const STEPS = [
  { key: 'delivery', label: 'Delivery' },
  { key: 'payment', label: 'Payment' },
  { key: 'review', label: 'Review' },
]

export default function Checkout() {
  const { user } = useAuth()
  const toast = useToast()
  const reducedMotion = useReducedMotion()

  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState(1)

  // What the customer has typed. Anything they have not touched falls back to
  // their saved profile, which avoids an effect that copies loaded data into
  // form state after render.
  const [typed, setTyped] = useState({})
  const [paymentProvider, setPaymentProvider] = useState('manual_momo')
  const [errors, setErrors] = useState({})
  const [placeError, setPlaceError] = useState(null)
  const [placing, setPlacing] = useState(false)
  const [placed, setPlaced] = useState(null)

  // Belt and braces against a double-click racing past the disabled state.
  const submitting = useRef(false)

  const { status, data, error: loadError, retry } = useAsyncData(
    useCallback(async () => {
      const [cart, config, profile] = await Promise.all([
        CartService.list(user.id),
        SettingsService.get(),
        ProfileService.get(user.id),
      ])
      return { items: cart, settings: config, profile }
    }, [user.id])
  )

  const items = data?.items ?? []
  const settings = data?.settings ?? null
  const profile = data?.profile ?? null

  const delivery = {
    name: typed.name ?? profile?.full_name ?? user.name ?? '',
    phone: typed.phone ?? profile?.phone ?? '',
    address: typed.address ?? profile?.address ?? '',
    notes: typed.notes ?? '',
  }
  const updateDelivery = (patch) => setTyped((current) => ({ ...current, ...patch }))

  const subtotal = items.filter((i) => i.available).reduce((sum, i) => sum + i.price * i.qty, 0)
  const deliveryFee = settings
    ? (settings.freeDeliveryOver != null && subtotal >= settings.freeDeliveryOver ? 0 : settings.deliveryFee)
    : 0

  const goTo = (index) => {
    setDirection(index > stepIndex ? 1 : -1)
    setStepIndex(index)
  }

  const validateDelivery = () => {
    const found = collectErrors({
      name: validateFullName(delivery.name),
      phone: validatePhone(delivery.phone),
      address: validateAddress(delivery.address),
    })
    setErrors(found)
    return Object.keys(found).length === 0
  }

  const placeOrder = async () => {
    if (submitting.current) return
    submitting.current = true
    setPlacing(true)
    setPlaceError(null)

    try {
      const result = await OrderService.place({
        name: delivery.name,
        phone: delivery.phone,
        address: delivery.address,
        paymentProvider,
        notes: delivery.notes,
      })
      setPlaced(result)
      toast.success(`Order ${result.reference} placed`)
    } catch (err) {
      // Stock ran out, a store was suspended, a price rule failed — the message
      // comes from the database and is already written for the customer.
      setPlaceError(err.message)
      submitting.current = false
    } finally {
      setPlacing(false)
    }
  }

  if (placed) return <OrderPlaced result={placed} provider={paymentProvider} />

  if (status === 'loading') {
    return (
      <PageShell title="Checkout" width="narrow">
        <PageHeader title="Checkout" />
        <ListSkeleton count={3} height={110} />
      </PageShell>
    )
  }

  if (status === 'error') {
    return (
      <PageShell title="Checkout" width="narrow">
        <PageHeader title="Checkout" />
        <ErrorState title="We couldn't start checkout" description={loadError} onRetry={retry} />
      </PageShell>
    )
  }

  const available = items.filter((i) => i.available)
  if (available.length === 0) {
    return (
      <PageShell title="Checkout" width="narrow">
        <PageHeader title="Checkout" />
        <EmptyState
          icon={Icon.Cart}
          title="There is nothing to check out"
          description="Your cart is empty, or everything in it has become unavailable."
          action={<Link to="/" className="btn btn-primary">Browse products</Link>}
        />
      </PageShell>
    )
  }

  const step = STEPS[stepIndex].key

  return (
    <PageShell title="Checkout" width="narrow">
      <PageHeader title="Checkout" back={{ to: '/cart', label: 'Back to cart' }} />

      <Stepper steps={STEPS} activeIndex={stepIndex} onSelect={(i) => i < stepIndex && goTo(i)} />

      <div style={{ marginTop: 24, overflow: 'hidden' }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            variants={reducedMotion ? undefined : stepVariants(direction)}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {step === 'delivery' && (
              <DeliveryStep
                delivery={delivery}
                errors={errors}
                onChange={updateDelivery}
                onNext={() => { if (validateDelivery()) goTo(1) }}
              />
            )}

            {step === 'payment' && (
              <PaymentStep
                items={available}
                value={paymentProvider}
                onChange={setPaymentProvider}
                onBack={() => goTo(0)}
                onNext={() => goTo(2)}
              />
            )}

            {step === 'review' && (
              <ReviewStep
                items={available}
                delivery={delivery}
                paymentProvider={paymentProvider}
                subtotal={subtotal}
                deliveryFee={deliveryFee}
                placing={placing}
                error={placeError}
                onBack={() => goTo(1)}
                onPlace={placeOrder}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </PageShell>
  )
}

// ── Stepper ─────────────────────────────────────────────────────────────────

function Stepper({ steps, activeIndex, onSelect }) {
  return (
    <ol style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {steps.map((step, index) => {
        const done = index < activeIndex
        const active = index === activeIndex
        return (
          <li key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <button
              type="button"
              onClick={() => onSelect(index)}
              disabled={index >= activeIndex}
              aria-current={active ? 'step' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, minWidth: 0,
                cursor: index < activeIndex ? 'pointer' : 'default',
              }}
            >
              <span
                style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  display: 'grid', placeItems: 'center',
                  fontSize: '0.75rem', fontWeight: 700,
                  background: done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--surface-hover)',
                  color: done || active ? '#fff' : 'var(--text-subtle)',
                  transition: 'background 200ms',
                }}
              >
                {done ? <Icon.Check size={14} /> : index + 1}
              </span>
              <span
                style={{
                  fontSize: '0.8125rem', fontWeight: active ? 600 : 500,
                  color: active ? 'var(--text)' : 'var(--text-subtle)',
                  whiteSpace: 'nowrap',
                }}
              >
                {step.label}
              </span>
            </button>
            {index < steps.length - 1 && (
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
  )
}

// ── Steps ───────────────────────────────────────────────────────────────────

function DeliveryStep({ delivery, errors, onChange, onNext }) {
  return (
    <form
      className="card"
      onSubmit={(e) => { e.preventDefault(); onNext() }}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <h2 style={{ fontSize: '1rem' }}>Where should we deliver?</h2>

      <Field label="Full name" required error={errors.name} htmlFor="delivery-name">
        <input
          id="delivery-name" className="input" autoComplete="name"
          value={delivery.name} onChange={(e) => onChange({ name: e.target.value })}
          aria-invalid={errors.name ? 'true' : undefined}
        />
      </Field>

      <Field
        label="Phone number"
        required
        error={errors.phone}
        hint="The seller or courier will use this to reach you"
        htmlFor="delivery-phone"
      >
        <input
          id="delivery-phone" className="input" type="tel" autoComplete="tel"
          value={delivery.phone} onChange={(e) => onChange({ phone: e.target.value })}
          placeholder="+250 78 000 0000"
          aria-invalid={errors.phone ? 'true' : undefined}
        />
      </Field>

      <Field label="Delivery address" required error={errors.address} htmlFor="delivery-address">
        <textarea
          id="delivery-address" className="input" rows={3} autoComplete="street-address"
          value={delivery.address} onChange={(e) => onChange({ address: e.target.value })}
          placeholder="e.g. KK 243 St, House 12, Kicukiro, Kigali"
          aria-invalid={errors.address ? 'true' : undefined}
        />
      </Field>

      <Field label="Delivery notes" hint="Optional — landmarks, gate codes, best time to call" htmlFor="delivery-notes">
        <textarea
          id="delivery-notes" className="input" rows={2}
          value={delivery.notes} onChange={(e) => onChange({ notes: e.target.value })}
        />
      </Field>

      <button type="submit" className="btn btn-primary btn-block">
        Continue to payment <Icon.ArrowRight size={16} />
      </button>
    </form>
  )
}

function PaymentStep({ items, value, onChange, onBack, onNext }) {
  // Show the payment details of each store in the basket, so the buyer knows
  // where the money is going before they choose a method.
  const stores = [...new Map(items.map((i) => [i.sellerId, i.storeName])).entries()]

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: '1rem' }}>How would you like to pay?</h2>

      <InlineNotice tone="info" title="Payment is confirmed by the seller">
        SwiftBuy does not process card payments. You pay the seller directly, tell us the
        reference, and the order is only marked paid once the seller confirms the money arrived.
      </InlineNotice>

      <fieldset style={{ border: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <legend className="sr-only">Payment method</legend>
        {PAYMENT_METHODS.map((method) => (
          <label
            key={method.value}
            style={{
              display: 'flex', gap: 12, padding: '14px 15px', cursor: 'pointer',
              borderRadius: 'var(--radius)',
              border: `1px solid ${value === method.value ? 'var(--accent)' : 'var(--border)'}`,
              background: value === method.value ? 'var(--accent-wash)' : 'var(--surface)',
              transition: 'border-color 140ms, background 140ms',
            }}
          >
            <input
              type="radio"
              name="payment-method"
              value={method.value}
              checked={value === method.value}
              onChange={() => onChange(method.value)}
              style={{ marginTop: 3, accentColor: 'var(--accent)', width: 17, height: 17 }}
            />
            <span>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.9375rem' }}>
                {method.label}
              </span>
              <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: 2 }}>
                {method.hint}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {stores.length > 1 && (
        <p style={{ color: 'var(--text-subtle)', fontSize: '0.8125rem' }}>
          Your basket has products from {stores.length} stores. Each store confirms its own part of
          the order, and you will see payment details for each after placing it.
        </p>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          <Icon.ArrowLeft size={16} /> Back
        </button>
        <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={onNext}>
          Review order <Icon.ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}

function ReviewStep({ items, delivery, paymentProvider, subtotal, deliveryFee, placing, error, onBack, onPlace }) {
  const method = PAYMENT_METHODS.find((m) => m.value === paymentProvider)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {error && <InlineNotice tone="danger" title="We could not place your order">{error}</InlineNotice>}

      <section className="card">
        <h2 style={{ fontSize: '1rem', marginBottom: 12 }}>Your order</h2>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item) => (
            <li key={item.cartItemId} style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
              <span
                style={{
                  width: 44, height: 44, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                  background: 'var(--bg-sunk)', overflow: 'hidden',
                  display: 'grid', placeItems: 'center', color: 'var(--text-subtle)',
                }}
              >
                {item.imagePath ? (
                  <img
                    src={productImageUrl(item.imagePath, { width: 100 })}
                    alt="" loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : <Icon.Image size={16} />}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600 }}>{item.name}</span>
                <span style={{ display: 'block', color: 'var(--text-subtle)', fontSize: '0.75rem' }}>
                  {item.storeName} · {item.qty} × {formatRwf(item.price)}
                </span>
              </span>
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                {formatRwf(item.price * item.qty)}
              </span>
            </li>
          ))}
        </ul>

        <dl
          style={{
            marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.875rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <dt style={{ color: 'var(--text-muted)' }}>Subtotal</dt>
            <dd style={{ fontWeight: 600 }}>{formatRwf(subtotal)}</dd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <dt style={{ color: 'var(--text-muted)' }}>Delivery</dt>
            <dd style={{ fontWeight: 600 }}>{deliveryFee === 0 ? 'Free' : formatRwf(deliveryFee)}</dd>
          </div>
          <div
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              paddingTop: 10, borderTop: '1px solid var(--border)',
            }}
          >
            <dt style={{ fontWeight: 700 }}>Total</dt>
            <dd style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--accent-soft)' }}>
              {formatRwf(subtotal + deliveryFee)}
            </dd>
          </div>
        </dl>

        <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem', marginTop: 8 }}>
          SwiftBuy recalculates this total from live prices as your order is created. If anything
          has changed, the order will show the real figure and nothing is charged before you pay.
        </p>
      </section>

      <section className="card">
        <h2 style={{ fontSize: '1rem', marginBottom: 10 }}>Delivering to</h2>
        <p style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{delivery.name}</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{delivery.phone}</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{delivery.address}</p>
        {delivery.notes && (
          <p style={{ color: 'var(--text-subtle)', fontSize: '0.8125rem', marginTop: 6 }}>
            Notes: {delivery.notes}
          </p>
        )}
        <p style={{ marginTop: 12, fontSize: '0.875rem' }}>
          <strong>Paying by:</strong> {method?.label}
        </p>
      </section>

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="btn btn-ghost" onClick={onBack} disabled={placing}>
          <Icon.ArrowLeft size={16} /> Back
        </button>
        <SubmitButton
          loading={placing}
          loadingLabel="Placing your order…"
          onClick={onPlace}
          type="button"
          className="btn btn-primary"
          style={{ flex: 1 }}
        >
          Place order
        </SubmitButton>
      </div>
    </div>
  )
}

// ── Confirmation ────────────────────────────────────────────────────────────

function OrderPlaced({ result, provider }) {
  return (
    <PageShell title="Order placed" width="narrow">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ textAlign: 'center', padding: '32px 0' }}
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.08 }}
          style={{
            width: 66, height: 66, borderRadius: '50%', margin: '0 auto 20px',
            background: 'var(--success-wash)', color: 'var(--success)',
            display: 'grid', placeItems: 'center',
          }}
        >
          <Icon.Check size={30} />
        </motion.div>

        <h1 style={{ marginBottom: 10 }}>Order placed</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>
          Your reference is{' '}
          <strong style={{ color: 'var(--accent-soft)', fontFamily: 'monospace' }}>
            {result.reference}
          </strong>
        </p>
        <p style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 24 }}>
          {formatRwf(result.total)}
        </p>

        <div style={{ textAlign: 'left', marginBottom: 24 }}>
          <InlineNotice tone="warning" title="Not paid yet">
            {provider === 'cash_on_delivery'
              ? 'You will pay when the order is delivered. The seller marks it paid once they receive the money.'
              : 'Open the order to see the seller’s payment details, pay them, then enter your transaction reference. The seller confirms it from their side.'}
          </InlineNotice>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/orders" className="btn btn-primary">View my orders</Link>
          <Link to="/" className="btn btn-outline">Keep shopping</Link>
        </div>
      </motion.div>
    </PageShell>
  )
}
