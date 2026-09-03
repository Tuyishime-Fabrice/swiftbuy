import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, role, roles }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />

  const allowed = roles || (role ? [role] : null)
  if (allowed && !allowed.includes(user.role)) {
    if (user.role === 'superadmin' || user.role === 'admin') return <Navigate to="/admin" replace />
    if (user.role === 'seller') return <Navigate to="/seller" replace />
    return <Navigate to="/" replace />
  }
  return children
}
