import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import PageShell from '../layouts/PageShell'
import { PageHeader, EmptyState, ErrorState, ProductGridSkeleton } from '../components/UI'
import { ProductCard } from '../components/ProductCard'
import * as Icon from '../components/Icons'
import { useAuth } from '../context/auth-context'
import { useToast } from '../context/toast-context'
import { WishlistService, CartService } from '../services/commerce'
import { listContainer } from '../lib/motion'
import { useAsyncData } from '../hooks/useAsyncData'

export default function Wishlist() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [busy, setBusy] = useState(null)

  const { status, data, error, retry, setData } = useAsyncData(
    useCallback(() => WishlistService.list(user.id), [user.id])
  )

  const items = data ?? []

  const remove = async (product) => {
    try {
      await WishlistService.toggle(user.id, product.id)
      setData((current) => (current ?? []).filter((i) => i.id !== product.id))
      toast.info('Removed from your wishlist')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const addToCart = async (product) => {
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

  if (status === 'loading') {
    return (
      <PageShell title="Wishlist">
        <PageHeader title="Wishlist" />
        <ProductGridSkeleton count={4} />
      </PageShell>
    )
  }

  if (status === 'error') {
    return (
      <PageShell title="Wishlist">
        <PageHeader title="Wishlist" />
        <ErrorState title="We couldn't load your wishlist" description={error} onRetry={retry} />
      </PageShell>
    )
  }

  return (
    <PageShell title="Wishlist">
      <PageHeader
        title="Wishlist"
        subtitle={`${items.length} saved ${items.length === 1 ? 'product' : 'products'}`}
        actions={
          items.length > 0 && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/')}>
              Keep browsing
            </button>
          )
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Icon.Heart}
          title="Nothing saved yet"
          description="Tap the heart on any product to keep it here for later. Your wishlist follows your account, not this browser."
          action={<Link to="/" className="btn btn-primary">Find something you like</Link>}
        />
      ) : (
        <motion.div className="grid-products" variants={listContainer} initial="initial" animate="animate">
          {items.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={addToCart}
              onToggleWishlist={remove}
              wishlisted
              busy={busy === product.id}
            />
          ))}
        </motion.div>
      )}
    </PageShell>
  )
}
