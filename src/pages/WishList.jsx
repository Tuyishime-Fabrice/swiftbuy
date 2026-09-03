import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { WishlistService, CartService } from '../services/storage'
import { ProductCard, EmptyState, PageHeader } from '../components/UI'

export default function Wishlist() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [wishlist, setWishlist] = useState([])

  useEffect(() => {
    document.title = 'Wishlist — SwiftBuy'
    WishlistService.get(user.id).then(wl => setWishlist(Array.isArray(wl) ? wl : []))
  }, [])

  const toggleWishlist = async (product) => {
    await WishlistService.toggle(product, user.id)
    const wl = await WishlistService.get(user.id)
    setWishlist(Array.isArray(wl) ? wl : [])
    toast('Removed from wishlist', 'info')
  }

  const addToCart = async (product) => {
    await CartService.add(product, user.id)
    toast(`${product.name} added to cart!`, 'success')
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <PageHeader title="Wishlist" subtitle={`${wishlist.length} saved item${wishlist.length !== 1 ? 's' : ''}`} />
        {wishlist.length === 0 ? (
          <EmptyState title="Your wishlist is empty" subtitle="Save products you like and find them here." action={<Link to="/" className="btn btn-primary">Browse Products</Link>} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {wishlist.map(p => (
              <ProductCard key={p.id} product={p} onAddToCart={addToCart} onToggleWishlist={toggleWishlist} wishlisted={true} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
