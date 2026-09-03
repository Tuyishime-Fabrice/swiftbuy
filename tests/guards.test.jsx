import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { renderHook } from '@testing-library/react'
import ProtectedRoute from '../src/components/ProtectedRoute'
import { AuthContext } from '../src/context/auth-context'
import { homeFor } from '../src/lib/routes'
import { useAsyncData } from '../src/hooks/useAsyncData'

vi.mock('../src/lib/supabase', () => ({
  supabase: null,
  isConfigured: false,
  publicUrl: () => null,
  productImageUrl: () => null,
}))

// Navbar reaches for live counters; the guard behaviour under test does not.
vi.mock('../src/components/Navbar', () => ({ default: () => <nav /> }))

function renderGuarded(auth, element, { path = '/protected' } = {}) {
  return render(
    <AuthContext.Provider value={{ loading: false, ...auth }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/protected" element={element} />
          <Route path="/login" element={<p>Sign in page</p>} />
          <Route path="/" element={<p>Storefront</p>} />
          <Route path="/admin" element={<p>Admin dashboard</p>} />
          <Route path="/seller" element={<p>Seller dashboard</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

const secret = <p>Protected content</p>

/**
 * These cover the guard as a user-experience control. The equivalent security
 * guarantees — that a customer cannot read another customer's orders, or
 * promote themselves — are proved against the real policies in
 * supabase/tests/01_security_and_commerce.sql, because that is where they are
 * actually enforced.
 */

describe('ProtectedRoute', () => {
  it('sends a signed-out visitor to sign in', () => {
    renderGuarded({ user: null }, <ProtectedRoute>{secret}</ProtectedRoute>)
    expect(screen.getByText('Sign in page')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('waits rather than redirecting while the session is still resolving', () => {
    render(
      <AuthContext.Provider value={{ loading: true, user: null }}>
        <MemoryRouter>
          <ProtectedRoute>{secret}</ProtectedRoute>
        </MemoryRouter>
      </AuthContext.Provider>
    )
    expect(screen.getByText('Checking your session')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('lets a signed-in account through when no role is required', () => {
    renderGuarded(
      { user: { id: 'u1', role: 'customer' } },
      <ProtectedRoute>{secret}</ProtectedRoute>
    )
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  it('keeps a customer out of seller and admin routes', () => {
    renderGuarded(
      { user: { id: 'u1', role: 'customer' } },
      <ProtectedRoute roles={['admin', 'superadmin']}>{secret}</ProtectedRoute>
    )
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    expect(screen.getByText('Storefront')).toBeInTheDocument()
  })

  it('keeps a seller out of admin routes and returns them to their dashboard', () => {
    renderGuarded(
      { user: { id: 's1', role: 'seller', store: { status: 'approved' } } },
      <ProtectedRoute roles={['admin', 'superadmin']}>{secret}</ProtectedRoute>
    )
    expect(screen.getByText('Seller dashboard')).toBeInTheDocument()
  })

  it('keeps a plain admin out of nothing an admin route allows', () => {
    renderGuarded(
      { user: { id: 'a1', role: 'admin' } },
      <ProtectedRoute roles={['admin', 'superadmin']}>{secret}</ProtectedRoute>
    )
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  describe('seller store status', () => {
    const guarded = (status, reason) =>
      renderGuarded(
        { user: { id: 's1', role: 'seller', store: { status, statusReason: reason } } },
        <ProtectedRoute roles={['seller']} requireApprovedSeller>{secret}</ProtectedRoute>
      )

    it('explains the wait to a pending seller instead of a permission error', () => {
      guarded('pending')
      expect(screen.getByText(/awaiting review/i)).toBeInTheDocument()
      expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    })

    it('shows a rejected seller the reason they were given', () => {
      guarded('rejected', 'We could not verify the business details.')
      expect(screen.getByText(/not approved/i)).toBeInTheDocument()
      expect(screen.getByText('We could not verify the business details.')).toBeInTheDocument()
    })

    it('tells a suspended seller their listings are hidden', () => {
      guarded('suspended', 'Repeated unfulfilled orders.')
      expect(screen.getByText(/suspended/i)).toBeInTheDocument()
      expect(screen.getByText('Repeated unfulfilled orders.')).toBeInTheDocument()
    })

    it('lets an approved seller through', () => {
      guarded('approved')
      expect(screen.getByText('Protected content')).toBeInTheDocument()
    })
  })
})

describe('homeFor', () => {
  it('sends each role to the surface it actually uses', () => {
    expect(homeFor('customer')).toBe('/')
    expect(homeFor('seller')).toBe('/seller')
    expect(homeFor('admin')).toBe('/admin')
    expect(homeFor('superadmin')).toBe('/admin')
    expect(homeFor(undefined)).toBe('/')
  })
})

describe('useAsyncData', () => {
  it('moves from loading to ready with the fetched data', async () => {
    const fetcher = vi.fn(async () => ({ items: [1, 2, 3] }))
    const { result } = renderHook(() => useAsyncData(fetcher))

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.data).toEqual({ items: [1, 2, 3] })
    expect(result.current.error).toBeNull()
  })

  it('surfaces a failure as a readable message rather than swallowing it', async () => {
    const fetcher = vi.fn(async () => { throw new Error('Only 3 left in stock') })
    const { result } = renderHook(() => useAsyncData(fetcher))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('Only 3 left in stock')
  })

  it('refetches on reload without blanking the screen', async () => {
    let call = 0
    const fetcher = vi.fn(async () => ({ call: ++call }))
    const { result } = renderHook(() => useAsyncData(fetcher))

    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => result.current.reload())
    // A quiet reload keeps the previous content visible while it refetches.
    expect(result.current.status).toBe('ready')
    await waitFor(() => expect(result.current.data).toEqual({ call: 2 }))
  })

  it('shows the loading state again on an explicit retry', async () => {
    const fetcher = vi.fn(async () => ({ ok: true }))
    const { result } = renderHook(() => useAsyncData(fetcher))

    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => result.current.retry())
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
  })

  it('discards a response that arrives after unmount', async () => {
    let resolve
    const fetcher = vi.fn(() => new Promise((r) => { resolve = r }))
    const { unmount } = renderHook(() => useAsyncData(fetcher))

    unmount()
    // Resolving after teardown must not warn or update anything.
    await act(async () => { resolve({ late: true }) })
  })

  it('applies an optimistic local change without refetching', async () => {
    const fetcher = vi.fn(async () => ({ items: ['a'] }))
    const { result } = renderHook(() => useAsyncData(fetcher))

    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => result.current.setData((current) => ({ items: [...current.items, 'b'] })))
    expect(result.current.data).toEqual({ items: ['a', 'b'] })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
