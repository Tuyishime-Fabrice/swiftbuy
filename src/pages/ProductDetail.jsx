import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ProductService, CartService, WishlistService, ReviewService } from '../services/storage'

const fmt = (n) => `RWF ${Number(n).toLocaleString()}`

function StarRow({ rating, size = 16, interactive = false, onRate }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(s => (
        <span
          key={s}
          onClick={() => interactive && onRate && onRate(s)}
          style={{
            fontSize: size, cursor: interactive ? 'pointer' : 'default',
            color: s <= rating ? '#f0a500' : 'var(--border2)', lineHeight: 1,
          }}
        >★</span>
      ))}
    </div>
  )
}

export default function ProductDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [product, setProduct] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [inWishlist, setInWishlist] = useState(false)
  const [qty, setQty] = useState(1)

  // Review form
  const [showReview, setShowReview] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    load()
  }, [id])

  const load = async () => {
    setLoading(true)
    try {
      const p = await ProductService.getById(id)
      if (!p) { navigate('/'); return }
      setProduct(p)
      document.title = `${p.name} — SwiftBuy Rwanda`

      const r = await ReviewService.getByProduct(id)
      setReviews(r)

      if (user) {
        const wl = await WishlistService.get(user.id)
        setInWishlist(Array.isArray(wl) ? wl.some(w => String(w.id) === String(id)) : false)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const addToCart = async () => {
    if (!user) return navigate('/login')
    if (user.role !== 'user') return toast('Only customers can add to cart', 'error')
    try {
      for (let i = 0; i < qty; i++) await CartService.add(product, user.id)
      toast(`${product.name} added to cart`, 'success')
    } catch { toast('Could not add to cart', 'error') }
  }

  const toggleWish = async () => {
    if (!user) return navigate('/login')
    try {
      const added = await WishlistService.toggle(product, user.id)
      setInWishlist(typeof added === 'boolean' ? added : !inWishlist)
      toast(inWishlist ? 'Removed from wishlist' : 'Added to wishlist', 'success')
    } catch { toast('Could not update wishlist', 'error') }
  }

  const submitReview = async () => {
    if (!user) return navigate('/login')
    if (!rating) return toast('Please select a rating', 'error')
    setSubmitting(true)
    try {
      const ok = await ReviewService.submit({
        productId: product.id, userId: user.id,
        orderId: null, userName: user.name,
        rating, comment
      })
      if (!ok) { toast('You already reviewed this product', 'error'); return }
      toast('Review submitted', 'success')
      setComment(''); setRating(5); setShowReview(false)
      load()
    } catch { toast('Could not submit review', 'error') }
    finally { setSubmitting(false) }
  }

  if (loading) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
        <div className="skeleton" style={{ height: 400, borderRadius: 16 }} />
      </div>
    </div>
  )

  if (!product) return null

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 28, fontSize: 13, color: 'var(--text3)' }}>
          <Link to="/" style={{ color: 'var(--accent)' }}>Shop</Link>
          <span>/</span>
          <span>{product.category}</span>
          <span>/</span>
          <span style={{ color: 'var(--text2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</span>
        </div>

        {/* Main layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: 48 }} className="product-detail-grid">

          {/* Image */}
          <div style={{
            background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)',
            aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', minHeight: 320
          }}>
            {product.image || product.imageUrl ? (
              <img src={product.image || product.imageUrl} alt={product.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text3)' }}>
                <div style={{ fontSize: 64, marginBottom: 8 }}>
                  {product.category}
                </div>
                <p style={{ fontSize: 13 }}>No image available</p>
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            {product.isFeatured && (
              <div style={{ display: 'inline-block', background: 'rgba(240,165,0,0.15)', color: 'var(--yellow)', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, marginBottom: 12, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                Featured
              </div>
            )}

            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 8, lineHeight: 1.25 }}>
              {product.name}
            </h1>

            {/* Rating summary */}
            {avgRating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <StarRow rating={Math.round(avgRating)} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{avgRating}</span>
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>({reviews.length} review{reviews.length !== 1 ? 's' : ''})</span>
              </div>
            )}

            <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--accent)', marginBottom: 16 }}>
              {fmt(product.price)}
            </div>

            <div style={{ marginBottom: 20 }}>
              <span style={{
                fontSize: 13, fontWeight: 600, padding: '4px 12px', borderRadius: 99,
                background: product.stock > 0 ? 'rgba(0,196,140,0.12)' : 'rgba(255,77,106,0.12)',
                color: product.stock > 0 ? 'var(--green)' : 'var(--red)',
              }}>
                {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
              </span>
            </div>

            <p style={{ color: 'var(--text2)', lineHeight: 1.7, fontSize: 15, marginBottom: 24 }}>
              {product.description || 'No description available.'}
            </p>

            {/* Seller */}
            <div style={{ background: 'var(--card2)', borderRadius: 12, padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                {(product.sellerName || 'S').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 1 }}>Sold by</p>
                <Link to={`/seller-profile/${product.sellerId}`} style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)' }}>
                  {product.sellerName}
                </Link>
              </div>
              {user?.role === 'user' && (
                <Link to={`/chat/${product.sellerId}`} style={{ fontSize: 13, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border2)', color: 'var(--text2)' }}>
                  Message
                </Link>
              )}
            </div>

            {/* Actions */}
            {user?.role === 'user' && product.stock > 0 && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                {/* Qty selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid var(--border2)', borderRadius: 10, overflow: 'hidden' }}>
                  <button onClick={() => setQty(q => Math.max(1, q - 1))}
                    style={{ width: 36, height: 44, background: 'var(--card)', color: 'var(--text)', border: 'none', fontSize: 18, cursor: 'pointer' }}>−</button>
                  <span style={{ width: 36, textAlign: 'center', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{qty}</span>
                  <button onClick={() => setQty(q => Math.min(product.stock, q + 1))}
                    style={{ width: 36, height: 44, background: 'var(--card)', color: 'var(--text)', border: 'none', fontSize: 18, cursor: 'pointer' }}>+</button>
                </div>

                <button onClick={addToCart} className="btn btn-primary" style={{ flex: 1, height: 44, fontSize: 15 }}>
                  Add to Cart
                </button>

                <button onClick={toggleWish} style={{
                  width: 44, height: 44, borderRadius: 10, border: '1px solid var(--border2)',
                  background: inWishlist ? 'rgba(255,77,106,0.12)' : 'var(--card)',
                  color: inWishlist ? 'var(--red)' : 'var(--text3)', fontSize: 20, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {inWishlist ? '♥' : '♡'}
                </button>
              </div>
            )}

            {!user && (
              <Link to="/login" className="btn btn-primary" style={{ display: 'block', textAlign: 'center', padding: '12px', borderRadius: 10, marginBottom: 16 }}>
                Sign in to purchase
              </Link>
            )}

            <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text3)', flexWrap: 'wrap' }}>
              <span>Category: <strong style={{ color: 'var(--text2)' }}>{product.category}</strong></span>
            </div>
          </div>
        </div>

        {/* Reviews section */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700 }}>
              Customer Reviews
              {reviews.length > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 16, marginLeft: 8 }}>({reviews.length})</span>}
            </h2>
            {user?.role === 'user' && (
              <button onClick={() => setShowReview(r => !r)} className="btn btn-sm" style={{ border: '1px solid var(--border2)', color: 'var(--text2)', background: 'var(--card)', borderRadius: 8, padding: '8px 16px', fontSize: 13 }}>
                {showReview ? 'Cancel' : 'Write a Review'}
              </button>
            )}
          </div>

          {/* Review form */}
          {showReview && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginBottom: 28 }}>
              <p style={{ fontWeight: 600, marginBottom: 12 }}>Your rating</p>
              <div style={{ marginBottom: 16 }}>
                <StarRow rating={rating} size={28} interactive onRate={setRating} />
              </div>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Share your experience with this product..."
                rows={4}
                style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '12px 14px', color: 'var(--text)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button onClick={submitReview} disabled={submitting} className="btn btn-primary" style={{ padding: '10px 24px', borderRadius: 10 }}>
                  {submitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </div>
          )}

          {reviews.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text3)' }}>
              <div style={{ fontSize: 40, marginBottom: 12, color: "var(--text3)" }}>—</div>
              <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>No reviews yet</p>
              <p style={{ fontSize: 14 }}>Be the first to review this product.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {reviews.map(r => (
                <div key={r.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: 'var(--accent)', flexShrink: 0 }}>
                      {(r.userName || r.user_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{r.userName || r.user_name}</p>
                      <StarRow rating={r.rating} size={13} />
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>
                      {r.createdAt || (r.created_at && new Date(r.created_at).toLocaleDateString())}
                    </span>
                  </div>
                  {r.comment && <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.6 }}>{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 700px) {
          .product-detail-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
        }
      `}</style>
    </div>
  )
}
