import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { OrderService, ReviewService } from '../services/storage'
import { StatusBadge, EmptyState, Tabs } from '../components/UI'
import { Link } from 'react-router-dom'

function ReviewForm({ item, orderId, userId, onDone }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const { toast } = useToast()

  const submit = async () => {
    if (!rating) return toast('Select a star rating', 'error')
    const ok = await ReviewService.submit({ productId: item.id, productName: item.name, userId, orderId, rating, comment })
    if (ok) { toast('Review submitted!', 'success'); onDone() }
    else toast('Already reviewed', 'info')
  }

  return (
    <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ color: 'var(--text2)', fontSize: 13, fontWeight: 600 }}>Rate: {item.name}</p>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1,2,3,4,5].map(s => (
          <span key={s} onClick={() => setRating(s)} style={{ fontSize: 26, cursor: 'pointer', color: s <= rating ? 'var(--yellow)' : 'var(--border2)', transition: 'color 0.15s' }}>★</span>
        ))}
      </div>
      <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Write a comment (optional)" className="input" rows={2} style={{ resize: 'vertical' }} />
      <button className="btn btn-primary btn-sm" onClick={submit}>Submit Review</button>
    </div>
  )
}

export default function Orders() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [orders, setOrders] = useState([])
  const [tab, setTab] = useState('all')
  const [reviewFor, setReviewFor] = useState(null) // { orderId, item }

  useEffect(() => {
    document.title = 'My Orders — SwiftBuy'
    OrderService.getByUser(user.id).then(setOrders)
  }, [user.id])

  const reload = () => OrderService.getByUser(user.id).then(setOrders)

  const submitPaymentProof = async (orderId, method, proof = null) => {
    await OrderService.update(orderId, { paymentMethod: method, paymentProof: proof || method, paymentStatus: 'pending_verification' })
    toast('Payment submitted! Waiting for confirmation.', 'success')
    reload()
  }

  const tabs = [
    { key: 'all', label: 'All', count: orders.length },
    { key: 'pending', label: 'Pending', count: orders.filter(o => o.status === 'pending').length },
    { key: 'confirmed', label: 'Confirmed', count: orders.filter(o => o.status === 'confirmed').length },
    { key: 'delivered', label: 'Delivered', count: orders.filter(o => o.deliveryStatus === 'delivered').length },
  ]

  const visible = tab === 'all' ? orders
    : tab === 'pending' ? orders.filter(o => o.status === 'pending')
    : tab === 'confirmed' ? orders.filter(o => o.status === 'confirmed')
    : orders.filter(o => o.deliveryStatus === 'delivered')

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>My Orders</h1>
        <p style={{ color: 'var(--text3)', fontSize: 14, marginBottom: 24 }}>Track your orders and upload payment proof</p>

        <div style={{ marginBottom: 24 }}>
          <Tabs tabs={tabs} active={tab} onChange={setTab} />
        </div>

        {visible.length === 0 ? (
          <EmptyState title="No orders found" subtitle="When you place an order it will appear here." action={<Link to="/" className="btn btn-primary">Shop Now</Link>} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {visible.slice().reverse().map(order => (
              <div key={order.id} className="card fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <p style={{ color: 'var(--accent-light)', fontWeight: 700, fontSize: 14, fontFamily: 'monospace' }}>{order.id}</p>
                    <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 2 }}>{order.createdAt}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <StatusBadge value={order.status} />
                    <StatusBadge value={order.paymentStatus} />
                    <StatusBadge value={order.deliveryStatus} />
                  </div>
                </div>

                {/* Items */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  {order.items.filter(i => !i.sellerId || i.sellerId).map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg2)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {item.image ? <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600 }}>{item.name}</p>
                        <p style={{ color: 'var(--text3)', fontSize: 12 }}>Qty: {item.qty} · by {item.sellerName}</p>
                      </div>
                      <p style={{ color: 'var(--accent-light)', fontWeight: 700 }}>{(Number(item.price) * item.qty).toLocaleString()} RWF</p>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ color: 'var(--text3)', fontSize: 12 }}>Address: {order.deliveryAddress} · Phone: {order.deliveryPhone}</p>
                    {order.deliveryInfo && (
                      <p style={{ color: 'var(--green)', fontSize: 13, marginTop: 4, fontWeight: 600 }}>{order.deliveryInfo.message}</p>
                    )}
                  </div>
                  <p style={{ color: 'var(--green)', fontWeight: 800, fontSize: 18 }}>{Number(order.total).toLocaleString()} RWF</p>
                </div>

                {/* Payment section */}
                {order.paymentStatus === 'unpaid' && order.status !== 'rejected' && (
                  <div style={{ background: 'rgba(91,76,255,0.08)', border: '1px solid rgba(91,76,255,0.2)', borderRadius: 12, padding: 16 }}>
                    <p style={{ color: 'var(--accent-light)', fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Payment Instructions</p>
                    {order.sellerPayments?.map(sp => (
                      <div key={sp.sellerId} style={{ marginBottom: 12 }}>
                        <p style={{ color: 'var(--text2)', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Payment to: {sp.sellerName}</p>
                        {sp.paymentMethods?.momoNumber && (
                          <p style={{ color: 'var(--text2)', fontSize: 13, background: 'var(--bg2)', padding: '8px 12px', borderRadius: 8, marginBottom: 4 }}>
                            <strong>MoMo:</strong> {sp.paymentMethods.momoNumber} ({sp.paymentMethods.momoName})
                          </p>
                        )}
                        {sp.paymentMethods?.bankAccount && (
                          <p style={{ color: 'var(--text2)', fontSize: 13, background: 'var(--bg2)', padding: '8px 12px', borderRadius: 8, marginBottom: 4 }}>
                            <strong>Bank:</strong> {sp.paymentMethods.bankName} — {sp.paymentMethods.bankAccount}
                          </p>
                        )}
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => submitPaymentProof(order.id, 'mobile_money')}>
                        Confirm MoMo Payment
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => submitPaymentProof(order.id, 'bank_transfer')}>
                        Confirm Bank Transfer
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => submitPaymentProof(order.id, 'cash_on_delivery')}>
                        Cash on Delivery
                      </button>
                    </div>
                  </div>
                )}

                {order.paymentStatus === 'pending_verification' && (
                  <div style={{ background: 'rgba(240,165,0,0.1)', border: '1px solid rgba(240,165,0,0.3)', borderRadius: 10, padding: '10px 14px' }}>
                    <p style={{ color: 'var(--yellow)', fontSize: 13, fontWeight: 600 }}>⏳ Payment submitted — awaiting admin/seller confirmation.</p>
                  </div>
                )}

                {/* Reviews (for delivered orders) */}
                {order.deliveryStatus === 'delivered' && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <p style={{ color: 'var(--text2)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Rate your products</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {order.items.map(item => {
                        const key = `${order.id}-${item.id}`
                        if (reviewFor === key) {
                          return <ReviewForm key={key} item={item} orderId={order.id} userId={user.id} onDone={() => setReviewFor(null)} />
                        }
                        return (
                          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg2)', borderRadius: 10, padding: '10px 14px' }}>
                            <span style={{ color: 'var(--text2)', fontSize: 13 }}>{item.name}</span>
                            <button className="btn btn-ghost btn-xs" onClick={() => setReviewFor(key)}>Write a Review</button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
