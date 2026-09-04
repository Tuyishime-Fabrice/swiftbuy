import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import PageShell from '../layouts/PageShell'
import { PageHeader, EmptyState, ErrorState, ListSkeleton, QuantityStepper, InlineNotice } from '../components/UI'
import * as Icon from '../components/Icons'
import { useAuth } from '../context/auth-context'
import { useToast } from '../context/toast-context'
import { CartService } from '../services/commerce'
import { SettingsService } from '../services/accounts'
import { productImageUrl } from '../lib/supabase'
import { formatRwf } from '../utils/format'
import { listItem } from '../lib/motion'
import { useAsyncData } from '../hooks/useAsyncData'

export default function Cart() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [busy, setBusy] = useState(null)

  const { status, data, error, reload, retry, setData } = useAsyncData(
    useCallback(async () => {
      const [cart, config] = await Promise.all([CartService.list(user.id), SettingsService.get()])
      return { items: cart, settings: config }
    }, [user.id])
  )

  const items = data?.items ?? []
  const settings = data?.settings ?? null

  const changeQty = async (item, qty) => {
    setBusy(item.cartItemId)

    setData((current) => ({
      ...current,
      items: current.items.map((i) => (i.cartItemId === item.cartItemId ? { ...i, qty } : i)),
    }))
    try {
      await CartService.setQty(item.cartItemId, qty)
    } catch (err) {
      toast.error(err.message)
      reload()
    } finally {
      setBusy(null)
    }
  }

  const remove = async (item) => {
    setBusy(item.cartItemId)
    try {
      await CartService.remove(item.cartItemId)
      setData((current) => ({
        ...current,
        items: current.items.filter((i) => i.cartItemId !== item.cartItemId),
      }))
      toast.info(`${item.name} removed from your cart`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(null)
    }
  }

  const subtotal = items
    .filter((i) => i.available)
    .reduce((sum, i) => sum + i.price * i.qty, 0)

  const deliveryFee = settings
    ? (settings.freeDeliveryOver != null && subtotal >= settings.freeDeliveryOver ? 0 : settings.deliveryFee)
    : 0

  const unavailable = items.filter((i) => !i.available)
  const canCheckout = items.length > 0 && unavailable.length === 0

  if (status === 'loading') {
    return (
      <PageShell title="Cart">
        <PageHeader title="Your cart" />
        <ListSkeleton count={3} height={100} />
      </PageShell>
    )
  }

  if (status === 'error') {
    return (
      <PageShell title="Cart">
        <PageHeader title="Your cart" />
        <ErrorState title="We couldn't load your cart" description={error} onRetry={retry} />
      </PageShell>
    )
  }

  if (items.length === 0) {
    return (
      <PageShell title="Cart">
        <PageHeader title="Your cart" />
        <EmptyState
          icon={Icon.Cart}
          title="Your cart is empty"
          description="Products you add will be saved here — on any device you sign in from."
          action={<Link to="/" className="btn btn-primary">Browse products</Link>}
        />
      </PageShell>
    )
  }

  return (
    <PageShell title="Cart">
      <PageHeader
        title="Your cart"
        subtitle={`${items.length} ${items.length === 1 ? 'product' : 'products'}`}
      />

      {unavailable.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <InlineNotice tone="warning" title="Some items are no longer available">
            {unavailable.map((i) => i.name).join(', ')} {unavailable.length === 1 ? 'is' : 'are'} out
            of stock or has been delisted. Remove {unavailable.length === 1 ? 'it' : 'them'} to
            continue to checkout.
          </InlineNotice>
        </div>
      )}

      <div
        style={{
          display: 'grid', gap: 20, alignItems: 'start',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
        }}
      >
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.li
                key={item.cartItemId}
                layout
                variants={listItem}
                initial="initial"
                animate="animate"
                exit={{ opacity: 0, x: -20, transition: { duration: 0.16 } }}
                className="card"
                style={{ padding: 14, display: 'flex', gap: 13, alignItems: 'flex-start' }}
              >
                <Link
                  to={`/product/${item.productId}`}
                  style={{
                    width: 68, height: 68, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                    background: 'var(--bg-sunk)', overflow: 'hidden',
                    display: 'grid', placeItems: 'center', color: 'var(--text-subtle)',
                  }}
                >
                  {item.imagePath ? (
                    <img
                      src={productImageUrl(item.imagePath, { width: 160 })}
                      alt=""
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Icon.Image size={20} />
                  )}
                </Link>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link to={`/product/${item.productId}`}>
                    <p style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{item.name}</p>
                  </Link>
                  {item.storeName && (
                    <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>{item.storeName}</p>
                  )}
                  <p style={{ color: 'var(--accent-soft)', fontWeight: 600, fontSize: '0.875rem', marginTop: 3 }}>
                    {formatRwf(item.price)} each
                  </p>

                  {!item.available && (
                    <span className="badge badge-danger" style={{ marginTop: 6 }}>Unavailable</span>
                  )}

                  <div
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: 10, marginTop: 10, flexWrap: 'wrap',
                    }}
                  >
                    <QuantityStepper
                      value={item.qty}
                      max={item.stock || undefined}
                      onChange={(qty) => changeQty(item, qty)}
                      compact
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
                        {formatRwf(item.price * item.qty)}
                      </span>
                      <button
                        type="button"
                        onClick={() => remove(item)}
                        disabled={busy === item.cartItemId}
                        aria-label={`Remove ${item.name} from cart`}
                        style={{ color: 'var(--danger)', display: 'flex', padding: 6 }}
                      >
                        <Icon.Trash size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <aside
          className="card"
          style={{ position: 'sticky', top: 'calc(var(--nav-height) + 20px)' }}
          aria-label="Order summary"
        >
          <h2 style={{ fontSize: '1rem', marginBottom: 14 }}>Summary</h2>

          <dl style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.875rem' }}>
            <Row label="Subtotal" value={formatRwf(subtotal)} />
            <Row
              label="Delivery"
              value={deliveryFee === 0 ? 'Free' : formatRwf(deliveryFee)}
            />
          </dl>

          <div
            style={{
              borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 14,
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            }}
          >
            <span style={{ fontWeight: 700 }}>Estimated total</span>
            <span style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--accent-soft)' }}>
              {formatRwf(subtotal + deliveryFee)}
            </span>
          </div>

          <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem', marginTop: 8 }}>
            SwiftBuy recalculates this from live prices when you place the order, so what you are
            charged always matches the catalogue.
          </p>

          <button
            type="button"
            className="btn btn-primary btn-block"
            style={{ marginTop: 16 }}
            disabled={!canCheckout}
            onClick={() => navigate('/checkout')}
          >
            Continue to checkout <Icon.ArrowRight size={16} />
          </button>

          <Link
            to="/"
            className="btn btn-ghost btn-sm btn-block"
            style={{ marginTop: 8 }}
          >
            Keep shopping
          </Link>
        </aside>
      </div>
    </PageShell>
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
