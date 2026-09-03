import { Link } from 'react-router-dom'

// ── ProductCard ───────────────────────────────────────────────────────────────
export function ProductCard({ product, onAddToCart, onToggleWishlist, wishlisted }) {
  return (
    <div className="fade-up" style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 32px rgba(0,0,0,0.22)' }}
    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
    >
      {/* Image — clicking goes to detail page */}
      <Link to={`/product/${product.id}`} style={{ display: 'block', textDecoration: 'none' }}>
        <div style={{ height: 200, background: 'var(--bg2)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {product.image || product.imageUrl ? (
            <img src={product.image || product.imageUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--border2)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          </div>
          )}
          {product.stock === 0 && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, background: 'rgba(255,77,106,0.85)', padding: '5px 14px', borderRadius: 20 }}>Out of Stock</span>
            </div>
          )}
          {product.isFeatured && (
            <div style={{ position: 'absolute', top: 10, left: 10, background: 'var(--yellow)', color: '#000', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, letterSpacing: '.04em', textTransform: 'uppercase' }}>
              Featured
            </div>
          )}
        </div>
      </Link>

      {/* Wishlist button overlay on image */}
      {onToggleWishlist && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => onToggleWishlist(product)}
            style={{
              position: 'absolute', top: -200 + 10, right: 10,
              width: 32, height: 32, borderRadius: '50%',
              background: wishlisted ? 'rgba(255,77,106,0.2)' : 'rgba(0,0,0,0.45)',
              border: '1px solid ' + (wishlisted ? 'rgba(255,77,106,0.5)' : 'rgba(255,255,255,0.12)'),
              color: wishlisted ? '#ff4d6a' : '#fff', fontSize: 15, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.18s', zIndex: 2,
            }}
          >
            {wishlisted ? '♥' : '♡'}
          </button>
        </div>
      )}

      {/* Body */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div>
          <p style={{ color: 'var(--text3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, marginBottom: 4 }}>
            {product.category}
          </p>
          <Link to={`/product/${product.id}`} style={{ textDecoration: 'none' }}>
            <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{product.name}</p>
          </Link>
        </div>

        {product.avgRating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: 'var(--yellow)', fontSize: 12, letterSpacing: 1 }}>
              {'★'.repeat(Math.round(product.avgRating))}{'☆'.repeat(5 - Math.round(product.avgRating))}
            </span>
            <span style={{ color: 'var(--text3)', fontSize: 11 }}>{product.avgRating} ({product.reviewCount})</span>
          </div>
        )}

        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <p style={{ color: 'var(--accent-light)', fontWeight: 800, fontSize: 17 }}>
              {Number(product.price).toLocaleString()}
              <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginLeft: 4 }}>RWF</span>
            </p>
            {product.stock > 0 && product.stock <= 5 && (
              <p style={{ color: 'var(--orange)', fontSize: 11, fontWeight: 600, marginTop: 1 }}>Only {product.stock} left</p>
            )}
          </div>
          {onAddToCart && product.stock > 0 && (
            <button className="btn btn-primary btn-sm" onClick={() => onAddToCart(product)} style={{ flexShrink: 0 }}>
              Add to cart
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── StatsCard ─────────────────────────────────────────────────────────────────
export function StatsCard({ label, value, sub, color = 'var(--accent)' }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      <p style={{ color: 'var(--text)', fontSize: 24, fontWeight: 800, fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>{value}</p>
      <p style={{ color: 'var(--text2)', fontSize: 13, fontWeight: 600 }}>{label}</p>
      {sub && <p style={{ color: 'var(--text3)', fontSize: 12 }}>{sub}</p>}
    </div>
  )
}

// ── PageHeader ────────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>{title}</h1>
        {subtitle && <p style={{ color: 'var(--text3)', marginTop: 4, fontSize: 14 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ── Empty State ────────────────────────────────────────────────────────────────
export function EmptyState({ title, subtitle, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <p style={{ color: 'var(--text2)', fontWeight: 700, fontSize: 16 }}>{title}</p>
      {subtitle && <p style={{ color: 'var(--text3)', fontSize: 14, maxWidth: 300 }}>{subtitle}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, width = 480 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18,
        width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto',
        animation: 'fadeUp 0.22s ease',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 16 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text2)', width: 28, height: 28, borderRadius: 7, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  )
}

// ── FormField ─────────────────────────────────────────────────────────────────
export function FormField({ label, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ color: 'var(--text2)', fontSize: 13, fontWeight: 600 }}>{label}</label>}
      {children}
      {error && <span style={{ color: 'var(--red)', fontSize: 12 }}>{error}</span>}
    </div>
  )
}

// ── Spinner ────────────────────────────────────────────────────────────────────
export function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 32, height: 32, border: '2.5px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
    </div>
  )
}

// ── StatusBadge ───────────────────────────────────────────────────────────────
export function StatusBadge({ value }) {
  const map = {
    pending:              { bg: 'rgba(240,165,0,0.12)',   color: 'var(--yellow)', label: 'Pending' },
    confirmed:            { bg: 'rgba(0,196,140,0.12)',   color: 'var(--green)',  label: 'Confirmed' },
    rejected:             { bg: 'rgba(255,77,106,0.12)',  color: 'var(--red)',    label: 'Rejected' },
    cancelled:            { bg: 'rgba(255,77,106,0.12)',  color: 'var(--red)',    label: 'Cancelled' },
    paid:                 { bg: 'rgba(0,196,140,0.12)',   color: 'var(--green)',  label: 'Paid' },
    unpaid:               { bg: 'rgba(255,77,106,0.12)',  color: 'var(--red)',    label: 'Unpaid' },
    pending_verification: { bg: 'rgba(240,165,0,0.12)',   color: 'var(--yellow)', label: 'Verifying' },
    shipped:              { bg: 'rgba(91,76,255,0.12)',   color: 'var(--accent)', label: 'Shipped' },
    delivered:            { bg: 'rgba(0,196,140,0.12)',   color: 'var(--green)',  label: 'Delivered' },
    'not shipped':        { bg: 'rgba(160,160,184,0.1)',  color: 'var(--text3)',  label: 'Not Shipped' },
    active:               { bg: 'rgba(0,196,140,0.12)',   color: 'var(--green)',  label: 'Active' },
  }
  const { bg, color, label } = map[value] || { bg: 'var(--card2)', color: 'var(--text3)', label: value || '—' }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: bg, color, display: 'inline-block' }}>
      {label}
    </span>
  )
}

// ── Tabs ───────────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2, background: 'var(--bg2)', borderRadius: 12, padding: 4, flexWrap: 'wrap' }}>
      {tabs.map(tab => (
        <button key={tab.key} onClick={() => onChange(tab.key)} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, transition: 'all 0.15s', fontFamily: 'inherit',
          background: active === tab.key ? 'var(--card)' : 'transparent',
          color: active === tab.key ? 'var(--accent)' : 'var(--text3)',
          boxShadow: active === tab.key ? '0 1px 6px rgba(0,0,0,0.12)' : 'none',
        }}>
          {tab.label}
          {tab.count != null && (
            <span style={{ marginLeft: 6, background: active === tab.key ? 'var(--accent)' : 'var(--border2)', color: active === tab.key ? '#fff' : 'var(--text3)', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
