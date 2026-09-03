/**
 * Where each role belongs after signing in, and where a guard sends someone who
 * has wandered somewhere their account cannot use.
 *
 * Kept out of the component files so it can be imported without dragging a
 * component along with it.
 */
export function homeFor(role) {
  if (role === 'admin' || role === 'superadmin') return '/admin'
  if (role === 'seller') return '/seller'
  return '/'
}
