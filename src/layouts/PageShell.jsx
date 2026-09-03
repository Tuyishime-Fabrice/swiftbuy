import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { pageTransition } from '../lib/motion'
import * as Icon from '../components/Icons'

/**
 * The standard page frame: header, an animated main region and the footer.
 *
 * It also owns the document title, so every route sets one without repeating
 * the same effect, and gives `main` an id for the skip link to target.
 */
export default function PageShell({ title, children, footer = true, width = 'default' }) {
  useEffect(() => {
    document.title = title ? `${title} · SwiftBuy` : 'SwiftBuy'
  }, [title])

  const containerClass =
    width === 'narrow' ? 'container container-narrow' :
    width === 'full' ? 'container' :
    'container'

  return (
    <div className="page">
      <Navbar />
      <motion.main
        {...pageTransition}
        id="main"
        tabIndex={-1}
        className={containerClass}
        style={{ flex: 1, paddingTop: 24, paddingBottom: 48, outline: 'none' }}
      >
        {children}
      </motion.main>
      {footer && <SiteFooter />}
    </div>
  )
}

/**
 * A bare frame for pages that manage their own full-height layout — the chat
 * screens, mainly, which need the message list to fill the viewport.
 */
export function BarePageShell({ title, children }) {
  useEffect(() => {
    document.title = title ? `${title} · SwiftBuy` : 'SwiftBuy'
  }, [title])

  return (
    <div className="page">
      <Navbar />
      <motion.main
        {...pageTransition}
        id="main"
        tabIndex={-1}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, outline: 'none' }}
      >
        {children}
      </motion.main>
    </div>
  )
}

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-sunk)' }}>
      <div className="container" style={{ paddingTop: 32, paddingBottom: 28 }}>
        <div
          style={{
            display: 'grid', gap: 24,
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            marginBottom: 24,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  width: 24, height: 24, borderRadius: 6, background: 'var(--accent)',
                  display: 'grid', placeItems: 'center', color: '#fff',
                }}
              >
                <Icon.Bolt size={14} />
              </span>
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800 }}>SwiftBuy</span>
            </div>
            <p style={{ color: 'var(--text-subtle)', fontSize: '0.8125rem', maxWidth: 260 }}>
              A marketplace for Rwandan sellers and the people who buy from them.
            </p>
          </div>

          <FooterColumn title="Shop">
            <FooterLink to="/">Browse products</FooterLink>
            <FooterLink to="/wishlist">Wishlist</FooterLink>
            <FooterLink to="/orders">Track an order</FooterLink>
          </FooterColumn>

          <FooterColumn title="Sell">
            <FooterLink to="/register">Open a store</FooterLink>
            <FooterLink to="/seller">Seller dashboard</FooterLink>
          </FooterColumn>

          <FooterColumn title="Account">
            <FooterLink to="/login">Sign in</FooterLink>
            <FooterLink to="/profile">My profile</FooterLink>
            <FooterLink to="/notifications">Notifications</FooterLink>
          </FooterColumn>
        </div>

        <div
          style={{
            borderTop: '1px solid var(--border)', paddingTop: 16,
            display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
            color: 'var(--text-subtle)', fontSize: '0.8125rem',
          }}
        >
          <p>© {year} SwiftBuy Rwanda</p>
          <p>Prices in Rwandan francs (RWF)</p>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ title, children }) {
  return (
    <div>
      <p
        style={{
          fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10,
        }}
      >
        {title}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{children}</div>
    </div>
  )
}

function FooterLink({ to, children }) {
  return (
    <Link to={to} style={{ color: 'var(--text-subtle)', fontSize: '0.875rem' }}>
      {children}
    </Link>
  )
}
