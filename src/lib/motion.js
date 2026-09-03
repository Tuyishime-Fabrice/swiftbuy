/**
 * The motion vocabulary.
 *
 * Every animation in SwiftBuy comes from this file so the whole product moves
 * at the same speeds. The rules it encodes:
 *
 *   - Three durations, matching the CSS custom properties: 140 / 240 / 380ms.
 *   - Only opacity and transform, which the compositor can animate without
 *     laying the page out again.
 *   - Motion confirms an action or explains where something came from. There
 *     is no decorative, looping or attention-seeking movement.
 *   - Nothing animates for a visitor who has asked for reduced motion.
 */

export const DURATION = {
  fast: 0.14,
  base: 0.24,
  slow: 0.38,
}

export const EASE = [0.22, 0.61, 0.36, 1]

/** A spring for things the user is directly manipulating. */
export const SPRING = { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DURATION.base, ease: EASE },
}

/** Content arriving: a short rise, not a slide across the screen. */
export const riseIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: DURATION.base, ease: EASE },
}

/** Page-level transition. Deliberately smaller than the content inside it. */
export const pageTransition = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: DURATION.base, ease: EASE },
}

/** Menus and popovers grow from the edge they are anchored to. */
export const popIn = {
  initial: { opacity: 0, scale: 0.96, y: -6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: -4 },
  transition: { duration: DURATION.fast, ease: EASE },
}

export const modalBackdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DURATION.fast, ease: EASE },
}

export const modalPanel = {
  initial: { opacity: 0, scale: 0.97, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 8 },
  transition: { duration: DURATION.base, ease: EASE },
}

/** The mobile drawer slides in from the edge it lives on. */
export const drawerPanel = {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
  transition: { duration: DURATION.base, ease: EASE },
}

export const toastItem = {
  initial: { opacity: 0, y: 16, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.97, transition: { duration: DURATION.fast } },
  transition: SPRING,
}

/**
 * Staggered list entry. Capped at a small delay so a full grid finishes
 * arriving quickly instead of trickling in.
 */
export const listContainer = {
  animate: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
}

export const listItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE } },
}

/** Checkout step changes move in the direction of travel. */
export function stepVariants(direction) {
  return {
    initial: { opacity: 0, x: direction >= 0 ? 24 : -24 },
    animate: { opacity: 1, x: 0, transition: { duration: DURATION.base, ease: EASE } },
    exit: { opacity: 0, x: direction >= 0 ? -20 : 20, transition: { duration: DURATION.fast } },
  }
}

/** The nudge a cart badge gives when its count changes. */
export const badgePulse = {
  initial: { scale: 0.6, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: SPRING,
}
