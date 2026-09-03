import { createClient } from '@supabase/supabase-js'

/**
 * The single Supabase client for the whole app.
 *
 * Only the URL and the anon key are exposed here, and that is deliberate: the
 * anon key is a public identifier, not a secret. Every permission decision
 * happens in the database (see supabase/migrations/0002_security.sql), so a
 * browser holding this key can still only read and write what Row Level
 * Security allows it to. A service-role key must never appear in this bundle.
 */

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Whether the app is configured to talk to a real backend. When this is false
 * the UI shows a clear setup screen rather than pretending to work — there is
 * no localStorage "demo mode" that quietly stores commerce data per browser.
 */
export const isConfigured = Boolean(url && anonKey)

export const supabase = isConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

/** Public URL for an object in a public Storage bucket. */
export function publicUrl(bucket, path) {
  if (!path || !supabase) return null
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data?.publicUrl ?? null
}

/**
 * Supabase image transformations resize on the CDN, so a product grid does not
 * download full-resolution photographs.
 */
export function productImageUrl(path, { width, height } = {}) {
  if (!path || !supabase) return null
  const { data } = supabase.storage.from('product-images').getPublicUrl(path, {
    transform: width ? { width, height: height ?? width, resize: 'cover' } : undefined,
  })
  return data?.publicUrl ?? null
}
