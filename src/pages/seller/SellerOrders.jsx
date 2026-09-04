import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SellerLayout from '../../layouts/SellerLayout'
import {
  PageHeader, Tabs, StatCard, StatGrid, StatSkeleton, ListSkeleton, EmptyState,
  ErrorState, StatusBadge, InlineNotice, Modal, Field, SubmitButton,
} from '../../components/UI'
import * as Icon from '../../components/Icons'
import { useAuth } from '../../context/auth-context'
import { useToast } from '../../context/toast-context'
import {
  OrderService, ShipmentService, PaymentService, DisputeService,
  FULFILMENT_FLOW, FULFILMENT_LABEL, PAYMENT_LABEL,
} from '../../services/commerce'
import { SellerService } from '../../services/accounts'
import { formatRwf, formatDateTime } from '../../utils/format'
import { listContainer, listItem } from '../../lib/motion'
import { useAsyncData } from '../../hooks/useAsyncData'

export default function SellerOrders() {
  const { user } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState('action')
  const [paymentTarget, setPaymentTarget] = useState(null)
  const [caseTarget, setCaseTarget] = useState(null)

  const { status, data, error, reload, retry } = useAsyncData(
    useCallback(async () => {
      const [orderList, earningsData, caseList] = await Promise.all([
        OrderService.listForSeller(user.id),
        SellerService.earnings(user.id),
        DisputeService.list().catch(() => []),
      ])
      return { orders: orderList, earnings: earningsData, cases: caseList }
    }, [user.id])
  )

  const orders = data?.orders ?? []
  const earnings = data?.earnings ?? null
  const cases = data?.cases ?? []

  const needsAction = orders.filter(
    (o) =>
      o.payment?.status === 'awaiting_confirmation' ||
      (o.shipment && !['delivered', 'cancelled'].includes(o.shipment.status))
  )
  const completed = orders.filter((o) => o.shipment?.status === 'delivered')
  const openCases = cases.filter((c) => !['resolved', 'closed'].includes(c.status))

  const visible =
    tab === 'action' ? needsAction :
    tab === 'completed' ? completed :
    orders

  const advance = async (order, nextStatus) => {
    try {
      await ShipmentService.setStatus(order.shipment.id, nextStatus)
      toast.success(`Order ${order.reference} marked ${FULFILMENT_LABEL[nextStatus].toLowerCase()}`)
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (status === 'loading') {
    return (
      <SellerLayout title="Orders">
        <PageHeader title="Orders" />
        <StatSkeleton count={4} />
        <div style={{ marginTop: 20 }}><ListSkeleton count={3} height={170} /></div>
      </SellerLayout>
    )
  }

  if (status === 'error') {
    return (
      <SellerLayout title="Orders">
        <PageHeader title="Orders" />
        <ErrorState title="We couldn't load your orders" description={error} onRetry={retry} />
      </SellerLayout>
    )
  }

  return (
    <SellerLayout title="Orders">
      <PageHeader
        title="Orders"
        subtitle="Confirm payments and move each order through to delivery"
      />

      <StatGrid>
        <StatCard label="Orders received" value={orders.length} icon={Icon.Package} />
        <StatCard label="Needing action" value={needsAction.length} tone="warning" icon={Icon.Clock} />
        <StatCard label="Delivered" value={completed.length} tone="success" icon={Icon.Check} />
        <StatCard
          label="Settled earnings"
          value={formatRwf(earnings?.net ?? 0)}
          hint="After commission, from confirmed payments only"
          tone="success"
          icon={Icon.Receipt}
        />
      </StatGrid>

      {openCases.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <InlineNotice
            tone="warning"
            title={`${openCases.length} open case${openCases.length === 1 ? '' : 's'}`}
            action={
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setCaseTarget(openCases[0])}>
                Review
              </button>
            }
          >
            A customer has reported a problem with an order from your store.
          </InlineNotice>
        </div>
      )}

      <div style={{ margin: '22px 0 18px' }}>
        <Tabs
          label="Seller orders"
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'action', label: 'Needs action', count: needsAction.length },
            { key: 'completed', label: 'Delivered', count: completed.length },
            { key: 'all', label: 'All', count: orders.length },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Icon.Package}
          title={tab === 'action' ? 'Nothing needs your attention' : 'No orders here yet'}
          description={
            tab === 'action'
              ? 'Every order is either delivered or waiting on the customer.'
              : 'Orders containing your products will appear here as customers place them.'
          }
        />
      ) : (
        <motion.div
          variants={listContainer}
          initial="initial"
          animate="animate"
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {visible.map((order) => (
            <SellerOrderCard
              key={order.id}
              order={order}
              cases={cases.filter((c) => c.orderId === order.id)}
              onAdvance={advance}
              onVerifyPayment={() => setPaymentTarget(order)}
              onOpenCase={setCaseTarget}
            />
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {paymentTarget && (
          <VerifyPaymentDialog
            order={paymentTarget}
            onClose={() => setPaymentTarget(null)}
            onDone={() => { setPaymentTarget(null); reload() }}
          />
        )}
        {caseTarget && (
          <RespondToCaseDialog
            dispute={caseTarget}
            onClose={() => setCaseTarget(null)}
            onDone={() => { setCaseTarget(null); reload() }}
          />
        )}
      </AnimatePresence>
    </SellerLayout>
  )
}

function SellerOrderCard({ order, cases, onAdvance, onVerifyPayment, onOpenCase }) {
  const shipment = order.shipment
  const payment = order.payment
  const nextSteps = shipment ? (FULFILMENT_FLOW[shipment.status] ?? []) : []
  const needsPaymentCheck = payment?.status === 'awaiting_confirmation'

  return (
    <motion.article variants={listItem} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-soft)', fontSize: '0.875rem' }}>
            {order.reference}
          </p>
          <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>
            {formatDateTime(order.placedAt)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {shipment && <StatusBadge status={shipment.status} label={FULFILMENT_LABEL[shipment.status]} />}
          {payment && <StatusBadge status={payment.status} label={PAYMENT_LABEL[payment.status]} />}
        </div>
      </header>

      <div className="panel">
        <p style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{order.deliveryName}</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{order.deliveryPhone}</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{order.deliveryAddress}</p>
        {order.notes && (
          <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem', marginTop: 4 }}>
            Notes: {order.notes}
          </p>
        )}
      </div>

      <ul style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {order.items.map((item) => (
          <li
            key={item.id}
            style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '0.875rem' }}
          >
            <span>
              {item.name}{' '}
              <span style={{ color: 'var(--text-subtle)' }}>× {item.qty}</span>
            </span>
            <span style={{ fontWeight: 600 }}>{formatRwf(item.lineTotal)}</span>
          </li>
        ))}
      </ul>

      <dl
        style={{
          borderTop: '1px solid var(--border)', paddingTop: 12,
          display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.875rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <dt style={{ color: 'var(--text-muted)' }}>Your items</dt>
          <dd>{formatRwf(order.sellerTotal)}</dd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <dt style={{ color: 'var(--text-muted)' }}>Platform commission</dt>
          <dd style={{ color: 'var(--text-muted)' }}>
            −{formatRwf(order.items.reduce((sum, i) => sum + i.commission, 0))}
          </dd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
          <dt>You earn</dt>
          <dd style={{ color: 'var(--success)' }}>
            {formatRwf(order.items.reduce((sum, i) => sum + i.sellerNet, 0))}
          </dd>
        </div>
      </dl>

      {needsPaymentCheck && (
        <InlineNotice
          tone="warning"
          title="The customer says they have paid"
          action={
            <button type="button" className="btn btn-primary btn-sm" onClick={onVerifyPayment}>
              Verify
            </button>
          }
        >
          {payment.customerReference
            ? <>Reference: <strong>{payment.customerReference}</strong>. Check your account before confirming.</>
            : 'Check your account for the payment before confirming.'}
        </InlineNotice>
      )}

      {cases.length > 0 && (
        <InlineNotice
          tone="danger"
          title="A customer reported a problem"
          action={
            <button type="button" className="btn btn-outline btn-sm" onClick={() => onOpenCase(cases[0])}>
              Respond
            </button>
          }
        >
          {cases[0].description.slice(0, 120)}
        </InlineNotice>
      )}

      {nextSteps.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <p
            style={{
              fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-subtle)',
              letterSpacing: '0.04em', marginBottom: 8,
            }}
          >
            NEXT STEP
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {nextSteps.map((next) => (
              <button
                key={next}
                type="button"
                className={next === 'cancelled' ? 'btn btn-ghost btn-sm' : 'btn btn-primary btn-sm'}
                onClick={() => onAdvance(order, next)}
              >
                {next === 'cancelled' ? 'Cancel this shipment' : `Mark ${FULFILMENT_LABEL[next].toLowerCase()}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.article>
  )
}

function VerifyPaymentDialog({ order, onClose, onDone }) {
  const toast = useToast()
  const [mode, setMode] = useState('confirm')
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError(null)

    if (mode === 'reject' && reason.trim().length < 3) {
      setError('Tell the customer why, so they can fix it.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'confirm') {
        await PaymentService.confirm(order.payment.id, order.payment.customerReference)
        toast.success(`Payment confirmed for ${order.reference}`)
      } else {
        await PaymentService.reject(order.payment.id, reason)
        toast.info('The customer has been told the payment was not found')
      }
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Verify payment"
      description={`${order.reference} · ${formatRwf(order.payment.amount)}`}
      onClose={onClose}
      width={450}
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <InlineNotice tone="danger" title="Could not update the payment">{error}</InlineNotice>}

        <div className="panel">
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>The customer entered</p>
          <p style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9375rem', marginTop: 2 }}>
            {order.payment.customerReference || '— no reference given —'}
          </p>
        </div>

        <InlineNotice tone="warning" title="Check before you confirm">
          Confirming marks this order paid across SHOP MUMU and counts towards your settled
          earnings. Only confirm once you can see the money in your own account.
        </InlineNotice>

        <fieldset style={{ border: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend className="sr-only">Decision</legend>
          {[
            { value: 'confirm', label: 'I received this payment', tone: 'var(--success)' },
            { value: 'reject', label: 'I could not find this payment', tone: 'var(--danger)' },
          ].map((option) => (
            <label
              key={option.value}
              style={{
                display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px',
                borderRadius: 'var(--radius)', cursor: 'pointer',
                border: `1px solid ${mode === option.value ? option.tone : 'var(--border)'}`,
              }}
            >
              <input
                type="radio"
                name="payment-decision"
                checked={mode === option.value}
                onChange={() => setMode(option.value)}
                style={{ accentColor: option.tone, width: 17, height: 17 }}
              />
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{option.label}</span>
            </label>
          ))}
        </fieldset>

        {mode === 'reject' && (
          <Field label="What should the customer do?" required htmlFor="reject-reason">
            <textarea
              id="reject-reason"
              className="input"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. No payment with that reference has arrived. Please check the number and send the correct code."
            />
          </Field>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <SubmitButton
            loading={loading}
            loadingLabel="Saving…"
            className={mode === 'confirm' ? 'btn btn-primary' : 'btn btn-danger'}
          >
            {mode === 'confirm' ? 'Confirm payment received' : 'Report payment not found'}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  )
}

function RespondToCaseDialog({ dispute, onClose, onDone }) {
  const toast = useToast()
  const [reply, setReply] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (reply.trim().length < 5) {
      setError('Please write a reply for the customer and SHOP MUMU to read.')
      return
    }

    setLoading(true)
    try {
      await DisputeService.respond(dispute.id, reply)
      toast.success('Your reply has been recorded')
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Respond to a case"
      description={dispute.orderReference ? `Order ${dispute.orderReference}` : undefined}
      onClose={onClose}
      width={460}
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <InlineNotice tone="danger" title="Could not send your reply">{error}</InlineNotice>}

        <div className="panel">
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-subtle)' }}>
            THE CUSTOMER SAYS
          </p>
          <p style={{ fontSize: '0.875rem', marginTop: 4 }}>{dispute.description}</p>
        </div>

        <Field label="Your response" required htmlFor="case-reply">
          <textarea
            id="case-reply"
            className="input"
            rows={4}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Explain what happened and what you propose to do."
          />
        </Field>

        <InlineNotice tone="info" title="A SHOP MUMU administrator decides the outcome">
          Your reply is shown to the customer and to SHOP MUMU, who resolve the case.
        </InlineNotice>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <SubmitButton loading={loading} loadingLabel="Sending…">Send reply</SubmitButton>
        </div>
      </form>
    </Modal>
  )
}
