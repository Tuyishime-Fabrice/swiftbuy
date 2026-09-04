import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import PageShell from '../../layouts/PageShell'
import {
  PageHeader, Tabs, StatCard, StatGrid, StatSkeleton, ListSkeleton, EmptyState,
  ErrorState, StatusBadge, InlineNotice, Modal, Field, SubmitButton, ConfirmDialog,
  Pagination,
} from '../../components/UI'
import * as Icon from '../../components/Icons'
import { useAuth } from '../../context/auth-context'
import { useToast } from '../../context/toast-context'
import {
  ProfileService, SellerService, SettingsService, AuditService,
  SellerDocumentService, SELLER_STATUS_LABEL, DOCUMENT_TYPE_LABEL,
} from '../../services/accounts'
import { OrderService, PaymentService, DisputeService, PAYMENT_LABEL } from '../../services/commerce'
import { ProductService } from '../../services/products'
import { formatRwf, formatDateTime, formatDate, initials } from '../../utils/format'
import { useAsyncData } from '../../hooks/useAsyncData'
import { listContainer, listItem } from '../../lib/motion'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'sellers', label: 'Seller applications' },
  { key: 'orders', label: 'Orders' },
  { key: 'users', label: 'Users' },
  { key: 'products', label: 'Products' },
  { key: 'cases', label: 'Cases' },
  { key: 'settings', label: 'Settings' },
  { key: 'audit', label: 'Audit log' },
]

export default function AdminDashboard() {
  const { user, isSuperAdmin } = useAuth()
  const [tab, setTab] = useState('overview')

  return (
    <PageShell title="Admin">
      <PageHeader
        title={isSuperAdmin ? 'Platform administration' : 'Admin dashboard'}
        subtitle={
          isSuperAdmin
            ? 'Full control, including roles and marketplace settings'
            : 'Moderate stores, orders and marketplace content'
        }
      />

      <Tabs label="Admin sections" tabs={TABS} active={tab} onChange={setTab} />

      <div style={{ marginTop: 24 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {tab === 'overview' && <OverviewTab />}
            {tab === 'sellers' && <SellersTab />}
            {tab === 'orders' && <OrdersTab />}
            {tab === 'users' && <UsersTab currentUserId={user.id} isSuperAdmin={isSuperAdmin} />}
            {tab === 'products' && <ProductsTab />}
            {tab === 'cases' && <CasesTab />}
            {tab === 'settings' && <SettingsTab isSuperAdmin={isSuperAdmin} />}
            {tab === 'audit' && <AuditTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </PageShell>
  )
}

function OverviewTab() {
  const { status, data, error, retry } = useAsyncData(
    useCallback(async () => {
      const [orders, sellers, users, products] = await Promise.all([
        OrderService.listAll({ limit: 200 }),
        SellerService.listAll(),
        ProfileService.listAll(),
        ProductService.search({ pageSize: 1 }),
      ])
      return {
        orders: orders.items,
        orderTotal: orders.total,
        sellers,
        users,
        productTotal: products.total,
      }
    }, [])
  )

  const derived = useMemo(() => {
    if (!data) return null
    const paid = data.orders.filter((o) => o.payment?.status === 'successful')
    const settledValue = paid.reduce((sum, o) => sum + o.total, 0)
    const commissionEarned = paid.reduce((sum, o) => sum + o.commission, 0)

    const byDay = new Map()
    for (const order of paid) {
      const day = order.placedAt.slice(0, 10)
      byDay.set(day, (byDay.get(day) ?? 0) + order.total)
    }
    const series = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([day, amount]) => ({
        day: new Date(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        amount,
      }))

    return {
      settledValue,
      commissionEarned,
      series,
      pendingSellers: data.sellers.filter((s) => s.status === 'pending'),
      awaitingPayment: data.orders.filter((o) => o.payment?.status === 'awaiting_confirmation').length,
    }
  }, [data])

  if (status === 'loading') return <StatSkeleton count={6} />
  if (status === 'error') {
    return <ErrorState title="We couldn't load the overview" description={error} onRetry={retry} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {derived.pendingSellers.length > 0 && (
        <InlineNotice
          tone="warning"
          title={`${derived.pendingSellers.length} store${derived.pendingSellers.length === 1 ? '' : 's'} awaiting review`}
        >
          {derived.pendingSellers.slice(0, 3).map((s) => s.storeName).join(', ')}
          {derived.pendingSellers.length > 3 && ` and ${derived.pendingSellers.length - 3} more`} —
          open the Sellers tab to approve or reject.
        </InlineNotice>
      )}

      <StatGrid>
        <StatCard
          label="Settled order value"
          value={formatRwf(derived.settledValue)}
          hint="Orders with a confirmed payment"
          tone="success"
          icon={Icon.Receipt}
        />
        <StatCard
          label="Commission earned"
          value={formatRwf(derived.commissionEarned)}
          hint="Platform share of settled orders"
          tone="accent"
          icon={Icon.Scale}
        />
        <StatCard label="Orders" value={data.orderTotal} icon={Icon.Package} />
        <StatCard
          label="Awaiting payment check"
          value={derived.awaitingPayment}
          hint="Sellers still to verify"
          tone="warning"
          icon={Icon.Clock}
        />
        <StatCard
          label="Approved stores"
          value={data.sellers.filter((s) => s.status === 'approved').length}
          hint={`${data.sellers.length} total`}
          icon={Icon.Store}
        />
        <StatCard label="Live products" value={data.productTotal} icon={Icon.Store} />
        <StatCard
          label="Customers"
          value={data.users.filter((u) => u.role === 'customer').length}
          icon={Icon.Users}
        />
        <StatCard
          label="Suspended accounts"
          value={data.users.filter((u) => u.suspended).length}
          tone={data.users.some((u) => u.suspended) ? 'danger' : 'neutral'}
          icon={Icon.Alert}
        />
      </StatGrid>

      <section className="card">
        <h2 style={{ fontSize: '0.9375rem' }}>Settled order value over time</h2>
        <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem', marginTop: 2, marginBottom: 14 }}>
          Only orders whose payment a seller has confirmed
        </p>
        {derived.series.length === 0 ? (
          <div style={{ height: 220, display: 'grid', placeItems: 'center', color: 'var(--text-subtle)', fontSize: '0.875rem' }}>
            No confirmed payments yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={derived.series} margin={{ top: 6, right: 10, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: 'var(--text-subtle)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fill: 'var(--text-subtle)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem',
                }}
                formatter={(value) => [formatRwf(value), 'Settled']}
              />
              <Line type="monotone" dataKey="amount" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  )
}

function SellersTab() {
  const toast = useToast()
  const [filter, setFilter] = useState('pending')
  const [moderating, setModerating] = useState(null)

  const { status, data, error, reload, retry } = useAsyncData(
    useCallback(() => SellerService.listAll(), [])
  )
  const sellers = data ?? []

  const counts = {
    pending: sellers.filter((s) => s.status === 'pending').length,
    approved: sellers.filter((s) => s.status === 'approved').length,
    rejected: sellers.filter((s) => s.status === 'rejected').length,
    suspended: sellers.filter((s) => s.status === 'suspended').length,
  }

  const visible = filter === 'all' ? sellers : sellers.filter((s) => s.status === filter)

  const approve = async (seller) => {
    try {
      await SellerService.setStatus(seller.id, 'approved')
      toast.success(`${seller.storeName} approved`)
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (status === 'loading') return <ListSkeleton count={4} height={130} />
  if (status === 'error') {
    return <ErrorState title="We couldn't load sellers" description={error} onRetry={retry} />
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <Tabs
          label="Seller status"
          active={filter}
          onChange={setFilter}
          tabs={[
            { key: 'pending', label: 'Pending', count: counts.pending },
            { key: 'approved', label: 'Approved', count: counts.approved },
            { key: 'rejected', label: 'Rejected', count: counts.rejected },
            { key: 'suspended', label: 'Suspended', count: counts.suspended },
            { key: 'all', label: 'All', count: sellers.length },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Icon.Store}
          title={filter === 'pending' ? 'No applications waiting' : 'Nothing here'}
          description={
            filter === 'pending'
              ? 'Every seller application has been dealt with.'
              : 'No stores have this status.'
          }
        />
      ) : (
        <motion.div
          variants={listContainer}
          initial="initial"
          animate="animate"
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {visible.map((seller) => (
            <motion.article key={seller.id} variants={listItem} className="card">
              <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <span
                  style={{
                    width: 42, height: 42, borderRadius: 'var(--radius)', flexShrink: 0,
                    background: 'var(--accent)', color: '#fff', display: 'grid',
                    placeItems: 'center', fontWeight: 700, fontSize: '0.875rem',
                  }}
                >
                  {initials(seller.storeName)}
                </span>

                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <p style={{ fontWeight: 700 }}>{seller.storeName}</p>
                    <StatusBadge status={seller.status} label={SELLER_STATUS_LABEL[seller.status]} />
                    {seller.ownerSuspended && <span className="badge badge-danger">Account suspended</span>}
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    {seller.ownerName} · {seller.ownerEmail}
                  </p>
                  <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem', marginTop: 3 }}>
                    Applied {formatDate(seller.createdAt)}
                    {seller.momoNumber && ` · MoMo ${seller.momoNumber}`}
                    {seller.bankName && ` · ${seller.bankName}`}
                  </p>
                  {seller.statusReason && (
                    <p style={{ color: 'var(--warning)', fontSize: '0.8125rem', marginTop: 5 }}>
                      Note: {seller.statusReason}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {seller.status === 'approved' && (
                    <Link to={`/store/${seller.id}`} className="btn btn-ghost btn-sm">View store</Link>
                  )}
                  {seller.status !== 'approved' && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => approve(seller)}>
                      <Icon.Check size={14} /> Approve
                    </button>
                  )}
                  {seller.status === 'pending' && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setModerating({ seller, action: 'rejected' })}
                    >
                      Reject
                    </button>
                  )}
                  {seller.status === 'approved' && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setModerating({ seller, action: 'suspended' })}
                    >
                      Suspend
                    </button>
                  )}
                </div>
              </div>

              <VerificationDocuments sellerId={seller.id} />
            </motion.article>
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {moderating && (
          <ModerateSellerDialog
            seller={moderating.seller}
            action={moderating.action}
            onClose={() => setModerating(null)}
            onDone={() => { setModerating(null); reload() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function VerificationDocuments({ sellerId }) {
  const toast = useToast()
  const [opening, setOpening] = useState(null)

  const { status, data } = useAsyncData(
    useCallback(() => SellerDocumentService.list(sellerId), [sellerId])
  )

  const documents = data ?? []

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

  return (
    <div style={{ borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 12 }}>
      <p
        style={{
          fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em',
          color: 'var(--text-subtle)', marginBottom: 8,
        }}
      >
        VERIFICATION DOCUMENTS
      </p>

      {status === 'loading' && (
        <p style={{ color: 'var(--text-subtle)', fontSize: '0.8125rem' }}>Loading…</p>
      )}

      {status === 'ready' && documents.length === 0 && (
        <p style={{ color: 'var(--warning)', fontSize: '0.8125rem' }}>
          Nothing submitted. Consider asking for a document before approving.
        </p>
      )}

      {status === 'error' && (
        <p style={{ color: 'var(--danger)', fontSize: '0.8125rem' }}>
          Could not load the documents for this application.
        </p>
      )}

      {documents.length > 0 && (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {documents.map((document) => (
            <li
              key={document.id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
            >
              <Icon.Receipt size={15} />
              <span style={{ fontSize: '0.8125rem', flex: 1, minWidth: 140 }}>
                {DOCUMENT_TYPE_LABEL[document.docType] ?? document.docType}
                <span style={{ color: 'var(--text-subtle)' }}>
                  {document.fileName ? ` · ${document.fileName}` : ''}
                </span>
              </span>
              {document.reviewedAt && (
                <span className="badge badge-neutral">
                  Reviewed {formatDate(document.reviewedAt)}
                </span>
              )}
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => open(document)}
                disabled={opening === document.id}
              >
                {opening === document.id ? <span className="spinner" aria-hidden="true" /> : null}
                Open
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ModerateSellerDialog({ seller, action, onClose, onDone }) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const rejecting = action === 'rejected'

  const submit = async (event) => {
    event.preventDefault()
    if (reason.trim().length < 5) {
      setError('Give a reason — the seller sees this, and it is recorded in the audit log.')
      return
    }

    setLoading(true)
    try {
      await SellerService.setStatus(seller.id, action, reason)
      toast.success(rejecting ? 'Application rejected' : 'Store suspended')
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={rejecting ? 'Reject this application' : 'Suspend this store'}
      description={seller.storeName}
      onClose={onClose}
      width={440}
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <InlineNotice tone="danger" title="Could not complete">{error}</InlineNotice>}

        <InlineNotice tone="warning" title="What this does">
          {rejecting
            ? 'The seller is told their application was rejected, with your reason. They keep their account and can still shop.'
            : 'Every product from this store is delisted immediately and the store disappears from the marketplace.'}
        </InlineNotice>

        <Field label="Reason" required htmlFor="moderation-reason">
          <textarea
            id="moderation-reason"
            className="input"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={rejecting
              ? 'e.g. We could not verify the business details provided.'
              : 'e.g. Repeated failure to fulfil confirmed orders.'}
          />
        </Field>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <SubmitButton loading={loading} loadingLabel="Saving…" className="btn btn-danger">
            {rejecting ? 'Reject application' : 'Suspend store'}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  )
}

const ORDERS_PER_PAGE = 20

function OrdersTab() {
  const toast = useToast()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [refunding, setRefunding] = useState(null)

  const { status, data, error, reload, retry } = useAsyncData(
    useCallback(
      () => OrderService.listAll({
        limit: ORDERS_PER_PAGE,
        offset: page * ORDERS_PER_PAGE,
        search,
      }),
      [page, search]
    )
  )
  const result = data ?? { items: [], total: 0 }

  const confirmRefund = async (reason) => {
    try {
      await PaymentService.recordRefund(refunding.payment.id, reason)
      toast.success('Refund recorded')
      setRefunding(null)
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16, maxWidth: 340 }}>
        <label htmlFor="order-search" className="sr-only">Search orders by reference</label>
        <input
          id="order-search"
          className="input"
          type="search"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          placeholder="Search by order reference…"
        />
      </div>

      {status === 'loading' && <ListSkeleton count={5} height={90} />}
      {status === 'error' && (
        <ErrorState title="We couldn't load orders" description={error} onRetry={retry} />
      )}

      {status === 'ready' && (
        result.items.length === 0 ? (
          <EmptyState
            icon={Icon.Package}
            title={search ? 'No orders match that reference' : 'No orders yet'}
            description={search ? 'Check the reference and try again.' : 'Orders will appear here as customers place them.'}
          />
        ) : (
          <>
            <div className="card card-flush scroll-x">
              <table className="table">
                <caption className="sr-only">All marketplace orders</caption>
                <thead>
                  <tr>
                    <th scope="col">Reference</th>
                    <th scope="col">Placed</th>
                    <th scope="col">Order</th>
                    <th scope="col">Payment</th>
                    <th scope="col">Total</th>
                    <th scope="col">Commission</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((order) => (
                    <tr key={order.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{order.reference}</td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                        {formatDate(order.placedAt)}
                      </td>
                      <td><StatusBadge status={order.status} /></td>
                      <td>
                        {order.payment
                          ? <StatusBadge status={order.payment.status} label={PAYMENT_LABEL[order.payment.status]} />
                          : <span className="badge badge-neutral">None</span>}
                      </td>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{formatRwf(order.total)}</td>
                      <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {formatRwf(order.commission)}
                      </td>
                      <td>
                        {order.payment?.status === 'successful' && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setRefunding(order)}
                          >
                            Record refund
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination page={page} pageSize={ORDERS_PER_PAGE} total={result.total} onChange={setPage} />
          </>
        )
      )}

      <AnimatePresence>
        {refunding && (
          <RefundDialog
            order={refunding}
            onClose={() => setRefunding(null)}
            onConfirm={confirmRefund}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function RefundDialog({ order, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (reason.trim().length < 5) {
      setError('Record why this refund was agreed.')
      return
    }
    setLoading(true)
    await onConfirm(reason)
    setLoading(false)
  }

  return (
    <Modal
      title="Record a refund"
      description={`${order.reference} · ${formatRwf(order.total)}`}
      onClose={onClose}
      width={440}
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <InlineNotice tone="danger" title="Could not record">{error}</InlineNotice>}

        <InlineNotice tone="warning" title="This records the decision — it does not move money">
          SHOP MUMU has no payout rail, so the actual refund is arranged between the seller and the
          customer. This marks the payment refunded, updates the order, and writes an audit entry.
        </InlineNotice>

        <Field label="Reason" required htmlFor="refund-reason">
          <textarea
            id="refund-reason"
            className="input"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Product arrived damaged; seller agreed to refund in full."
          />
        </Field>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <SubmitButton loading={loading} loadingLabel="Recording…">Record refund</SubmitButton>
        </div>
      </form>
    </Modal>
  )
}

function UsersTab({ currentUserId, isSuperAdmin }) {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [suspending, setSuspending] = useState(null)
  const [promoting, setPromoting] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  const { status, data, error, reload, retry } = useAsyncData(
    useCallback(() => ProfileService.listAll({ search: debounced }), [debounced])
  )
  const users = data ?? []

  const toggleSuspend = async (target, suspended) => {
    try {
      await ProfileService.setSuspended(target.id, suspended)
      toast.success(suspended ? 'Account suspended' : 'Account restored')
      setSuspending(null)
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const changeRole = async (target, role) => {
    try {
      await ProfileService.setRole(target.id, role)
      toast.success(`${target.full_name} is now ${role}`)
      setPromoting(null)
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16, maxWidth: 340 }}>
        <label htmlFor="user-search" className="sr-only">Search users</label>
        <input
          id="user-search"
          className="input"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
        />
      </div>

      {!isSuperAdmin && (
        <div style={{ marginBottom: 16 }}>
          <InlineNotice tone="info" title="Role changes need a superadmin">
            You can suspend and restore accounts. Granting or removing the admin role is
            restricted to superadmins, and the database enforces that regardless of this screen.
          </InlineNotice>
        </div>
      )}

      {status === 'loading' && <ListSkeleton count={5} height={72} />}
      {status === 'error' && <ErrorState title="We couldn't load users" description={error} onRetry={retry} />}

      {status === 'ready' && (
        users.length === 0 ? (
          <EmptyState icon={Icon.Users} title="No users match that" description="Try a different name or email." />
        ) : (
          <div className="card card-flush scroll-x">
            <table className="table">
              <caption className="sr-only">Marketplace accounts</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Joined</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {users.map((account) => (
                  <tr key={account.id}>
                    <td style={{ fontWeight: 600 }}>{account.full_name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{account.email}</td>
                    <td><span className="badge badge-accent">{account.role}</span></td>
                    <td>
                      {account.suspended
                        ? <span className="badge badge-danger">Suspended</span>
                        : <span className="badge badge-success">Active</span>}
                    </td>
                    <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatDate(account.created_at)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {account.id !== currentUserId && account.role !== 'superadmin' && (
                          <>
                            <button
                              type="button"
                              className={account.suspended ? 'btn btn-outline btn-sm' : 'btn btn-ghost btn-sm'}
                              onClick={() =>
                                account.suspended
                                  ? toggleSuspend(account, false)
                                  : setSuspending(account)
                              }
                            >
                              {account.suspended ? 'Restore' : 'Suspend'}
                            </button>
                            {isSuperAdmin && (account.role === 'customer' || account.role === 'admin') && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => setPromoting(account)}
                              >
                                {account.role === 'admin' ? 'Remove admin' : 'Make admin'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      <AnimatePresence>
        {suspending && (
          <ConfirmDialog
            title="Suspend this account?"
            message={`${suspending.full_name} will not be able to sign in or place orders. You can restore the account at any time, and the action is recorded in the audit log.`}
            confirmLabel="Suspend account"
            onConfirm={() => toggleSuspend(suspending, true)}
            onCancel={() => setSuspending(null)}
          />
        )}
        {promoting && (
          <ConfirmDialog
            title={promoting.role === 'admin' ? 'Remove admin access?' : 'Grant admin access?'}
            message={
              promoting.role === 'admin'
                ? `${promoting.full_name} will lose access to the admin dashboard and all moderation powers.`
                : `${promoting.full_name} will be able to approve stores, moderate products and record refunds. They will not be able to change anyone's role.`
            }
            confirmLabel={promoting.role === 'admin' ? 'Remove admin' : 'Grant admin'}
            tone={promoting.role === 'admin' ? 'danger' : 'primary'}
            onConfirm={() => changeRole(promoting, promoting.role === 'admin' ? 'customer' : 'admin')}
            onCancel={() => setPromoting(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function ProductsTab() {
  const toast = useToast()
  const [page, setPage] = useState(0)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 250)
    return () => clearTimeout(timer)
  }, [query])

  const { status, data, error, reload, retry } = useAsyncData(
    useCallback(
      () => ProductService.search({ query: debounced, page, pageSize: 24 }),
      [debounced, page]
    )
  )
  const result = data ?? { items: [], total: 0 }

  const toggleFeatured = async (product) => {
    try {
      await ProductService.setFeatured(product.id, !product.isFeatured)
      toast.success(product.isFeatured ? 'Removed from featured' : 'Featured on the storefront')
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16, maxWidth: 340 }}>
        <label htmlFor="admin-product-search" className="sr-only">Search products</label>
        <input
          id="admin-product-search"
          className="input"
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0) }}
          placeholder="Search live products…"
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <InlineNotice tone="info" title="Featuring is the platform's call">
          Sellers cannot feature their own products — the database pins that column, so it only
          changes through this screen.
        </InlineNotice>
      </div>

      {status === 'loading' && <ListSkeleton count={4} height={84} />}
      {status === 'error' && <ErrorState title="We couldn't load products" description={error} onRetry={retry} />}

      {status === 'ready' && (
        result.items.length === 0 ? (
          <EmptyState icon={Icon.Store} title="No products match that" />
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {result.items.map((product) => (
                <div
                  key={product.id}
                  className="card"
                  style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
                >
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Link to={`/product/${product.id}`} style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                        {product.name}
                      </Link>
                      {product.isFeatured && <span className="badge badge-warning">Featured</span>}
                    </div>
                    <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>
                      {product.storeName} · {product.category ?? 'Uncategorised'} · {formatRwf(product.price)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={product.isFeatured ? 'btn btn-ghost btn-sm' : 'btn btn-outline btn-sm'}
                    onClick={() => toggleFeatured(product)}
                  >
                    {product.isFeatured ? 'Unfeature' : 'Feature'}
                  </button>
                </div>
              ))}
            </div>
            <Pagination page={page} pageSize={24} total={result.total} onChange={setPage} />
          </>
        )
      )}
    </div>
  )
}

function CasesTab() {
  const toast = useToast()
  const [resolving, setResolving] = useState(null)

  const { status, data, error, reload, retry } = useAsyncData(
    useCallback(() => DisputeService.list(), [])
  )
  const cases = data ?? []

  if (status === 'loading') return <ListSkeleton count={3} height={140} />
  if (status === 'error') return <ErrorState title="We couldn't load cases" description={error} onRetry={retry} />

  const open = cases.filter((c) => !['resolved', 'closed'].includes(c.status))

  return (
    <div>
      {cases.length === 0 ? (
        <EmptyState
          icon={Icon.Scale}
          title="No cases open"
          description="When a customer reports a problem with an order, it appears here for review."
        />
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <InlineNotice tone="info" title={`${open.length} open, ${cases.length - open.length} closed`}>
              Resolving a case does not move money. If a refund is agreed, record it against the
              order on the Orders tab.
            </InlineNotice>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cases.map((dispute) => (
              <article key={dispute.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--accent-soft)' }}>
                      {dispute.orderReference ?? '—'}
                    </p>
                    <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>
                      {formatDateTime(dispute.createdAt)} · {dispute.category.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <StatusBadge status={dispute.status} />
                </div>

                <p style={{ fontSize: '0.875rem', marginTop: 12 }}>{dispute.description}</p>

                {dispute.sellerReply && (
                  <div className="panel" style={{ marginTop: 12 }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-subtle)' }}>
                      SELLER'S REPLY
                    </p>
                    <p style={{ fontSize: '0.875rem', marginTop: 4 }}>{dispute.sellerReply}</p>
                  </div>
                )}

                {dispute.resolution && (
                  <div style={{ marginTop: 12 }}>
                    <InlineNotice tone="success" title="Resolution">{dispute.resolution}</InlineNotice>
                  </div>
                )}

                {!['resolved', 'closed'].includes(dispute.status) && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setResolving(dispute)}>
                      Resolve case
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      <AnimatePresence>
        {resolving && (
          <ResolveCaseDialog
            dispute={resolving}
            onClose={() => setResolving(null)}
            onDone={() => { setResolving(null); reload(); toast.success('Case updated') }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function ResolveCaseDialog({ dispute, onClose, onDone }) {
  const [outcome, setOutcome] = useState('resolved')
  const [resolution, setResolution] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (resolution.trim().length < 5) {
      setError('Explain the outcome — both parties see it, and it is recorded in the audit log.')
      return
    }
    setLoading(true)
    try {
      await DisputeService.resolve(dispute.id, outcome, resolution)
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Resolve this case" onClose={onClose} width={440}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <InlineNotice tone="danger" title="Could not update the case">{error}</InlineNotice>}

        <Field label="Outcome" required htmlFor="case-outcome">
          <select id="case-outcome" className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="under_review">Keep under review</option>
            <option value="resolved">Resolved in the customer's favour</option>
            <option value="closed">Closed — no action needed</option>
          </select>
        </Field>

        <Field label="What did you decide?" required htmlFor="case-resolution">
          <textarea
            id="case-resolution"
            className="input"
            rows={4}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
          />
        </Field>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <SubmitButton loading={loading} loadingLabel="Saving…">Save decision</SubmitButton>
        </div>
      </form>
    </Modal>
  )
}

function SettingsTab({ isSuperAdmin }) {
  const toast = useToast()
  const [settings, setSettings] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    SettingsService.get().then((data) => {
      setSettings(data)
      setForm({
        commissionPercent: (data.commissionRateBps / 100).toString(),
        deliveryFee: data.deliveryFee.toString(),
        freeDeliveryOver: data.freeDeliveryOver?.toString() ?? '',
        lowStockThreshold: data.lowStockThreshold.toString(),
      })
    })
  }, [])

  if (!form) return <ListSkeleton count={1} height={320} />

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      await SettingsService.update({
        commissionRateBps: Math.round(Number(form.commissionPercent) * 100),
        deliveryFee: Math.round(Number(form.deliveryFee)),
        freeDeliveryOver: form.freeDeliveryOver === '' ? null : Math.round(Number(form.freeDeliveryOver)),
        lowStockThreshold: Math.round(Number(form.lowStockThreshold)),
      })
      toast.success('Marketplace settings saved')
      setSettings(await SettingsService.get())
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }))

  return (
    <div style={{ maxWidth: 560 }}>
      {!isSuperAdmin && (
        <div style={{ marginBottom: 16 }}>
          <InlineNotice tone="info" title="Read-only for admins">
            Marketplace economics are set by a superadmin. The database refuses these writes from
            any other role, so the fields below are shown for reference.
          </InlineNotice>
        </div>
      )}

      <form className="card" onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ fontSize: '1rem' }}>Marketplace economics</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: -8 }}>
          These values are applied by the checkout function at the moment an order is placed.
          Changing them affects new orders only — past orders keep the rate they were charged at.
        </p>

        <Field
          label="Commission rate (%)"
          hint="Taken from each order line. Currently applied at checkout as basis points."
          htmlFor="setting-commission"
        >
          <input
            id="setting-commission" className="input" type="number" min="0" max="100" step="0.01"
            value={form.commissionPercent} onChange={set('commissionPercent')}
            disabled={!isSuperAdmin}
          />
        </Field>

        <Field label="Delivery fee (RWF)" hint="Charged once per order, not per seller" htmlFor="setting-delivery">
          <input
            id="setting-delivery" className="input" type="number" min="0" step="1"
            value={form.deliveryFee} onChange={set('deliveryFee')}
            disabled={!isSuperAdmin}
          />
        </Field>

        <Field
          label="Free delivery over (RWF)"
          hint="Leave blank to always charge the delivery fee"
          htmlFor="setting-free-delivery"
        >
          <input
            id="setting-free-delivery" className="input" type="number" min="0" step="1"
            value={form.freeDeliveryOver} onChange={set('freeDeliveryOver')}
            disabled={!isSuperAdmin}
          />
        </Field>

        <Field
          label="Low stock threshold"
          hint="When a seller is warned that a product is running out"
          htmlFor="setting-low-stock"
        >
          <input
            id="setting-low-stock" className="input" type="number" min="0" step="1"
            value={form.lowStockThreshold} onChange={set('lowStockThreshold')}
            disabled={!isSuperAdmin}
          />
        </Field>

        {settings?.sandboxPayments && (
          <InlineNotice tone="warning" title="Sandbox payments are enabled">
            This project accepts simulated payments. That must be switched off before any real
            money passes through the marketplace.
          </InlineNotice>
        )}

        {isSuperAdmin && (
          <SubmitButton loading={saving} loadingLabel="Saving…" style={{ alignSelf: 'flex-start' }}>
            Save settings
          </SubmitButton>
        )}
      </form>
    </div>
  )
}

function AuditTab() {
  const { status, data, error, retry } = useAsyncData(
    useCallback(() => AuditService.list({ limit: 80 }), [])
  )
  const entries = data ?? []

  if (status === 'loading') return <ListSkeleton count={6} height={62} />
  if (status === 'error') return <ErrorState title="We couldn't load the audit log" description={error} onRetry={retry} />

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <InlineNotice tone="info" title="Append-only">
          Sensitive actions — approvals, suspensions, role changes, payment confirmations,
          refunds — are written here by the database itself. Nothing in the application can edit
          or delete an entry.
        </InlineNotice>
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={Icon.Shield} title="Nothing logged yet" description="Privileged actions will be recorded here." />
      ) : (
        <div className="card card-flush scroll-x">
          <table className="table">
            <caption className="sr-only">Audit log</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">Action</th>
                <th scope="col">Subject</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                    {formatDateTime(entry.createdAt)}
                  </td>
                  <td>{entry.actorName}</td>
                  <td><span className="badge badge-neutral">{entry.action}</span></td>
                  <td style={{ color: 'var(--text-muted)' }}>{entry.entityType}</td>
                  <td style={{ color: 'var(--text-subtle)', fontSize: '0.75rem', maxWidth: 260 }}>
                    {formatMetadata(entry.metadata)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function formatMetadata(metadata) {
  if (!metadata || Object.keys(metadata).length === 0) return '—'
  return Object.entries(metadata)
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
    .join(' · ')
}
