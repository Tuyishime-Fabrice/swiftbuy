import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ProductService, UserService } from '../services/storage'
import { PageHeader, EmptyState, FormField, Modal } from '../components/UI'
import { SellerSidebar } from './SellerDashboard'

const CATEGORIES = ['Electronics', 'Clothing', 'Food & Drinks', 'Home & Living', 'Beauty', 'Sports', 'Other']

function ProductForm({ product, onSave, onClose }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [name, setName] = useState(product?.name || '')
  const [description, setDescription] = useState(product?.description || '')
  const [price, setPrice] = useState(product?.price || '')
  const [category, setCategory] = useState(product?.category || 'Electronics')
  const [stock, setStock] = useState(product?.stock || '')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(product?.image || product?.image_url || '')
  const [saving, setSaving] = useState(false)

  const handleImage = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { toast('Image too large (max 3MB)', 'error'); return }
    setImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result)
    reader.readAsDataURL(file)
  }

  const save = async () => {
    if (!name.trim() || !price) return toast('Name and price are required', 'error')
    setSaving(true)
    try {
      let imageUrl = imagePreview
      if (imageFile) {
        imageUrl = await ProductService.uploadImage(imageFile, user.id)
      }
      const saved = await ProductService.save({
        ...(product || {}),
        id: product?.id || undefined,
        sellerId: user.id,
        sellerName: user.name,
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        category,
        stock: parseInt(stock) || 0,
        image: imageUrl,
      })
      toast(product ? 'Product updated!' : 'Product added!', 'success')
      onSave(saved)
    } catch (e) {
      toast('Failed to save product', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FormField label="Product Name *">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Samsung Galaxy S25" className="input" />
      </FormField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <FormField label="Price (RWF) *">
          <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 50000" className="input" />
        </FormField>
        <FormField label="Stock Quantity">
          <input type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder="e.g. 10" className="input" />
        </FormField>
      </div>
      <FormField label="Category">
        <select value={category} onChange={e => setCategory(e.target.value)} className="input">
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </FormField>
      <FormField label="Description">
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your product..." className="input" rows={3} style={{ resize: 'vertical' }} />
      </FormField>
      <FormField label="Product Image (max 3MB)">
        {imagePreview && <img src={imagePreview} alt="preview" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 10, marginBottom: 8 }} />}
        <input type="file" accept="image/*" onChange={handleImage} className="input" style={{ padding: '8px' }} />
      </FormField>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : product ? 'Update Product' : 'Add Product'}
        </button>
      </div>
    </div>
  )
}

export default function SellerProducts() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [products, setProducts] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [search, setSearch] = useState('')
  const [payModal, setPayModal] = useState(false)
  const [momo, setMomo] = useState(user.momo_number || user.paymentMethods?.momoNumber || '')
  const [momoName, setMomoName] = useState(user.momo_name || user.paymentMethods?.momoName || user.name)
  const [bankName, setBankName] = useState(user.bank_name || user.paymentMethods?.bankName || '')
  const [bankAccount, setBankAccount] = useState(user.bank_account || user.paymentMethods?.bankAccount || '')

  useEffect(() => {
    document.title = 'Products — SwiftBuy Seller'
    ProductService.getBySeller(user.id).then(setProducts)
  }, [user.id])

  const reload = () => ProductService.getBySeller(user.id).then(setProducts)
  const handleSave = () => { reload(); setShowModal(false); setEditProduct(null) }

  const deleteProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return
    await ProductService.delete(id)
    toast('Product deleted', 'info')
    reload()
  }

  const savePayment = async () => {
    await UserService.update(user.id, { momoNumber: momo, momoName, bankName, bankAccount })
    toast('Payment details updated!', 'success')
    setPayModal(false)
  }

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ display: 'flex' }}>
        <SellerSidebar active="products" />
        <div style={{ flex: 1, padding: '32px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>My Products</h1>
              <p style={{ color: 'var(--text3)', fontSize: 14 }}>{products.length} products listed</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setPayModal(true)}>Payment Details</button>
              <button className="btn btn-primary" onClick={() => { setEditProduct(null); setShowModal(true) }}>+ Add Product</button>
            </div>
          </div>

          <div style={{ position: 'relative', marginBottom: 20, maxWidth: 360 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="input" />
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="No products yet" subtitle="Add your first product to start selling!" action={<button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Product</button>} />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {filtered.map(p => (
                <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                  <div style={{ height: 160, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {(p.image || p.image_url)
                      ? <img src={p.image || p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 48, opacity: 0.2, color: 'var(--text3)' }}>No image</span>}
                  </div>
                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    <div>
                      <p style={{ color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>{p.category}</p>
                      <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15, marginTop: 2 }}>{p.name}</p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ color: 'var(--accent-light)', fontWeight: 800, fontSize: 16 }}>{Number(p.price).toLocaleString()} RWF</p>
                      <span style={{ background: p.stock > 0 ? 'rgba(0,196,140,0.1)' : 'rgba(255,77,106,0.1)', color: p.stock > 0 ? 'var(--green)' : 'var(--red)', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>
                        {p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => { setEditProduct(p); setShowModal(true) }}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteProduct(p.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <Modal title={editProduct ? 'Edit Product' : 'Add New Product'} onClose={() => { setShowModal(false); setEditProduct(null) }}>
          <ProductForm product={editProduct} onSave={handleSave} onClose={() => { setShowModal(false); setEditProduct(null) }} />
        </Modal>
      )}

      {payModal && (
        <Modal title="Payment Details" onClose={() => setPayModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ color: 'var(--text3)', fontSize: 13 }}>These details are shown to customers when they pay for their orders.</p>
            <FormField label="MoMo Number"><input value={momo} onChange={e => setMomo(e.target.value)} placeholder="+250 7XX XXX XXX" className="input" /></FormField>
            <FormField label="MoMo Account Name"><input value={momoName} onChange={e => setMomoName(e.target.value)} placeholder="Your full name" className="input" /></FormField>
            <FormField label="Bank Name"><input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. Bank of Kigali" className="input" /></FormField>
            <FormField label="Bank Account Number"><input value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="Account number" className="input" /></FormField>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setPayModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={savePayment}>Save Details</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
