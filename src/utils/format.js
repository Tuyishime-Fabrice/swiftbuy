/**
 * Display helpers. Prices are whole Rwandan francs stored as integers, so
 * formatting never has to worry about floating-point drift.
 */

const rwf = new Intl.NumberFormat('en-RW', { maximumFractionDigits: 0 })

export function formatRwf(amount, { withCurrency = true } = {}) {
  const n = Number(amount ?? 0)
  if (!Number.isFinite(n)) return withCurrency ? '0 RWF' : '0'
  const formatted = rwf.format(Math.round(n))
  return withCurrency ? `${formatted} RWF` : formatted
}

export function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** "3 minutes ago" style labels for chat and notification lists. */
export function formatRelative(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const seconds = Math.round((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} d ago`
  return formatDate(value)
}

export function initials(name) {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

/**
 * Stock is shown as a state, not a raw number, so the storefront never
 * advertises exact inventory levels it has no reason to reveal.
 */
export function stockState(stock, lowThreshold = 5) {
  const n = Number(stock ?? 0)
  if (n <= 0) return 'out_of_stock'
  if (n <= lowThreshold) return 'low_stock'
  return 'in_stock'
}

export const STOCK_LABEL = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
}
