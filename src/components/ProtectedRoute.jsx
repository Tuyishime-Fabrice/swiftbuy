import { Navigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { homeFor } from '../lib/routes'
import { Spinner, EmptyState, InlineNotice } from './UI'
import Navbar from './Navbar'
import * as Icon from './Icons'

export default function ProtectedRoute({ children, roles, requireApprovedSeller }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="page">
        <Navbar />
        <Spinner label="Checking your session" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeFor(user.role)} replace />
  }

  if (requireApprovedSeller && user.store?.status !== 'approved') {
    return (
      <div className="page">
        <Navbar />
        <main className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
          <SellerStatusNotice status={user.store?.status} reason={user.store?.statusReason} />
        </main>
      </div>
    )
  }

  return children
}

function SellerStatusNotice({ status, reason }) {
  if (!status) {
    return (
      <EmptyState
        icon={Icon.Store}
        title="You do not sell on SwiftBuy yet"
        description="Selling is something you apply for. Tell us about your store, attach a verification document, and an administrator will review it."
        action={<Link to="/sell/apply" className="btn btn-primary">Apply to sell</Link>}
      />
    )
  }

  if (status === 'pending') {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <EmptyState
          icon={Icon.Clock}
          title="Your application is awaiting review"
          description="A SwiftBuy administrator is checking your store details and verification documents. You will be notified as soon as there is a decision, and the seller tools open up then."
          action={<Link to="/sell/apply" className="btn btn-outline">View my application</Link>}
        />
      </div>
    )
  }

  if (status === 'rejected') {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <EmptyState
          icon={Icon.Alert}
          title="Your seller application was not approved"
          description="You can still shop on SwiftBuy with this account, and you can correct your details and apply again."
          action={<Link to="/sell/apply" className="btn btn-primary">Review and apply again</Link>}
        />
        {reason && <InlineNotice tone="warning" title="Reason given">{reason}</InlineNotice>}
      </div>
    )
  }

  if (status === 'suspended') {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <EmptyState
          icon={Icon.Alert}
          title="Your store is suspended"
          description="Your listings have been hidden from the marketplace. Your customer account is unaffected. Contact SwiftBuy support to resolve this."
        />
        {reason && <InlineNotice tone="warning" title="Reason given">{reason}</InlineNotice>}
      </div>
    )
  }

  return (
    <EmptyState
      icon={Icon.Store}
      title="Store not available"
      description="We could not read your store's status. Please contact SwiftBuy support."
    />
  )
}
