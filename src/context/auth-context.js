import { createContext, useContext } from 'react'

/**
 * The auth context object and its hook, separated from the provider component
 * so that importing `useAuth` does not pull a component into the module graph.
 */
export const AuthContext = createContext(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')
  return context
}
