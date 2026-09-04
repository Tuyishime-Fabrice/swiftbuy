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

  it('keeps an approved seller out of admin routes', () => {
    renderGuarded(
      { user: { id: 's1', role: 'customer', store: { status: 'approved' } } },
      <ProtectedRoute roles={['admin', 'superadmin']}>{secret}</ProtectedRoute>
    )
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    expect(screen.getByText('Storefront')).toBeInTheDocument()
  })

  it('lets an approved seller use the customer routes as well', () => {
    renderGuarded(
      { user: { id: 's1', role: 'customer', store: { status: 'approved' } } },
      <ProtectedRoute roles={['customer']}>{secret}</ProtectedRoute>
    )
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  it('lets a pending applicant keep using the customer routes', () => {
    renderGuarded(
      { user: { id: 's1', role: 'customer', store: { status: 'pending' } } },
      <ProtectedRoute roles={['customer']}>{secret}</ProtectedRoute>
    )
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  it('keeps a plain admin out of nothing an admin route allows', () => {
    renderGuarded(
      { user: { id: 'a1', role: 'admin' } },
      <ProtectedRoute roles={['admin', 'superadmin']}>{secret}</ProtectedRoute>
    )
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  describe('the seller workspace opens on approval, not on a role', () => {
    const guarded = (store) =>
      renderGuarded(
        { user: { id: 's1', role: 'customer', store } },
        <ProtectedRoute requireApprovedSeller>{secret}</ProtectedRoute>
      )

    it('offers the application to a customer who has never applied', () => {
      guarded(null)
      expect(screen.getByText(/do not sell on SHOP MUMU yet/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /apply to sell/i })).toHaveAttribute('href', '/sell/apply')
      expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    })

    it('explains the wait to a pending applicant instead of a permission error', () => {
      guarded({ status: 'pending' })
      expect(screen.getByText(/awaiting review/i)).toBeInTheDocument()
      expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    })

    it('shows a rejected applicant the reason and a way to apply again', () => {
      guarded({ status: 'rejected', statusReason: 'We could not verify the licence document.' })
      expect(screen.getByText(/not approved/i)).toBeInTheDocument()
      expect(screen.getByText('We could not verify the licence document.')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /apply again/i })).toBeInTheDocument()
      expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    })

    it('tells a suspended seller their listings are hidden', () => {
      guarded({ status: 'suspended', statusReason: 'Repeated unfulfilled orders.' })
      expect(screen.getByText(/suspended/i)).toBeInTheDocument()
      expect(screen.getByText('Repeated unfulfilled orders.')).toBeInTheDocument()
      expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    })

    it('lets an approved seller through', () => {
      guarded({ status: 'approved' })
      expect(screen.getByText('Protected content')).toBeInTheDocument()
    })
  })
})

describe('homeFor', () => {
  it('sends staff to the dashboard and everyone else to the shop', () => {
    expect(homeFor('customer')).toBe('/')
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
