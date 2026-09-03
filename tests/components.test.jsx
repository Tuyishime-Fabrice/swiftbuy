import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import {
  Modal, ConfirmDialog, QuantityStepper, StatusBadge, Rating, Pagination,
  Field, EmptyState, ErrorState,
} from '../src/components/UI'
import { ProductCard } from '../src/components/ProductCard'

vi.mock('../src/lib/supabase', () => ({
  supabase: null,
  isConfigured: false,
  publicUrl: () => null,
  productImageUrl: () => null,
}))

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('Modal', () => {
  it('is announced as a dialog and labelled by its title', () => {
    wrap(<Modal title="Verify payment" onClose={vi.fn()}>Body</Modal>)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByText('Verify payment')).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    wrap(<Modal title="Verify payment" onClose={onClose}>Body</Modal>)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('closes from the labelled close button', async () => {
    const onClose = vi.fn()
    wrap(<Modal title="Verify payment" onClose={onClose}>Body</Modal>)
    await userEvent.click(screen.getByRole('button', { name: /close dialog/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('stops the page behind it scrolling while open', () => {
    const { unmount } = wrap(<Modal title="Open" onClose={vi.fn()}>Body</Modal>)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).not.toBe('hidden')
  })
})

describe('ConfirmDialog', () => {
  it('asks before a destructive action and reports both answers', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    wrap(
      <ConfirmDialog
        title="Suspend this account?"
        message="They will not be able to sign in."
        confirmLabel="Suspend account"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )

    expect(screen.getByText('They will not be able to sign in.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Suspend account' }))
    expect(onConfirm).toHaveBeenCalled()
  })
})

describe('QuantityStepper', () => {
  it('will not go below the minimum or above the available stock', async () => {
    const onChange = vi.fn()
    const { rerender } = wrap(<QuantityStepper value={1} max={3} onChange={onChange} />)

    const decrease = screen.getByRole('button', { name: /decrease/i })
    const increase = screen.getByRole('button', { name: /increase/i })

    expect(decrease).toBeDisabled()
    await userEvent.click(increase)
    expect(onChange).toHaveBeenCalledWith(2)

    rerender(<MemoryRouter><QuantityStepper value={3} max={3} onChange={onChange} /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /increase/i })).toBeDisabled()
  })

  it('announces the current quantity politely', () => {
    wrap(<QuantityStepper value={4} max={9} onChange={vi.fn()} />)
    expect(screen.getByText('4')).toHaveAttribute('aria-live', 'polite')
  })
})

describe('StatusBadge', () => {
  it('turns a database enum into words a customer understands', () => {
    const { rerender } = wrap(<StatusBadge status="awaiting_confirmation" />)
    expect(screen.getByText('Awaiting confirmation')).toBeInTheDocument()

    rerender(<MemoryRouter><StatusBadge status="in_transit" /></MemoryRouter>)
    expect(screen.getByText('On the way')).toBeInTheDocument()

    rerender(<MemoryRouter><StatusBadge status="successful" /></MemoryRouter>)
    expect(screen.getByText('Paid')).toBeInTheDocument()
  })

  it('shows an unknown status rather than an empty badge', () => {
    wrap(<StatusBadge status="something_new" />)
    expect(screen.getByText('something_new')).toBeInTheDocument()
  })
})

describe('Rating', () => {
  it('exposes the score to assistive technology, not just as stars', () => {
    wrap(<Rating value={4.2} count={11} />)
    expect(screen.getByRole('img', { name: /rated 4\.2 out of 5/i })).toBeInTheDocument()
    expect(screen.getByText('4.2 (11)')).toBeInTheDocument()
  })

  it('renders nothing for a product with no reviews', () => {
    const { container } = wrap(<Rating value={0} count={0} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('Pagination', () => {
  it('disables the edges and reports the visible range', () => {
    wrap(<Pagination page={0} pageSize={24} total={60} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled()
    expect(screen.getByText(/1–24/)).toBeInTheDocument()
  })

  it('disappears when everything fits on one page', () => {
    const { container } = wrap(<Pagination page={0} pageSize={24} total={12} onChange={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('Field', () => {
  it('associates the label with the control and announces the error', () => {
    wrap(
      <Field label="Email address" error="Enter a valid email address" htmlFor="email">
        <input id="email" className="input" />
      </Field>
    )
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address')
  })
})

describe('empty and error states', () => {
  it('an empty state names the next thing to do', () => {
    wrap(
      <EmptyState
        title="Your cart is empty"
        description="Products you add will be saved here."
        action={<button type="button">Browse products</button>}
      />
    )
    expect(screen.getByText('Your cart is empty')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Browse products' })).toBeInTheDocument()
  })

  it('an error state is announced and offers a retry', async () => {
    const onRetry = vi.fn()
    wrap(<ErrorState title="We couldn't load your cart" description="Network error" onRetry={onRetry} />)

    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load your cart")
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalled()
  })
})

describe('ProductCard', () => {
  const product = {
    id: 'p1',
    name: 'Samsung Galaxy S25',
    price: 980000,
    stock: 3,
    category: 'Electronics',
    storeName: 'Gigi Electronics',
    rating: 4.5,
    ratingCount: 8,
    imagePath: null,
    isFeatured: false,
  }

  it('shows the price in francs and links to the product', () => {
    wrap(<ProductCard product={product} />)
    expect(screen.getByText('980,000')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Samsung Galaxy S25, 980,000 RWF/ }))
      .toHaveAttribute('href', '/product/p1')
  })

  it('warns when stock is low without publishing the exact count', () => {
    wrap(<ProductCard product={product} />)
    expect(screen.getByText('Low stock')).toBeInTheDocument()
    expect(screen.queryByText(/3 left/)).not.toBeInTheDocument()
  })

  it('hides add-to-cart and says so when a product is out of stock', () => {
    wrap(<ProductCard product={{ ...product, stock: 0 }} onAddToCart={vi.fn()} />)
    expect(screen.getByText('Out of stock')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add .* to cart/i })).not.toBeInTheDocument()
  })

  it('adds to the cart when asked', async () => {
    const onAddToCart = vi.fn()
    wrap(<ProductCard product={product} onAddToCart={onAddToCart} />)
    await userEvent.click(screen.getByRole('button', { name: /add samsung galaxy s25 to cart/i }))
    expect(onAddToCart).toHaveBeenCalledWith(product)
  })

  it('exposes the wishlist control as a labelled toggle', async () => {
    const onToggleWishlist = vi.fn()
    const { rerender } = wrap(
      <ProductCard product={product} onToggleWishlist={onToggleWishlist} wishlisted={false} />
    )

    const save = screen.getByRole('button', { name: /save samsung galaxy s25 to wishlist/i })
    expect(save).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(save)
    expect(onToggleWishlist).toHaveBeenCalledWith(product)

    rerender(
      <MemoryRouter>
        <ProductCard product={product} onToggleWishlist={onToggleWishlist} wishlisted />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: /remove samsung galaxy s25 from wishlist/i }))
      .toHaveAttribute('aria-pressed', 'true')
  })
})
