import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import Navbar from '../components/Navbar'
import { pageTransition } from '../lib/motion'
import * as Icon from '../components/Icons'

const LINKS = [
  { to: '/seller', label: 'Orders', icon: Icon.Package, end: true },
  { to: '/seller/products', label: 'Products', icon: Icon.Store },
  { to: '/seller/analytics', label: 'Analytics', icon: Icon.Chart },
  { to: '/seller/chats', label: 'Messages', icon: Icon.Chat },
  { to: '/seller/store', label: 'Store settings', icon: Icon.Settings },
]

export default function SellerLayout({ title, children }) {
  useEffect(() => {
    document.title = title ? `${title} · SwiftBuy Seller` : 'SwiftBuy Seller'
  }, [title])

  return (
    <div className="page">
      <Navbar />

      <div
        className="container"
        style={{ flex: 1, paddingTop: 20, paddingBottom: 48 }}
      >

        <nav aria-label="Seller sections" className="only-mobile scroll-x" style={{ marginBottom: 16 }}>
          <div style={{ display: 'inline-flex', gap: 6, minWidth: 'max-content', paddingBottom: 4 }}>
            {LINKS.map(({ to, label, icon: Glyph, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className="chip"
                style={({ isActive }) => ({
                  background: isActive ? 'var(--accent-wash)' : 'var(--surface)',
                  borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                  color: isActive ? 'var(--accent-soft)' : 'var(--text-muted)',
                  gap: 7,
                })}
              >
                <Glyph size={15} /> {label}
              </NavLink>
            ))}
          </div>
        </nav>

        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        <nav
          aria-label="Seller sections"
          className="only-desktop"
          style={{
            width: 196, flexShrink: 0, flexDirection: 'column', gap: 2,
            position: 'sticky', top: 'calc(var(--nav-height) + 20px)',
          }}
        >
          <p
            style={{
              fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: 'var(--text-subtle)',
              padding: '0 12px', marginBottom: 8,
            }}
          >
            Seller panel
          </p>
          {LINKS.map((link) => (
            <RailLink key={link.to} {...link} />
          ))}
        </nav>

        <motion.main
          {...pageTransition}
          id="main"
          tabIndex={-1}
          style={{ flex: 1, minWidth: 0, outline: 'none' }}
        >
          {children}
        </motion.main>
        </div>
      </div>
    </div>
  )
}

function RailLink({ to, label, icon: Glyph, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 'var(--radius)',
        fontSize: '0.875rem', fontWeight: isActive ? 600 : 500,
        color: isActive ? 'var(--accent-soft)' : 'var(--text-muted)',
        background: isActive ? 'var(--accent-wash)' : 'transparent',
      })}
    >
      <Glyph size={17} /> {label}
    </NavLink>
  )
}
