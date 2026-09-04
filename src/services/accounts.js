import { supabase } from '../lib/supabase'
import { assertOk } from '../lib/errors'
import { validateDocumentFile } from '../utils/validation'

export const SELLER_STATUS_LABEL = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
}

export const DOCUMENT_TYPES = [
  { value: 'business_licence', label: 'Business or licence document' },
  { value: 'identity', label: 'Identity document' },
  { value: 'other', label: 'Other supporting document' },
]

export const DOCUMENT_TYPE_LABEL = Object.fromEntries(
  DOCUMENT_TYPES.map((t) => [t.value, t.label])
)

const DOCUMENT_BUCKET = 'seller-documents'

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
        profiles!sellers_id_fkey ( full_name, email )
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
        created_at, approved_at, profiles!sellers_id_fkey ( full_name, email, suspended )
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

  async setStatus(sellerId, status, reason = null) {
    const { error } = await supabase.rpc('set_seller_status', {
      p_seller_id: sellerId,
      p_status: status,
      p_reason: reason,
    })
    assertOk(error, 'update seller status')
  },

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

export const SellerApplicationService = {
  async mine() {
    const { data, error } = await supabase.rpc('my_seller_application')
    assertOk(error, 'load seller application')

    const row = Array.isArray(data) ? data[0] : data
    if (!row) return null
    return {
      id: row.seller_id,
      storeName: row.store_name,
      description: row.description,
      status: row.status,
      statusReason: row.status_reason,
      momoNumber: row.momo_number,
      momoName: row.momo_name,
      bankName: row.bank_name,
      bankAccount: row.bank_account,
      appliedAt: row.applied_at,
      approvedAt: row.approved_at,
      documentCount: row.document_count ?? 0,
    }
  },

  async submit({ storeName, description, momoNumber, momoName, bankName, bankAccount }) {
    const { data, error } = await supabase.rpc('apply_to_sell', {
      p_store_name: storeName,
      p_description: description || null,
      p_momo_number: momoNumber || null,
      p_momo_name: momoName || null,
      p_bank_name: bankName || null,
      p_bank_account: bankAccount || null,
    })
    assertOk(error, 'submit seller application')
    return data
  },
}

export const SellerDocumentService = {
  async list(sellerId) {
    const { data, error } = await supabase.rpc('seller_application_documents', {
      p_seller_id: sellerId,
    })
    assertOk(error, 'load verification documents')
    return (data ?? []).map((d) => ({
      id: d.id,
      docType: d.doc_type,
      storagePath: d.storage_path,
      fileName: d.file_name,
      reviewedAt: d.reviewed_at,
      createdAt: d.created_at,
    }))
  },

  async upload({ file, sellerId, docType }) {
    const problem = validateDocumentFile(file)
    if (problem) throw new Error(problem)

    const extension = file.name?.split('.').pop()?.toLowerCase()
    const suffix = extension && /^[a-z0-9]{2,5}$/.test(extension)
      ? extension
      : (file.type === 'application/pdf' ? 'pdf' : 'jpg')
    const path = `${sellerId}/${crypto.randomUUID()}.${suffix}`

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type })
    assertOk(uploadError, 'upload verification document')

    const { data, error } = await supabase
      .from('seller_documents')
      .insert({
        seller_id: sellerId,
        doc_type: docType,
        storage_path: path,
        file_name: file.name ?? null,
      })
      .select('id, doc_type, storage_path, file_name, reviewed_at, created_at')
      .single()

    if (error) {
      await supabase.storage.from(DOCUMENT_BUCKET).remove([path])
      assertOk(error, 'record verification document')
    }
    return data
  },

  async remove({ documentId, storagePath }) {
    const { error } = await supabase.from('seller_documents').delete().eq('id', documentId)
    assertOk(error, 'remove verification document')
    if (storagePath) {
      await supabase.storage.from(DOCUMENT_BUCKET).remove([storagePath])
    }
  },

  async openUrl(storagePath) {
    const { data, error } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrl(storagePath, 120)
    assertOk(error, 'open verification document')
    return data?.signedUrl ?? null
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
