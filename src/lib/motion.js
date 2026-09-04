export const DURATION = {
  fast: 0.14,
  base: 0.24,
  slow: 0.38,
}

export const EASE = [0.22, 0.61, 0.36, 1]

export const SPRING = { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DURATION.base, ease: EASE },
}

export const riseIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: DURATION.base, ease: EASE },
}

export const pageTransition = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: DURATION.base, ease: EASE },
}

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

export const listContainer = {
  animate: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
}

export const listItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE } },
}

export function stepVariants(direction) {
  return {
    initial: { opacity: 0, x: direction >= 0 ? 24 : -24 },
    animate: { opacity: 1, x: 0, transition: { duration: DURATION.base, ease: EASE } },
    exit: { opacity: 0, x: direction >= 0 ? -20 : 20, transition: { duration: DURATION.fast } },
  }
}

export const badgePulse = {
  initial: { scale: 0.6, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: SPRING,
}
