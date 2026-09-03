import { useState, useEffect, useCallback } from 'react'
import Navbar from '../components/Navbar'
import { OrderService, UserService, ProductService, NotificationService } from '../services/storage'
import { StatsCard, StatusBadge, EmptyState, Tabs, PageHeader } from '../components/UI'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'

const COLORS = ['#5b4cff', '#00c48c', '#ff8c42', '#f0a500', '#ff4d6a', '#7b6fff']
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'orders',   label: 'Orders' },
  { key: 'users',    label: 'Users' },
  { key: 'sellers',  label: 'Sellers' },
  { key: 'products', label: 'Products' },
]

export default function AdminDashboard() {
  const { toast } = useToast()
  const { user: currentUser } = useAuth()
  const isSuperAdmin = currentUser?.role === 'superadmin'

  const [tab, setTab] = useState('overview')
  const [orders, setOrders] = useState([])
  const [users, setUsers] = useState([])
  const [products, setProducts] = useState([])
  const [searchUser, setSearchUser] = useState('')
  const [searchOrder, setSearchOrder] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)

  useEffect(() => {
    document.title = 'Dashboard — SwiftBuy'
    load()
  }, [])

  // Initial load — shows skeleton
  const load = async () => {
    try {
      const [o, u, p] = await Promise.all([
        OrderService.getAll(),
        UserService.getAll(),
        ProductService.getAll(),
      ])
      setOrders(o || [])
      setUsers(u || [])
      setProducts(p || [])
    } catch (e) {
      console.error(e)
      toast('Failed to load data', 'error')
    } finally {
      setInitialLoading(false)
    }
  }

  // Silent reload after actions — no spinner, just refreshes data in background
  const reload = useCallback(async () => {
    try {
      const [o, u] = await Promise.all([
        OrderService.getAll(),
        UserService.getAll(),
      ])
      setOrders(o || [])
      setUsers(u || [])
    } catch (e) {
      console.error(e)
    }
  }, [])

  // Only reload products when on products tab
  const reloadProducts = useCallback(async () => {
    try {
      const p = await ProductService.getAll()
      setProducts(p || [])
    } catch (e) { console.error(e) }
  }, [])

  const customers      = users.filter(u => u.role === 'user')
  const sellers        = users.filter(u => u.role === 'seller')
  const admins         = users.filter(u => u.role === 'admin')
  const pendingSellers = sellers.filter(s => !s.approved && !s.rejected && !s.suspended)
  const totalRevenue   = orders
    .filter(o => (o.paymentStatus || o.payment_status) === 'paid')
    .reduce((s, o) => s + Number(o.total), 0)

  const revenueMap = {}
  orders.filter(o => (o.paymentStatus || o.payment_status) === 'paid').forEach(o => {
    const date = (o.createdAt || o.created_at)?.split('T')[0] || 'Unknown'
    revenueMap[date] = (revenueMap[date] || 0) + Number(o.total)
  })
  const revenueData = Object.entries(revenueMap).map(([date, amount]) => ({ date, amount }))

  const statusMap = { pending: 0, confirmed: 0, rejected: 0 }
  orders.forEach(o => { statusMap[o.status] = (statusMap[o.status] || 0) + 1 })
  const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }))

  const tooltipStyle = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 }

  // ── Actions ────────────────────────────────────────────────────────────────
  const updateOrder = async (id, field, value) => {
    try {
      const order = orders.find(o => o.id === id)
      await OrderService.update(id, { [field]: value })
      if (field === 'status' && order) {
        await NotificationService.push(order.userId || order.user_id, `Your order ${id} has been ${value}.`)
      }
      if (field === 'deliveryStatus' && order) {
        const msgs = { 'not shipped': 'Not shipped yet.', shipped: 'Your order is on the way.', delivered: 'Your order has been delivered.' }
        const est = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString()
        await OrderService.update(id, { deliveryInfo: { message: msgs[value], estimatedDate: est } })
        await NotificationService.push(order.userId || order.user_id, `Delivery update for order ${id}: ${msgs[value]}`)
      }
      toast('Order updated', 'success')
      // Update locally without full reload
      setOrders(prev => prev.map(o => o.id === id ? { ...o, [field]: value, status: field === 'status' ? value : o.status, paymentStatus: field === 'paymentStatus' ? value : o.paymentStatus, deliveryStatus: field === 'deliveryStatus' ? value : o.deliveryStatus } : o))
    } catch { toast('Failed to update order', 'error') }
  }

  const approveSeller = async (id) => {
    try {
      await UserService.update(id, { approved: true, rejected: false, suspended: false })
      await NotificationService.push(id, 'Your seller account has been approved. You can now list products.')
      toast('Seller approved', 'success')
      // Update locally instantly, then reload in background
      setUsers(prev => prev.map(u => u.id === id ? { ...u, approved: true, rejected: false, suspended: false } : u))
      reload()
    } catch (e) {
      console.error(e)
      toast('Failed to approve. Make sure you ran the supabase-rls-fix.sql file.', 'error')
    }
  }

  const confirmReject = async () => {
    if (!rejectTarget) return
    try {
      await UserService.update(rejectTarget, { rejected: true, approved: false, rejectReason })
      toast('Seller rejected', 'info')
      setUsers(prev => prev.map(u => u.id === rejectTarget ? { ...u, rejected: true, approved: false, reject_reason: rejectReason } : u))
      setRejectTarget(null); setRejectReason('')
      reload()
    } catch { toast('Failed to reject', 'error') }
  }

  const suspendUser = async (id) => {
    if (!confirm('Suspend this account?')) return
    try {
      await UserService.update(id, { suspended: true })
      setUsers(prev => prev.map(u => u.id === id ? { ...u, suspended: true } : u))
      toast('Account suspended', 'info')
    } catch { toast('Failed', 'error') }
  }

  const unsuspendUser = async (id) => {
    try {
      await UserService.update(id, { suspended: false })
      setUsers(prev => prev.map(u => u.id === id ? { ...u, suspended: false } : u))
      toast('Account unsuspended', 'success')
    } catch { toast('Failed', 'error') }
  }

  const toggleAdmin = async (u) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin'
    if (!confirm(`${newRole === 'admin' ? 'Promote' : 'Demote'} ${u.name} to ${newRole}?`)) return
    try {
      await UserService.update(u.id, { role: newRole })
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: newRole } : x))
      toast('Role updated', 'success')
    } catch { toast('Failed', 'error') }
  }

  const toggleFeatured = async (product) => {
    const current = product.isFeatured || product.is_featured
    try {
      await ProductService.setFeatured(product.id, !current)
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_featured: !current, isFeatured: !current } : p))
      toast(!current ? 'Product featured' : 'Removed from featured', 'success')
    } catch { toast('Failed', 'error') }
  }

  const deleteProduct = async (id) => {
    if (!confirm('Delete this product?')) return
    try {
      await ProductService.delete(id)
      setProducts(prev => prev.filter(p => p.id !== id))
      toast('Product deleted', 'info')
    } catch { toast('Failed to delete', 'error') }
  }

  const filteredOrders = searchOrder
    ? orders.filter(o => o.id?.toString().includes(searchOrder) || (o.user_name || o.userName)?.toLowerCase().includes(searchOrder.toLowerCase()))
    : orders

  const filteredUsers = searchUser
    ? users.filter(u => u.name?.toLowerCase().includes(searchUser.toLowerCase()) || u.email?.toLowerCase().includes(searchUser.toLowerCase()))
    : users

  if (initialLoading) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12, marginBottom: 14 }} />)}
      </div>
    </div>
  )

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        <PageHeader
          title={isSuperAdmin ? 'Super Admin' : 'Admin Dashboard'}
          subtitle={isSuperAdmin ? 'Full platform control including admin management' : 'Manage orders, sellers, and products'}
        />

        {pendingSellers.length > 0 && (
          <div style={{ background: 'rgba(240,165,0,0.08)', border: '1px solid rgba(240,165,0,0.25)', borderRadius: 12, padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--yellow)', flexShrink: 0 }} />
            <p style={{ color: 'var(--yellow)', fontSize: 14, fontWeight: 600 }}>
              {pendingSellers.length} seller application{pendingSellers.length !== 1 ? 's' : ''} awaiting review
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => setTab('sellers')} style={{ marginLeft: 'auto' }}>Review</button>
          </div>
        )}

        <div style={{ marginBottom: 28 }}>
          <Tabs tabs={TABS} active={tab} onChange={setTab} />
        </div>

        {/* ── OVERVIEW ───────────────────────────────────────────────────── */}
        {tab === 'overview' && <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
            <StatsCard label="Total Revenue" value={totalRevenue.toLocaleString() + ' RWF'} color="var(--green)" />
            <StatsCard label="Total Orders" value={orders.length} color="var(--accent)" />
            <StatsCard label="Customers" value={customers.length} color="var(--orange)" />
            <StatsCard label="Active Sellers" value={sellers.filter(s => s.approved).length} color="var(--yellow)" />
            <StatsCard label="Products" value={products.length} color="var(--accent)" />
            <StatsCard label="Pending Orders" value={orders.filter(o => o.status === 'pending').length} color="var(--yellow)" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div className="card">
              <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: 20 }}>Revenue Over Time</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={revenueData}>
                  <XAxis dataKey="date" tick={{ fill: 'var(--text3)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} tickFormatter={v => v.toLocaleString()} />
                  <Tooltip contentStyle={tooltipStyle} formatter={v => [v.toLocaleString() + ' RWF', 'Revenue']} />
                  <Line type="monotone" dataKey="amount" stroke="#5b4cff" strokeWidth={2.5} dot={{ fill: '#5b4cff', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: 20 }}>Order Status Breakdown</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} paddingAngle={3}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ color: 'var(--text2)', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {isSuperAdmin && (
            <div className="card" style={{ marginTop: 20 }}>
              <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: 16 }}>Admin Accounts</p>
              {admins.length === 0 && <p style={{ color: 'var(--text3)', fontSize: 14 }}>No admin accounts yet.</p>}
              {admins.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(240,165,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--yellow)', fontWeight: 700, fontSize: 13 }}>
                    {a.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text3)' }}>{a.email}</p>
                  </div>
                  <button className="btn btn-danger btn-xs" onClick={() => toggleAdmin(a)}>Remove Admin</button>
                </div>
              ))}
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 12 }}>
                To promote a user to admin, find them in the Users tab.
              </p>
            </div>
          )}
        </>}

        {/* ── ORDERS ─────────────────────────────────────────────────────── */}
        {tab === 'orders' && <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <p style={{ color: 'var(--text2)', fontSize: 14 }}>{orders.length} orders</p>
            <input value={searchOrder} onChange={e => setSearchOrder(e.target.value)} placeholder="Search order ID or customer..." className="input" style={{ maxWidth: 300 }} />
          </div>
          {filteredOrders.length === 0
            ? <EmptyState title="No orders yet" />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredOrders.map(order => {
                  const status   = order.status
                  const payment  = order.paymentStatus || order.payment_status
                  const delivery = order.deliveryStatus || order.delivery_status
                  const userName = order.userName || order.user_name
                  const createdAt = order.createdAt || order.created_at
                  return (
                    <div key={order.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <p style={{ color: 'var(--text3)', fontSize: 11, fontFamily: 'monospace', letterSpacing: '.04em' }}>{order.id}</p>
                          <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>{userName}</p>
                          <p style={{ color: 'var(--text3)', fontSize: 12 }}>{typeof createdAt === 'string' ? createdAt.replace('T', ' ').slice(0, 16) : ''} · {Number(order.total).toLocaleString()} RWF</p>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                          <StatusBadge value={status} />
                          <StatusBadge value={payment} />
                          <StatusBadge value={delivery} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {status === 'pending' && <>
                          <button className="btn btn-primary btn-xs" onClick={() => updateOrder(order.id, 'status', 'confirmed')}>Confirm</button>
                          <button className="btn btn-danger btn-xs" onClick={() => updateOrder(order.id, 'status', 'rejected')}>Reject</button>
                        </>}
                        {(['not shipped','shipped','delivered']).map(s => (
                          <button key={s} className={`btn btn-xs ${delivery === s ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => updateOrder(order.id, 'deliveryStatus', s)}>
                            {s === 'not shipped' ? 'Not Shipped' : s === 'shipped' ? 'Shipped' : 'Delivered'}
                          </button>
                        ))}
                        {payment === 'pending_verification' && <>
                          <button className="btn btn-primary btn-xs" onClick={() => updateOrder(order.id, 'paymentStatus', 'paid')}>Confirm Payment</button>
                          <button className="btn btn-danger btn-xs" onClick={() => updateOrder(order.id, 'paymentStatus', 'pending')}>Reject Payment</button>
                        </>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
        </>}

        {/* ── USERS ──────────────────────────────────────────────────────── */}
        {tab === 'users' && <>
          <div style={{ marginBottom: 16 }}>
            <input value={searchUser} onChange={e => setSearchUser(e.target.value)} placeholder="Search users..." className="input" style={{ maxWidth: 300 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredUsers.filter(u => u.role === 'user' || u.role === 'admin').map(u => (
              <div key={u.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: u.role === 'admin' ? 'rgba(240,165,0,0.15)' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: u.role === 'admin' ? 'var(--yellow)' : '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                  {(u.name || 'U')[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>{u.name}</p>
                    {u.role === 'admin' && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: 'rgba(240,165,0,0.15)', color: 'var(--yellow)' }}>ADMIN</span>}
                  </div>
                  <p style={{ color: 'var(--text3)', fontSize: 12 }}>{u.email}</p>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {u.suspended
                    ? <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>Suspended</span>
                    : <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>Active</span>}
                  <button className={`btn btn-xs ${u.suspended ? 'btn-primary' : 'btn-danger'}`}
                    onClick={() => u.suspended ? unsuspendUser(u.id) : suspendUser(u.id)}>
                    {u.suspended ? 'Unsuspend' : 'Suspend'}
                  </button>
                  {isSuperAdmin && u.role !== 'superadmin' && (
                    <button className="btn btn-xs btn-ghost" onClick={() => toggleAdmin(u)}>
                      {u.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>}

        {/* ── SELLERS ────────────────────────────────────────────────────── */}
        {tab === 'sellers' && (
          <>
            {rejectTarget && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <div className="card" style={{ maxWidth: 420, width: '100%' }}>
                  <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Reject Seller Application</p>
                  <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 14 }}>Provide a reason (the seller will see this):</p>
                  <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="e.g. Incomplete business information..." className="input" style={{ resize: 'vertical', width: '100%', marginBottom: 16, boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setRejectTarget(null); setRejectReason('') }}>Cancel</button>
                    <button className="btn btn-danger btn-sm" onClick={confirmReject}>Confirm Rejection</button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sellers.length === 0 && <EmptyState title="No sellers yet" />}
              {sellers.map(s => {
                const approved = s.approved
                const rejected = s.rejected
                const suspended = s.suspended
                const momoNumber = s.momoNumber || s.momo_number
                return (
                  <div key={s.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                      <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                        {s.name[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</p>
                        <p style={{ color: 'var(--text3)', fontSize: 13 }}>{s.email}</p>
                        {momoNumber && <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 2 }}>MoMo: {momoNumber}</p>}
                        {rejected && (s.rejectReason || s.reject_reason) && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>Reason: {s.rejectReason || s.reject_reason}</p>}
                      </div>
                      <div>
                        {!approved && !rejected && !suspended && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(240,165,0,0.15)', color: 'var(--yellow)' }}>Pending</span>}
                        {approved && !suspended && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(0,196,140,0.15)', color: 'var(--green)' }}>Approved</span>}
                        {rejected && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(255,77,106,0.15)', color: 'var(--red)' }}>Rejected</span>}
                        {suspended && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(255,77,106,0.15)', color: 'var(--red)' }}>Suspended</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {!approved && !rejected && !suspended && <>
                        <button className="btn btn-primary btn-sm" onClick={() => approveSeller(s.id)}>Approve</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setRejectTarget(s.id)}>Reject</button>
                      </>}
                      {approved && !suspended && (
                        <button className="btn btn-danger btn-sm" onClick={() => suspendUser(s.id)}>Suspend</button>
                      )}
                      {suspended && (
                        <button className="btn btn-primary btn-sm" onClick={() => unsuspendUser(s.id)}>Unsuspend</button>
                      )}
                      {rejected && (
                        <button className="btn btn-ghost btn-sm" onClick={() => approveSeller(s.id)}>Re-approve</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── PRODUCTS ───────────────────────────────────────────────────── */}
        {tab === 'products' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {products.length === 0 && <EmptyState title="No products yet" />}
            {products.map(p => {
              const featured = p.isFeatured || p.is_featured
              return (
                <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ height: 120, background: 'var(--bg2)', borderRadius: 10, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.image || p.imageUrl || p.image_url
                      ? <img src={p.image || p.imageUrl || p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ color: 'var(--text3)', fontSize: 13 }}>No image</span>}
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</p>
                    <p style={{ color: 'var(--text3)', fontSize: 12 }}>{p.category} · {p.sellerName || p.seller_name}</p>
                    <p style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 14, marginTop: 2 }}>{Number(p.price).toLocaleString()} RWF</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className={`btn btn-xs ${featured ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => toggleFeatured(p)}>
                      {featured ? 'Unfeature' : 'Feature'}
                    </button>
                    <button className="btn btn-danger btn-xs" onClick={() => deleteProduct(p.id)}>Delete</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
