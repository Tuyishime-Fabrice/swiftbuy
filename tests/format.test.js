import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatRwf, formatDate, formatDateTime, formatRelative, initials,
  stockState, STOCK_LABEL,
} from '../src/utils/format'

describe('formatRwf', () => {
  it('formats whole francs with thousands separators', () => {
    expect(formatRwf(980000)).toBe('980,000 RWF')
    expect(formatRwf(0)).toBe('0 RWF')
    expect(formatRwf(1)).toBe('1 RWF')
  })

  it('can omit the currency for compact layouts', () => {
    expect(formatRwf(22000, { withCurrency: false })).toBe('22,000')
  })

  it('never shows fractional francs', () => {
    expect(formatRwf(1250.4)).toBe('1,250 RWF')
    expect(formatRwf(1250.6)).toBe('1,251 RWF')
  })

  it('degrades to zero rather than NaN on junk input', () => {
    expect(formatRwf(undefined)).toBe('0 RWF')
    expect(formatRwf(null)).toBe('0 RWF')
    expect(formatRwf('not a number')).toBe('0 RWF')
  })
})

describe('dates', () => {
  it('formats an ISO timestamp readably', () => {
    expect(formatDate('2026-03-14T09:30:00Z')).toBe('14 Mar 2026')
    expect(formatDateTime('2026-03-14T09:30:00Z')).toMatch(/14 Mar 2026/)
  })

  it('returns an empty string rather than "Invalid Date"', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate('nonsense')).toBe('')
    expect(formatDateTime(undefined)).toBe('')
    expect(formatRelative('nonsense')).toBe('')
  })
})

describe('formatRelative', () => {
  afterEach(() => vi.useRealTimers())

  it('describes recent times in the units a person would use', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00Z'))

    expect(formatRelative('2026-03-14T11:59:40Z')).toBe('just now')
    expect(formatRelative('2026-03-14T11:45:00Z')).toBe('15 min ago')
    expect(formatRelative('2026-03-14T09:00:00Z')).toBe('3 h ago')
    expect(formatRelative('2026-03-12T12:00:00Z')).toBe('2 d ago')
    // Beyond a week, an actual date is more useful than "9 d ago".
    expect(formatRelative('2026-03-01T12:00:00Z')).toBe('1 Mar 2026')
  })
})

describe('initials', () => {
  it('takes at most two initials', () => {
    expect(initials('Amina Uwase')).toBe('AU')
    expect(initials('Gigi')).toBe('G')
    expect(initials('Jean Claude Habimana')).toBe('JC')
  })

  it('copes with extra whitespace and missing names', () => {
    expect(initials('  Amina   Uwase  ')).toBe('AU')
    expect(initials('')).toBe('?')
    expect(initials(null)).toBe('?')
  })
})

describe('stockState', () => {
  it('reports a state rather than an exact count', () => {
    expect(stockState(40)).toBe('in_stock')
    expect(stockState(3)).toBe('low_stock')
    expect(stockState(0)).toBe('out_of_stock')
  })

  it('never reports negative stock as available', () => {
    expect(stockState(-5)).toBe('out_of_stock')
    expect(stockState(null)).toBe('out_of_stock')
  })

  it('honours the platform configured low-stock threshold', () => {
    expect(stockState(8, 10)).toBe('low_stock')
    expect(stockState(8, 5)).toBe('in_stock')
  })

  it('has a label for every state it can return', () => {
    for (const value of [40, 3, 0]) {
      expect(STOCK_LABEL[stockState(value)]).toBeTruthy()
    }
  })
})
