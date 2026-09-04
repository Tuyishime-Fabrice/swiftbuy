import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { pageTransition } from '../lib/motion'
import * as Icon from '../components/Icons'

export default function AuthLayout({ title, subtitle, children, footer, width = 440 }) {
  useEffect(() => {
    document.title = title ? `${title} · SHOP MUMU` : 'SHOP MUMU'
  }, [title])

  return (
    <motion.main
      {...pageTransition}
      id="main"
      tabIndex={-1}
      style={{
        minHeight: '100dvh', display: 'grid', placeItems: 'center',
        padding: '32px 16px', background: 'var(--bg)', outline: 'none',
      }}
    >
      <div style={{ width: '100%', maxWidth: width }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <Link
            to="/"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}
            aria-label="SHOP MUMU home"
          >
            <span
              style={{
                width: 32, height: 32, borderRadius: 9, background: 'var(--accent)',
                display: 'grid', placeItems: 'center', color: '#fff',
              }}
            >
              <Icon.Bolt size={18} />
            </span>
            <span
              style={{
                fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.3rem',
                letterSpacing: '-0.02em',
              }}
            >
              SHOP MUMU
            </span>
          </Link>
          <h1 style={{ fontSize: '1.25rem', marginTop: 18 }}>{title}</h1>
          {subtitle && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', marginTop: 6 }}>
              {subtitle}
            </p>
          )}
        </div>

        <div className="card">{children}</div>

        {footer && (
          <p style={{ textAlign: 'center', marginTop: 18, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {footer}
          </p>
        )}
      </div>
    </motion.main>
  )
}
