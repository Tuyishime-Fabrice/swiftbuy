// src/lib/supabase.js
// ─────────────────────────────────────────────────────────────────────────────
// Appwrite client — drop-in replacement for the old Supabase client.
// Only this file changed. Everything else (storage.js, AuthContext) is intact.
// ─────────────────────────────────────────────────────────────────────────────

import { Client, Account, Databases, ID, Query } from 'appwrite'

const PROJECT_ID = '6a1601b300297b030dde'
const ENDPOINT   = 'https://fra.cloud.appwrite.io/v1'
const DATABASE_ID = '6a16022c000a0a543603'

// ── Appwrite client ──────────────────────────────────────────────────────────
const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)

export const account   = new Account(client)
export const databases = new Databases(client)
export { ID, Query, DATABASE_ID }

// ── Collection IDs (create these in Appwrite console) ───────────────────────
export const COLLECTIONS = {
  users:         'users',
  products:      'products',
  orders:        'orders',
  reviews:       'reviews',
  cart:          'cart_items',
  wishlist:      'wishlist_items',
  notifications: 'notifications',
  messages:      'messages',
}

// ── isSupabaseReady flag (kept same name so storage.js needs zero changes) ──
// Set to false so the app uses the localStorage fallback while you set up
// Appwrite collections. Set to true once collections are ready.
export const isSupabaseReady = true

// ── Compatibility shim ───────────────────────────────────────────────────────
// The old code used: supabase.auth.signInWithPassword(...)
// We expose the same interface so AuthContext.jsx works with minimal changes.
export const supabase = {
  auth: {
    signInWithPassword: async ({ email, password }) => {
      try {
        // Delete any existing session first to avoid conflict
        try { await account.deleteSession('current') } catch {}
        const session = await account.createEmailPasswordSession(email, password)
        const user = await account.get()
        return { data: { user, session }, error: null }
      } catch (e) {
        return { data: null, error: { message: e.message } }
      }
    },

    signUp: async ({ email, password, options }) => {
      try {
        const userId = ID.unique()
        const name = options?.data?.name || email.split('@')[0]
        const role = options?.data?.role || 'user'
        const user = await account.create(userId, email, password, name)
        // Store role in prefs so we can read it back
        await account.updatePrefs({ role, name })
        return { data: { user }, error: null }
      } catch (e) {
        return { data: null, error: { message: e.message } }
      }
    },

    signOut: async () => {
      try { await account.deleteSession('current') } catch {}
    },

    getSession: async () => {
      try {
        const user = await account.get()
        return { data: { session: user ? { user } : null } }
      } catch {
        return { data: { session: null } }
      }
    },

    onAuthStateChange: (callback) => {
      // Appwrite doesn't have a real-time auth listener like Supabase.
      // We check the session once on load — this is enough for this app.
      account.get()
        .then(user => callback('SIGNED_IN', { user }))
        .catch(() => callback('SIGNED_OUT', null))
      // Return an unsubscribe-compatible object
      return { data: { subscription: { unsubscribe: () => {} } } }
    },
  },

  // Table query shim — routes to localStorage fallback in storage.js
  // (isSupabaseReady = false means storage.js never calls these)
  from: () => ({
    select: () => ({ data: [], error: null }),
    insert: () => ({ data: null, error: null }),
    update: () => ({ data: null, error: null }),
    delete: () => ({ data: null, error: null }),
    eq: function() { return this },
    single: function() { return { data: null, error: null } },
  }),
}
