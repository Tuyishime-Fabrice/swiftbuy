import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SellerLayout from '../../layouts/SellerLayout'
import {
  PageHeader, EmptyState, ErrorState, ListSkeleton, Modal, Field, SubmitButton,
  InlineNotice, ConfirmDialog, StatCard, StatGrid, Rating,
} from '../../components/UI'
import * as Icon from '../../components/Icons'
import { useAuth } from '../../context/auth-context'
import { useToast } from '../../context/toast-context'
import { ProductService, CategoryService } from '../../services/products'
import { ImageService } from '../../services/images'
import { SettingsService } from '../../services/accounts'
import { productImageUrl } from '../../lib/supabase'
import { formatRwf, stockState, STOCK_LABEL } from '../../utils/format'
import {
  validateProductName, validatePrice, validateStock, validateImageFile,
  collectErrors, LIMITS, ACCEPTED_IMAGE_TYPES,
} from '../../utils/validation'
import { listContainer, listItem } from '../../lib/motion'
import { useAsyncData } from '../../hooks/useAsyncData'

/**
 * The seller's catalogue.
 *
 * Images are uploaded to Supabase Storage and referenced by path — the old
 * version base64-encoded them into a database column, which made every product
 * query drag megabytes of image data with it.
 */
export default function SellerProducts() {
  const { user } = useAuth()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)   // product object, or 'new'
  const [delisting, setDelisting] = useState(null)

  const { status, data, error, reload, retry } = useAsyncData(
    useCallback(async () => {
      const [list, cats, config] = await Promise.all([
        ProductService.listForSeller(user.id),
        CategoryService.list(),
        SettingsService.get(),
      ])
      return { products: list, categories: cats, settings: config }
    }, [user.id])
  )

  const products = data?.products ?? []
  const categories = data?.categories ?? []
  const settings = data?.settings ?? null

  const lowThreshold = settings?.lowStockThreshold ?? 5
  const live = products.filter((p) => p.isActive)
  const lowStock = live.filter((p) => p.stock > 0 && p.stock <= lowThreshold)
  const outOfStock = live.filter((p) => p.stock === 0)

  const visible = search
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : products

  const confirmDelist = async () => {
    try {
      await ProductService.delist(delisting.id)
      toast.info(`${delisting.name} is no longer listed`)
      setDelisting(null)
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const relist = async (product) => {
    try {
      await ProductService.relist(product.id)
      toast.success(`${product.name} is live again`)
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (status === 'loading') {
    return (
      <SellerLayout title="Products">
        <PageHeader title="Products" />
        <StatGrid><StatCard label="Loading" value="—" /></StatGrid>
        <div style={{ marginTop: 20 }}><ListSkeleton count={3} height={110} /></div>
      </SellerLayout>
    )
  }

  if (status === 'error') {
    return (
      <SellerLayout title="Products">
        <PageHeader title="Products" />
        <ErrorState title="We couldn't load your products" description={error} onRetry={retry} />
      </SellerLayout>
    )
  }

  return (
    <SellerLayout title="Products">
      <PageHeader
        title="Products"
        subtitle={`${live.length} live · ${products.length - live.length} delisted`}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            <Icon.Plus size={16} /> Add product
          </button>
        }
      />

      <StatGrid>
        <StatCard label="Live listings" value={live.length} icon={Icon.Store} />
        <StatCard
          label="Low stock"
          value={lowStock.length}
          hint={`${lowThreshold} or fewer left`}
          tone="warning"
          icon={Icon.Alert}
        />
        <StatCard label="Out of stock" value={outOfStock.length} tone="danger" icon={Icon.Alert} />
      </StatGrid>

      {lowStock.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <InlineNotice tone="warning" title="Running low">
            {lowStock.map((p) => p.name).join(', ')} — restock before they sell out.
          </InlineNotice>
        </div>
      )}

      <div style={{ margin: '20px 0 16px', maxWidth: 340 }}>
        <label htmlFor="product-search" className="sr-only">Search your products</label>
        <input
          id="product-search"
          className="input"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your products…"
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Icon.Store}
          title={search ? 'Nothing matches that' : 'No products yet'}
          description={
            search
              ? 'Try a different search term.'
              : 'Add your first product and it will appear on the SwiftBuy storefront straight away.'
          }
          action={
            !search && (
              <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
                <Icon.Plus size={16} /> Add your first product
              </button>
            )
          }
        />
      ) : (
        <motion.ul
          variants={listContainer}
          initial="initial"
          animate="animate"
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {visible.map((product) => {
            const state = stockState(product.stock, lowThreshold)
            return (
              <motion.li
                key={product.id}
                variants={listItem}
                className="card"
                style={{ padding: 14, display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}
              >
                <span
                  style={{
                    width: 76, height: 76, borderRadius: 'var(--radius)', flexShrink: 0,
                    background: 'var(--bg-sunk)', overflow: 'hidden',
                    display: 'grid', placeItems: 'center', color: 'var(--text-subtle)',
                  }}
                >
                  {product.imagePath ? (
                    <img
                      src={productImageUrl(product.imagePath, { width: 180 })}
                      alt="" loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : <Icon.Image size={22} />}
                </span>

                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <p style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{product.name}</p>
                    {!product.isActive && <span className="badge badge-neutral">Delisted</span>}
                    {product.isFeatured && <span className="badge badge-warning">Featured</span>}
                  </div>
                  <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>
                    {product.category ?? 'Uncategorised'}
                  </p>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: 'var(--accent-soft)' }}>
                      {formatRwf(product.price)}
                    </span>
                    <span
                      className={
                        state === 'out_of_stock' ? 'badge badge-danger'
                          : state === 'low_stock' ? 'badge badge-warning'
                          : 'badge badge-success'
                      }
                    >
                      {STOCK_LABEL[state]} · {product.stock}
                    </span>
                    {product.ratingCount > 0 && (
                      <Rating value={product.rating} count={product.ratingCount} size={12} />
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(product)}>
                    <Icon.Edit size={14} /> Edit
                  </button>
                  {product.isActive ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDelisting(product)}>
                      Delist
                    </button>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => relist(product)}>
                      Relist
                    </button>
                  )}
                </div>
              </motion.li>
            )
          })}
        </motion.ul>
      )}

      <AnimatePresence>
        {editing && (
          <ProductDialog
            product={editing === 'new' ? null : editing}
            categories={categories}
            sellerId={user.id}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); reload() }}
          />
        )}
        {delisting && (
          <ConfirmDialog
            title="Delist this product?"
            message={`“${delisting.name}” will be removed from the storefront. Past orders keep their record, and you can relist it at any time.`}
            confirmLabel="Delist product"
            onConfirm={confirmDelist}
            onCancel={() => setDelisting(null)}
          />
        )}
      </AnimatePresence>
    </SellerLayout>
  )
}

// ── Product form ────────────────────────────────────────────────────────────

function ProductDialog({ product, categories, sellerId, onClose, onSaved }) {
  const toast = useToast()
  const editing = Boolean(product)

  const [form, setForm] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product?.price ?? '',
    stock: product?.stock ?? '',
    categoryId: product?.categoryId ?? (categories[0]?.id ?? ''),
  })
  const [images, setImages] = useState([])
  const [pendingFiles, setPendingFiles] = useState([])
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!product) return
    ImageService.listForProduct(product.id).then(setImages).catch(() => setImages([]))
  }, [product])

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }))

  const chooseFiles = (event) => {
    const files = Array.from(event.target.files ?? [])
    const accepted = []
    for (const file of files) {
      const problem = validateImageFile(file)
      if (problem) {
        toast.error(`${file.name}: ${problem}`)
        continue
      }
      accepted.push(file)
    }
    setPendingFiles((current) => [...current, ...accepted].slice(0, 6))
    event.target.value = ''
  }

  const removePending = (index) => {
    setPendingFiles((current) => current.filter((_, i) => i !== index))
  }

  const removeExisting = async (image) => {
    try {
      await ImageService.remove({ imageId: image.id, storagePath: image.storage_path })
      setImages((current) => current.filter((i) => i.id !== image.id))
    } catch (err) {
      toast.error(err.message)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    setFormError(null)

    const found = collectErrors({
      name: validateProductName(form.name),
      price: validatePrice(form.price),
      stock: validateStock(form.stock),
    })
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    try {
      let productId = product?.id
      if (editing) {
        await ProductService.update(productId, form)
      } else {
        productId = await ProductService.create({ ...form, sellerId })
      }

      // Uploads happen after the row exists, because the storage path includes
      // the product id and the image row points at the product.
      for (const [index, file] of pendingFiles.entries()) {
        await ImageService.upload({
          file,
          sellerId,
          productId,
          position: images.length + index,
          isPrimary: images.length === 0 && index === 0,
        })
      }

      toast.success(editing ? 'Product updated' : 'Product added to your store')
      onSaved()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={editing ? 'Edit product' : 'Add a product'}
      description={editing ? product.name : 'It goes live on the storefront as soon as you save'}
      onClose={onClose}
      width={540}
    >
      <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {formError && <InlineNotice tone="danger" title="Could not save">{formError}</InlineNotice>}

        <Field label="Product name" required error={errors.name} htmlFor="product-name">
          <input
            id="product-name" className="input"
            value={form.name} onChange={set('name')}
            maxLength={LIMITS.productNameMax}
            placeholder="e.g. Samsung Galaxy S25, 128GB"
            aria-invalid={errors.name ? 'true' : undefined}
          />
        </Field>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
          <Field label="Price (RWF)" required error={errors.price} htmlFor="product-price">
            <input
              id="product-price" className="input" type="number" min="0" step="1" inputMode="numeric"
              value={form.price} onChange={set('price')}
              aria-invalid={errors.price ? 'true' : undefined}
            />
          </Field>
          <Field label="Stock" required error={errors.stock} htmlFor="product-stock">
            <input
              id="product-stock" className="input" type="number" min="0" step="1" inputMode="numeric"
              value={form.stock} onChange={set('stock')}
              aria-invalid={errors.stock ? 'true' : undefined}
            />
          </Field>
        </div>

        <Field label="Category" htmlFor="product-category">
          <select id="product-category" className="input" value={form.categoryId} onChange={set('categoryId')}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>

        <Field
          label="Description"
          hint="What is it, what condition is it in, what is included?"
          htmlFor="product-description"
        >
          <textarea
            id="product-description" className="input" rows={4}
            maxLength={LIMITS.descriptionMax}
            value={form.description} onChange={set('description')}
          />
        </Field>

        <Field
          label="Photos"
          hint={`JPEG, PNG, WebP or AVIF · up to ${Math.round(LIMITS.imageBytes / 1024 / 1024)} MB each · first photo is the main one`}
          htmlFor="product-images"
        >
          <input
            id="product-images"
            className="input"
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            multiple
            onChange={chooseFiles}
            style={{ padding: 8 }}
          />
        </Field>

        {(images.length > 0 || pendingFiles.length > 0) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {images.map((image) => (
              <ImageThumb
                key={image.id}
                src={productImageUrl(image.storage_path, { width: 160 })}
                primary={image.is_primary}
                onRemove={() => removeExisting(image)}
              />
            ))}
            {pendingFiles.map((file, index) => (
              <ImageThumb
                key={`${file.name}-${index}`}
                src={URL.createObjectURL(file)}
                pending
                onRemove={() => removePending(index)}
              />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <SubmitButton loading={saving} loadingLabel={pendingFiles.length ? 'Uploading…' : 'Saving…'}>
            {editing ? 'Save changes' : 'Add product'}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  )
}

function ImageThumb({ src, primary, pending, onRemove }) {
  return (
    <div style={{ position: 'relative' }}>
      <img
        src={src}
        alt=""
        style={{
          width: 74, height: 74, objectFit: 'cover',
          borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
        }}
      />
      {primary && (
        <span
          className="badge badge-accent"
          style={{ position: 'absolute', bottom: 3, left: 3, fontSize: '0.5625rem', padding: '1px 5px' }}
        >
          Main
        </span>
      )}
      {pending && (
        <span
          className="badge badge-warning"
          style={{ position: 'absolute', bottom: 3, left: 3, fontSize: '0.5625rem', padding: '1px 5px' }}
        >
          New
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove this photo"
        style={{
          position: 'absolute', top: -6, right: -6, width: 21, height: 21,
          borderRadius: '50%', background: 'var(--danger)', color: '#fff',
          display: 'grid', placeItems: 'center',
        }}
      >
        <Icon.Close size={12} />
      </button>
    </div>
  )
}
