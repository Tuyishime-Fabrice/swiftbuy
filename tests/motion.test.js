import { describe, it, expect } from 'vitest'
import {
  DURATION, fadeIn, riseIn, pageTransition, popIn, modalPanel, drawerPanel,
  listItem, stepVariants, toastItem,
} from '../src/lib/motion'

const PRESETS = { fadeIn, riseIn, pageTransition, popIn, modalPanel, drawerPanel, toastItem }

const ALLOWED = new Set(['opacity', 'x', 'y', 'scale', 'rotate', 'height', 'transition'])

describe('the motion vocabulary', () => {
  it('uses three speeds and nothing slower', () => {
    expect(Object.values(DURATION)).toEqual([0.14, 0.24, 0.38])
    for (const duration of Object.values(DURATION)) {
      expect(duration).toBeLessThanOrEqual(0.45)
    }
  })

  it('animates only properties the compositor can handle', () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      for (const phase of ['initial', 'animate', 'exit']) {
        for (const property of Object.keys(preset[phase] ?? {})) {
          expect(ALLOWED.has(property), `${name}.${phase} animates ${property}`).toBe(true)
        }
      }
    }
  })

  it('keeps every preset within the slowest allowed duration', () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      const duration = preset.transition?.duration
      if (duration == null) continue
      expect(duration, `${name} is too slow`).toBeLessThanOrEqual(DURATION.slow)
    }
  })

  it('moves content a short distance, not across the screen', () => {
    expect(Math.abs(riseIn.initial.y)).toBeLessThanOrEqual(16)
    expect(Math.abs(pageTransition.initial.y)).toBeLessThanOrEqual(16)
    expect(Math.abs(listItem.initial.y)).toBeLessThanOrEqual(16)
  })

  it('never fully collapses or wildly overshoots a scale', () => {
    for (const preset of [popIn, modalPanel, toastItem]) {
      for (const phase of ['initial', 'animate', 'exit']) {
        const scale = preset[phase]?.scale
        if (scale == null) continue
        expect(scale).toBeGreaterThanOrEqual(0.9)
        expect(scale).toBeLessThanOrEqual(1.05)
      }
    }
  })
})

describe('checkout step transitions', () => {
  it('moves forwards and backwards in the direction of travel', () => {
    expect(stepVariants(1).initial.x).toBeGreaterThan(0)
    expect(stepVariants(1).exit.x).toBeLessThan(0)
    expect(stepVariants(-1).initial.x).toBeLessThan(0)
    expect(stepVariants(-1).exit.x).toBeGreaterThan(0)
  })

  it('always lands the step at rest', () => {
    for (const direction of [1, -1]) {
      expect(stepVariants(direction).animate).toMatchObject({ opacity: 1, x: 0 })
    }
  })
})
