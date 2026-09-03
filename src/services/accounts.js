import { supabase } from '../lib/supabase'
import { assertOk } from '../lib/errors'

/**
 * Profiles, stores, platform settings and the audit trail.
 *
 * Every privileged action here is a call to a database function that checks
 * the caller's role for itself. Nothing in this file grants permission; it
 * only asks.
 */

export const SELLER_STATUS_LABEL = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
}

export const ProfileService = {
  async get(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, address, avatar_path, role, suspended, created_at')
      .eq('id', userId)
      .maybeSingle()
    assertOk(error, 'load profile')
    return data
  },

  async update(userId, { fullName, phone, address }) {
    const patch = {}
    if (fullName !== undefined) patch.full_name = fullName.trim()
    if (phone !== undefined) patch.phone = phone?.trim() || null
    if (address !== undefined) patch.address = address?.trim() || null

    const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
    assertOk(error, 'update profile')
  },

  /** Changing the password goes through Supabase Auth, not the profiles table. */
  async changePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    assertOk(error, 'change password')
  },

  async listAll({ role = null, search = '' } = {}) {
    let q = supabase
      .from('profiles')
      .select('id, full_name, email, phone, role, suspended, created_at')
      .order('created_at', { ascending: false })

    if (role) q = q.eq('role', role)
    if (search) q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)

    const { data, error } = await q
    assertOk(error, 'load users')
    return data ?? []
  },

  async setSuspended(userId, suspended) {
    const { error } = await supabase.rpc('set_user_suspended', {
      p_user_id: userId,
      p_suspended: suspended,
    })
    assertOk(error, 'update account status')
  },

  /** Superadmin only — the function refuses everyone else. */
  async setRole(userId, role) {
    const { error } = await supabase.rpc('set_user_role', { p_user_id: userId, p_role: role })
    assertOk(error, 'change role')
  },
}

export const SellerService = {
  async get(sellerId) {
    const { data, error } = await supabase
      .from('sellers')
      .select(`
        id, store_name, description, status, status_reason,
        momo_number, momo_name, bank_name, bank_account, created_at, approved_at,
        profiles ( full_name, email )
      `)
      .eq('id', sellerId)
      .maybeSingle()
    assertOk(error, 'load store')
    if (!data) return null
    return {
      id: data.id,
      storeName: data.store_name,
      description: data.description,
      status: data.status,
      statusReason: data.status_reason,
      momoNumber: data.momo_number,
      momoName: data.momo_name,
      bankName: data.bank_name,
      bankAccount: data.bank_account,
      createdAt: data.created_at,
      approvedAt: data.approved_at,
      ownerName: data.profiles?.full_name ?? null,
      ownerEmail: data.profiles?.email ?? null,
    }
  },

  async updateStore(sellerId, { storeName, description, momoNumber, momoName, bankName, bankAccount }) {
    const patch = {}
    if (storeName !== undefined) patch.store_name = storeName.trim()
    if (description !== undefined) patch.description = description?.trim() || null
    if (momoNumber !== undefined) patch.momo_number = momoNumber?.trim() || null
    if (momoName !== undefined) patch.momo_name = momoName?.trim() || null
    if (bankName !== undefined) patch.bank_name = bankName?.trim() || null
    if (bankAccount !== undefined) patch.bank_account = bankAccount?.trim() || null

    const { error } = await supabase.from('sellers').update(patch).eq('id', sellerId)
    assertOk(error, 'update store')
  },

  async listAll() {
    const { data, error } = await supabase
      .from('sellers')
      .select(`
        id, store_name, status, status_reason, momo_number, bank_name,
        created_at, approved_at, profiles ( full_name, email, suspended )
      `)
      .order('created_at', { ascending: false })
    assertOk(error, 'load sellers')
    return (data ?? []).map((s) => ({
      id: s.id,
      storeName: s.store_name,
      status: s.status,
      statusReason: s.status_reason,
      momoNumber: s.momo_number,
      bankName: s.bank_name,
      createdAt: s.created_at,
      approvedAt: s.approved_at,
      ownerName: s.profiles?.full_name ?? null,
      ownerEmail: s.profiles?.email ?? null,
      ownerSuspended: s.profiles?.suspended ?? false,
    }))
  },

  /** Admin moderation — approve, reject or suspend a store. */
  async setStatus(sellerId, status, reason = null) {
    const { error } = await supabase.rpc('set_seller_status', {
      p_seller_id: sellerId,
      p_status: status,
      p_reason: reason,
    })
    assertOk(error, 'update seller status')
  },

  /**
   * Settled earnings only: the view joins commissions to confirmed payments,
   * so nothing here counts money that has not actually been received.
   */
  async earnings(sellerId) {
    const { data, error } = await supabase
      .from('seller_earnings')
      .select('paid_orders, gross_rwf, commission_rwf, net_rwf')
      .eq('seller_id', sellerId)
      .maybeSingle()
    if (error) return { paidOrders: 0, gross: 0, commission: 0, net: 0 }
    return {
      paidOrders: data?.paid_orders ?? 0,
      gross: Number(data?.gross_rwf ?? 0),
      commission: Number(data?.commission_rwf ?? 0),
      net: Number(data?.net_rwf ?? 0),
    }
  },
}

export const SettingsService = {
  async get() {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('commission_rate_bps, delivery_fee_rwf, free_delivery_over_rwf, low_stock_threshold, sandbox_payments_enabled')
      .maybeSingle()
    if (error || !data) {
      return {
        commissionRateBps: 0,
        deliveryFee: 0,
        freeDeliveryOver: null,
        lowStockThreshold: 5,
        sandboxPayments: false,
      }
    }
    return {
      commissionRateBps: data.commission_rate_bps,
      deliveryFee: Number(data.delivery_fee_rwf),
      freeDeliveryOver: data.free_delivery_over_rwf ? Number(data.free_delivery_over_rwf) : null,
      lowStockThreshold: data.low_stock_threshold,
      sandboxPayments: data.sandbox_payments_enabled,
    }
  },

  /** Superadmin only; RLS refuses anyone else. */
  async update({ commissionRateBps, deliveryFee, freeDeliveryOver, lowStockThreshold }) {
    const patch = {}
    if (commissionRateBps !== undefined) patch.commission_rate_bps = commissionRateBps
    if (deliveryFee !== undefined) patch.delivery_fee_rwf = deliveryFee
    if (freeDeliveryOver !== undefined) patch.free_delivery_over_rwf = freeDeliveryOver
    if (lowStockThreshold !== undefined) patch.low_stock_threshold = lowStockThreshold

    const { error } = await supabase.from('platform_settings').update(patch).eq('id', true)
    assertOk(error, 'update platform settings')
  },
}

export const AuditService = {
  async list({ limit = 50 } = {}) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, action, entity_type, entity_id, metadata, created_at, actor_id, profiles ( full_name )')
      .order('created_at', { ascending: false })
      .limit(limit)
    assertOk(error, 'load audit log')
    return (data ?? []).map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: row.metadata,
      createdAt: row.created_at,
      actorName: row.profiles?.full_name ?? 'System',
    }))
  },
}
