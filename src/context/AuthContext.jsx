import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { account, isSupabaseReady } from '../lib/supabase'
import { UserService } from '../services/storage'

const AuthContext = createContext()

// ─── localStorage seed (runs when backend is not active) ─────────────────────
function seedIfEmpty() {
  const users = JSON.parse(localStorage.getItem('users') || '[]')
  if (users.length > 0) return
  const seeded = [
    { id: 1, name: 'SwiftBuy Super Admin', email: 'superadmin@swiftbuy.rw', password: 'admin123', role: 'superadmin' },
    { id: 2, name: 'SwiftBuy Admin',       email: 'admin@swiftbuy.rw',      password: 'admin123', role: 'admin' },
    {
      id: 3, name: 'Gigi IWENGA', email: 'gigi@seller.rw', password: 'seller123', role: 'seller',
      approved: true,
      paymentMethods: { momoNumber: '+250 789 549 369', momoName: 'Gigi IWENGA', bankName: 'Bank of Kigali', bankAccount: '1234567890' }
    },
    { id: 4, name: 'Amina Uwase', email: 'amina@user.rw', password: 'user123', role: 'user' },
  ]
  localStorage.setItem('users', JSON.stringify(seeded))

  const products = JSON.parse(localStorage.getItem('products') || '[]')
  if (products.length === 0) {
    localStorage.setItem('products', JSON.stringify([
      { id: 101, sellerId: 3, sellerName: 'Gigi IWENGA', name: 'iPhone 17', category: 'Electronics', price: 1200000, stock: 5, description: 'Latest Apple iPhone 17 — 256GB, all colors available. Sealed box.', image: '' },
      { id: 102, sellerId: 3, sellerName: 'Gigi IWENGA', name: 'Yoga Mat', category: 'Sports', price: 22000, stock: 30, description: 'Premium non-slip yoga mat, 6mm thickness. Great for home workouts.', image: '' },
      { id: 103, sellerId: 3, sellerName: 'Gigi IWENGA', name: 'Dumbbell Set', category: 'Sports', price: 55000, stock: 10, description: 'Adjustable dumbbell set 5–25kg. Rubber coated for floor protection.', image: '' },
      { id: 104, sellerId: 3, sellerName: 'Gigi IWENGA', name: 'Perfume — Oud Royal', category: 'Beauty', price: 48000, stock: 20, description: 'Luxury Oud Royal eau de parfum, 100ml. Long-lasting oriental fragrance.', image: '' },
      { id: 105, sellerId: 3, sellerName: 'Gigi IWENGA', name: 'Hair Wig — Natural', category: 'Beauty', price: 55000, stock: 8, description: 'Premium quality natural-look wig. Various lengths available.', image: '' },
      { id: 106, sellerId: 3, sellerName: 'Gigi IWENGA', name: 'Samsung Galaxy S25', category: 'Electronics', price: 980000, stock: 3, description: 'Samsung Galaxy S25 — 128GB, comes with warranty.', image: '' },
      { id: 107, sellerId: 3, sellerName: 'Gigi IWENGA', name: 'African Print Dress', category: 'Clothing', price: 25000, stock: 15, description: 'Beautiful Kitenge African print dress. Available in multiple sizes.', image: '' },
      { id: 108, sellerId: 3, sellerName: 'Gigi IWENGA', name: 'Indomie Bulk Pack (48)', category: 'Food & Drinks', price: 8500, stock: 50, description: '48-pack of Indomie noodles. Best value for families.', image: '' },
    ]))
  }
}

seedIfEmpty()

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('currentUser')
    return saved ? JSON.parse(saved) : null
  })

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme') || 'dark'
    document.documentElement.setAttribute('data-theme', saved)
    return saved
  })

  // ── Check Appwrite session on load ─────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseReady) return
    account.get()
      .then(async (appwriteUser) => {
        if (appwriteUser) {
          const prefs = appwriteUser.prefs || {}
          const profile = {
            id: appwriteUser.$id,
            name: appwriteUser.name || prefs.name,
            email: appwriteUser.email,
            role: prefs.role || 'user',
            approved: prefs.approved !== false,
          }
          setUser(profile)
          localStorage.setItem('currentUser', JSON.stringify(profile))
        }
      })
      .catch(() => {}) // no session — stay logged out
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('theme', next)
      document.documentElement.setAttribute('data-theme', next)
      return next
    })
  }, [])

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    if (isSupabaseReady) {
      try {
        // Clear any existing session first
        try { await account.deleteSession('current') } catch {}
        await account.createEmailPasswordSession(email, password)
        const appwriteUser = await account.get()
        const prefs = appwriteUser.prefs || {}
        const role = prefs.role || 'user'

        if (prefs.suspended) return { success: false, message: 'Account suspended. Contact support.' }
        if (role === 'seller' && !prefs.approved && !prefs.rejected)
          return { success: false, message: 'Seller account pending approval.' }
        if (role === 'seller' && prefs.rejected)
          return { success: false, message: 'Seller application was rejected.' }

        const profile = {
          id: appwriteUser.$id,
          name: appwriteUser.name || prefs.name,
          email: appwriteUser.email,
          role,
          approved: prefs.approved !== false,
          momoNumber: prefs.momoNumber,
          momoName: prefs.momoName,
          bankName: prefs.bankName,
          bankAccount: prefs.bankAccount,
        }
        setUser(profile)
        localStorage.setItem('currentUser', JSON.stringify(profile))
        return { success: true, role }
      } catch (e) {
        return { success: false, message: 'Incorrect email or password.' }
      }
    }

    // ── localStorage fallback ──
    const users = JSON.parse(localStorage.getItem('users') || '[]')
    const found = users.find(u => u.email === email && u.password === password)
    if (!found) return { success: false, message: 'Incorrect email or password.' }
    if (found.suspended) return { success: false, message: 'Account suspended. Contact support.' }
    if (found.role === 'seller' && !found.approved && !found.rejected)
      return { success: false, message: 'Seller account pending approval.' }
    if (found.role === 'seller' && found.rejected)
      return { success: false, message: 'Seller application was rejected.' }
    setUser(found)
    localStorage.setItem('currentUser', JSON.stringify(found))
    return { success: true, role: found.role }
  }, [])

  // ── Register ───────────────────────────────────────────────────────────────
  const register = useCallback(async (name, email, password, role, extra = {}) => {
    if (isSupabaseReady) {
      try {
        // Clear any existing session first
        try { await account.deleteSession('current') } catch {}

        const { ID } = await import('appwrite')
        const newUser = await account.create(ID.unique(), email, password, name)

        // Store role and extra info in prefs
        await account.createEmailPasswordSession(email, password)
        await account.updatePrefs({
          role,
          name,
          approved: role === 'user' ? true : false, // sellers need approval
          momoNumber: extra.momoNumber || '',
          momoName: extra.momoName || '',
          bankName: extra.bankName || '',
          bankAccount: extra.bankAccount || '',
        })

        // Sync to users collection so admin can see all users
        await UserService.upsert(newUser.$id, {
          name,
          email,
          role,
          approved: role === 'user',
        }).catch(() => {})

        if (role !== 'seller') {
          const profile = { id: newUser.$id, name, email, role, approved: true }
          setUser(profile)
          localStorage.setItem('currentUser', JSON.stringify(profile))
        }
        return { success: true, role }
      } catch (e) {
        // Appwrite error codes
        if (e.code === 409) return { success: false, message: 'Email already registered.' }
        return { success: false, message: e.message || 'Registration failed. Please try again.' }
      }
    }

    // ── localStorage fallback ──
    const users = JSON.parse(localStorage.getItem('users') || '[]')
    if (users.find(u => u.email === email)) return { success: false, message: 'Email already registered.' }
    const newUser = { id: Date.now(), name, email, password, role, ...extra }
    users.push(newUser)
    localStorage.setItem('users', JSON.stringify(users))
    if (role !== 'seller') {
      setUser(newUser)
      localStorage.setItem('currentUser', JSON.stringify(newUser))
    }
    return { success: true, role }
  }, [])

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    if (isSupabaseReady) {
      try { await account.deleteSession('current') } catch {}
    }
    setUser(null)
    localStorage.removeItem('currentUser')
  }, [])

  // ── Refresh user ───────────────────────────────────────────────────────────
  const refreshUser = useCallback(async () => {
    if (isSupabaseReady && user?.id) {
      try {
        const appwriteUser = await account.get()
        const prefs = appwriteUser.prefs || {}
        const profile = { ...user, name: appwriteUser.name, role: prefs.role || user.role }
        setUser(profile)
        localStorage.setItem('currentUser', JSON.stringify(profile))
      } catch {}
      return
    }
    const users = JSON.parse(localStorage.getItem('users') || '[]')
    const fresh = users.find(u => u.id === user?.id)
    if (fresh) {
      setUser(fresh)
      localStorage.setItem('currentUser', JSON.stringify(fresh))
    }
  }, [user])

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshUser, theme, toggleTheme }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
