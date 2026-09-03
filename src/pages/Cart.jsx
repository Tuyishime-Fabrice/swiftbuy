import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { CartService, OrderService, NotificationService, UserService } from '../services/storage'
import { EmptyState } from '../components/UI'

export default function Cart() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [cart, setCart] = useState([])
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [step, setStep] = useState('cart')
  const [orderId, setOrderId] = useState(null)
  const [placing, setPlacing] = useState(false)

  useEffect(() => {
    document.title = 'Cart — SwiftBuy'
    CartService.get(user?.id).then(c => setCart(c || []))
  }, [])

  const updateQty = async (id, qty) => {
    await CartService.updateQty(id, qty, user?.id)
    const updated = await CartService.get(user?.id)
    setCart(updated || [])
  }

  const remove = async (id) => {
    await CartService.remove(id, user?.id)
    const updated = await CartService.get(user?.id)
    setCart(updated || [])
    toast('Removed from cart', 'info')
  }

  const total = cart.reduce((s, i) => s + Number(i.price) * i.qty, 0)

  const placeOrder = async () => {
    if (!address.trim() || !phone.trim()) return toast('Please enter delivery address and phone number', 'error')
    if (cart.length === 0) return toast('Your cart is empty', 'error')
    setPlacing(true)
    try {
      const users = await UserService.getAll()
      const sellerIds = [...new Set(cart.map(i => i.sellerId || i.seller_id))]
      const sellerPayments = sellerIds.map(id => {
        const seller = users.find(u => String(u.id) === String(id))
        return { sellerId: id, sellerName: seller?.name, paymentMethods: seller?.paymentMethods }
      })

      const order = await OrderService.create({
        id: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        items: cart,
        total,
        status: 'pending',
        paymentStatus: 'unpaid',
        deliveryStatus: 'not shipped',
        sellerPayments,
        deliveryAddress: address,
        deliveryPhone: phone,
        createdAt: new Date().toISOString(),
      })

      await CartService.clear(user?.id)
      setCart([])
      setOrderId(order.id)
      await NotificationService.push(user.id, `Order ${order.id} placed successfully! It is now pending review.`)
      setStep('success')
    } catch (e) {
      toast('Failed to place order. Please try again.', 'error')
    } finally {
      setPlacing(false)
    }
  }

  if (step === 'success') {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ maxWidth: 520, margin: '60px auto', padding: '0 24px', textAlign: 'center' }} className="fade-up">
          <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(0,196,140,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 32 }}>✓</div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>Order Placed!</h1>
          <p style={{ color: 'var(--text2)', marginBottom: 8 }}>Order <strong style={{ color: 'var(--accent-light)' }}>{orderId}</strong> has been placed successfully.</p>
          <p style={{ color: 'var(--text3)', fontSize: 14, marginBottom: 32 }}>Go to My Orders to upload payment proof and track delivery.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link to="/orders" className="btn btn-primary">View My Orders</Link>
            <Link to="/" className="btn btn-ghost">Continue Shopping</Link>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'checkout') {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ maxWidth: 660, margin: '0 auto', padding: '32px 24px' }} className="fade-up">
          <button onClick={() => setStep('cart')} className="btn btn-ghost btn-sm" style={{ marginBottom: 24 }}>← Back to Cart</button>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 28 }}>Checkout</h1>

          <div className="card" style={{ marginBottom: 20 }}>
            <p style={{ color: 'var(--text2)', fontWeight: 700, fontSize: 13, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Order Summary</p>
            {cart.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text)', fontSize: 14 }}>{item.name} <span style={{ color: 'var(--text3)' }}>× {item.qty}</span></span>
                <span style={{ color: 'var(--accent-light)', fontWeight: 700 }}>{(Number(item.price) * item.qty).toLocaleString()} RWF</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
              <span style={{ color: 'var(--text)', fontWeight: 800, fontSize: 16 }}>Total</span>
              <span style={{ color: 'var(--green)', fontWeight: 800, fontSize: 18 }}>{total.toLocaleString()} RWF</span>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ color: 'var(--text2)', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Delivery Details</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ color: 'var(--text2)', fontSize: 13, fontWeight: 600 }}>Delivery Address *</label>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. KK 243, Kigali" className="input" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ color: 'var(--text2)', fontSize: 13, fontWeight: 600 }}>Phone Number *</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+250 7XX XXX XXX" className="input" />
            </div>
          </div>

          <div className="card" style={{ marginBottom: 28 }}>
            <p style={{ color: 'var(--text2)', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>Payment</p>
            <p style={{ color: 'var(--text3)', fontSize: 13, lineHeight: 1.6 }}>
              After placing your order, go to <strong style={{ color: 'var(--text2)' }}>My Orders</strong> to view payment instructions from the seller and confirm your payment.
            </p>
            <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {['Mobile Money (MTN/Airtel)', 'Bank Transfer', 'Cash on Delivery'].map(m => (
                <span key={m} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 14px', fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{m}</span>
              ))}
            </div>
          </div>

          <button className="btn btn-primary" onClick={placeOrder} disabled={placing} style={{ width: '100%', padding: '14px', fontSize: 16 }}>
            {placing ? 'Placing Order...' : `Place Order — ${total.toLocaleString()} RWF`}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 28 }}>
          Cart <span style={{ color: 'var(--text3)', fontSize: 18, fontWeight: 600 }}>({cart.length} items)</span>
        </h1>

        {cart.length === 0 ? (
          <EmptyState title="Your cart is empty" subtitle="Add some products to get started!" action={<Link to="/" className="btn btn-primary">Browse Products</Link>} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {cart.map(item => (
                <div key={item.id} className="card" style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '16px' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 12, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {(item.image || item.image_url)
                      ? <img src={item.image || item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : null}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15 }}>{item.name}</p>
                    <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 2 }}>by {item.sellerName || item.seller_name}</p>
                    <p style={{ color: 'var(--accent-light)', fontWeight: 700, marginTop: 4 }}>{Number(item.price).toLocaleString()} RWF each</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => updateQty(item.id, item.qty - 1)}>−</button>
                    <span style={{ color: 'var(--text)', fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{item.qty}</span>
                    <button className="btn btn-ghost btn-xs" onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 120 }}>
                    <p style={{ color: 'var(--text)', fontWeight: 800 }}>{(Number(item.price) * item.qty).toLocaleString()} RWF</p>
                    <button onClick={() => remove(item.id)} style={{ color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, marginTop: 6, fontFamily: 'inherit' }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="card" style={{ minWidth: 240, position: 'sticky', top: 80 }}>
              <p style={{ color: 'var(--text)', fontWeight: 800, fontSize: 17, marginBottom: 16 }}>Order Summary</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {cart.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text2)' }}>{item.name} × {item.qty}</span>
                    <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{(Number(item.price) * item.qty).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
                <span style={{ color: 'var(--text)', fontWeight: 700 }}>Total</span>
                <span style={{ color: 'var(--green)', fontWeight: 800, fontSize: 18 }}>{total.toLocaleString()} RWF</span>
              </div>
              <button className="btn btn-primary" onClick={() => setStep('checkout')} style={{ width: '100%' }}>
                Proceed to Checkout →
              </button>
              <Link to="/" className="btn btn-ghost btn-sm" style={{ display: 'block', textAlign: 'center', marginTop: 10 }}>
                ← Continue Shopping
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
