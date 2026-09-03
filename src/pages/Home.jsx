import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import PageShell from '../layouts/PageShell'
import { ProductCard } from '../components/ProductCard'
import {
  EmptyState, ErrorState, ProductGridSkeleton, Pagination, Field, Modal,
} from '../components/UI'
import * as Icon from '../components/Icons'
import { useAuth } from '../context/auth-context'
import { useToast } from '../context/toast-context'
import { ProductService, CategoryService, SORTS, PAGE_SIZE } from '../services/products'
import { CartService, WishlistService } from '../services/commerce'
import { listContainer, riseIn } from '../lib/motion'
import { useAsyncData } from '../hooks/useAsyncData'
import { formatRwf } from '../utils/format'

/**
 * The storefront.
 *
 * Filtering, sorting and paging all happen in PostgreSQL through the
 * search_products function — the browser holds one page at a time. Filter
 * state lives in the URL so a filtered view can be shared, bookmarked, and
 * survives the back button.
 */

const PRICE_CEILING = 2_000_000

export default function Home() {
  const { user, isCustomer } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const [categories, setCategories] = useState([])
  const [wishlist, setWishlist] = useState(new Set())
  const [busyProduct, setBusyProduct] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // The search box is typed into constantly; the query only runs once typing
  // pauses, so a five-letter search is one request rather than five.
  const [searchDraft, setSearchDraft] = useState(params.get('q') ?? '')
  const debounce = useRef(null)

  const query = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const sort = params.get('sort') ?? 'newest'
  const maxPrice = params.get('max') ? Number(params.get('max')) : null
  const inStock = params.get('stock') === '1'
  const page = Number(params.get('page') ?? 0)

  const updateParams = useCallback((changes, { resetPage = true } = {}) => {
    setParams((current) => {
      const next = new URLSearchParams(current)
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '' || value === false) next.delete(key)
        else next.set(key, String(value))
      }
      if (resetPage) next.delete('page')
      return next
    }, { replace: true })
  }, [setParams])

  useEffect(() => {
    CategoryService.list().then(setCategories).catch(() => setCategories([]))
  }, [])

  // The results carry the filters they were fetched for. Comparing that to the
  // filters now in the URL tells us a new search is in flight without storing a
  // separate loading flag.
  const filterKey = JSON.stringify({ query, category, maxPrice, inStock, sort, page })

  const { status, data, error, retry } = useAsyncData(
    useCallback(async () => {
      const found = await ProductService.search({ query, category, maxPrice, inStock, sort, page })
      return { ...found, key: filterKey }
    }, [query, category, maxPrice, inStock, sort, page, filterKey])
  )

  const result = data ?? { items: [], total: 0, key: null }
  const searching = status === 'loading' || result.key !== filterKey

  useEffect(() => {
    if (!user || !isCustomer) return
    WishlistService.ids(user.id).then(setWishlist)
  }, [user, isCustomer])

  const onSearchChange = (value) => {
    setSearchDraft(value)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => updateParams({ q: value }), 320)
  }

  useEffect(() => () => clearTimeout(debounce.current), [])

  const addToCart = async (product) => {
    if (!user) return navigate('/login', { state: { from: '/' } })
    if (!isCustomer) return toast.info('Switch to a customer account to shop.')

    setBusyProduct(product.id)
    try {
      await CartService.add(user.id, product.id, 1)
      toast.success(`${product.name} added to your cart`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyProduct(null)
    }
  }

  const toggleWishlist = async (product) => {
    if (!user) return navigate('/login', { state: { from: '/' } })
    if (!isCustomer) return toast.info('Switch to a customer account to save products.')

    try {
      const saved = await WishlistService.toggle(user.id, product.id)
      setWishlist((current) => {
        const next = new Set(current)
        if (saved) next.add(product.id)
        else next.delete(product.id)
        return next
      })
      toast.info(saved ? 'Saved to your wishlist' : 'Removed from your wishlist')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const hasFilters = Boolean(query || category || maxPrice || inStock || sort !== 'newest')

  const clearFilters = () => {
    setSearchDraft('')
    setParams(new URLSearchParams(), { replace: true })
    setFiltersOpen(false)
  }

  const filterControls = (
    <FilterControls
      categories={categories}
      category={category}
      sort={sort}
      maxPrice={maxPrice}
      inStock={inStock}
      onChange={updateParams}
      onClear={hasFilters ? clearFilters : null}
    />
  )

  return (
    <PageShell title="Shop">
      <Hero
        searchDraft={searchDraft}
        onSearchChange={onSearchChange}
        onClear={() => onSearchChange('')}
        signedIn={Boolean(user)}
      />

      {/* Category chips: the fastest way into the catalogue on a phone. */}
      <nav aria-label="Categories" className="scroll-x" style={{ margin: '24px 0 20px' }}>
        <div style={{ display: 'inline-flex', gap: 8, minWidth: 'max-content', paddingBottom: 4 }}>
          <button
            type="button"
            className="chip"
            aria-pressed={category === ''}
            onClick={() => updateParams({ category: null })}
          >
            All products
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className="chip"
              aria-pressed={category === c.name}
              onClick={() => updateParams({ category: c.name })}
            >
              {c.name}
            </button>
          ))}
        </div>
      </nav>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <aside
          className="only-desktop"
          style={{
            width: 216, flexShrink: 0, flexDirection: 'column',
            position: 'sticky', top: 'calc(var(--nav-height) + 20px)',
          }}
        >
          <div className="card">{filterControls}</div>
        </aside>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, marginBottom: 16, flexWrap: 'wrap',
            }}
          >
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }} aria-live="polite">
              {searching ? 'Searching…' : (
                <>
                  <strong style={{ color: 'var(--text)' }}>{result.total}</strong>
                  {result.total === 1 ? ' product' : ' products'}
                  {query && <> for “{query}”</>}
                </>
              )}
            </p>

            <button
              type="button"
              className="btn btn-outline btn-sm only-mobile"
              onClick={() => setFiltersOpen(true)}
            >
              <Icon.Filter size={15} /> Filters{hasFilters ? ' ·' : ''}
            </button>
          </div>

          {searching && status !== 'error' && <ProductGridSkeleton />}

          {status === 'error' && (
            <ErrorState
              title="We couldn't load the catalogue"
              description={error}
              onRetry={retry}
            />
          )}

          {!searching && status === 'ready' && result.items.length === 0 && (
            <EmptyState
              icon={Icon.Search}
              title="No products match that"
              description={
                hasFilters
                  ? 'Try a different search term, or widen your filters.'
                  : 'There are no products listed yet. Check back soon.'
              }
              action={
                hasFilters && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={clearFilters}>
                    Clear filters
                  </button>
                )
              }
            />
          )}

          {!searching && status === 'ready' && result.items.length > 0 && (
            <>
              <motion.div
                className="grid-products"
                variants={listContainer}
                initial="initial"
                animate="animate"
              >
                {result.items.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                    onToggleWishlist={toggleWishlist}
                    wishlisted={wishlist.has(product.id)}
                    busy={busyProduct === product.id}
                  />
                ))}
              </motion.div>

              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={result.total}
                onChange={(next) => {
                  updateParams({ page: next || null }, { resetPage: false })
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              />
            </>
          )}
        </div>
      </div>

      <HowItWorks />

      <AnimatePresence>
        {filtersOpen && (
          <Modal title="Filters" onClose={() => setFiltersOpen(false)} width={400}>
            {filterControls}
            <button
              type="button"
              className="btn btn-primary btn-block"
              style={{ marginTop: 18 }}
              onClick={() => setFiltersOpen(false)}
            >
              Show {result.total} product{result.total === 1 ? '' : 's'}
            </button>
          </Modal>
        )}
      </AnimatePresence>
    </PageShell>
  )
}

// ── Hero ────────────────────────────────────────────────────────────────────

/**
 * The claims here are all things the platform actually does: sellers really
 * are reviewed before they can list, reviews really do require a delivered
 * purchase, and money really is calculated server-side. Nothing about being
 * the biggest or the fastest, because none of that is measurable here.
 */
function Hero({ searchDraft, onSearchChange, onClear, signedIn }) {
  return (
    <motion.section
      {...riseIn}
      style={{
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        background: 'linear-gradient(160deg, var(--surface) 0%, var(--bg-sunk) 100%)',
        padding: 'clamp(24px, 4vw, 44px) clamp(18px, 4vw, 40px)',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', top: -120, right: -80, width: 320, height: 320,
          background: 'radial-gradient(circle, var(--accent-wash) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <p
        style={{
          color: 'var(--accent-soft)', fontSize: '0.75rem', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12,
        }}
      >
        Rwanda’s marketplace for verified sellers
      </p>

      <h1 style={{ maxWidth: 620, margin: '0 auto 14px' }}>
        Buy from local sellers,{' '}
        <span style={{ color: 'var(--accent-soft)' }}>with your money protected</span>
      </h1>

      <p
        style={{
          color: 'var(--text-muted)', maxWidth: 520, margin: '0 auto 26px',
          fontSize: '0.9375rem',
        }}
      >
        Every store is reviewed before it can list. Every price and total is calculated by
        SwiftBuy, not by the seller. Pay with Mobile Money, bank transfer, or cash on delivery.
      </p>

      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        style={{
          maxWidth: 520, margin: '0 auto', display: 'flex', alignItems: 'center',
          gap: 4, background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '4px 4px 4px 14px',
        }}
      >
        <label htmlFor="storefront-search" className="sr-only">Search products</label>
        <span style={{ color: 'var(--text-subtle)', display: 'flex' }}><Icon.Search size={18} /></span>
        <input
          id="storefront-search"
          type="search"
          value={searchDraft}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search products, categories, stores…"
          style={{
            flex: 1, minWidth: 0, background: 'transparent', border: 'none',
            padding: '11px 10px', fontSize: 16, outline: 'none',
          }}
        />
        {searchDraft && (
          <button type="button" className="icon-btn" onClick={onClear} aria-label="Clear search">
            <Icon.Close size={16} />
          </button>
        )}
      </form>

      {!signedIn && (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 22, flexWrap: 'wrap' }}>
          <Link to="/register" className="btn btn-primary">Create an account</Link>
          <Link to="/register?role=seller" className="btn btn-outline">Sell on SwiftBuy</Link>
        </div>
      )}

      <ul
        style={{
          display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap',
          marginTop: 26, color: 'var(--text-subtle)', fontSize: '0.8125rem',
        }}
      >
        <TrustPoint icon={Icon.Shield}>Sellers reviewed before listing</TrustPoint>
        <TrustPoint icon={Icon.Receipt}>Totals calculated by SwiftBuy</TrustPoint>
        <TrustPoint icon={Icon.Star}>Reviews from delivered orders only</TrustPoint>
      </ul>
    </motion.section>
  )
}

function TrustPoint({ icon: Glyph, children }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Glyph size={15} /> {children}
    </li>
  )
}

// ── Filters ─────────────────────────────────────────────────────────────────

function FilterControls({ categories, category, sort, maxPrice, inStock, onChange, onClear }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Field label="Sort by" htmlFor="filter-sort">
        <select
          id="filter-sort"
          className="input"
          value={sort}
          onChange={(e) => onChange({ sort: e.target.value === 'newest' ? null : e.target.value })}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Category" htmlFor="filter-category">
        <select
          id="filter-category"
          className="input"
          value={category}
          onChange={(e) => onChange({ category: e.target.value || null })}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </Field>

      <Field
        label={`Maximum price: ${maxPrice ? formatRwf(maxPrice) : 'any'}`}
        htmlFor="filter-price"
      >
        <input
          id="filter-price"
          type="range"
          min={0}
          max={PRICE_CEILING}
          step={10_000}
          value={maxPrice ?? PRICE_CEILING}
          onChange={(e) => {
            const value = Number(e.target.value)
            onChange({ max: value >= PRICE_CEILING ? null : value })
          }}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
      </Field>

      <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', minHeight: 32 }}>
        <input
          type="checkbox"
          checked={inStock}
          onChange={(e) => onChange({ stock: e.target.checked ? '1' : null })}
          style={{ width: 17, height: 17, accentColor: 'var(--accent)' }}
        />
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>In stock only</span>
      </label>

      {onClear && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>
          Clear all filters
        </button>
      )}
    </div>
  )
}

// ── How it works ────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    { icon: Icon.Search, title: 'Find it', body: 'Browse verified stores and compare prices in Rwandan francs.' },
    { icon: Icon.Cart, title: 'Order it', body: 'SwiftBuy calculates the total from live prices and checks stock before confirming.' },
    { icon: Icon.Shield, title: 'Pay safely', body: 'Pay the seller by MoMo, bank transfer or on delivery. Payment only counts once the seller confirms it.' },
    { icon: Icon.Truck, title: 'Track it', body: 'Follow each seller’s part of your order from confirmation to delivery.' },
  ]

  return (
    <section style={{ marginTop: 56 }} aria-labelledby="how-it-works">
      <h2 id="how-it-works" style={{ textAlign: 'center', marginBottom: 8 }}>How SwiftBuy works</h2>
      <p
        style={{
          textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9375rem',
          maxWidth: 440, margin: '0 auto 26px',
        }}
      >
        Four steps, and the marketplace does the parts you should not have to trust anyone on.
      </p>

      <motion.div
        variants={listContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: '-60px' }}
        style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}
      >
        {steps.map(({ icon: Glyph, title, body }, index) => (
          <motion.div key={title} variants={riseIn} className="card">
            <div
              style={{
                width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                background: 'var(--accent-wash)', color: 'var(--accent-soft)',
                display: 'grid', placeItems: 'center', marginBottom: 12,
              }}
            >
              <Glyph size={18} />
            </div>
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.06em' }}>
              STEP {index + 1}
            </p>
            <h3 style={{ fontSize: '0.9375rem', margin: '2px 0 6px' }}>{title}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{body}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}
