export function homeFor(role) {
  if (role === 'admin' || role === 'superadmin') return '/admin'
  return '/'
}
