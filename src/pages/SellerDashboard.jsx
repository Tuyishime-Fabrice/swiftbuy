import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { OrderService, NotificationService } from '../services/storage'
import { StatsCard, StatusBadge, EmptyState, Tabs } from '../components/UI'

function SellerSidebar({ active }) {
  const links = [
    { to: '/seller', label: 'Orders', key: 'orders' },
    { to: '/seller/products', label: 'Products', key: 'products' },
    { to: '/seller/analytics', label: 'Analytics', key: 'analytics' },
    { to: '/seller/chats', label: 'Chats', key: 'chats' },
    { to: '/profile', label: 'Profile', key: 'profile' },
  ]
  return (
    <div style={{ width: 200, flexShrink: 0, background: 'var(--card)', borderRight: '1px solid var(--border)', minHeight: 'calc(100vh - 62px)', padding: '24px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p style={{ color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, padding: '0 10px' }}>Seller Panel</p>
      {links.map(l => (
        <Link key={l.to} to={l.to} style={{
          padding: '10px 12px', borderRadius: 10, color: active === l.key ? 'var(--accent-light)' : 'var(--text2)',
          background: active === l.key ? 'rgba(91,76,255,0.12)' : 'transparent',
          fontSize: 14, fontWeight: active === l.key ? 700 : 500,
          transition: 'all 0.2s', display: 'block',
        }}>
          {l.label}
        </Link>
      ))}
    </div>
  )
}

export default function SellerDashboard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [orders, setOrders] = useState([])
  const [tab, setTab] = useState('all')

  useEffect(() => {
    document.title = 'Orders — SwiftBuy Seller'
    OrderService.getBySeller(user.id).then(setOrders)
  }, [user.id])

  const reload = () => OrderService.getBySeller(user.id).then(setOrders)

  const updateOrder = async (orderId, field, value) => {
    const order = orders.find(o => o.id === orderId)
    const changes = { [field]: value }
    if (field === 'deliveryStatus') {
      const msgs = { 'not shipped': 'Your order has not been shipped yet.', shipped: 'Your order is on the way.', delivered: 'Your order has been delivered! ✓' }
      const est = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString()
      changes.deliveryInfo = { message: msgs[value], estimatedDate: est }
      if (order) await NotificationService.push(order.userId, `Delivery update for order ${orderId}: ${msgs[value]}`)
    }
    if (field === 'paymentStatus' && value === 'paid' && order) {
      await NotificationService.push(order.userId, `Payment confirmed for order ${orderId}! ✓`)
    }
    await OrderService.update(orderId, changes)
    toast(`Order updated`, 'success')
    reload()
  }

  const pending = orders.filter(o => o.status === 'pending').length
  const confirmed = orders.filter(o => o.status === 'confirmed').length
  const revenue = orders.filter(o => o.paymentStatus === 'paid').reduce((s, o) => {
    const myItems = o.items.filter(i => i.sellerId === user.id)
    return s + myItems.reduce((ss, i) => ss + Number(i.price) * i.qty, 0)
  }, 0)

  const tabList = [
    { key: 'all', label: 'All', count: orders.length },
    { key: 'pending', label: 'Pending', count: pending },
    { key: 'confirmed', label: 'Active', count: confirmed },
    { key: 'payment', label: 'Awaiting Payment', count: orders.filter(o => o.paymentStatus === 'pending_verification').length },
  ]

  const visible = tab === 'all' ? orders
    : tab === 'pending' ? orders.filter(o => o.status === 'pending')
    : tab === 'confirmed' ? orders.filter(o => o.status === 'confirmed')
    : orders.filter(o => o.paymentStatus === 'pending_verification')

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ display: 'flex' }}>
        <SellerSidebar active="orders" />
        <div style={{ flex: 1, padding: '32px 28px', maxWidth: 'calc(100vw - 200px)' }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 24 }}>
            Customer Orders
          </h1>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14, marginBottom: 28 }}>
            <StatsCard label="Total Orders" value={orders.length} color="var(--accent)" />
            <StatsCard icon="⏳" label="Pending" value={pending} color="var(--yellow)" />
            <StatsCard icon="✓" label="Confirmed" value={confirmed} color="var(--green)" />
            <StatsCard label="Revenue Earned" value={revenue.toLocaleString() + ' RWF'} color="var(--green)" />
          </div>

          <div style={{ marginBottom: 20 }}>
            <Tabs tabs={tabList} active={tab} onChange={setTab} />
          </div>

          {visible.length === 0 ? (
            <EmptyState title="No orders" subtitle="Orders from customers will appear here." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {visible.slice().reverse().map(order => {
                const myItems = order.items.filter(i => i.sellerId === user.id)
                const myTotal = myItems.reduce((s, i) => s + Number(i.price) * i.qty, 0)
                return (
                  <div key={order.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <p style={{ color: 'var(--accent-light)', fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>{order.id}</p>
                        <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>
                          Customer: {order.userName} · Phone: {order.deliveryPhone}
                        </p>
                        <p style={{ color: 'var(--text3)', fontSize: 12 }}>Address: {order.deliveryAddress}</p>
                        <p style={{ color: 'var(--text3)', fontSize: 12 }}>{order.createdAt}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <StatusBadge value={order.status} />
                        <StatusBadge value={order.paymentStatus} />
                        <StatusBadge value={order.deliveryStatus} />
                      </div>
                    </div>

                    {/* My items */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                      {myItems.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--text)', fontSize: 14 }}>{item.name} <span style={{ color: 'var(--text3)' }}>× {item.qty}</span></span>
                          <span style={{ color: 'var(--accent-light)', fontWeight: 700 }}>{(Number(item.price) * item.qty).toLocaleString()} RWF</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                        <p style={{ color: 'var(--green)', fontWeight: 800 }}>My total: {myTotal.toLocaleString()} RWF</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                      <span style={{ color: 'var(--text3)', fontSize: 12, alignSelf: 'center', marginRight: 4 }}>Order:</span>
                      {order.status === 'pending' && <>
                        <button className="btn btn-primary btn-sm" onClick={() => updateOrder(order.id, 'status', 'confirmed')}>✓ Confirm</button>
                        <button className="btn btn-danger btn-sm" onClick={() => updateOrder(order.id, 'status', 'rejected')}>✕ Reject</button>
                      </>}

                      <span style={{ color: 'var(--text3)', fontSize: 12, alignSelf: 'center', marginLeft: 8, marginRight: 4 }}>Delivery:</span>
                      {['not shipped', 'shipped', 'delivered'].map(s => (
                        <button key={s} disabled={order.deliveryStatus === s} className={`btn btn-sm ${order.deliveryStatus === s ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => updateOrder(order.id, 'deliveryStatus', s)}>
                          {s === 'not shipped' ? 'Not Shipped' : s === 'shipped' ? 'Shipped' : '✓ Delivered'}
                        </button>
                      ))}

                      {order.paymentStatus === 'pending_verification' && (
                        <>
                          <span style={{ color: 'var(--text3)', fontSize: 12, alignSelf: 'center', marginLeft: 8, marginRight: 4 }}>Payment:</span>
                          <button className="btn btn-primary btn-sm" onClick={() => updateOrder(order.id, 'paymentStatus', 'paid')}>✓ Confirm Paid</button>
                          <button className="btn btn-danger btn-sm" onClick={() => updateOrder(order.id, 'paymentStatus', 'unpaid')}>✕ Mark Failed</button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export { SellerSidebar }
