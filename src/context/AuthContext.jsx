import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { classifyError } from '../lib/errors'
import { AuthContext } from './auth-context'

const THEME_KEY = 'shop-mumu.theme'

function readStored(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function prefersLightTheme() {
  return Boolean(
    typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-color-scheme: light)').matches
  )
}

function readStoredTheme() {
  const stored = readStored(THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return prefersLightTheme() ? 'light' : 'dark'
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)

  const [loading, setLoading] = useState(isConfigured)
  const [theme, setTheme] = useState(readStoredTheme)
  const mounted = useRef(true)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    writeStored(THEME_KEY, theme)
  }, [theme])

  const loadIdentity = useCallback(async (authUser) => {
    if (!authUser) return null

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, address, avatar_path, role, suspended')
      .eq('id', authUser.id)
      .maybeSingle()

    if (error || !profile) {

      classifyError(error)
      return null
    }

    const { data: sellerRow } = await supabase
      .from('sellers')
      .select('id, store_name, status, status_reason, momo_number, momo_name, bank_name, bank_account')
      .eq('id', authUser.id)
      .maybeSingle()

    const store = sellerRow
      ? {
          id: sellerRow.id,
          name: sellerRow.store_name,
          status: sellerRow.status,
          statusReason: sellerRow.status_reason,
          momoNumber: sellerRow.momo_number,
          momoName: sellerRow.momo_name,
          bankName: sellerRow.bank_name,
          bankAccount: sellerRow.bank_account,
        }
      : null

    return {
      id: profile.id,
      name: profile.full_name,
      email: profile.email ?? authUser.email,
      phone: profile.phone,
      address: profile.address,
      role: profile.role,
      suspended: profile.suspended,
      store,
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    if (!isConfigured) return undefined

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted.current) return
      setSession(data.session)
      setUser(await loadIdentity(data.session?.user))
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted.current) return
      setSession(nextSession)
      if (event === 'SIGNED_OUT' || !nextSession?.user) {
        setUser(null)
        return
      }

      setUser(await loadIdentity(nextSession.user))
    })

    return () => {
      mounted.current = false
      listener?.subscription?.unsubscribe()
    }
  }, [loadIdentity])

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) {

      return { ok: false, message: 'Incorrect email or password.' }
    }

    const identity = await loadIdentity(data.user)
    if (!identity) {
      await supabase.auth.signOut()
      return { ok: false, message: 'We could not load your account. Please contact support.' }
    }
    if (identity.suspended) {
      await supabase.auth.signOut()
      return { ok: false, message: 'This account has been suspended. Please contact support.' }
    }

    setUser(identity)
    return { ok: true, user: identity }
  }, [loadIdentity])

  const signUp = useCallback(async ({ name, email, password }) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {

        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })

    if (error) {
      if (/already registered|already exists/i.test(error.message)) {
        return { ok: false, message: 'That email address is already registered.' }
      }
      return { ok: false, message: classifyError(error).message }
    }

    const needsConfirmation = !data.session
    if (data.session) setUser(await loadIdentity(data.user))

    return { ok: true, needsConfirmation }
  }, [loadIdentity])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }, [])

  const requestPasswordReset = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error && import.meta.env.DEV) console.warn('[shop-mumu] password reset:', error.message)
    return { ok: true }
  }, [])

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getUser()
    if (data?.user) setUser(await loadIdentity(data.user))
  }, [loadIdentity])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      isConfigured,
      theme,
      toggleTheme,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      refresh,

      isCustomer: Boolean(user) && user.role !== 'admin' && user.role !== 'superadmin',
      hasSellerApplication: Boolean(user?.store),
      sellerStatus: user?.store?.status ?? null,
      isApprovedSeller: user?.store?.status === 'approved',
      isAdmin: user?.role === 'admin' || user?.role === 'superadmin',
      isSuperAdmin: user?.role === 'superadmin',
    }),
    [user, session, loading, theme, toggleTheme, signIn, signUp, signOut, requestPasswordReset, refresh]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
