import { useReducedMotion as useFramerReducedMotion } from 'framer-motion'

/**
 * Whether this visitor has asked their system for reduced motion.
 *
 * Framer Motion already suppresses transform animations when the preference is
 * set; this hook exposes the same signal so components can also drop things
 * Framer cannot know about — an auto-scroll, a staggered reveal, a transition
 * between checkout steps.
 */
export function useReducedMotion() {
  return useFramerReducedMotion() ?? false
}

/** Scroll behaviour that respects the preference. */
export function scrollBehavior(reduced) {
  return reduced ? 'auto' : 'smooth'
}
