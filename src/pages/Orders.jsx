import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import PageShell from '../layouts/PageShell'
import {
  PageHeader, Tabs, EmptyState, ErrorState, ListSkeleton, StatusBadge,
  InlineNotice, Modal, Field, SubmitButton, Rating,
} from '../components/UI'
import * as Icon from '../components/Icons'
import { useAuth } from '../context/auth-context'
import { useToast } from '../context/toast-context'
import {
  OrderService, PaymentService, ReviewService, DisputeService,
  DISPUTE_CATEGORIES, FULFILMENT_LABEL, PAYMENT_LABEL,
} from '../services/commerce'
import { SellerService } from '../services/accounts'
import { productImageUrl } from '../lib/supabase'
import { formatRwf, formatDateTime } from '../utils/format'
import { validateRating } from '../utils/validation'
import { listItem, listContainer } from '../lib/motion'
import { useAsyncData } from '../hooks/useAsyncData'

/**
 * The customer's orders.
 *
 * This page is where the honest payment story shows up: an order carries a
 * payment record with its own status, the customer can declare that they have
 * paid, and only the seller's confirmation flips it to paid. Reviews and
 * dispute reporting hang off delivered lines, which is what makes them
 * verified.
 */
export default function Orders() {
  const { user } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState('all')
  const [payingOrder, setPayingOrder] = useState(null)
  const [reviewTarget, setReviewTarget] = useState(null)
  const [disputeTarget, setDisputeTarget] = useState(null)

  const { status, data, error, reload, retry } = useAsyncData(
    useCallback(async () => {
      const [list, reviewed] = await Promise.all([
        OrderService.listForCustomer(user.id),
        ReviewService.reviewedItemIds(user.id),
      ])
      return { orders: list, reviewedItems: reviewed }
    }, [user.id])
  )

  const orders = data?.orders ?? []
  const reviewedItems = data?.reviewedItems ?? new Set()

  const counts = {
    all: orders.length,
    active: orders.filter((o) => !['delivered', 'cancelled', 'refunded'].includes(o.status)).length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    closed: orders.filter((o) => ['cancelled', 'refunded'].includes(o.status)).length,
  }

  const visible = orders.filter((order) => {
    if (tab === 'active') return !['delivered', 'cancelled', 'refunded'].includes(order.status)
    if (tab === 'delivered') return order.status === 'delivered'
    if (tab === 'closed') return ['cancelled', 'refunded'].includes(order.status)
    return true
  })

  const cancelOrder = async (order) => {
    try {
      await OrderService.cancel(order.id)
      toast.success(`Order ${order.reference} cancelled`)
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (status === 'loading') {
    return (
      <PageShell title="My orders" width="narrow">
        <PageHeader title="My orders" />
        <ListSkeleton count={3} height={180} />
      </PageShell>
    )
  }

  if (status === 'error') {
    return (
      <PageShell title="My orders" width="narrow">
        <PageHeader title="My orders" />
        <ErrorState title="We couldn't load your orders" description={error} onRetry={retry} />
      </PageShell>
    )
  }

  return (
    <PageShell title="My orders" width="narrow">
      <PageHeader
        title="My orders"
        subtitle="Track delivery, settle payment, and review what you have received"
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={Icon.Package}
          title="You have not ordered anything yet"
          description="When you place an order it will appear here, with its delivery progress and payment status."
          action={<Link to="/" className="btn btn-primary">Start shopping</Link>}
        />
      ) : (
        <>
          <Tabs
            label="Orders"
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'all', label: 'All', count: counts.all },
              { key: 'active', label: 'In progress', count: counts.active },
              { key: 'delivered', label: 'Delivered', count: counts.delivered },
              { key: 'closed', label: 'Closed', count: counts.closed },
            ]}
          />

          {visible.length === 0 ? (
            <EmptyState
              icon={Icon.Package}
              title="Nothing here"
              description="No orders match this filter."
            />
          ) : (
            <motion.div
              variants={listContainer}
              initial="initial"
              animate="animate"
              style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}
            >
              {visible.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  reviewedItems={reviewedItems}
                  onPay={() => setPayingOrder(order)}
                  onCancel={() => cancelOrder(order)}
                  onReview={(item) => setReviewTarget({ order, item })}
                  onDispute={(item) => setDisputeTarget({ order, item })}
                />
              ))}
            </motion.div>
          )}
        </>
      )}

      <AnimatePresence>
        {payingOrder && (
          <PaymentDialog
            order={payingOrder}
            onClose={() => setPayingOrder(null)}
            onDone={() => { setPayingOrder(null); reload() }}
          />
        )}
        {reviewTarget && (
          <ReviewDialog
            target={reviewTarget}
            userId={user.id}
            onClose={() => setReviewTarget(null)}
            onDone={() => { setReviewTarget(null); reload() }}
          />
        )}
        {disputeTarget && (
          <DisputeDialog
            target={disputeTarget}
            onClose={() => setDisputeTarget(null)}
            onDone={() => { setDisputeTarget(null); reload() }}
          />
        )}
      </AnimatePresence>
    </PageShell>
  )
}

// ── Order card ──────────────────────────────────────────────────────────────

function OrderCard({ order, reviewedItems, onPay, onCancel, onReview, onDispute }) {
  const payment = order.payment
  const paid = payment?.status === 'successful'
  const canDeclare = payment && ['pending', 'initiated', 'failed'].includes(payment.status)
  const canCancel = ['pending', 'confirmed'].includes(order.status) && !paid

  const disputedItems = new Set(order.disputes.map((d) => d.orderItemId))

  return (
    <motion.article variants={listItem} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <header
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 12, flexWrap: 'wrap',
        }}
      >
        <div>
          <p style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-soft)', fontSize: '0.875rem' }}>
            {order.reference}
          </p>
          <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>
            {formatDateTime(order.placedAt)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <StatusBadge status={order.status} />
          {payment && <StatusBadge status={payment.status} label={PAYMENT_LABEL[payment.status]} />}
        </div>
      </header>

      <ul style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {order.items.map((item) => {
          const shipment = order.shipments.find((s) => s.sellerId === item.sellerId)
          const delivered = shipment?.status === 'delivered'
          const reviewed = reviewedItems.has(item.id)
          const disputed = disputedItems.has(item.id)

          return (
            <li key={item.id} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
              <span
                style={{
                  width: 46, height: 46, borderRadius: 'var(--radius-sm)', flexShrink: 0,
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

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                  {item.productId ? (
                    <Link to={`/product/${item.productId}`}>{item.name}</Link>
                  ) : item.name}
                </p>
                <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>
                  {item.qty} × {formatRwf(item.unitPrice)}
                </p>

                {delivered && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
                    {reviewed ? (
                      <span className="badge badge-success"><Icon.Check size={11} /> Reviewed</span>
                    ) : (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => onReview(item)}>
                        <Icon.Star size={14} /> Write a review
                      </button>
                    )}
                    {disputed ? (
                      <span className="badge badge-warning">Case open</span>
                    ) : (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDispute(item)}>
                        Report a problem
                      </button>
                    )}
                  </div>
                )}
              </div>

              <span style={{ fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                {formatRwf(item.lineTotal)}
              </span>
            </li>
          )
        })}
      </ul>

      {/* Per-seller delivery progress: one customer order, several journeys. */}
      {order.shipments.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.04em', marginBottom: 8 }}>
            DELIVERY
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {order.shipments.map((shipment) => {
              const sellerItems = order.items.filter((i) => i.sellerId === shipment.sellerId)
              return (
                <div
                  key={shipment.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
                >
                  <Icon.Truck size={15} />
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', flex: 1, minWidth: 120 }}>
                    {sellerItems.length} item{sellerItems.length === 1 ? '' : 's'}
                    {shipment.trackingReference && (
                      <> · <span style={{ fontFamily: 'monospace' }}>{shipment.trackingReference}</span></>
                    )}
                  </span>
                  <StatusBadge status={shipment.status} label={FULFILMENT_LABEL[shipment.status]} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      <dl
        style={{
          borderTop: '1px solid var(--border)', paddingTop: 12,
          display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.875rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <dt style={{ color: 'var(--text-muted)' }}>Subtotal</dt>
          <dd>{formatRwf(order.subtotal)}</dd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <dt style={{ color: 'var(--text-muted)' }}>Delivery</dt>
          <dd>{order.deliveryFee === 0 ? 'Free' : formatRwf(order.deliveryFee)}</dd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
          <dt>Total</dt>
          <dd style={{ color: 'var(--accent-soft)' }}>{formatRwf(order.total)}</dd>
        </div>
      </dl>

      <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>
        Delivering to {order.deliveryName}, {order.deliveryAddress} · {order.deliveryPhone}
      </p>

      {payment?.status === 'awaiting_confirmation' && (
        <InlineNotice tone="warning" title="Waiting for the seller to confirm">
          You told us you paid{payment.customerReference && <> with reference <strong>{payment.customerReference}</strong></>}.
          The order will show as paid once the seller confirms the money arrived.
        </InlineNotice>
      )}

      {payment?.status === 'failed' && (
        <InlineNotice tone="danger" title="Payment not verified">
          {payment.failureReason || 'The seller could not find this payment.'} You can try again
          with the correct reference.
        </InlineNotice>
      )}

      {paid && (
        <InlineNotice tone="success" title="Payment confirmed">
          The seller has confirmed receiving {formatRwf(payment.amount)}.
        </InlineNotice>
      )}

      {(canDeclare || canCancel) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canDeclare && (
            <button type="button" className="btn btn-primary btn-sm" onClick={onPay}>
              <Icon.Receipt size={15} />
              {payment.provider === 'cash_on_delivery' ? 'Confirm cash on delivery' : 'I have paid'}
            </button>
          )}
          {canCancel && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
              Cancel order
            </button>
          )}
        </div>
      )}
    </motion.article>
  )
}

// ── Payment dialog ──────────────────────────────────────────────────────────

/**
 * Where the buyer declares an out-of-band payment. It never marks the order
 * paid — the wording and the outcome both make that clear.
 */
function PaymentDialog({ order, onClose, onDone }) {
  const toast = useToast()
  const [stores, setStores] = useState([])
  const [reference, setReference] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const cashOnDelivery = order.payment?.provider === 'cash_on_delivery'
  const needsReference = !cashOnDelivery

  useEffect(() => {
    const sellerIds = [...new Set(order.items.map((i) => i.sellerId))]
    Promise.all(sellerIds.map((id) => SellerService.get(id)))
      .then((results) => setStores(results.filter(Boolean)))
      .catch(() => setStores([]))
  }, [order])

  const submit = async (event) => {
    event.preventDefault()
    setError(null)

    if (needsReference && reference.trim().length < 4) {
      setError('Enter the transaction reference from your payment confirmation message.')
      return
    }

    setLoading(true)
    try {
      await PaymentService.declare(order.id, reference)
      toast.success('Thanks — the seller has been asked to confirm')
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={cashOnDelivery ? 'Cash on delivery' : 'Tell us you have paid'}
      description={`Order ${order.reference} · ${formatRwf(order.total)}`}
      onClose={onClose}
      width={470}
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <InlineNotice tone="danger" title="Could not submit">{error}</InlineNotice>}

        {!cashOnDelivery && (
          <>
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 8 }}>
                Pay {stores.length > 1 ? 'each store' : 'the store'} directly
              </p>
              {stores.length === 0 ? (
                <p style={{ color: 'var(--text-subtle)', fontSize: '0.8125rem' }}>
                  Loading payment details…
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {stores.map((store) => {
                    const storeTotal = order.items
                      .filter((i) => i.sellerId === store.id)
                      .reduce((sum, i) => sum + i.lineTotal, 0)
                    return (
                      <div key={store.id} className="panel">
                        <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{store.storeName}</p>
                        <p style={{ color: 'var(--accent-soft)', fontWeight: 700, fontSize: '0.875rem' }}>
                          {formatRwf(storeTotal)}
                        </p>
                        {store.momoNumber && (
                          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            <strong>MoMo:</strong> {store.momoNumber}
                            {store.momoName && ` (${store.momoName})`}
                          </p>
                        )}
                        {store.bankAccount && (
                          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                            <strong>Bank:</strong> {store.bankName} — {store.bankAccount}
                          </p>
                        )}
                        {!store.momoNumber && !store.bankAccount && (
                          <p style={{ fontSize: '0.8125rem', color: 'var(--warning)', marginTop: 4 }}>
                            This store has not published payment details yet. Message them to arrange payment.
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <Field
              label="Transaction reference"
              required
              hint="The confirmation code from your MoMo or bank message. The seller uses it to find your payment."
              htmlFor="payment-reference"
            >
              <input
                id="payment-reference"
                className="input"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. MP240101.1234.A56789"
              />
            </Field>
          </>
        )}

        <InlineNotice tone="info" title="This does not mark the order paid">
          {cashOnDelivery
            ? 'The seller marks the order paid once they receive the cash on delivery.'
            : 'SwiftBuy passes your reference to the seller. They confirm it from their own account, and only then does the order show as paid.'}
        </InlineNotice>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <SubmitButton loading={loading} loadingLabel="Submitting…">
            {cashOnDelivery ? 'Confirm cash on delivery' : 'Submit for confirmation'}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  )
}

// ── Review dialog ───────────────────────────────────────────────────────────

function ReviewDialog({ target, userId, onClose, onDone }) {
  const toast = useToast()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    const problem = validateRating(rating)
    setError(problem)
    if (problem) return

    setLoading(true)
    try {
      await ReviewService.submit({
        productId: target.item.productId,
        userId,
        orderItemId: target.item.id,
        rating,
        comment,
      })
      toast.success('Thanks for your review')
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Write a review"
      description={target.item.name}
      onClose={onClose}
      width={440}
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <InlineNotice tone="danger" title="Could not submit your review">{error}</InlineNotice>}

        <fieldset style={{ border: 0 }}>
          <legend className="label" style={{ marginBottom: 8 }}>Your rating</legend>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                aria-pressed={rating === value}
                style={{
                  padding: 4, color: value <= rating ? 'var(--warning)' : 'var(--border-strong)',
                  transition: 'color 140ms',
                }}
              >
                <Icon.Star size={28} filled={value <= rating} />
              </button>
            ))}
          </div>
        </fieldset>

        <Field label="Your review" hint="Optional — what should other buyers know?" htmlFor="review-comment">
          <textarea
            id="review-comment"
            className="input"
            rows={4}
            maxLength={2000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="How was the product and the delivery?"
          />
        </Field>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <SubmitButton loading={loading} loadingLabel="Publishing…">Publish review</SubmitButton>
        </div>
      </form>
    </Modal>
  )
}

// ── Dispute dialog ──────────────────────────────────────────────────────────

function DisputeDialog({ target, onClose, onDone }) {
  const toast = useToast()
  const [category, setCategory] = useState('product_damaged')
  const [description, setDescription] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (description.trim().length < 10) {
      setError('Please describe the problem in a little more detail.')
      return
    }

    setLoading(true)
    try {
      await DisputeService.open({
        orderId: target.order.id,
        orderItemId: target.item.id,
        category,
        description,
      })
      toast.success('Your case has been opened')
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Report a problem" description={target.item.name} onClose={onClose} width={460}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <InlineNotice tone="danger" title="Could not open the case">{error}</InlineNotice>}

        <Field label="What went wrong?" required htmlFor="dispute-category">
          <select
            id="dispute-category"
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {DISPUTE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Tell us what happened" required htmlFor="dispute-description">
          <textarea
            id="dispute-description"
            className="input"
            rows={4}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the problem so the seller and SwiftBuy can look into it."
          />
        </Field>

        <InlineNotice tone="info" title="What happens next">
          The seller is notified and can reply. A SwiftBuy administrator reviews the case and
          decides the outcome. Any refund is recorded by SwiftBuy — it is not automatic.
        </InlineNotice>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <SubmitButton loading={loading} loadingLabel="Opening case…">Open case</SubmitButton>
        </div>
      </form>
    </Modal>
  )
}
