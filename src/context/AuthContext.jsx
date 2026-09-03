import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { classifyError } from '../lib/errors'
import { AuthContext } from './auth-context'

/**
 * Authentication and the signed-in user's identity.
 *
 * Two things are deliberate here:
 *
 *  1. The role and the seller's store status are read from the database on
 *     every session, never from localStorage. What is cached in the browser is
 *     display state — it decides which links to render, and nothing else. The
 *     database re-checks permission on every request, so editing localStorage
 *     changes what the menu looks like and no more.
 *
 *  2. There is no offline fallback. Without a configured Supabase project the
 *     app says so plainly rather than storing carts and orders per-browser and
 *     appearing to work.
 */

const THEME_KEY = 'swiftbuy.theme'

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // Private browsing can refuse storage; fall through to the media query.
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  return 'dark'
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  // With no Supabase credentials there is no session to resolve, so the app is
  // never "loading" — it goes straight to the setup screen.
  const [loading, setLoading] = useState(isConfigured)
  const [theme, setTheme] = useState(readStoredTheme)
  const mounted = useRef(true)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // A remembered theme is a nicety, not a requirement.
    }
  }, [theme])

  /** Loads the authoritative profile (and store, for sellers) for a session. */
  const loadIdentity = useCallback(async (authUser) => {
    if (!authUser) return null

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, address, avatar_path, role, suspended')
      .eq('id', authUser.id)
      .maybeSingle()

    if (error || !profile) {
      // The signup trigger creates this row; if it is genuinely missing the
      // session is unusable, so say so rather than guessing at a role.
      classifyError(error)
      return null
    }

    let store = null
    if (profile.role === 'seller') {
      const { data } = await supabase
        .from('sellers')
        .select('id, store_name, status, status_reason, momo_number, momo_name, bank_name, bank_account')
        .eq('id', authUser.id)
        .maybeSingle()
      if (data) {
        store = {
          id: data.id,
          name: data.store_name,
          status: data.status,
          statusReason: data.status_reason,
          momoNumber: data.momo_number,
          momoName: data.momo_name,
          bankName: data.bank_name,
          bankAccount: data.bank_account,
        }
      }
    }

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
      // TOKEN_REFRESHED fires often; re-reading the profile on it keeps a role
      // or approval change picked up without a full page reload.
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
      // Supabase does not distinguish "no such account" from "wrong password",
      // and neither should we — it would confirm which emails are registered.
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

  const signUp = useCallback(async ({ name, email, password, role, store }) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        // The database trigger clamps this: only 'customer' and 'seller' are
        // self-assignable, so asking for 'admin' here achieves nothing.
        data: {
          full_name: name.trim(),
          role: role === 'seller' ? 'seller' : 'customer',
          ...(role === 'seller'
            ? {
                store_name: store?.storeName?.trim() || name.trim(),
                momo_number: store?.momoNumber?.trim() || '',
                momo_name: store?.momoName?.trim() || name.trim(),
                bank_name: store?.bankName?.trim() || '',
                bank_account: store?.bankAccount?.trim() || '',
              }
            : {}),
        },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })

    if (error) {
      if (/already registered|already exists/i.test(error.message)) {
        return { ok: false, message: 'That email address is already registered.' }
      }
      return { ok: false, message: classifyError(error).message }
    }

    // With email confirmation switched on there is no session yet; the user
    // must confirm before they can sign in.
    const needsConfirmation = !data.session
    if (data.session) setUser(await loadIdentity(data.user))

    return { ok: true, needsConfirmation, role: role === 'seller' ? 'seller' : 'customer' }
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
    // The response is the same either way, so a stranger cannot use this form
    // to discover which addresses have accounts.
    if (error && import.meta.env.DEV) console.warn('[swiftbuy] password reset:', error.message)
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
      // Convenience flags for rendering. These shape the UI only — the
      // database decides what each of these people may actually do.
      isCustomer: user?.role === 'customer',
      isSeller: user?.role === 'seller',
      isApprovedSeller: user?.role === 'seller' && user?.store?.status === 'approved',
      isAdmin: user?.role === 'admin' || user?.role === 'superadmin',
      isSuperAdmin: user?.role === 'superadmin',
    }),
    [user, session, loading, theme, toggleTheme, signIn, signUp, signOut, requestPasswordReset, refresh]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

