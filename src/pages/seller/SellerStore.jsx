import { useState, useEffect } from 'react'
import SellerLayout from '../../layouts/SellerLayout'
import {
  PageHeader, Field, SubmitButton, InlineNotice, ListSkeleton, StatusBadge,
} from '../../components/UI'
import { useAuth } from '../../context/auth-context'
import { useToast } from '../../context/toast-context'
import { SellerService, SELLER_STATUS_LABEL } from '../../services/accounts'
import { formatDate } from '../../utils/format'
import { validatePhone, collectErrors } from '../../utils/validation'

export default function SellerStore() {
  const { user, refresh } = useAuth()
  const toast = useToast()

  const [store, setStore] = useState(null)
  const [form, setForm] = useState({
    storeName: '', description: '', momoNumber: '', momoName: '', bankName: '', bankAccount: '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    SellerService.get(user.id).then((data) => {
      setStore(data)
      setForm({
        storeName: data?.storeName ?? '',
        description: data?.description ?? '',
        momoNumber: data?.momoNumber ?? '',
        momoName: data?.momoName ?? '',
        bankName: data?.bankName ?? '',
        bankAccount: data?.bankAccount ?? '',
      })
    })
  }, [user.id])

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }))

  const save = async (event) => {
    event.preventDefault()
    const found = collectErrors({
      storeName: form.storeName.trim().length < 2 ? 'Store name is required' : null,
      momoNumber: validatePhone(form.momoNumber, { required: false }),
    })
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    try {
      await SellerService.updateStore(user.id, form)
      await refresh()
      toast.success('Your store details have been saved')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!store) {
    return (
      <SellerLayout title="Store settings">
        <PageHeader title="Store settings" />
        <ListSkeleton count={2} height={240} />
      </SellerLayout>
    )
  }

  const hasPaymentDetails = Boolean(form.momoNumber || form.bankAccount)

  return (
    <SellerLayout title="Store settings">
      <PageHeader title="Store settings" subtitle="How customers see and pay your store" />

      <section className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.04em' }}>
              STORE STATUS
            </p>
            <div style={{ marginTop: 6 }}>
              <StatusBadge status={store.status} label={SELLER_STATUS_LABEL[store.status]} />
            </div>
          </div>
          {store.approvedAt && (
            <p style={{ color: 'var(--text-subtle)', fontSize: '0.8125rem' }}>
              Approved {formatDate(store.approvedAt)}
            </p>
          )}
        </div>

        {store.statusReason && (
          <div style={{ marginTop: 14 }}>
            <InlineNotice
              tone={store.status === 'approved' ? 'info' : 'warning'}
              title="Note from SwiftBuy"
            >
              {store.statusReason}
            </InlineNotice>
          </div>
        )}

        {store.status === 'pending' && (
          <div style={{ marginTop: 14 }}>
            <InlineNotice tone="warning" title="Waiting for review">
              You can fill in your store details now. Once an administrator approves your store,
              your products go live on the marketplace.
            </InlineNotice>
          </div>
        )}
      </section>

      <form className="card" onSubmit={save} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: '1rem' }}>Storefront</h2>

        <Field label="Store name" required error={errors.storeName} htmlFor="store-name">
          <input
            id="store-name" className="input"
            value={form.storeName} onChange={set('storeName')}
            aria-invalid={errors.storeName ? 'true' : undefined}
          />
        </Field>

        <Field
          label="About your store"
          hint="Shown on your store page. What do you sell, and what should buyers know?"
          htmlFor="store-description"
        >
          <textarea
            id="store-description" className="input" rows={4} maxLength={2000}
            value={form.description} onChange={set('description')}
          />
        </Field>

        <h2 style={{ fontSize: '1rem', marginTop: 8 }}>Payment details</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: -8 }}>
          Customers see these when they pay for an order. SwiftBuy does not hold the money —
          it goes straight to you, and you confirm each payment from the orders page.
        </p>

        {!hasPaymentDetails && (
          <InlineNotice tone="warning" title="No payment details yet">
            Until you add a MoMo number or bank account, customers have no way to pay you and
            will have to message you to arrange it.
          </InlineNotice>
        )}

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <Field label="Mobile Money number" error={errors.momoNumber} htmlFor="store-momo">
            <input
              id="store-momo" className="input" type="tel"
              value={form.momoNumber} onChange={set('momoNumber')}
              placeholder="+250 78 000 0000"
              aria-invalid={errors.momoNumber ? 'true' : undefined}
            />
          </Field>
          <Field label="Name on the MoMo account" htmlFor="store-momo-name">
            <input id="store-momo-name" className="input" value={form.momoName} onChange={set('momoName')} />
          </Field>
          <Field label="Bank name" htmlFor="store-bank">
            <input id="store-bank" className="input" value={form.bankName} onChange={set('bankName')} placeholder="e.g. Bank of Kigali" />
          </Field>
          <Field label="Bank account number" htmlFor="store-account">
            <input id="store-account" className="input" value={form.bankAccount} onChange={set('bankAccount')} />
          </Field>
        </div>

        <SubmitButton loading={saving} loadingLabel="Saving…" style={{ alignSelf: 'flex-start' }}>
          Save store details
        </SubmitButton>
      </form>
    </SellerLayout>
  )
}
