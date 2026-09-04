import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

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

export function publicUrl(bucket, path) {
  if (!path || !supabase) return null
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data?.publicUrl ?? null
}

export function productImageUrl(path, { width, height } = {}) {
  if (!path || !supabase) return null
  const { data } = supabase.storage.from('product-images').getPublicUrl(path, {
    transform: width ? { width, height: height ?? width, resize: 'cover' } : undefined,
  })
  return data?.publicUrl ?? null
}
