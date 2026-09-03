import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toastItem } from '../lib/motion'
import * as Icon from '../components/Icons'
import { ToastContext } from './toast-context'

/**
 * Transient feedback.
 *
 * The region is a polite live region, so a screen reader announces the message
 * without interrupting; errors are assertive because they usually mean the
 * thing the person just tried did not happen.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback((message, tone = 'info', { duration } = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    // Errors linger: they usually need reading, not glancing at.
    const life = duration ?? (tone === 'error' ? 6000 : 3600)

    setToasts((current) => [...current.slice(-3), { id, message, tone }])
    timers.current.set(id, setTimeout(() => dismiss(id), life))
    return id
  }, [dismiss])

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach(clearTimeout)
      pending.clear()
    }
  }, [])

  const value = useMemo(
    () => ({
      toast,
      success: (message, options) => toast(message, 'success', options),
      error: (message, options) => toast(message, 'error', options),
      info: (message, options) => toast(message, 'info', options),
      dismiss,
    }),
    [toast, dismiss]
  )

  const glyph = { success: Icon.Check, error: Icon.Alert, info: Icon.Info }
  const colour = { success: 'var(--success)', error: 'var(--danger)', info: 'var(--accent-soft)' }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="region" aria-label="Notifications">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Glyph = glyph[t.tone] ?? Icon.Info
            return (
              <motion.output
                key={t.id}
                {...toastItem}
                layout
                className={`toast toast-${t.tone}`}
                aria-live={t.tone === 'error' ? 'assertive' : 'polite'}
              >
                <span style={{ color: colour[t.tone], display: 'flex', marginTop: 1 }}>
                  <Glyph size={17} />
                </span>
                <span style={{ flex: 1 }}>{t.message}</span>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss notification"
                  style={{ color: 'var(--text-subtle)', display: 'flex', marginTop: 1 }}
                >
                  <Icon.Close size={15} />
                </button>
              </motion.output>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

