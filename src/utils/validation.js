/**
 * Client-side validation.
 *
 * These rules mirror the CHECK constraints and function guards in
 * supabase/migrations — they exist to give fast, specific feedback in the
 * form, not to be the enforcement point. The database rejects bad input
 * regardless of what the browser does with it.
 */

export const LIMITS = {
  nameMin: 2,
  nameMax: 120,
  passwordMin: 8,
  productNameMin: 2,
  productNameMax: 160,
  descriptionMax: 5000,
  priceMax: 100_000_000,
  stockMax: 1_000_000,
  reviewMax: 2000,
  messageMax: 4000,
  imageBytes: 5 * 1024 * 1024,
}

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
// Rwandan numbers are usually written +250 7XX XXX XXX; spaces, dashes and
// brackets are tolerated because that is how people actually type them.
const PHONE = /^\+?[0-9 ()-]{7,20}$/

export function validateEmail(value) {
  if (!value?.trim()) return 'Email address is required'
  if (!EMAIL.test(value.trim())) return 'Enter a valid email address'
  return null
}

export function validatePassword(value) {
  if (!value) return 'Password is required'
  if (value.length < LIMITS.passwordMin) {
    return `Password must be at least ${LIMITS.passwordMin} characters`
  }
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
    return 'Password must include both letters and numbers'
  }
  return null
}

export function validateFullName(value) {
  const name = value?.trim() ?? ''
  if (!name) return 'Full name is required'
  if (name.length < LIMITS.nameMin) return 'Enter your full name'
  if (name.length > LIMITS.nameMax) return 'That name is too long'
  return null
}

export function validatePhone(value, { required = true } = {}) {
  const phone = value?.trim() ?? ''
  if (!phone) return required ? 'Phone number is required' : null
  if (!PHONE.test(phone)) return 'Enter a valid phone number, e.g. +250 78 000 0000'
  return null
}

export function validateAddress(value) {
  const address = value?.trim() ?? ''
  if (!address) return 'Delivery address is required'
  if (address.length < 5) return 'Enter a more complete address'
  if (address.length > 400) return 'That address is too long'
  return null
}

export function validatePrice(value) {
  if (value === '' || value === null || value === undefined) return 'Price is required'
  const n = Number(value)
  if (!Number.isFinite(n)) return 'Price must be a number'
  if (!Number.isInteger(n)) return 'Price must be a whole number of francs'
  if (n < 0) return 'Price cannot be negative'
  if (n > LIMITS.priceMax) return 'That price is unrealistically high'
  return null
}

export function validateStock(value) {
  if (value === '' || value === null || value === undefined) return 'Stock quantity is required'
  const n = Number(value)
  if (!Number.isInteger(n)) return 'Stock must be a whole number'
  if (n < 0) return 'Stock cannot be negative'
  if (n > LIMITS.stockMax) return 'That stock quantity is too large'
  return null
}

export function validateProductName(value) {
  const name = value?.trim() ?? ''
  if (!name) return 'Product name is required'
  if (name.length < LIMITS.productNameMin) return 'Product name is too short'
  if (name.length > LIMITS.productNameMax) return 'Product name is too long'
  return null
}

export function validateQuantity(value, max) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) return 'Quantity must be at least 1'
  if (max != null && n > max) return `Only ${max} available`
  return null
}

export function validateRating(value) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1 || n > 5) return 'Choose a rating from 1 to 5 stars'
  return null
}

export function validateImageFile(file) {
  if (!file) return 'Choose an image'
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return 'Images must be JPEG, PNG, WebP or AVIF'
  }
  if (file.size > LIMITS.imageBytes) {
    return `Images must be smaller than ${Math.round(LIMITS.imageBytes / 1024 / 1024)} MB`
  }
  return null
}

/**
 * Collects field errors into one object; an empty object means the form is
 * valid. Keeps form components from repeating the same null-filtering.
 */
export function collectErrors(fields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, error]) => Boolean(error))
  )
}
