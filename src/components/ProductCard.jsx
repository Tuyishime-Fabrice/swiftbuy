import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { productImageUrl } from '../lib/supabase'
import { formatRwf, stockState, STOCK_LABEL } from '../utils/format'
import { listItem, DURATION, EASE } from '../lib/motion'
import { Rating } from './UI'
import * as Icon from './Icons'

/**
 * The storefront product card.
 *
 * Keeps the original SwiftBuy layout — image, category, name, rating, price,
 * add-to-cart — and tightens the details: real stock states instead of a raw
 * count, a wishlist control that is a labelled button, a CDN-resized image,
 * and lazy loading so a long grid does not fetch everything at once.
 */
export function ProductCard({ product, onAddToCart, onToggleWishlist, wishlisted, busy }) {
  const state = stockState(product.stock)
  const outOfStock = state === 'out_of_stock'
  const src = productImageUrl(product.imagePath, { width: 480 })

  return (
    <motion.article
      variants={listItem}
      whileHover={{ y: -3 }}
      transition={{ duration: DURATION.fast, ease: EASE }}
      className="card card-flush"
      style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}
    >
      <Link
        to={`/product/${product.id}`}
        style={{ display: 'block' }}
        aria-label={`${product.name}, ${formatRwf(product.price)}`}
      >
        <div
          style={{
            aspectRatio: '1', background: 'var(--bg-sunk)', position: 'relative',
            display: 'grid', placeItems: 'center', overflow: 'hidden',
          }}
        >
          {src ? (
            <motion.img
              src={src}
              alt={product.name}
              loading="lazy"
              decoding="async"
              whileHover={{ scale: 1.04 }}
              transition={{ duration: DURATION.slow, ease: EASE }}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ color: 'var(--text-subtle)' }}><Icon.Image size={28} /></span>
          )}

          {outOfStock && (
            <div
              style={{
                position: 'absolute', inset: 0, background: 'rgba(6,6,12,0.6)',
                display: 'grid', placeItems: 'center',
              }}
            >
              <span className="badge badge-danger" style={{ background: 'rgba(217,45,78,0.9)', color: '#fff' }}>
                Out of stock
              </span>
            </div>
          )}

          {product.isFeatured && !outOfStock && (
            <span
              className="badge badge-warning"
              style={{ position: 'absolute', top: 10, left: 10, background: 'var(--warning)', color: '#fff' }}
            >
              Featured
            </span>
          )}
        </div>
      </Link>

      {onToggleWishlist && (
        <button
          type="button"
          onClick={() => onToggleWishlist(product)}
          aria-pressed={Boolean(wishlisted)}
          aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          style={{
            position: 'absolute', top: 10, right: 10, width: 34, height: 34,
            borderRadius: '50%', display: 'grid', placeItems: 'center',
            background: 'rgba(8,8,14,0.55)', backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255,255,255,0.14)',
            color: wishlisted ? 'var(--danger)' : '#fff',
            transition: `color ${DURATION.fast}s`,
          }}
        >
          <motion.span
            key={String(wishlisted)}
            initial={{ scale: 0.7 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            style={{ display: 'flex' }}
          >
            {wishlisted ? <Icon.HeartFilled size={16} /> : <Icon.Heart size={16} />}
          </motion.span>
        </button>
      )}

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
        {product.category && (
          <p
            style={{
              color: 'var(--text-subtle)', fontSize: '0.6875rem', fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}
          >
            {product.category}
          </p>
        )}

        <Link to={`/product/${product.id}`}>
          <h3
            style={{
              fontFamily: 'inherit', fontSize: '0.9375rem', fontWeight: 600,
              lineHeight: 1.35, letterSpacing: 0,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {product.name}
          </h3>
        </Link>

        {product.ratingCount > 0 && <Rating value={product.rating} count={product.ratingCount} size={13} />}

        {product.storeName && (
          <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>{product.storeName}</p>
        )}

        <div
          style={{
            marginTop: 'auto', paddingTop: 8, display: 'flex', alignItems: 'flex-end',
            justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
          }}
        >
          <div>
            <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--accent-soft)' }}>
              {formatRwf(product.price, { withCurrency: false })}
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-subtle)', marginLeft: 4 }}>RWF</span>
            </p>
            {state === 'low_stock' && (
              <p style={{ color: 'var(--warning)', fontSize: '0.75rem', fontWeight: 600 }}>
                {STOCK_LABEL.low_stock}
              </p>
            )}
          </div>

          {onAddToCart && !outOfStock && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onAddToCart(product)}
              disabled={busy}
              aria-label={`Add ${product.name} to cart`}
            >
              {busy ? <span className="spinner" aria-hidden="true" /> : <Icon.Cart size={15} />}
              Add
            </button>
          )}
        </div>
      </div>
    </motion.article>
  )
}
