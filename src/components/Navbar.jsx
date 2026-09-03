import { useState, useEffect, useCallback } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../context/auth-context'
import { CartService } from '../services/commerce'
import { NotificationService } from '../services/messaging'
import { popIn, drawerPanel, modalBackdrop, badgePulse } from '../lib/motion'
import { initials } from '../utils/format'
import * as Icon from './Icons'

/**
 * The application header.
 *
 * Keeps SwiftBuy's original shape — logo left, primary links centre, actions
 * right, hamburger drawer on mobile — and fixes the things that were wrong
 * underneath: the counters now come from the database for the signed-in user
 * (and update live over Realtime) instead of being recomputed from
 * localStorage on every render.
 */

function Badge({ count }) {
  if (!count) return null
  return (
    <motion.span
      key={count}
      {...badgePulse}
      aria-hidden="true"
      style={{
        position: 'absolute', top: 2, right: 2, minWidth: 17, height: 17,
        padding: '0 4px', borderRadius: 'var(--radius-pill)',
        background: 'var(--danger)', color: '#fff',
        fontSize: '0.625rem', fontWeight: 700, lineHeight: '17px', textAlign: 'center',
      }}
    >
      {count > 9 ? '9+' : count}
    </motion.span>
  )
}

function TopLink({ to, children, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        padding: '8px 13px',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.875rem',
        fontWeight: 500,
        color: isActive ? 'var(--accent-soft)' : 'var(--text-muted)',
        background: isActive ? 'var(--accent-wash)' : 'transparent',
        whiteSpace: 'nowrap',
      })}
    >
      {children}
    </NavLink>
  )
}

function DrawerLink({ to, icon: Glyph, children, onNavigate, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '13px 14px', borderRadius: 'var(--radius)',
        fontSize: '0.9375rem', fontWeight: 500, minHeight: 48,
        color: isActive ? 'var(--accent-soft)' : 'var(--text-muted)',
        background: isActive ? 'var(--accent-wash)' : 'transparent',
      })}
    >
      {Glyph && <Glyph size={18} />}
      {children}
    </NavLink>
  )
}

export default function Navbar() {
  const { user, signOut, theme, toggleTheme, isCustomer, isSeller, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Menus are stamped with the route they were opened on, so navigating away
  // closes them by derivation instead of an effect that writes state on every
  // route change.
  const [openMenu, setOpenMenu] = useState({ path: null, which: null })
  const menuOpen = openMenu.which === 'account' && openMenu.path === location.pathname
  const drawerOpen = openMenu.which === 'drawer' && openMenu.path === location.pathname
  const closeMenus = useCallback(() => setOpenMenu({ path: null, which: null }), [])

  const [counters, setCounters] = useState({ cart: 0, unread: 0 })
  const { cart: cartCount, unread } = counters

  const fetchCounters = useCallback(async () => {
    if (!user) return { cart: 0, unread: 0 }
    const [cart, unread] = await Promise.all([
      isCustomer ? CartService.count(user.id) : Promise.resolve(0),
      NotificationService.unreadCount(user.id),
    ])
    return { cart, unread }
  }, [user, isCustomer])

  // Recount on navigation: adding to the cart from one page and then moving is
  // the common case, and this is far cheaper than polling.
  useEffect(() => {
    let cancelled = false
    fetchCounters().then((next) => { if (!cancelled) setCounters(next) })
    return () => { cancelled = true }
  }, [fetchCounters, location.pathname])

  // New notifications arrive over Realtime, so the bell is live.
  useEffect(() => {
    if (!user) return undefined
    return NotificationService.subscribe(user.id, () => {
      setCounters((current) => ({ ...current, unread: current.unread + 1 }))
    })
  }, [user])

  // The page behind the drawer must not scroll while it is open.
  useEffect(() => {
    if (!drawerOpen) return undefined
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow }
  }, [drawerOpen])

  const handleSignOut = async () => {
    closeMenus()
    await signOut()
    navigate('/login')
  }

  const closeDrawer = closeMenus

  return (
    <>
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 900,
          height: 'var(--nav-height)',
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(14px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <nav
          aria-label="Main"
          className="container"
          style={{
            height: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 12,
          }}
        >
          <Link
            to="/"
            style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}
            aria-label="SwiftBuy home"
          >
            <span
              style={{
                width: 28, height: 28, borderRadius: 8, background: 'var(--accent)',
                display: 'grid', placeItems: 'center', color: '#fff',
              }}
            >
              <Icon.Bolt size={16} />
            </span>
            <span
              style={{
                fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.0625rem',
                letterSpacing: '-0.02em', color: 'var(--text)',
              }}
            >
              SwiftBuy
            </span>
          </Link>

          <div className="only-desktop" style={{ alignItems: 'center', gap: 2 }}>
            <TopLink to="/" end>Shop</TopLink>
            {isCustomer && <>
              <TopLink to="/orders">Orders</TopLink>
              <TopLink to="/wishlist">Wishlist</TopLink>
              <TopLink to="/messages">Messages</TopLink>
            </>}
            {isSeller && <>
              <TopLink to="/seller" end>Orders</TopLink>
              <TopLink to="/seller/products">Products</TopLink>
              <TopLink to="/seller/analytics">Analytics</TopLink>
              <TopLink to="/seller/chats">Messages</TopLink>
            </>}
            {isAdmin && <TopLink to="/admin">Admin</TopLink>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              className="icon-btn"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Icon.Sun size={18} /> : <Icon.Moon size={18} />}
            </button>

            {isCustomer && (
              <Link to="/cart" className="icon-btn" aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}>
                <Icon.Cart size={18} />
                <AnimatePresence><Badge count={cartCount} /></AnimatePresence>
              </Link>
            )}

            {user && (
              <Link
                to="/notifications"
                className="icon-btn"
                aria-label={`Notifications, ${unread} unread`}
              >
                <Icon.Bell size={18} />
                <AnimatePresence><Badge count={unread} /></AnimatePresence>
              </Link>
            )}

            {!user && (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm only-desktop">Sign in</Link>
                <Link to="/register" className="btn btn-primary btn-sm">Get started</Link>
              </>
            )}

            {user && (
              <div className="only-desktop" style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() =>
                setOpenMenu((current) =>
                  current.which === 'account' ? { path: null, which: null }
                    : { path: location.pathname, which: 'account' }
                )}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  aria-label={`Account menu for ${user.name}`}
                  style={{
                    width: 34, height: 34, borderRadius: 'var(--radius-sm)',
                    background: 'var(--accent)', color: '#fff',
                    fontSize: '0.75rem', fontWeight: 700, display: 'grid', placeItems: 'center',
                  }}
                >
                  {initials(user.name)}
                </button>

                <AnimatePresence>
                  {menuOpen && (
                    <>
                      <div
                        style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                        onClick={closeMenus}
                        aria-hidden="true"
                      />
                      <motion.div
                        {...popIn}
                        role="menu"
                        style={{
                          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 20,
                          minWidth: 226, padding: 6, transformOrigin: 'top right',
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
                        }}
                      >
                        <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                          <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{user.name}</p>
                          <p style={{ color: 'var(--text-subtle)', fontSize: '0.75rem' }}>{user.email}</p>
                          <span className="badge badge-accent" style={{ marginTop: 6 }}>
                            {user.role === 'seller' && user.store
                              ? `Seller · ${user.store.status}`
                              : user.role}
                          </span>
                        </div>

                        <MenuLink to="/profile" icon={Icon.User}>My profile</MenuLink>
                        {isCustomer && <MenuLink to="/orders" icon={Icon.Package}>My orders</MenuLink>}
                        {isSeller && <MenuLink to="/seller/store" icon={Icon.Store}>Store settings</MenuLink>}
                        {isAdmin && <MenuLink to="/admin" icon={Icon.Shield}>Admin dashboard</MenuLink>}

                        <hr className="divider" style={{ margin: '4px 0' }} />
                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleSignOut}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                            padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                            fontSize: '0.875rem', color: 'var(--danger)',
                          }}
                        >
                          <Icon.LogOut size={16} /> Sign out
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}

            <button
              type="button"
              className="icon-btn only-mobile"
              onClick={() => setOpenMenu({ path: location.pathname, which: 'drawer' })}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
            >
              <Icon.Menu size={20} />
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              {...modalBackdrop}
              onClick={closeDrawer}
              style={{ position: 'fixed', inset: 0, zIndex: 950, background: 'var(--overlay)' }}
              aria-hidden="true"
            />
            <motion.div
              {...drawerPanel}
              role="dialog"
              aria-label="Menu"
              aria-modal="true"
              style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 960,
                width: 'min(320px, 86vw)', background: 'var(--surface)',
                borderLeft: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
                display: 'flex', flexDirection: 'column',
                overflowY: 'auto', padding: 12,
              }}
            >
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '4px 4px 12px',
                }}
              >
                <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800 }}>Menu</span>
                <button type="button" className="icon-btn" onClick={closeDrawer} aria-label="Close menu">
                  <Icon.Close size={20} />
                </button>
              </div>

              {user && (
                <div className="panel" style={{ marginBottom: 10 }}>
                  <p style={{ fontWeight: 600 }}>{user.name}</p>
                  <p style={{ color: 'var(--text-subtle)', fontSize: '0.8125rem' }}>{user.email}</p>
                  <span className="badge badge-accent" style={{ marginTop: 6 }}>
                    {user.role === 'seller' && user.store ? `Seller · ${user.store.status}` : user.role}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <DrawerLink to="/" icon={Icon.Store} onNavigate={closeDrawer} end>Shop</DrawerLink>

                {isCustomer && <>
                  <DrawerLink to="/cart" icon={Icon.Cart} onNavigate={closeDrawer}>
                    Cart{cartCount > 0 ? ` (${cartCount})` : ''}
                  </DrawerLink>
                  <DrawerLink to="/orders" icon={Icon.Package} onNavigate={closeDrawer}>My orders</DrawerLink>
                  <DrawerLink to="/wishlist" icon={Icon.Heart} onNavigate={closeDrawer}>Wishlist</DrawerLink>
                  <DrawerLink to="/messages" icon={Icon.Chat} onNavigate={closeDrawer}>Messages</DrawerLink>
                </>}

                {isSeller && <>
                  <DrawerLink to="/seller" icon={Icon.Package} onNavigate={closeDrawer} end>Orders</DrawerLink>
                  <DrawerLink to="/seller/products" icon={Icon.Store} onNavigate={closeDrawer}>Products</DrawerLink>
                  <DrawerLink to="/seller/analytics" icon={Icon.Chart} onNavigate={closeDrawer}>Analytics</DrawerLink>
                  <DrawerLink to="/seller/chats" icon={Icon.Chat} onNavigate={closeDrawer}>Messages</DrawerLink>
                  <DrawerLink to="/seller/store" icon={Icon.Settings} onNavigate={closeDrawer}>Store settings</DrawerLink>
                </>}

                {isAdmin && (
                  <DrawerLink to="/admin" icon={Icon.Shield} onNavigate={closeDrawer}>Admin dashboard</DrawerLink>
                )}

                {user && <>
                  <DrawerLink to="/notifications" icon={Icon.Bell} onNavigate={closeDrawer}>
                    Notifications{unread > 0 ? ` (${unread})` : ''}
                  </DrawerLink>
                  <DrawerLink to="/profile" icon={Icon.User} onNavigate={closeDrawer}>My profile</DrawerLink>
                </>}

                {!user && <>
                  <DrawerLink to="/login" icon={Icon.User} onNavigate={closeDrawer}>Sign in</DrawerLink>
                  <DrawerLink to="/register" icon={Icon.Plus} onNavigate={closeDrawer}>Create account</DrawerLink>
                </>}
              </div>

              {user && (
                <>
                  <hr className="divider" style={{ margin: '10px 0' }} />
                  <button
                    type="button"
                    onClick={handleSignOut}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px',
                      borderRadius: 'var(--radius)', color: 'var(--danger)',
                      fontSize: '0.9375rem', fontWeight: 500, minHeight: 48,
                    }}
                  >
                    <Icon.LogOut size={18} /> Sign out
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function MenuLink({ to, icon: Glyph, children }) {
  return (
    <Link
      to={to}
      role="menuitem"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 'var(--radius-sm)',
        fontSize: '0.875rem', color: 'var(--text-muted)',
      }}
    >
      <Glyph size={16} /> {children}
    </Link>
  )
}
