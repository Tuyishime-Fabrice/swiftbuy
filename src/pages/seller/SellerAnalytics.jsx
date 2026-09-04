import { useCallback, useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import SellerLayout from '../../layouts/SellerLayout'
import {
  PageHeader, StatCard, StatGrid, StatSkeleton, EmptyState, ErrorState, InlineNotice,
} from '../../components/UI'
import * as Icon from '../../components/Icons'
import { useAuth } from '../../context/auth-context'
import { OrderService } from '../../services/commerce'
import { ProductService } from '../../services/products'
import { SellerService, SettingsService } from '../../services/accounts'
import { formatRwf } from '../../utils/format'
import { useAsyncData } from '../../hooks/useAsyncData'

export default function SellerAnalytics() {
  const { user } = useAuth()

  const { status, data, error, retry } = useAsyncData(
    useCallback(async () => {
      const [orderList, productList, earningsData, config] = await Promise.all([
        OrderService.listForSeller(user.id),
        ProductService.listForSeller(user.id),
        SellerService.earnings(user.id),
        SettingsService.get(),
      ])
      return { orders: orderList, products: productList, earnings: earningsData, settings: config }
    }, [user.id])
  )

  const orders = useMemo(() => data?.orders ?? [], [data])
  const products = data?.products ?? []
  const earnings = data?.earnings ?? null
  const settings = data?.settings ?? null

  const paidOrders = useMemo(
    () => orders.filter((o) => o.payment?.status === 'successful'),
    [orders]
  )

  const revenueSeries = useMemo(() => {
    const byDay = new Map()
    for (const order of paidOrders) {
      const day = order.placedAt.slice(0, 10)
      const amount = order.items.reduce((sum, i) => sum + i.sellerNet, 0)
      byDay.set(day, (byDay.get(day) ?? 0) + amount)
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([day, amount]) => ({
        day: new Date(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        amount,
      }))
  }, [paidOrders])

  const topProducts = useMemo(() => {
    const byProduct = new Map()
    for (const order of orders) {
      for (const item of order.items) {
        byProduct.set(item.name, (byProduct.get(item.name) ?? 0) + item.qty)
      }
    }
    return [...byProduct.entries()]
      .map(([name, qty]) => ({ name: name.length > 22 ? `${name.slice(0, 21)}…` : name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8)
  }, [orders])

  const lowThreshold = settings?.lowStockThreshold ?? 5
  const orderedValue = orders.reduce((sum, o) => sum + o.sellerTotal, 0)
  const unitsSold = orders.reduce(
    (sum, o) => sum + o.items.reduce((n, i) => n + i.qty, 0), 0
  )

  if (status === 'loading') {
    return (
      <SellerLayout title="Analytics">
        <PageHeader title="Analytics" />
        <StatSkeleton count={6} />
      </SellerLayout>
    )
  }

  if (status === 'error') {
    return (
      <SellerLayout title="Analytics">
        <PageHeader title="Analytics" />
        <ErrorState title="We couldn't load your analytics" description={error} onRetry={retry} />
      </SellerLayout>
    )
  }

  if (orders.length === 0 && products.length === 0) {
    return (
      <SellerLayout title="Analytics">
        <PageHeader title="Analytics" />
        <EmptyState
          icon={Icon.Chart}
          title="Nothing to measure yet"
          description="Once you list products and start receiving orders, your sales and earnings will be charted here."
        />
      </SellerLayout>
    )
  }

  return (
    <SellerLayout title="Analytics">
      <PageHeader
        title="Analytics"
        subtitle="How your store is doing, counted honestly"
      />

      <InlineNotice tone="info" title="What these numbers count">
        <strong>Settled</strong> figures come only from payments you have confirmed receiving.
        <strong> Ordered</strong> figures include orders that have not been paid for yet. The
        commission rate is set by SwiftBuy and is currently{' '}
        {((settings?.commissionRateBps ?? 0) / 100).toFixed(2)}%.
      </InlineNotice>

      <div style={{ marginTop: 18 }}>
        <StatGrid>
          <StatCard
            label="Settled earnings"
            value={formatRwf(earnings?.net ?? 0)}
            hint="After commission"
            tone="success"
            icon={Icon.Receipt}
          />
          <StatCard
            label="Commission paid"
            value={formatRwf(earnings?.commission ?? 0)}
            hint="On settled orders"
            tone="neutral"
            icon={Icon.Scale}
          />
          <StatCard
            label="Ordered value"
            value={formatRwf(orderedValue)}
            hint="Including unpaid orders"
            icon={Icon.Package}
          />
          <StatCard label="Orders" value={orders.length} icon={Icon.Package} />
          <StatCard label="Units sold" value={unitsSold} tone="warning" icon={Icon.Store} />
          <StatCard
            label="Live listings"
            value={products.filter((p) => p.isActive).length}
            hint={`${products.filter((p) => p.isActive && p.stock <= lowThreshold).length} low or out of stock`}
            icon={Icon.Store}
          />
        </StatGrid>
      </div>

      <div
        style={{
          display: 'grid', gap: 16, marginTop: 24,
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
        }}
      >
        <ChartCard
          title="Settled earnings over time"
          hint="Your share after commission, on confirmed payments"
          empty={revenueSeries.length === 0}
          emptyMessage="No confirmed payments yet. Once you verify a payment it will appear here."
        >
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={revenueSeries} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: 'var(--text-subtle)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fill: 'var(--text-subtle)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => [formatRwf(value), 'Settled']}
              />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--accent)' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Most ordered products"
          hint="Units across all orders, paid or not"
          empty={topProducts.length === 0}
          emptyMessage="No orders yet."
        >
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={topProducts} layout="vertical" margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-subtle)', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={130}
                tick={{ fill: 'var(--text-subtle)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, 'Units']} cursor={{ fill: 'var(--surface-hover)' }} />
              <Bar dataKey="qty" fill="var(--accent)" radius={[0, 5, 5, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </SellerLayout>
  )
}

const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.8125rem',
  color: 'var(--text)',
}

function ChartCard({ title, hint, empty, emptyMessage, children }) {
  return (
    <section className="card">
      <h2 style={{ fontSize: '0.9375rem' }}>{title}</h2>
      {hint && (
        <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem', marginTop: 2, marginBottom: 14 }}>
          {hint}
        </p>
      )}
      {empty ? (
        <div
          style={{
            height: 230, display: 'grid', placeItems: 'center',
            color: 'var(--text-subtle)', fontSize: '0.875rem', textAlign: 'center', padding: 16,
          }}
        >
          {emptyMessage}
        </div>
      ) : children}
    </section>
  )
}
