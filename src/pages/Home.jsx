import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { ProductCard, EmptyState } from '../components/UI'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ProductService, CartService, WishlistService } from '../services/storage'

const CATEGORIES = ['All', 'Electronics', 'Clothing', 'Food & Drinks', 'Home & Living', 'Beauty', 'Sports', 'Other']
const CAT_ICONS = { All: 'All', Electronics: 'Electronics', Clothing: 'Clothing', 'Food & Drinks': 'Food', 'Home & Living': 'Home', Beauty: 'Beauty', Sports: 'Sports', Other: 'Other' }

export default function Home() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState('default')
  const [wishlist, setWishlist] = useState([])
  const [priceRange, setPriceRange] = useState([0, 10000000])
  const [inStockOnly, setInStockOnly] = useState(false)

  useEffect(() => {
    document.title = 'SwiftBuy Rwanda — Shop'
    const load = async () => {
      const [prods, wl] = await Promise.all([
        ProductService.getAll(),
        user ? WishlistService.get(user.id) : Promise.resolve([])
      ])
      setProducts(prods)
      setWishlist(Array.isArray(wl) ? wl : [])
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    let p = products
    if (search) p = p.filter(x => x.name.toLowerCase().includes(search.toLowerCase()) || x.description?.toLowerCase().includes(search.toLowerCase()))
    if (category !== 'All') p = p.filter(x => x.category === category)
    if (inStockOnly) p = p.filter(x => x.stock > 0)
    p = p.filter(x => Number(x.price) >= priceRange[0] && Number(x.price) <= priceRange[1])
    if (sort === 'price-asc')  p = [...p].sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') p = [...p].sort((a, b) => b.price - a.price)
    if (sort === 'rating')     p = [...p].sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0))
    if (sort === 'featured')   p = [...p].sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0))
    return p
  }, [products, search, category, sort, priceRange, inStockOnly])

  const addToCart = async (product) => {
    if (!user) return navigate('/login')
    await CartService.add(product, user.id)
    toast(`${product.name} added to cart!`, 'success')
  }

  const toggleWishlist = async (product) => {
    if (!user) return navigate('/login')
    const added = await WishlistService.toggle(product, user.id)
    const wl = await WishlistService.get(user.id)
    setWishlist(Array.isArray(wl) ? wl : [])
    toast(added ? 'Added to wishlist' : 'Removed from wishlist', added ? 'success' : 'info')
  }

  const featuredProducts = products.filter(p => p.isFeatured || p.is_featured).slice(0, 3)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #0a0a18 0%, #12102e 50%, #0e0e20 100%)',
        borderBottom: '1px solid var(--border)',
        padding: '56px 24px',
        textAlign: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,76,255,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,196,140,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <p style={{ color: 'var(--accent-light)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 12 }}>
          Rwanda's Leading Marketplace
        </p>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(30px, 5vw, 52px)', fontWeight: 800, color: '#fff', lineHeight: 1.15, marginBottom: 16, letterSpacing: '-1px' }}>
          Quality Products,<br />
          <span style={{ background: 'linear-gradient(90deg, #7b6fff, #00c48c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Delivered Fast</span>
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: 16, maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.6 }}>
          Shop electronics, fashion, food, beauty and more — pay with Mobile Money, bank transfer, or cash on delivery.
        </p>

        <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', gap: 0, background: 'rgba(255,255,255,0.06)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', overflow: 'hidden' }}>
          <span style={{ padding: '0 16px', display: 'flex', alignItems: 'center', color: '#666' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products, brands, categories..."
            style={{ flex: 1, padding: '14px 0', background: 'transparent', border: 'none', color: '#fff', fontSize: 15 }}
          />
          {search && <button onClick={() => setSearch('')} style={{ padding: '0 16px', background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18 }}>✕</button>}
        </div>

        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
          {['Secure Payments', 'Fast Delivery', 'Verified Sellers', 'Mobile Money'].map(b => (
            <span key={b} style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 500 }}>{b}</span>
          ))}
        </div>
      </div>

      {/* Category pills */}
      <div style={{ padding: '20px 24px 0', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 8, paddingBottom: 4, minWidth: 'max-content' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: '9px 18px', borderRadius: 30, border: '1.5px solid',
                borderColor: category === cat ? 'var(--accent)' : 'var(--border)',
                background: category === cat ? 'rgba(91,76,255,0.15)' : 'var(--card)',
                color: category === cat ? 'var(--accent-light)' : 'var(--text2)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: 'inherit',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Featured strip */}
      {featuredProducts.length > 0 && search === '' && category === 'All' && (
        <div style={{ padding: '24px 24px 0' }}>
          <p style={{ color: 'var(--yellow)', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>Featured Today</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 8 }}>
            {featuredProducts.map(p => (
              <ProductCard key={p.id} product={p} onAddToCart={addToCart} onToggleWishlist={toggleWishlist} wishlisted={wishlist.some(w => w.id === p.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Main grid */}
      <div style={{ padding: '24px', display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Sidebar filters */}
        <div className="hide-mobile" style={{ width: 220, flexShrink: 0, position: 'sticky', top: 80 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15 }}>Filters</p>

            <div>
              <p style={{ color: 'var(--text2)', fontSize: 12, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Sort by</p>
              <select value={sort} onChange={e => setSort(e.target.value)} className="input" style={{ padding: '9px 12px', fontSize: 13 }}>
                <option value="default">Default</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating">Top Rated</option>
                <option value="featured">Featured First</option>
              </select>
            </div>

            <div>
              <p style={{ color: 'var(--text2)', fontSize: 12, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Availability</p>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text2)', fontSize: 13 }}>
                <input type="checkbox" checked={inStockOnly} onChange={e => setInStockOnly(e.target.checked)} />
                In Stock Only
              </label>
            </div>

            <div>
              <p style={{ color: 'var(--text2)', fontSize: 12, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Max Price: {Number(priceRange[1]).toLocaleString()} RWF
              </p>
              <input
                type="range" min={0} max={2000000} step={10000}
                value={priceRange[1]}
                onChange={e => setPriceRange([0, Number(e.target.value)])}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text3)', fontSize: 11, marginTop: 4 }}>
                <span>0</span><span>2,000,000</span>
              </div>
            </div>

            {(search || category !== 'All' || inStockOnly || priceRange[1] < 10000000) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setCategory('All'); setInStockOnly(false); setPriceRange([0, 10000000]); setSort('default') }}>
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Products */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <p style={{ color: 'var(--text2)', fontSize: 14 }}>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{filtered.length}</span> products
              {search && <> for "<span style={{ color: 'var(--accent-light)' }}>{search}</span>"</>}
            </p>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="No products found" subtitle="Try a different search term or category" action={<button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setCategory('All') }}>Clear filters</button>} />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {filtered.map(p => (
                <ProductCard key={p.id} product={p} onAddToCart={addToCart} onToggleWishlist={toggleWishlist} wishlisted={wishlist.some(w => w.id === p.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '32px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
        <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>SwiftBuy Rwanda</p>
        <p>Fast Delivery · Secure Payment · Quality Products</p>
        <p style={{ marginTop: 8, fontSize: 12 }}>© 2025 SwiftBuy Rwanda. Final Year Project — UTB University</p>
      </div>
    </div>
  )
}
