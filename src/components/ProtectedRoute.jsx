import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { homeFor } from '../lib/routes'
import { Spinner, EmptyState, InlineNotice } from './UI'
import Navbar from './Navbar'
import * as Icon from './Icons'

/**
 * Route guarding.
 *
 * This is a user-experience control, not a security control. It stops people
 * landing on a page that cannot work for them and sends them somewhere useful.
 * The actual permission decision for every piece of data behind these routes
 * is made by Row Level Security in PostgreSQL, so someone who edits their way
 * past this component reaches a page whose queries return nothing.
 */
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
    // Remember where they were headed so sign-in can return them there.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeFor(user.role)} replace />
  }

  // A seller whose store is not approved keeps their account and their
  // dashboard shell, but the pages that would list products explain the state
  // rather than failing with a permission error from the database.
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
  if (status === 'pending') {
    return (
      <EmptyState
        icon={Icon.Clock}
        title="Your store is awaiting review"
        description="A SwiftBuy administrator is reviewing your application. You will be notified as soon as it is approved, and you can start listing products then."
      />
    )
  }

  if (status === 'rejected') {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <EmptyState
          icon={Icon.Alert}
          title="Your seller application was not approved"
          description="You can still shop on SwiftBuy with this account."
        />
        {reason && (
          <InlineNotice tone="warning" title="Reason given">{reason}</InlineNotice>
        )}
      </div>
    )
  }

  if (status === 'suspended') {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <EmptyState
          icon={Icon.Alert}
          title="Your store is suspended"
          description="Your listings have been hidden from the marketplace. Contact SwiftBuy support to resolve this."
        />
        {reason && <InlineNotice tone="warning" title="Reason given">{reason}</InlineNotice>}
      </div>
    )
  }

  return (
    <EmptyState
      icon={Icon.Store}
      title="Store not set up"
      description="We could not find a store on this account. Please contact SwiftBuy support."
    />
  )
}

