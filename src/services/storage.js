// src/services/storage.js
// ─────────────────────────────────────────────────────────────────────────────
// Service layer — uses Appwrite when isSupabaseReady=true, localStorage otherwise
// ─────────────────────────────────────────────────────────────────────────────

import { databases, ID, Query, DATABASE_ID, COLLECTIONS, isSupabaseReady } from '../lib/supabase'

// ── localStorage helpers ──────────────────────────────────────────────────────
const lsGet = (key, fallback = null) => {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback } catch { return fallback }
}
const lsSet = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

// ── Appwrite helpers ──────────────────────────────────────────────────────────
const col = (name) => COLLECTIONS[name]

// Map Appwrite document to clean object
const mapProduct = (p) => ({
  id: p.$id,
  sellerId: p.seller_id,
  sellerName: p.seller_name,
  name: p.name,
  description: p.description,
  category: p.category,
  price: p.price,
  stock: p.stock,
  imageUrl: p.image_url,
  image: p.image_url,
  isFeatured: p.is_featured,
  isActive: p.is_active,
  createdAt: p.$createdAt,
})

const mapOrder = (o) => ({
  ...o,
  id: o.$id,
  userId: o.user_id,
  userName: o.user_name,
  userAddress: o.user_address,
  items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items,
  paymentStatus: o.payment_status,
  deliveryStatus: o.delivery_status,
  deliveryInfo: o.delivery_info ? (typeof o.delivery_info === 'string' ? JSON.parse(o.delivery_info) : o.delivery_info) : null,
  paymentProof: o.payment_proof,
  createdAt: o.$createdAt,
})

const mapUser = (u) => ({
  ...u,
  id: u.$id,
  momoNumber: u.momo_number,
  momoName: u.momo_name,
  bankName: u.bank_name,
  bankAccount: u.bank_account,
  rejectReason: u.reject_reason,
})

function withRatingsLocal(products) {
  const reviews = lsGet('reviews', [])
  return products.map(p => {
    const pr = reviews.filter(r => r.productId === p.id)
    const avg = pr.length ? (pr.reduce((s, r) => s + r.rating, 0) / pr.length).toFixed(1) : null
    return { ...p, avgRating: avg, reviewCount: pr.length }
  })
}

// ── Products ──────────────────────────────────────────────────────────────────
export const ProductService = {
  getAll: async () => {
    if (isSupabaseReady) {
      const res = await databases.listDocuments(DATABASE_ID, col('products'), [
        Query.equal('is_active', true),
        Query.orderDesc('$createdAt'),
        Query.limit(100),
      ])
      const products = res.documents.map(mapProduct)
      // Attach ratings from reviews
      const reviews = await ReviewService.getAll()
      return products.map(p => {
        const pr = reviews.filter(r => r.product_id === p.id || r.productId === p.id)
        const avg = pr.length ? (pr.reduce((s, r) => s + r.rating, 0) / pr.length).toFixed(1) : null
        return { ...p, avgRating: avg, reviewCount: pr.length }
      })
    }
    return withRatingsLocal(lsGet('products', []))
  },

  getById: async (id) => {
    if (isSupabaseReady) {
      const p = await databases.getDocument(DATABASE_ID, col('products'), id)
      return mapProduct(p)
    }
    return lsGet('products', []).find(p => String(p.id) === String(id))
  },

  getBySeller: async (sellerId) => {
    if (isSupabaseReady) {
      const res = await databases.listDocuments(DATABASE_ID, col('products'), [
        Query.equal('seller_id', sellerId),
        Query.orderDesc('$createdAt'),
        Query.limit(100),
      ])
      return res.documents.map(mapProduct)
    }
    return lsGet('products', []).filter(p => p.sellerId === sellerId)
  },

  save: async (product) => {
    if (isSupabaseReady) {
      const payload = {
        seller_id:   String(product.sellerId),
        seller_name: product.sellerName,
        name:        product.name,
        description: product.description || '',
        category:    product.category,
        price:       Number(product.price),
        stock:       parseInt(product.stock),
        image_url:   product.image || product.imageUrl || null,
        is_featured: product.isFeatured || false,
        is_active:   true,
      }
      if (product.id && !String(product.id).startsWith('tmp')) {
        const res = await databases.updateDocument(DATABASE_ID, col('products'), product.id, payload)
        return mapProduct(res)
      } else {
        const res = await databases.createDocument(DATABASE_ID, col('products'), ID.unique(), payload)
        return mapProduct(res)
      }
    }
    const all = lsGet('products', [])
    const idx = all.findIndex(p => p.id === product.id)
    if (idx >= 0) all[idx] = product; else all.push(product)
    lsSet('products', all)
    return product
  },

  delete: async (id) => {
    if (isSupabaseReady) {
      await databases.updateDocument(DATABASE_ID, col('products'), id, { is_active: false })
      return
    }
    lsSet('products', lsGet('products', []).filter(p => p.id !== id))
  },

  setFeatured: async (id, featured) => {
    if (isSupabaseReady) {
      await databases.updateDocument(DATABASE_ID, col('products'), id, { is_featured: featured })
      return
    }
    const all = lsGet('products', []).map(p => p.id === id ? { ...p, isFeatured: featured } : p)
    lsSet('products', all)
  },

  uploadImage: async (file) => {
    return new Promise((res, rej) => {
      const reader = new FileReader()
      reader.onload = e => res(e.target.result)
      reader.onerror = () => rej(new Error('Failed to read image file'))
      reader.readAsDataURL(file)
    })
  }
}

// ── Orders ────────────────────────────────────────────────────────────────────
export const OrderService = {
  getAll: async () => {
    if (isSupabaseReady) {
      const res = await databases.listDocuments(DATABASE_ID, col('orders'), [
        Query.orderDesc('$createdAt'), Query.limit(200),
      ])
      return res.documents.map(mapOrder)
    }
    return lsGet('orders', [])
  },

  getByUser: async (userId) => {
    if (isSupabaseReady) {
      const res = await databases.listDocuments(DATABASE_ID, col('orders'), [
        Query.equal('user_id', userId),
        Query.orderDesc('$createdAt'),
        Query.limit(100),
      ])
      return res.documents.map(mapOrder)
    }
    return lsGet('orders', []).filter(o => o.userId === userId)
  },

  getBySeller: async (sellerId) => {
    if (isSupabaseReady) {
      const res = await databases.listDocuments(DATABASE_ID, col('orders'), [
        Query.orderDesc('$createdAt'), Query.limit(200),
      ])
      return res.documents.map(mapOrder)
        .filter(o => Array.isArray(o.items) && o.items.some(i => i.sellerId === sellerId))
    }
    return lsGet('orders', []).filter(o => o.items?.some(i => i.sellerId === sellerId))
  },

  create: async (order) => {
    if (isSupabaseReady) {
      const res = await databases.createDocument(DATABASE_ID, col('orders'), order.id || ID.unique(), {
        user_id:         String(order.userId),
        user_name:       order.userName || '',
        user_address:    order.userAddress || order.deliveryAddress || '',
        items:           JSON.stringify(order.items),
        total:           Number(order.total),
        status:          order.status || 'pending',
        payment_status:  order.paymentStatus || 'pending',
        delivery_status: order.deliveryStatus || 'not shipped',
        delivery_phone:  order.deliveryPhone || '',
        notes:           order.notes || '',
      })
      return mapOrder(res)
    }
    const all = lsGet('orders', [])
    all.push(order)
    lsSet('orders', all)
    return order
  },

  update: async (id, changes) => {
    if (isSupabaseReady) {
      const mapped = {}
      if (changes.status !== undefined)          mapped.status = changes.status
      if (changes.paymentStatus !== undefined)   mapped.payment_status = changes.paymentStatus
      if (changes.deliveryStatus !== undefined)  mapped.delivery_status = changes.deliveryStatus
      if (changes.deliveryInfo !== undefined)    mapped.delivery_info = JSON.stringify(changes.deliveryInfo)
      if (changes.notes !== undefined)           mapped.notes = changes.notes
      if (changes.paymentProof !== undefined)    mapped.payment_proof = changes.paymentProof
      const res = await databases.updateDocument(DATABASE_ID, col('orders'), id, mapped)
      return mapOrder(res)
    }
    const all = lsGet('orders', []).map(o => o.id === id ? { ...o, ...changes } : o)
    lsSet('orders', all)
    return all.find(o => o.id === id)
  }
}

// ── Cart ──────────────────────────────────────────────────────────────────────
export const CartService = {
  get: async (userId) => {
    if (isSupabaseReady && userId) {
      const res = await databases.listDocuments(DATABASE_ID, col('cart'), [
        Query.equal('user_id', userId), Query.limit(100),
      ])
      // Get product details for each cart item
      const items = await Promise.all(res.documents.map(async item => {
        try {
          const product = await ProductService.getById(item.product_id)
          return { ...product, qty: item.qty, cartItemId: item.$id }
        } catch { return null }
      }))
      return items.filter(Boolean)
    }
    return lsGet('cart', [])
  },

  add: async (product, userId) => {
    if (isSupabaseReady && userId) {
      // Check if already in cart
      const existing = await databases.listDocuments(DATABASE_ID, col('cart'), [
        Query.equal('user_id', userId),
        Query.equal('product_id', String(product.id)),
      ])
      if (existing.documents.length > 0) {
        const item = existing.documents[0]
        await databases.updateDocument(DATABASE_ID, col('cart'), item.$id, { qty: item.qty + 1 })
      } else {
        await databases.createDocument(DATABASE_ID, col('cart'), ID.unique(), {
          user_id: userId, product_id: String(product.id), qty: 1,
        })
      }
      return
    }
    const cart = lsGet('cart', [])
    const idx = cart.findIndex(i => i.id === product.id)
    if (idx >= 0) cart[idx].qty += 1; else cart.push({ ...product, qty: 1 })
    lsSet('cart', cart)
    return cart
  },

  updateQty: async (productId, qty, userId) => {
    if (isSupabaseReady && userId) {
      const existing = await databases.listDocuments(DATABASE_ID, col('cart'), [
        Query.equal('user_id', userId),
        Query.equal('product_id', String(productId)),
      ])
      if (existing.documents.length > 0) {
        if (qty <= 0) {
          await databases.deleteDocument(DATABASE_ID, col('cart'), existing.documents[0].$id)
        } else {
          await databases.updateDocument(DATABASE_ID, col('cart'), existing.documents[0].$id, { qty })
        }
      }
      return
    }
    const cart = lsGet('cart', []).map(i => i.id === productId ? { ...i, qty } : i).filter(i => i.qty > 0)
    lsSet('cart', cart)
    return cart
  },

  remove: async (productId, userId) => {
    if (isSupabaseReady && userId) {
      const existing = await databases.listDocuments(DATABASE_ID, col('cart'), [
        Query.equal('user_id', userId),
        Query.equal('product_id', String(productId)),
      ])
      if (existing.documents.length > 0) {
        await databases.deleteDocument(DATABASE_ID, col('cart'), existing.documents[0].$id)
      }
      return
    }
    lsSet('cart', lsGet('cart', []).filter(i => i.id !== productId))
  },

  clear: async (userId) => {
    if (isSupabaseReady && userId) {
      const existing = await databases.listDocuments(DATABASE_ID, col('cart'), [
        Query.equal('user_id', userId), Query.limit(100),
      ])
      await Promise.all(existing.documents.map(item =>
        databases.deleteDocument(DATABASE_ID, col('cart'), item.$id)
      ))
      return
    }
    lsSet('cart', [])
  },

  count: () => lsGet('cart', []).reduce((s, i) => s + i.qty, 0)
}

// ── Notifications ─────────────────────────────────────────────────────────────
export const NotificationService = {
  getByUser: async (userId) => {
    if (isSupabaseReady) {
      const res = await databases.listDocuments(DATABASE_ID, col('notifications'), [
        Query.equal('user_id', userId),
        Query.orderDesc('$createdAt'),
        Query.limit(50),
      ])
      return res.documents.map(n => ({
        ...n, id: n.$id, userId: n.user_id, read: n.is_read, createdAt: n.$createdAt,
      }))
    }
    return lsGet('notifications', []).filter(n => n.userId === userId)
  },

  push: async (userId, message) => {
    if (isSupabaseReady) {
      await databases.createDocument(DATABASE_ID, col('notifications'), ID.unique(), {
        user_id: userId, message, is_read: false,
      })
      return
    }
    const all = lsGet('notifications', [])
    all.unshift({ id: Date.now(), userId, message, read: false, createdAt: new Date().toLocaleString() })
    lsSet('notifications', all)
  },

  markRead: async (userId) => {
    if (isSupabaseReady) {
      const res = await databases.listDocuments(DATABASE_ID, col('notifications'), [
        Query.equal('user_id', userId), Query.equal('is_read', false), Query.limit(100),
      ])
      await Promise.all(res.documents.map(n =>
        databases.updateDocument(DATABASE_ID, col('notifications'), n.$id, { is_read: true })
      ))
      return
    }
    lsSet('notifications', lsGet('notifications', []).map(n => n.userId === userId ? { ...n, read: true } : n))
  },

  unreadCount: (userId) => lsGet('notifications', []).filter(n => n.userId === userId && !n.read).length
}

// ── Wishlist ──────────────────────────────────────────────────────────────────
export const WishlistService = {
  get: async (userId) => {
    if (isSupabaseReady && userId) {
      const res = await databases.listDocuments(DATABASE_ID, col('wishlist'), [
        Query.equal('user_id', userId), Query.limit(100),
      ])
      const items = await Promise.all(res.documents.map(async item => {
        try {
          const product = await ProductService.getById(item.product_id)
          return { ...product, wishlistItemId: item.$id }
        } catch { return null }
      }))
      return items.filter(Boolean)
    }
    return lsGet('wishlist', [])
  },

  toggle: async (product, userId) => {
    if (isSupabaseReady && userId) {
      const existing = await databases.listDocuments(DATABASE_ID, col('wishlist'), [
        Query.equal('user_id', userId),
        Query.equal('product_id', String(product.id)),
      ])
      if (existing.documents.length > 0) {
        await databases.deleteDocument(DATABASE_ID, col('wishlist'), existing.documents[0].$id)
        return false
      } else {
        await databases.createDocument(DATABASE_ID, col('wishlist'), ID.unique(), {
          user_id: userId, product_id: String(product.id),
        })
        return true
      }
    }
    const list = lsGet('wishlist', [])
    const idx = list.findIndex(i => i.id === product.id)
    const updated = idx >= 0 ? list.filter(i => i.id !== product.id) : [...list, product]
    lsSet('wishlist', updated)
    return idx < 0
  },

  has: (id) => lsGet('wishlist', []).some(i => i.id === id)
}

// ── Reviews ───────────────────────────────────────────────────────────────────
export const ReviewService = {
  getAll: async () => {
    if (isSupabaseReady) {
      const res = await databases.listDocuments(DATABASE_ID, col('reviews'), [Query.limit(500)])
      return res.documents
    }
    return lsGet('reviews', [])
  },

  getByProduct: async (productId) => {
    if (isSupabaseReady) {
      const res = await databases.listDocuments(DATABASE_ID, col('reviews'), [
        Query.equal('product_id', String(productId)),
        Query.orderDesc('$createdAt'),
        Query.limit(50),
      ])
      return res.documents.map(r => ({ ...r, id: r.$id, productId: r.product_id, userId: r.user_id, userName: r.user_name, createdAt: r.$createdAt }))
    }
    return lsGet('reviews', []).filter(r => r.productId === productId)
  },

  submit: async (review) => {
    if (isSupabaseReady) {
      try {
        await databases.createDocument(DATABASE_ID, col('reviews'), ID.unique(), {
          product_id: String(review.productId),
          user_id:    String(review.userId),
          order_id:   review.orderId || null,
          user_name:  review.userName,
          rating:     review.rating,
          comment:    review.comment || '',
        })
        return true
      } catch { return false }
    }
    const all = lsGet('reviews', [])
    const exists = all.find(r => r.productId === review.productId && r.userId === review.userId && r.orderId === review.orderId)
    if (exists) return false
    all.push({ id: Date.now(), ...review, createdAt: new Date().toLocaleString() })
    lsSet('reviews', all)
    return true
  }
}

// ── Users ──────────────────────────────────────────────────────────────────────
export const UserService = {
  getAll: async () => {
    if (isSupabaseReady) {
      const res = await databases.listDocuments(DATABASE_ID, col('users'), [
        Query.orderDesc('$createdAt'), Query.limit(200),
      ])
      return res.documents.map(mapUser)
    }
    return lsGet('users', [])
  },

  getById: async (id) => {
    if (isSupabaseReady) {
      try {
        const u = await databases.getDocument(DATABASE_ID, col('users'), id)
        return mapUser(u)
      } catch { return null }
    }
    return lsGet('users', []).find(u => u.id === id)
  },

  upsert: async (id, data) => {
    if (isSupabaseReady) {
      try {
        await databases.getDocument(DATABASE_ID, col('users'), id)
        const res = await databases.updateDocument(DATABASE_ID, col('users'), id, data)
        return mapUser(res)
      } catch {
        const res = await databases.createDocument(DATABASE_ID, col('users'), id, data)
        return mapUser(res)
      }
    }
  },

  update: async (id, changes) => {
    if (isSupabaseReady) {
      const mapped = {}
      if (changes.name !== undefined)         mapped.name = changes.name
      if (changes.phone !== undefined)        mapped.phone = changes.phone
      if (changes.address !== undefined)      mapped.address = changes.address
      if (changes.approved !== undefined)     mapped.approved = changes.approved
      if (changes.rejected !== undefined)     mapped.rejected = changes.rejected
      if (changes.suspended !== undefined)    mapped.suspended = changes.suspended
      if (changes.rejectReason !== undefined) mapped.reject_reason = changes.rejectReason
      if (changes.role !== undefined)         mapped.role = changes.role
      if (changes.momoNumber !== undefined)   mapped.momo_number = changes.momoNumber
      if (changes.momoName !== undefined)     mapped.momo_name = changes.momoName
      if (changes.bankName !== undefined)     mapped.bank_name = changes.bankName
      if (changes.bankAccount !== undefined)  mapped.bank_account = changes.bankAccount
      const res = await databases.updateDocument(DATABASE_ID, col('users'), id, mapped)
      return mapUser(res)
    }
    const all = lsGet('users', []).map(u => u.id === id ? { ...u, ...changes } : u)
    lsSet('users', all)
    return all.find(u => u.id === id)
  }
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export const ChatService = {
  getMessages: async (userId, otherUserId) => {
    if (isSupabaseReady) {
      const res = await databases.listDocuments(DATABASE_ID, col('messages'), [
        Query.or([
          Query.and([Query.equal('sender_id', userId),      Query.equal('receiver_id', otherUserId)]),
          Query.and([Query.equal('sender_id', otherUserId), Query.equal('receiver_id', userId)]),
        ]),
        Query.orderAsc('$createdAt'),
        Query.limit(200),
      ])
      return res.documents.map(m => ({ ...m, id: m.$id, senderId: m.sender_id, createdAt: m.$createdAt }))
    }
    const key = `chat_${[userId, otherUserId].sort().join('_')}`
    return lsGet(key, [])
  },

  send: async (userId, otherUserId, text, senderName) => {
    if (isSupabaseReady) {
      const res = await databases.createDocument(DATABASE_ID, col('messages'), ID.unique(), {
        sender_id: userId, receiver_id: otherUserId, text,
      })
      return { ...res, id: res.$id, senderId: res.sender_id, createdAt: res.$createdAt }
    }
    const key = `chat_${[userId, otherUserId].sort().join('_')}`
    const msgs = lsGet(key, [])
    const msg = { id: Date.now(), senderId: userId, senderName, text, createdAt: new Date().toLocaleString() }
    msgs.push(msg)
    lsSet(key, msgs)
    return msg
  }
}
