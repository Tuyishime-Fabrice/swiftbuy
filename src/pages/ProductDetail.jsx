import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import PageShell from '../layouts/PageShell'
import {
  EmptyState, ErrorState, Rating, QuantityStepper, InlineNotice,
} from '../components/UI'
import { ProductCard } from '../components/ProductCard'
import * as Icon from '../components/Icons'
import { useAuth } from '../context/auth-context'
import { useToast } from '../context/toast-context'
import { ProductService } from '../services/products'
import { CartService, WishlistService, ReviewService } from '../services/commerce'
import { ChatService } from '../services/messaging'
import { productImageUrl } from '../lib/supabase'
import { formatRwf, formatDate, stockState, STOCK_LABEL, initials } from '../utils/format'
import { fadeIn, listContainer, DURATION, EASE } from '../lib/motion'
import { useAsyncData } from '../hooks/useAsyncData'

/**
 * The product page.
 *
 * Everything on it is real: the gallery comes from Storage, the rating is the
 * cached average of verified reviews, and the review list is read-only here —
 * a review can only be written from a delivered order, so the write path lives
 * on the orders page rather than behind a "write a review" button anyone can
 * press.
 */
export default function ProductDetail() {
  const { id } = useParams()
  const { user, isCustomer } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  // Gallery and quantity are stamped with the product they belong to, so
  // navigating to a different product resets them by derivation rather than
  // by an effect that writes state after the render.
  const [selection, setSelection] = useState({ productId: null, image: 0, qty: 1 })
  const activeImage = selection.productId === id ? selection.image : 0
  const qty = selection.productId === id ? selection.qty : 1
  const setActiveImage = (image) => setSelection({ productId: id, image, qty })
  const setQty = (next) => setSelection({ productId: id, image: activeImage, qty: next })

  const [wishlisted, setWishlisted] = useState(false)
  const [adding, setAdding] = useState(false)

  const { status, data, error, retry } = useAsyncData(
    useCallback(async () => {
      const found = await ProductService.getById(id)
      if (!found) return { product: null, reviews: [], related: [] }

      const [reviewList, relatedList] = await Promise.all([
        ReviewService.listForProduct(id),
        found.category
          ? ProductService.search({ category: found.category, pageSize: 5 })
          : Promise.resolve({ items: [] }),
      ])

      return {
        product: found,
        reviews: reviewList,
        related: relatedList.items.filter((p) => p.id !== id).slice(0, 4),
      }
    }, [id])
  )

  const product = data?.product ?? null
  const reviews = data?.reviews ?? []
  const related = data?.related ?? []
  // A delisted product, or one whose store is no longer approved, returns no
  // row under RLS rather than an error.
  const missing = status === 'ready' && !product

  useEffect(() => {
    if (!user || !isCustomer || !product) return
    WishlistService.ids(user.id).then((ids) => setWishlisted(ids.has(product.id)))
  }, [user, isCustomer, product])

  const addToCart = async () => {
    if (!user) return navigate('/login', { state: { from: `/product/${id}` } })
    if (!isCustomer) return toast.info('Switch to a customer account to shop.')

    setAdding(true)
    try {
      await CartService.add(user.id, product.id, qty)
      toast.success(`${qty} × ${product.name} added to your cart`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setAdding(false)
    }
  }

  const toggleWishlist = async () => {
    if (!user) return navigate('/login', { state: { from: `/product/${id}` } })
    if (!isCustomer) return toast.info('Switch to a customer account to save products.')
    try {
      const saved = await WishlistService.toggle(user.id, product.id)
      setWishlisted(saved)
      toast.info(saved ? 'Saved to your wishlist' : 'Removed from your wishlist')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const messageSeller = async () => {
    if (!user) return navigate('/login', { state: { from: `/product/${id}` } })
    if (!isCustomer) return toast.info('Only customers can message a store.')
    try {
      const conversationId = await ChatService.openWithSeller(product.sellerId)
      navigate(`/messages/${conversationId}`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (status === 'loading') {
    return (
      <PageShell title="Loading product">
        <ProductDetailSkeleton />
      </PageShell>
    )
  }

  if (missing) {
    return (
      <PageShell title="Product not found">
        <EmptyState
          icon={Icon.Package}
          title="This product is no longer available"
          description="It may have been delisted, or its store may no longer be active."
          action={<Link to="/" className="btn btn-primary">Back to the shop</Link>}
        />
      </PageShell>
    )
  }

  if (status === 'error') {
    return (
      <PageShell title="Product">
        <ErrorState title="We couldn't load this product" description={error} onRetry={retry} />
      </PageShell>
    )
  }

  const state = stockState(product.stock)
  const images = product.images.length > 0 ? product.images : [null]

  return (
    <PageShell title={product.name}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: 20 }}>
        <ol style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.8125rem', flexWrap: 'wrap' }}>
          <li><Link to="/" style={{ color: 'var(--accent-soft)' }}>Shop</Link></li>
          {product.category && (
            <>
              <li aria-hidden="true" style={{ color: 'var(--text-subtle)' }}>/</li>
              <li>
                <Link to={`/?category=${encodeURIComponent(product.category)}`} style={{ color: 'var(--accent-soft)' }}>
                  {product.category}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true" style={{ color: 'var(--text-subtle)' }}>/</li>
          <li style={{ color: 'var(--text-muted)' }}>{product.name}</li>
        </ol>
      </nav>

      <div
        style={{
          display: 'grid', gap: 'clamp(20px, 4vw, 40px)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          marginBottom: 48,
        }}
      >
        <Gallery
          images={images}
          activeIndex={activeImage}
          onSelect={setActiveImage}
          alt={product.name}
        />

        <div>
          {product.isFeatured && (
            <span className="badge badge-warning" style={{ marginBottom: 10 }}>Featured</span>
          )}

          <h1 style={{ marginBottom: 8 }}>{product.name}</h1>

          {product.ratingCount > 0 ? (
            <div style={{ marginBottom: 14 }}>
              <Rating value={product.rating} count={product.ratingCount} size={16} />
            </div>
          ) : (
            <p style={{ color: 'var(--text-subtle)', fontSize: '0.875rem', marginBottom: 14 }}>
              No reviews yet
            </p>
          )}

          <p
            style={{
              fontFamily: "'Syne', sans-serif", fontSize: '1.85rem', fontWeight: 700,
              color: 'var(--accent-soft)', marginBottom: 14, letterSpacing: '-0.02em',
            }}
          >
            {formatRwf(product.price)}
          </p>

          <span
            className={
              state === 'out_of_stock' ? 'badge badge-danger'
                : state === 'low_stock' ? 'badge badge-warning'
                : 'badge badge-success'
            }
          >
            {STOCK_LABEL[state]}
          </span>

          <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, margin: '20px 0 24px' }}>
            {product.description || 'The seller has not added a description for this product yet.'}
          </p>

          {product.store && (
            <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
              <span
                style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--accent)', color: '#fff', display: 'grid',
                  placeItems: 'center', fontWeight: 700, fontSize: '0.8125rem',
                }}
              >
                {initials(product.store.name)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>Sold by</p>
                <Link
                  to={`/store/${product.sellerId}`}
                  style={{ color: 'var(--accent-soft)', fontWeight: 600, fontSize: '0.9375rem' }}
                >
                  {product.store.name}
                </Link>
                {product.store.status === 'approved' && (
                  <p style={{ color: 'var(--success)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon.Shield size={12} /> Reviewed by SwiftBuy
                  </p>
                )}
              </div>
              {isCustomer && (
                <button type="button" className="btn btn-outline btn-sm" onClick={messageSeller}>
                  <Icon.Chat size={15} /> Message
                </button>
              )}
            </div>
          )}

          {state !== 'out_of_stock' ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <QuantityStepper value={qty} max={product.stock} onChange={setQty} />
              <button
                type="button"
                className="btn btn-primary"
                onClick={addToCart}
                disabled={adding}
                style={{ flex: '1 1 180px' }}
              >
                {adding ? <span className="spinner" aria-hidden="true" /> : <Icon.Cart size={17} />}
                {adding ? 'Adding…' : 'Add to cart'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={toggleWishlist}
                aria-pressed={wishlisted}
                aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                style={{ width: 46, padding: 0, color: wishlisted ? 'var(--danger)' : undefined }}
              >
                {wishlisted ? <Icon.HeartFilled size={18} /> : <Icon.Heart size={18} />}
              </button>
            </div>
          ) : (
            <InlineNotice tone="warning" title="Out of stock">
              This product is currently unavailable. Save it to your wishlist and check back.
            </InlineNotice>
          )}

          {!user && (
            <p style={{ color: 'var(--text-subtle)', fontSize: '0.875rem', marginTop: 14 }}>
              <Link to="/login" style={{ color: 'var(--accent-soft)' }}>Sign in</Link> to add this to your cart.
            </p>
          )}

          <ul
            style={{
              display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 22,
              color: 'var(--text-subtle)', fontSize: '0.8125rem',
            }}
          >
            <li style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Icon.Receipt size={14} /> Total calculated at checkout
            </li>
            <li style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Icon.Truck size={14} /> Delivery tracked per seller
            </li>
          </ul>
        </div>
      </div>

      <Reviews reviews={reviews} rating={product.rating} count={product.ratingCount} />

      {related.length > 0 && (
        <section style={{ marginTop: 48 }} aria-labelledby="related">
          <h2 id="related" style={{ marginBottom: 16 }}>More in {product.category}</h2>
          <motion.div className="grid-products" variants={listContainer} initial="initial" animate="animate">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </motion.div>
        </section>
      )}
    </PageShell>
  )
}

// ── Gallery ─────────────────────────────────────────────────────────────────

function Gallery({ images, activeIndex, onSelect, alt }) {
  const active = images[activeIndex]
  const src = productImageUrl(active?.storage_path, { width: 900 })

  return (
    <div>
      <div
        style={{
          aspectRatio: '1', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
          border: '1px solid var(--border)', background: 'var(--bg-sunk)',
          display: 'grid', placeItems: 'center',
        }}
      >
        <AnimatePresence mode="wait">
          {src ? (
            <motion.img
              key={active.id}
              {...fadeIn}
              src={src}
              alt={active.alt_text || alt}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-subtle)' }}>
              <Icon.Image size={36} />
              <p style={{ fontSize: '0.8125rem', marginTop: 8 }}>No photo yet</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {images.length > 1 && (
        <div className="scroll-x" style={{ marginTop: 10 }}>
          <div style={{ display: 'inline-flex', gap: 8, minWidth: 'max-content', paddingBottom: 2 }}>
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => onSelect(index)}
                aria-label={`Show image ${index + 1} of ${images.length}`}
                aria-current={index === activeIndex}
                style={{
                  width: 62, height: 62, borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                  border: `2px solid ${index === activeIndex ? 'var(--accent)' : 'var(--border)'}`,
                  background: 'var(--bg-sunk)', flexShrink: 0,
                  transition: `border-color ${DURATION.fast}s ${EASE}`,
                }}
              >
                <img
                  src={productImageUrl(image.storage_path, { width: 140 })}
                  alt=""
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Reviews ─────────────────────────────────────────────────────────────────

function Reviews({ reviews, rating, count }) {
  return (
    <section aria-labelledby="reviews" style={{ borderTop: '1px solid var(--border)', paddingTop: 32 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 14, marginBottom: 20, flexWrap: 'wrap',
        }}
      >
        <h2 id="reviews">Customer reviews</h2>
        {count > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Rating value={rating} size={16} showEmpty />
            <span style={{ fontWeight: 700 }}>{rating.toFixed(1)}</span>
            <span style={{ color: 'var(--text-subtle)', fontSize: '0.875rem' }}>
              from {count} verified purchase{count === 1 ? '' : 's'}
            </span>
          </div>
        )}
      </div>

      <InlineNotice tone="info" title="Only buyers can review">
        A review can only be written from a delivered order, so every rating here comes from
        someone who actually received the product.
      </InlineNotice>

      {reviews.length === 0 ? (
        <EmptyState
          icon={Icon.Star}
          title="No reviews yet"
          description="Once someone has received this product, their review will appear here."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}>
          {reviews.map((review) => (
            <article key={review.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 8 }}>
                <span
                  style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--surface-hover)', color: 'var(--accent-soft)',
                    display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '0.75rem',
                  }}
                >
                  {initials(review.authorName)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{review.authorName}</p>
                  <Rating value={review.rating} size={12} showEmpty />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge badge-success">
                    <Icon.Check size={11} /> Verified
                  </span>
                  <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem', marginTop: 3 }}>
                    {formatDate(review.createdAt)}
                  </p>
                </div>
              </div>
              {review.comment && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                  {review.comment}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function ProductDetailSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="skeleton" style={{ height: 14, width: 220, marginBottom: 22 }} />
      <div
        style={{
          display: 'grid', gap: 'clamp(20px, 4vw, 40px)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
        }}
      >
        <div className="skeleton" style={{ aspectRatio: '1', borderRadius: 'var(--radius-lg)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="skeleton" style={{ height: 30, width: '80%' }} />
          <div className="skeleton" style={{ height: 16, width: '40%' }} />
          <div className="skeleton" style={{ height: 34, width: '50%' }} />
          <div className="skeleton" style={{ height: 90 }} />
          <div className="skeleton" style={{ height: 66, borderRadius: 'var(--radius)' }} />
          <div className="skeleton" style={{ height: 46, borderRadius: 'var(--radius)' }} />
        </div>
      </div>
    </div>
  )
}
