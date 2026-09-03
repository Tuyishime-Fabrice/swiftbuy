import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { OrderService, ProductService } from '../services/storage'
import { StatsCard } from '../components/UI'
import { SellerSidebar } from './SellerDashboard'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const COLORS = ['#5b4cff', '#00c48c', '#ff8c42', '#f0a500', '#ff4d6a', '#7b6fff']

export default function SellerAnalytics() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])

  useEffect(() => {
    document.title = 'Analytics — SwiftBuy Seller'
    OrderService.getBySeller(user.id).then(setOrders)
    ProductService.getBySeller(user.id).then(setProducts)
  }, [user.id])

  const paidOrders = orders.filter(o => o.paymentStatus === 'paid')
  const totalRevenue = paidOrders.reduce((s, o) => {
    return s + o.items.filter(i => i.sellerId === user.id).reduce((ss, i) => ss + Number(i.price) * i.qty, 0)
  }, 0)
  const totalSold = paidOrders.reduce((s, o) => s + o.items.filter(i => i.sellerId === user.id).reduce((ss, i) => ss + i.qty, 0), 0)

  // Revenue over time
  const revenueMap = {}
  paidOrders.forEach(o => {
    const date = o.createdAt?.split(',')[0] || 'Unknown'
    const myAmount = o.items.filter(i => i.sellerId === user.id).reduce((s, i) => s + Number(i.price) * i.qty, 0)
    revenueMap[date] = (revenueMap[date] || 0) + myAmount
  })
  const revenueData = Object.entries(revenueMap).map(([date, amount]) => ({ date, amount }))

  // Sales by product
  const productMap = {}
  orders.forEach(o => {
    o.items.filter(i => i.sellerId === user.id).forEach(item => {
      productMap[item.name] = (productMap[item.name] || 0) + item.qty
    })
  })
  const productData = Object.entries(productMap).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 8)

  // Category distribution
  const catMap = {}
  products.forEach(p => { catMap[p.category] = (catMap[p.category] || 0) + 1 })
  const catData = Object.entries(catMap).map(([name, value]) => ({ name, value }))

  const tooltipStyle = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ display: 'flex' }}>
        <SellerSidebar active="analytics" />
        <div style={{ flex: 1, padding: '32px 28px' }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Analytics</h1>
          <p style={{ color: 'var(--text3)', fontSize: 14, marginBottom: 28 }}>Your store performance at a glance</p>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 32 }}>
            <StatsCard label="Total Revenue" value={totalRevenue.toLocaleString() + ' RWF'} color="var(--green)" />
            <StatsCard label="Total Orders" value={orders.length} color="var(--accent)" />
            <StatsCard icon="✓" label="Paid Orders" value={paidOrders.length} color="var(--green)" />
            <StatsCard label="Items Sold" value={totalSold} color="var(--orange)" />
            <StatsCard label="Products Listed" value={products.length} color="var(--accent)" />
            <StatsCard label="In Stock" value={products.filter(p => p.stock > 0).length} color="var(--yellow)" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            {/* Revenue chart */}
            <div className="card">
              <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Revenue Over Time</p>
              {revenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={revenueData}>
                    <XAxis dataKey="date" tick={{ fill: 'var(--text3)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} tickFormatter={v => v.toLocaleString()} />
                    <Tooltip contentStyle={tooltipStyle} formatter={v => [v.toLocaleString() + ' RWF', 'Revenue']} />
                    <Line type="monotone" dataKey="amount" stroke="#5b4cff" strokeWidth={2.5} dot={{ fill: '#5b4cff', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 14 }}>
                  No paid orders yet
                </div>
              )}
            </div>

            {/* Category pie */}
            <div className="card">
              <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15, marginBottom: 20 }}>🥧 Products by Category</p>
              {catData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} paddingAngle={3}>
                      {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ color: 'var(--text2)', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 14 }}>
                  No products listed yet
                </div>
              )}
            </div>
          </div>

          {/* Product sales bar */}
          <div className="card">
            <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Sales by Product</p>
            {productData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={productData} layout="vertical">
                  <XAxis type="number" tick={{ fill: 'var(--text3)', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text3)', fontSize: 11 }} width={130} />
                  <Tooltip contentStyle={tooltipStyle} formatter={v => [v, 'Units Sold']} />
                  <Bar dataKey="qty" fill="#5b4cff" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 14 }}>
                No sales data yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
