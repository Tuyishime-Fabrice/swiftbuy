import { supabase } from '../lib/supabase'
import { assertOk } from '../lib/errors'

export const CartService = {
  async list(userId) {
    const { data, error } = await supabase
      .from('cart_items')
      .select(`
        id, qty, product_id,
        products (
          id, name, price_rwf, stock, is_active, seller_id,
          sellers ( store_name, status ),
          product_images ( storage_path, is_primary, position )
        )
      `)
      .eq('user_id', userId)
      .order('added_at')
    assertOk(error, 'load cart')

    return (data ?? []).map((row) => {
      const p = row.products
      const images = (p?.product_images ?? []).sort(
        (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position
      )
      return {
        cartItemId: row.id,
        productId: row.product_id,
        qty: row.qty,
        name: p?.name ?? 'Unavailable product',

        price: Number(p?.price_rwf ?? 0),
        stock: p?.stock ?? 0,
        sellerId: p?.seller_id ?? null,
        storeName: p?.sellers?.store_name ?? null,

        available: Boolean(p?.is_active) && p?.sellers?.status === 'approved' && (p?.stock ?? 0) > 0,
        imagePath: images[0]?.storage_path ?? null,
      }
    })
  },

  async count(userId) {
    const { data, error } = await supabase
      .from('cart_items')
      .select('qty')
      .eq('user_id', userId)
    if (error) return 0
    return (data ?? []).reduce((sum, row) => sum + row.qty, 0)
  },

  async add(userId, productId, qty = 1) {
    const { data: existing } = await supabase
      .from('cart_items')
      .select('id, qty')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('cart_items')
        .update({ qty: existing.qty + qty })
        .eq('id', existing.id)
      assertOk(error, 'update cart quantity')
      return
    }

    const { error } = await supabase
      .from('cart_items')
      .insert({ user_id: userId, product_id: productId, qty })
    assertOk(error, 'add to cart')
  },

  async setQty(cartItemId, qty) {
    if (qty <= 0) return CartService.remove(cartItemId)
    const { error } = await supabase.from('cart_items').update({ qty }).eq('id', cartItemId)
    assertOk(error, 'update cart quantity')
  },

  async remove(cartItemId) {
    const { error } = await supabase.from('cart_items').delete().eq('id', cartItemId)
    assertOk(error, 'remove from cart')
  },

  async clear(userId) {
    const { error } = await supabase.from('cart_items').delete().eq('user_id', userId)
    assertOk(error, 'clear cart')
  },
}

export const WishlistService = {
  async list(userId) {
    const { data, error } = await supabase
      .from('wishlist_items')
      .select(`
        id, product_id,
        products (
          id, name, price_rwf, stock, is_active, rating_avg, rating_count, seller_id,
          categories ( name ),
          sellers ( store_name, status ),
          product_images ( storage_path, is_primary, position )
        )
      `)
      .eq('user_id', userId)
      .order('added_at', { ascending: false })
    assertOk(error, 'load wishlist')

    return (data ?? [])
      .filter((row) => row.products)
      .map((row) => {
        const p = row.products
        const images = (p.product_images ?? []).sort(
          (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position
        )
        return {
          wishlistItemId: row.id,
          id: p.id,
          name: p.name,
          price: Number(p.price_rwf),
          stock: p.stock,
          rating: Number(p.rating_avg ?? 0),
          ratingCount: p.rating_count ?? 0,
          category: p.categories?.name ?? null,
          sellerId: p.seller_id,
          storeName: p.sellers?.store_name ?? null,
          imagePath: images[0]?.storage_path ?? null,
        }
      })
  },

  async ids(userId) {
    const { data, error } = await supabase
      .from('wishlist_items')
      .select('product_id')
      .eq('user_id', userId)
    if (error) return new Set()
    return new Set((data ?? []).map((row) => row.product_id))
  },

  async toggle(userId, productId) {
    const { data: existing } = await supabase
      .from('wishlist_items')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase.from('wishlist_items').delete().eq('id', existing.id)
      assertOk(error, 'remove from wishlist')
      return false
    }

    const { error } = await supabase
      .from('wishlist_items')
      .insert({ user_id: userId, product_id: productId })
    assertOk(error, 'add to wishlist')
    return true
  },
}

export const PAYMENT_METHODS = [
  {
    value: 'manual_momo',
    label: 'Mobile Money',
    hint: 'Send the amount to the seller’s MTN or Airtel number, then enter the confirmation code.',
  },
  {
    value: 'manual_bank',
    label: 'Bank transfer',
    hint: 'Transfer to the seller’s account, then enter the transfer reference.',
  },
  {
    value: 'cash_on_delivery',
    label: 'Cash on delivery',
    hint: 'Pay the courier when your order arrives.',
  },
]

export const OrderService = {

  async place({ name, phone, address, paymentProvider, notes }) {
    const { data, error } = await supabase.rpc('place_order', {
      p_delivery_name: name,
      p_delivery_phone: phone,
      p_delivery_address: address,
      p_payment_provider: paymentProvider,
      p_notes: notes || null,
    })
    assertOk(error, 'place order')

    const row = Array.isArray(data) ? data[0] : data
    return {
      orderId: row.order_id,
      reference: row.reference,
      total: Number(row.total_rwf),
      paymentId: row.payment_id,
    }
  },

  async listForCustomer(userId) {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, reference, status, subtotal_rwf, delivery_fee_rwf, total_rwf,
        delivery_name, delivery_phone, delivery_address, notes, placed_at,
        order_items ( id, product_id, product_name, unit_price_rwf, qty, line_total_rwf, image_path, seller_id ),
        shipments ( id, seller_id, status, tracking_reference, delivered_at ),
        payments ( id, provider, status, amount_rwf, transaction_reference, customer_reference, failure_reason ),
        disputes ( id, order_item_id, status, category )
      `)
      .eq('user_id', userId)
      .order('placed_at', { ascending: false })
    assertOk(error, 'load orders')
    return (data ?? []).map(mapOrder)
  },

  async listForSeller(sellerId) {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, reference, status, total_rwf, delivery_name, delivery_phone,
        delivery_address, notes, placed_at,
        order_items ( id, product_name, unit_price_rwf, qty, line_total_rwf,
                      commission_rwf, seller_net_rwf, image_path, seller_id ),
        shipments ( id, seller_id, status, tracking_reference, delivered_at ),
        payments ( id, provider, status, amount_rwf, customer_reference, transaction_reference )
      `)
      .order('placed_at', { ascending: false })
    assertOk(error, 'load seller orders')

    return (data ?? []).map((order) => {
      const mapped = mapOrder(order)
      return {
        ...mapped,
        items: mapped.items.filter((i) => i.sellerId === sellerId),
        shipment: mapped.shipments.find((s) => s.sellerId === sellerId) ?? null,
        sellerTotal: mapped.items
          .filter((i) => i.sellerId === sellerId)
          .reduce((sum, i) => sum + i.lineTotal, 0),
      }
    })
  },

  async listAll({ limit = 50, offset = 0, search = '' } = {}) {
    let q = supabase
      .from('orders')
      .select(`
        id, reference, status, total_rwf, commission_rwf, delivery_name,
        delivery_phone, delivery_address, placed_at, user_id,
        order_items ( id, product_name, qty, line_total_rwf, seller_id ),
        shipments ( id, seller_id, status ),
        payments ( id, provider, status, amount_rwf )
      `, { count: 'exact' })
      .order('placed_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) q = q.ilike('reference', `%${search}%`)

    const { data, error, count } = await q
    assertOk(error, 'load all orders')
    return { items: (data ?? []).map(mapOrder), total: count ?? 0 }
  },

  async cancel(orderId, reason) {
    const { error } = await supabase.rpc('cancel_order', {
      p_order_id: orderId,
      p_reason: reason || null,
    })
    assertOk(error, 'cancel order')
  },
}

function mapOrder(o) {
  return {
    id: o.id,
    reference: o.reference,
    status: o.status,
    subtotal: Number(o.subtotal_rwf ?? 0),
    deliveryFee: Number(o.delivery_fee_rwf ?? 0),
    total: Number(o.total_rwf ?? 0),
    commission: Number(o.commission_rwf ?? 0),
    customerId: o.user_id ?? null,
    deliveryName: o.delivery_name,
    deliveryPhone: o.delivery_phone,
    deliveryAddress: o.delivery_address,
    notes: o.notes ?? null,
    placedAt: o.placed_at,
    items: (o.order_items ?? []).map((i) => ({
      id: i.id,
      productId: i.product_id ?? null,
      name: i.product_name,
      unitPrice: Number(i.unit_price_rwf ?? 0),
      qty: i.qty,
      lineTotal: Number(i.line_total_rwf ?? 0),
      commission: Number(i.commission_rwf ?? 0),
      sellerNet: Number(i.seller_net_rwf ?? 0),
      imagePath: i.image_path ?? null,
      sellerId: i.seller_id,
    })),
    shipments: (o.shipments ?? []).map((s) => ({
      id: s.id,
      sellerId: s.seller_id,
      status: s.status,
      trackingReference: s.tracking_reference ?? null,
      deliveredAt: s.delivered_at ?? null,
    })),
    payment: (o.payments ?? [])[0]
      ? {
          id: o.payments[0].id,
          provider: o.payments[0].provider,
          status: o.payments[0].status,
          amount: Number(o.payments[0].amount_rwf ?? 0),
          reference: o.payments[0].transaction_reference ?? null,
          customerReference: o.payments[0].customer_reference ?? null,
          failureReason: o.payments[0].failure_reason ?? null,
        }
      : null,
    disputes: (o.disputes ?? []).map((d) => ({
      id: d.id,
      orderItemId: d.order_item_id,
      status: d.status,
      category: d.category,
    })),
  }
}

export const FULFILMENT_FLOW = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['in_transit', 'cancelled'],
  in_transit: ['delivered'],
  delivered: [],
  cancelled: [],
}

export const FULFILMENT_LABEL = {
  pending: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for pickup',
  in_transit: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export const ShipmentService = {
  async setStatus(shipmentId, status, trackingReference = null) {
    const { error } = await supabase.rpc('update_shipment_status', {
      p_shipment_id: shipmentId,
      p_status: status,
      p_tracking_reference: trackingReference,
    })
    assertOk(error, 'update shipment')
  },
}

export const PAYMENT_LABEL = {
  pending: 'Payment not started',
  initiated: 'Payment arranged',
  awaiting_confirmation: 'Awaiting seller confirmation',
  successful: 'Payment confirmed',
  failed: 'Payment not verified',
  cancelled: 'Payment cancelled',
  refunded: 'Refunded',
}

export const PaymentService = {

  async declare(orderId, customerReference) {
    const { data, error } = await supabase.rpc('declare_payment', {
      p_order_id: orderId,
      p_customer_reference: customerReference || null,
    })
    assertOk(error, 'declare payment')
    return data
  },

  async confirm(paymentId, providerTransactionId = null) {
    const { error } = await supabase.rpc('confirm_payment', {
      p_payment_id: paymentId,
      p_provider_transaction_id: providerTransactionId,
    })
    assertOk(error, 'confirm payment')
  },

  async reject(paymentId, reason) {
    const { error } = await supabase.rpc('reject_payment', {
      p_payment_id: paymentId,
      p_reason: reason,
    })
    assertOk(error, 'reject payment')
  },

  async recordRefund(paymentId, reason) {
    const { error } = await supabase.rpc('record_refund', {
      p_payment_id: paymentId,
      p_reason: reason,
    })
    assertOk(error, 'record refund')
  },
}

export const ReviewService = {
  async listForProduct(productId) {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at, user_id, profiles ( full_name )')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(50)
    assertOk(error, 'load reviews')
    return (data ?? []).map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at,
      authorName: r.profiles?.full_name ?? 'SHOP MUMU customer',
      authorId: r.user_id,
    }))
  },

  async submit({ productId, userId, orderItemId, rating, comment }) {
    const { error } = await supabase.from('reviews').insert({
      product_id: productId,
      user_id: userId,
      order_item_id: orderItemId,
      rating,
      comment: comment?.trim() || null,
    })
    assertOk(error, 'submit review')
  },

  async reviewedItemIds(userId) {
    const { data, error } = await supabase
      .from('reviews')
      .select('order_item_id')
      .eq('user_id', userId)
    if (error) return new Set()
    return new Set((data ?? []).map((r) => r.order_item_id))
  },
}

export const DISPUTE_CATEGORIES = [
  { value: 'product_damaged', label: 'The product arrived damaged' },
  { value: 'wrong_product', label: 'I received the wrong product' },
  { value: 'missing_product', label: 'Part of my order is missing' },
  { value: 'delivery_issue', label: 'There was a delivery problem' },
  { value: 'seller_issue', label: 'A problem with the seller' },
  { value: 'other', label: 'Something else' },
]

export const DisputeService = {
  async open({ orderId, orderItemId, category, description }) {
    const { data, error } = await supabase.rpc('open_dispute', {
      p_order_id: orderId,
      p_order_item_id: orderItemId,
      p_category: category,
      p_description: description,
    })
    assertOk(error, 'open case')
    return data
  },

  async respond(disputeId, reply) {
    const { error } = await supabase.rpc('respond_to_dispute', {
      p_dispute_id: disputeId,
      p_reply: reply,
    })
    assertOk(error, 'reply to case')
  },

  async resolve(disputeId, status, resolution) {
    const { error } = await supabase.rpc('resolve_dispute', {
      p_dispute_id: disputeId,
      p_status: status,
      p_resolution: resolution,
    })
    assertOk(error, 'resolve case')
  },

  async list() {
    const { data, error } = await supabase
      .from('disputes')
      .select(`
        id, category, status, description, seller_reply, resolution, created_at,
        order_id, order_item_id, customer_id, seller_id,
        orders ( reference )
      `)
      .order('created_at', { ascending: false })
    assertOk(error, 'load cases')
    return (data ?? []).map((d) => ({
      id: d.id,
      category: d.category,
      status: d.status,
      description: d.description,
      sellerReply: d.seller_reply,
      resolution: d.resolution,
      createdAt: d.created_at,
      orderId: d.order_id,
      orderItemId: d.order_item_id,
      customerId: d.customer_id,
      sellerId: d.seller_id,
      orderReference: d.orders?.reference ?? null,
    }))
  },
}
