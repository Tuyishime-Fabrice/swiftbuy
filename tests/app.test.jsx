import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../src/lib/supabase', () => ({
  supabase: null,
  isConfigured: false,
  publicUrl: () => null,
  productImageUrl: () => null,
}))

const { default: App } = await import('../src/App')

describe('App without credentials', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('renders the setup screen rather than a fake storefront', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /not connected yet/i })).toBeInTheDocument()
    expect(screen.getByText(/VITE_SUPABASE_URL/)).toBeInTheDocument()
  })

  it('does not render any commerce surface', () => {
    render(<App />)
    expect(screen.queryByRole('link', { name: /cart/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/add to cart/i)).not.toBeInTheDocument()
  })

  it('offers a skip link before the main content', () => {
    render(<App />)
    const skip = screen.getByRole('link', { name: /skip to main content/i })
    expect(skip).toHaveAttribute('href', '#main')
  })
})
