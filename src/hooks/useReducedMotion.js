import { useReducedMotion as useFramerReducedMotion } from 'framer-motion'

export function useReducedMotion() {
  return useFramerReducedMotion() ?? false
}

export function scrollBehavior(reduced) {
  return reduced ? 'auto' : 'smooth'
}
