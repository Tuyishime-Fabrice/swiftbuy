import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { UserService, ProductService, CartService, WishlistService } from '../services/storage'
import { ProductCard, EmptyState } from '../components/UI'

export default function SellerProfile() {
  const { sellerId } = useParams()
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [seller, setSeller] = useState(null)
  const [products, setProducts] = useState([])
  const [wishlist, setWishlist] = useState([])

  useEffect(() => {
    const load = async () => {
      const users = await UserService.getAll()
      const s = users.find(u => String(u.id) === String(sellerId))
      setSeller(s)
      const [prods, wl] = await Promise.all([
        ProductService.getBySeller(sellerId),
        user ? WishlistService.get(user.id) : Promise.resolve([])
      ])
      setProducts(prods)
      setWishlist(Array.isArray(wl) ? wl : [])
    }
    load()
  }, [sellerId])

  const addToCart = async (product) => {
    if (!user) return navigate('/login')
    await CartService.add(product, user.id)
    toast(`${product.name} added to cart!`, 'success')
  }

  const toggleWishlist = async (product) => {
    if (!user) return navigate('/login')
    await WishlistService.toggle(product, user.id)
    const wl = await WishlistService.get(user.id)
    setWishlist(Array.isArray(wl) ? wl : [])
  }

  if (!seller) return null

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32, flexWrap: 'wrap' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 28, flexShrink: 0 }}>
            {seller.name[0]}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{seller.name}</h1>
            <p style={{ color: 'var(--text3)', fontSize: 14, marginTop: 2 }}>Verified Seller · {products.length} products</p>
            {(seller.momo_number || seller.paymentMethods?.momoNumber) && (
              <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>
                MoMo: {seller.momo_number || seller.paymentMethods?.momoNumber}
              </p>
            )}
          </div>
          {user && String(user.id) !== String(sellerId) && (
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/chat/${sellerId}`)}>Message Seller</button>
          )}
        </div>

        <h2 style={{ color: 'var(--text)', fontWeight: 700, marginBottom: 18 }}>Products</h2>
        {products.length === 0 ? (
          <EmptyState title="No products yet" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {products.map(p => (
              <ProductCard key={p.id} product={p} onAddToCart={addToCart} onToggleWishlist={toggleWishlist} wishlisted={wishlist.some(w => w.id === p.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
