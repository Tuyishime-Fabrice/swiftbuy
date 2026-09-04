import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import PageShell from '../layouts/PageShell'
import {
  EmptyState, ErrorState, ProductGridSkeleton, Pagination, InlineNotice,
} from '../components/UI'
import { ProductCard } from '../components/ProductCard'
import * as Icon from '../components/Icons'
import { useAuth } from '../context/auth-context'
import { useToast } from '../context/toast-context'
import { ProductService, PAGE_SIZE } from '../services/products'
import { SellerService } from '../services/accounts'
import { CartService, WishlistService } from '../services/commerce'
import { ChatService } from '../services/messaging'
import { formatDate, initials } from '../utils/format'
import { listContainer } from '../lib/motion'
import { useAsyncData } from '../hooks/useAsyncData'

export default function StorePage() {
  const { sellerId } = useParams()
  const { user, isCustomer } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [page, setPage] = useState(0)
  const [wishlist, setWishlist] = useState(new Set())
  const [busy, setBusy] = useState(null)

  const { status, data, error, retry } = useAsyncData(
    useCallback(async () => {
      const [storeData, products] = await Promise.all([
        SellerService.get(sellerId),
        ProductService.search({ sellerId, page }),
      ])
      return { store: storeData, result: products }
    }, [sellerId, page])
  )

  const store = data?.store ?? null
  const result = data?.result ?? { items: [], total: 0 }

  const missing = status === 'ready' && !store

  useEffect(() => {
    if (!user || !isCustomer) return
    WishlistService.ids(user.id).then(setWishlist)
  }, [user, isCustomer])

  const addToCart = async (product) => {
    if (!user) return navigate('/login', { state: { from: `/store/${sellerId}` } })
    setBusy(product.id)
    try {
      await CartService.add(user.id, product.id, 1)
      toast.success(`${product.name} added to your cart`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(null)
    }
  }

  const toggleWishlist = async (product) => {
    if (!user) return navigate('/login', { state: { from: `/store/${sellerId}` } })
    try {
      const saved = await WishlistService.toggle(user.id, product.id)
      setWishlist((current) => {
        const next = new Set(current)
        if (saved) next.add(product.id)
        else next.delete(product.id)
        return next
      })
    } catch (err) {
      toast.error(err.message)
    }
  }

  const messageStore = async () => {
    if (!user) return navigate('/login', { state: { from: `/store/${sellerId}` } })
    if (!isCustomer) return toast.info('Administrator accounts cannot message stores.')
    try {
      const conversationId = await ChatService.openWithSeller(sellerId)
      navigate(`/messages/${conversationId}`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (missing) {
    return (
      <PageShell title="Store not available">
        <EmptyState
          icon={Icon.Store}
          title="This store is not available"
          description="It may not be approved yet, or it may no longer be active on SwiftBuy."
          action={<Link to="/" className="btn btn-primary">Back to the shop</Link>}
        />
      </PageShell>
    )
  }

  if (status === 'error') {
    return (
      <PageShell title="Store">
        <ErrorState title="We couldn't load this store" description={error} onRetry={retry} />
      </PageShell>
    )
  }

  return (
    <PageShell title={store?.storeName ?? 'Store'}>
      <section
        className="card"
        style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24 }}
      >
        <span
          style={{
            width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
            background: 'var(--accent)', color: '#fff', display: 'grid',
            placeItems: 'center', fontFamily: "'Syne', sans-serif",
            fontWeight: 800, fontSize: '1.4rem',
          }}
        >
          {initials(store?.storeName)}
        </span>

        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: '1.35rem' }}>{store?.storeName}</h1>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="badge badge-success">
              <Icon.Shield size={11} /> Reviewed by SwiftBuy
            </span>
            <span style={{ color: 'var(--text-subtle)', fontSize: '0.8125rem' }}>
              {result.total} product{result.total === 1 ? '' : 's'}
            </span>
            {store?.approvedAt && (
              <span style={{ color: 'var(--text-subtle)', fontSize: '0.8125rem' }}>
                · Selling since {formatDate(store.approvedAt)}
              </span>
            )}
          </div>
          {store?.description && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', marginTop: 10 }}>
              {store.description}
            </p>
          )}
        </div>

        {isCustomer && user?.id !== sellerId && (
          <button type="button" className="btn btn-outline" onClick={messageStore}>
            <Icon.Chat size={16} /> Message store
          </button>
        )}
      </section>

      <div style={{ marginBottom: 20 }}>
        <InlineNotice tone="info" title="What “reviewed” means here">
          A SwiftBuy administrator checked this store's application before it was allowed to list
          products. It is not a guarantee of any individual product.
        </InlineNotice>
      </div>

      {status === 'loading' ? (
        <ProductGridSkeleton count={8} />
      ) : result.items.length === 0 ? (
        <EmptyState
          icon={Icon.Package}
          title="No products listed"
          description="This store has not published any products yet."
        />
      ) : (
        <>
          <motion.div className="grid-products" variants={listContainer} initial="initial" animate="animate">
            {result.items.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={isCustomer ? addToCart : undefined}
                onToggleWishlist={isCustomer ? toggleWishlist : undefined}
                wishlisted={wishlist.has(product.id)}
                busy={busy === product.id}
              />
            ))}
          </motion.div>

          <Pagination page={page} pageSize={PAGE_SIZE} total={result.total} onChange={setPage} />
        </>
      )}
    </PageShell>
  )
}
