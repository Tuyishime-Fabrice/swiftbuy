import { supabase } from '../lib/supabase'
import { assertOk } from '../lib/errors'
import { validateImageFile } from '../utils/validation'

/**
 * Product image uploads.
 *
 * Files go to Supabase Storage; only the object path is written to the
 * database. The bucket itself enforces a size cap and a MIME allow-list, and
 * its policies require the first path segment to be the uploading seller's
 * own id — so a client that skips this module still cannot write into
 * somebody else's folder.
 */

const BUCKET = 'product-images'

function extensionFor(file) {
  const fromName = file.name?.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName
  return file.type.split('/')[1] ?? 'jpg'
}

export const ImageService = {
  /** Uploads one image and records it against the product. */
  async upload({ file, sellerId, productId, position = 0, isPrimary = false }) {
    const problem = validateImageFile(file)
    if (problem) throw new Error(problem)

    const path = `${sellerId}/${productId}/${crypto.randomUUID()}.${extensionFor(file)}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type })
    assertOk(uploadError, 'upload product image')

    // If two images claim primary the unique index would reject the second, so
    // the existing primary is stood down first.
    if (isPrimary) {
      await supabase
        .from('product_images')
        .update({ is_primary: false })
        .eq('product_id', productId)
        .eq('is_primary', true)
    }

    const { data, error } = await supabase
      .from('product_images')
      .insert({
        product_id: productId,
        storage_path: path,
        position,
        is_primary: isPrimary,
        alt_text: file.name?.replace(/\.[^.]+$/, '') ?? null,
      })
      .select('id, storage_path, is_primary, position')
      .single()

    if (error) {
      // Do not leave an orphaned object behind if the row could not be written.
      await supabase.storage.from(BUCKET).remove([path])
      assertOk(error, 'record product image')
    }
    return data
  },

  async remove({ imageId, storagePath }) {
    const { error } = await supabase.from('product_images').delete().eq('id', imageId)
    assertOk(error, 'remove product image')
    if (storagePath) {
      await supabase.storage.from(BUCKET).remove([storagePath])
    }
  },

  async setPrimary({ productId, imageId }) {
    await supabase
      .from('product_images')
      .update({ is_primary: false })
      .eq('product_id', productId)
      .eq('is_primary', true)

    const { error } = await supabase
      .from('product_images')
      .update({ is_primary: true })
      .eq('id', imageId)
    assertOk(error, 'set primary image')
  },

  async listForProduct(productId) {
    const { data, error } = await supabase
      .from('product_images')
      .select('id, storage_path, alt_text, position, is_primary')
      .eq('product_id', productId)
      .order('is_primary', { ascending: false })
      .order('position')
    assertOk(error, 'load product images')
    return data ?? []
  },
}
