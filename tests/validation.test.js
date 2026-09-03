import { describe, it, expect } from 'vitest'
import {
  validateEmail, validatePassword, validateFullName, validatePhone, validateAddress,
  validatePrice, validateStock, validateProductName, validateQuantity, validateRating,
  validateImageFile, collectErrors, LIMITS,
} from '../src/utils/validation'

/**
 * These rules mirror the CHECK constraints and function guards in
 * supabase/migrations. They are the fast feedback loop in the form; the
 * database is the enforcement point. A change to one should be a change to
 * both, and these tests pin what the form promises.
 */

describe('email', () => {
  it('accepts an ordinary address', () => {
    expect(validateEmail('amina@example.rw')).toBeNull()
  })

  it('rejects an empty or malformed address', () => {
    expect(validateEmail('')).toMatch(/required/i)
    expect(validateEmail('   ')).toMatch(/required/i)
    expect(validateEmail('amina@')).toMatch(/valid/i)
    expect(validateEmail('amina.example.rw')).toMatch(/valid/i)
    expect(validateEmail('amina@example')).toMatch(/valid/i)
  })
})

describe('password', () => {
  it('requires length and a mix of letters and digits', () => {
    expect(validatePassword('Kigali2025')).toBeNull()
    expect(validatePassword('')).toMatch(/required/i)
    expect(validatePassword('short1')).toMatch(/8 characters/)
    expect(validatePassword('alllettershere')).toMatch(/letters and numbers/)
    expect(validatePassword('1234567890')).toMatch(/letters and numbers/)
  })

  it('is at least as strict as the length Supabase Auth is configured for', () => {
    expect(LIMITS.passwordMin).toBeGreaterThanOrEqual(8)
  })
})

describe('phone numbers', () => {
  it('accepts the shapes Rwandan numbers are actually written in', () => {
    expect(validatePhone('+250780000000')).toBeNull()
    expect(validatePhone('+250 78 000 0000')).toBeNull()
    expect(validatePhone('0780000000')).toBeNull()
    expect(validatePhone('(078) 000-0000')).toBeNull()
  })

  it('rejects letters and obviously wrong lengths', () => {
    expect(validatePhone('not a phone')).toMatch(/valid/i)
    expect(validatePhone('12345')).toMatch(/valid/i)
  })

  it('can be optional', () => {
    expect(validatePhone('', { required: false })).toBeNull()
    expect(validatePhone('')).toMatch(/required/i)
  })
})

describe('money and stock', () => {
  it('takes whole francs only — RWF has no minor unit in everyday use', () => {
    expect(validatePrice(50000)).toBeNull()
    expect(validatePrice('50000')).toBeNull()
    expect(validatePrice(1250.5)).toMatch(/whole number/)
  })

  it('refuses a negative or absurd price', () => {
    expect(validatePrice(-1)).toMatch(/negative/)
    expect(validatePrice(LIMITS.priceMax + 1)).toMatch(/unrealistically high/)
  })

  it('treats a missing value as an error rather than as zero', () => {
    expect(validatePrice('')).toMatch(/required/i)
    expect(validatePrice(null)).toMatch(/required/i)
    expect(validateStock('')).toMatch(/required/i)
  })

  it('accepts zero stock — an out-of-stock listing is legitimate', () => {
    expect(validateStock(0)).toBeNull()
    expect(validateStock(-1)).toMatch(/negative/)
    expect(validateStock(2.5)).toMatch(/whole number/)
  })
})

describe('quantities and ratings', () => {
  it('keeps a quantity within what is available', () => {
    expect(validateQuantity(1, 5)).toBeNull()
    expect(validateQuantity(5, 5)).toBeNull()
    expect(validateQuantity(6, 5)).toMatch(/Only 5 available/)
    expect(validateQuantity(0, 5)).toMatch(/at least 1/)
  })

  it('accepts only whole stars from one to five', () => {
    expect(validateRating(1)).toBeNull()
    expect(validateRating(5)).toBeNull()
    expect(validateRating(0)).toMatch(/1 to 5/)
    expect(validateRating(6)).toMatch(/1 to 5/)
    expect(validateRating(3.5)).toMatch(/1 to 5/)
  })
})

describe('names and addresses', () => {
  it('needs enough of a name and address to deliver to', () => {
    expect(validateFullName('Amina Uwase')).toBeNull()
    expect(validateFullName(' A ')).toMatch(/full name/i)
    expect(validateAddress('KK 243 St, Kigali')).toBeNull()
    expect(validateAddress('KK')).toMatch(/more complete/)
    expect(validateAddress('')).toMatch(/required/i)
  })

  it('bounds a product name at both ends', () => {
    expect(validateProductName('Samsung Galaxy S25')).toBeNull()
    expect(validateProductName('')).toMatch(/required/i)
    expect(validateProductName('x'.repeat(LIMITS.productNameMax + 1))).toMatch(/too long/)
  })
})

describe('image uploads', () => {
  const file = (type, size) => ({ name: 'photo.jpg', type, size })

  it('accepts the formats the storage bucket allows', () => {
    expect(validateImageFile(file('image/jpeg', 1024))).toBeNull()
    expect(validateImageFile(file('image/webp', 1024))).toBeNull()
    expect(validateImageFile(file('image/avif', 1024))).toBeNull()
  })

  it('refuses anything that is not one of those image types', () => {
    expect(validateImageFile(file('application/pdf', 1024))).toMatch(/JPEG, PNG, WebP or AVIF/)
    expect(validateImageFile(file('image/svg+xml', 1024))).toMatch(/JPEG, PNG, WebP or AVIF/)
    expect(validateImageFile(file('application/x-msdownload', 1024))).toMatch(/JPEG/)
  })

  it('refuses a file over the bucket size limit', () => {
    expect(validateImageFile(file('image/jpeg', LIMITS.imageBytes + 1))).toMatch(/smaller than/)
  })
})

describe('collectErrors', () => {
  it('drops the fields that passed and keeps the ones that did not', () => {
    const result = collectErrors({
      email: null,
      password: 'Password must be at least 8 characters',
      name: null,
    })
    expect(result).toEqual({ password: 'Password must be at least 8 characters' })
  })

  it('returns an empty object when everything is valid', () => {
    expect(collectErrors({ a: null, b: null })).toEqual({})
  })
})
