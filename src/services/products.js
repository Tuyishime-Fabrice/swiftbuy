import { supabase } from '../lib/supabase'
import { assertOk } from '../lib/errors'

/**
 * Catalogue reads and seller catalogue management.
 *
 * Storefront listing goes through the search_products database function so
 * filtering, sorting and pagination happen in PostgreSQL. The browser fetches
 * one page at a time and is told the total match count — it never downloads
 * the whole catalogue to filter it in JavaScript.
 */

export const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'featured', label: 'Featured first' },
]

export const PAGE_SIZE = 24

function mapSearchRow(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price_rwf),
    stock: row.stock,
    isFeatured: row.is_featured,
    rating: Number(row.rating_avg ?? 0),
    ratingCount: row.rating_count ?? 0,
    sellerId: row.seller_id,
    storeName: row.store_name,
    category: row.category_name,
    imagePath: row.image_path,
    createdAt: row.created_at,
  }
}

export const ProductService = {
  /** One page of the storefront, filtered and sorted by the database. */
  async search({
    query = '',
    category = null,
    minPrice = null,
    maxPrice = null,
    minRating = null,
    sellerId = null,
    inStock = false,
    sort = 'newest',
    page = 0,
    pageSize = PAGE_SIZE,
  } = {}) {
    const { data, error } = await supabase.rpc('search_products', {
      p_query: query || null,
      p_category: category || null,
      p_min_price: minPrice,
      p_max_price: maxPrice,
      p_min_rating: minRating,
      p_seller_id: sellerId,
      p_in_stock: inStock,
      p_sort: sort,
      p_limit: pageSize,
      p_offset: page * pageSize,
    })
    assertOk(error, 'search products')

    const rows = data ?? []
    return {
      items: rows.map(mapSearchRow),
      // count(*) over () rides along on every row; zero rows means zero matches.
      total: rows.length ? Number(rows[0].total_count) : 0,
      page,
      pageSize,
    }
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('products')
      .select(`
        id, name, description, price_rwf, stock, is_featured, is_active,
        rating_avg, rating_count, created_at, seller_id,
        categories ( name ),
        sellers ( id, store_name, status, momo_number, momo_name, bank_name, bank_account ),
        product_images ( id, storage_path, alt_text, position, is_primary )
      `)
      .eq('id', id)
      .maybeSingle()
    assertOk(error, 'load product')
    if (!data) return null

    const images = (data.product_images ?? []).sort(
      (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position
    )

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      price: Number(data.price_rwf),
      stock: data.stock,
      isFeatured: data.is_featured,
      isActive: data.is_active,
      rating: Number(data.rating_avg ?? 0),
      ratingCount: data.rating_count ?? 0,
      createdAt: data.created_at,
      category: data.categories?.name ?? null,
      sellerId: data.seller_id,
      store: data.sellers
        ? {
            id: data.sellers.id,
            name: data.sellers.store_name,
            status: data.sellers.status,
            momoNumber: data.sellers.momo_number,
            momoName: data.sellers.momo_name,
            bankName: data.sellers.bank_name,
            bankAccount: data.sellers.bank_account,
          }
        : null,
      images,
      imagePath: images[0]?.storage_path ?? null,
    }
  },

  /** A seller's own catalogue, including listings they have deactivated. */
  async listForSeller(sellerId) {
    const { data, error } = await supabase
      .from('products')
      .select(`
        id, name, price_rwf, stock, is_active, is_featured, rating_avg, rating_count,
        created_at, categories ( id, name ),
        product_images ( storage_path, is_primary, position )
      `)
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
    assertOk(error, 'load seller products')

    return (data ?? []).map((p) => {
      const images = (p.product_images ?? []).sort(
        (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position
      )
      return {
        id: p.id,
        name: p.name,
        price: Number(p.price_rwf),
        stock: p.stock,
        isActive: p.is_active,
        isFeatured: p.is_featured,
        rating: Number(p.rating_avg ?? 0),
        ratingCount: p.rating_count ?? 0,
        categoryId: p.categories?.id ?? null,
        category: p.categories?.name ?? null,
        imagePath: images[0]?.storage_path ?? null,
        createdAt: p.created_at,
      }
    })
  },

  async create({ sellerId, name, description, price, stock, categoryId }) {
    const { data, error } = await supabase
      .from('products')
      .insert({
        seller_id: sellerId,
        name: name.trim(),
        description: description?.trim() || null,
        price_rwf: Math.round(Number(price)),
        stock: Math.round(Number(stock)),
        category_id: categoryId || null,
      })
      .select('id')
      .single()
    assertOk(error, 'create product')
    return data.id
  },

  async update(id, { name, description, price, stock, categoryId, isActive }) {
    const patch = {}
    if (name !== undefined) patch.name = name.trim()
    if (description !== undefined) patch.description = description?.trim() || null
    if (price !== undefined) patch.price_rwf = Math.round(Number(price))
    if (stock !== undefined) patch.stock = Math.round(Number(stock))
    if (categoryId !== undefined) patch.category_id = categoryId || null
    if (isActive !== undefined) patch.is_active = isActive

    const { error } = await supabase.from('products').update(patch).eq('id', id)
    assertOk(error, 'update product')
  },

  /**
   * Delisting rather than deleting: order history references the product, and
   * a hard delete would strip a customer's past purchases of their link.
   */
  async delist(id) {
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id)
    assertOk(error, 'delist product')
  },

  async relist(id) {
    const { error } = await supabase.from('products').update({ is_active: true }).eq('id', id)
    assertOk(error, 'relist product')
  },

  /** Platform merchandising — the RPC refuses anyone who is not an admin. */
  async setFeatured(id, featured) {
    const { error } = await supabase.rpc('set_product_featured', {
      p_product_id: id,
      p_featured: featured,
    })
    assertOk(error, 'feature product')
  },
}

export const CategoryService = {
  async list() {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('sort_order')
    assertOk(error, 'load categories')
    return data ?? []
  },
}
