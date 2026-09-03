import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState, useEffect } from 'react'
import { CartService, NotificationService } from '../services/storage'

// ── Inline SVG icons (no emoji) ───────────────────────────────────────────────
const Icon = {
  Sun: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  Moon: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  Cart: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  Bell: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Menu: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  X: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  User: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Package: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Heart: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  Chat: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  LogOut: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  BarChart: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
}

const S = {
  nav: {
    position: 'sticky', top: 0, zIndex: 1000,
    background: 'var(--nav-bg)', backdropFilter: 'blur(16px)',
    borderBottom: '1px solid var(--border)',
    padding: '0 24px', height: 62,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
  },
  logo: {
    fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18,
    color: 'var(--accent)', letterSpacing: '-0.3px',
    display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, textDecoration: 'none',
  },
  logoMark: {
    width: 28, height: 28, background: 'var(--accent)', borderRadius: 7,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  links: { display: 'flex', alignItems: 'center', gap: 2 },
  link: {
    color: 'var(--text2)', fontSize: 14, padding: '6px 12px',
    borderRadius: 8, transition: 'all 0.15s', fontWeight: 500,
    textDecoration: 'none', whiteSpace: 'nowrap',
  },
  linkActive: { color: 'var(--accent)', background: 'rgba(91,76,255,0.1)' },
  right: { display: 'flex', alignItems: 'center', gap: 6 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 9,
    background: 'transparent', border: '1px solid var(--border)',
    color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s', position: 'relative', cursor: 'pointer',
  },
  avatar: {
    width: 34, height: 34, borderRadius: 9,
    background: 'var(--accent)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0, letterSpacing: '0.5px',
  },
  dropdown: {
    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '6px', minWidth: 210,
    boxShadow: '0 12px 32px rgba(0,0,0,0.25)', zIndex: 100,
  },
  dropItem: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
    borderRadius: 8, color: 'var(--text2)', fontSize: 13,
    transition: 'all 0.12s', cursor: 'pointer', width: '100%',
    background: 'transparent', border: 'none', fontFamily: 'inherit',
    textDecoration: 'none', fontWeight: 500,
  },
  badge: {
    position: 'absolute', top: -4, right: -4,
    background: 'var(--red)', color: '#fff',
    fontSize: 10, fontWeight: 700, borderRadius: 99,
    minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 3px', lineHeight: 1,
  },
}

function NavLink({ to, label, exact }) {
  const location = useLocation()
  const active = exact ? location.pathname === to : location.pathname.startsWith(to)
  return (
    <Link to={to} style={{ ...S.link, ...(active ? S.linkActive : {}) }}>{label}</Link>
  )
}

// Mobile drawer link
function DrawerLink({ to, label, icon: Ico, onClick }) {
  const location = useLocation()
  const active = location.pathname === to || location.pathname.startsWith(to + '/')
  return (
    <Link to={to} onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 16px', borderRadius: 10, textDecoration: 'none',
      background: active ? 'rgba(91,76,255,0.1)' : 'transparent',
      color: active ? 'var(--accent)' : 'var(--text2)',
      fontWeight: 500, fontSize: 15, transition: 'all 0.15s',
    }}>
      {Ico && <span style={{ opacity: 0.7 }}><Ico /></span>}
      {label}
    </Link>
  )
}

export default function Navbar() {
  const { user, logout, theme, toggleTheme } = useAuth()
  const navigate = useNavigate()
  const [dropOpen, setDropOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [notifCount, setNotifCount] = useState(0)

  useEffect(() => {
    setCartCount(CartService.count())
    if (user?.role === 'user') setNotifCount(NotificationService.unreadCount(user.id))
  })

  // Close mobile menu on route change
  const location = useLocation()
  useEffect(() => setMobileOpen(false), [location])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
    setDropOpen(false)
    setMobileOpen(false)
  }

  const initials = user ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : ''

  const roleBadgeStyle = {
    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, marginTop: 3,
    letterSpacing: '.04em', textTransform: 'uppercase', display: 'inline-block',
    ...(user?.role === 'superadmin' ? { background: 'rgba(240,165,0,0.2)', color: 'var(--yellow)' } :
        user?.role === 'admin'      ? { background: 'rgba(240,165,0,0.15)', color: 'var(--yellow)' } :
        user?.role === 'seller'     ? { background: 'rgba(91,76,255,0.15)', color: 'var(--accent-light)' } :
                                      { background: 'rgba(0,196,140,0.15)', color: 'var(--green)' })
  }

  return (
    <>
      <nav style={S.nav}>
        {/* Logo */}
        <Link to="/" style={S.logo}>
          <div style={S.logoMark}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>
          SwiftBuy
        </Link>

        {/* Desktop center links */}
        <div style={S.links} className="hide-mobile">
          {!user && <><NavLink to="/" label="Shop" exact /><NavLink to="/login" label="Sign In" /></>}
          {user?.role === 'user' && <><NavLink to="/" label="Shop" exact /><NavLink to="/wishlist" label="Wishlist" /><NavLink to="/orders" label="Orders" /></>}
          {user?.role === 'seller' && <><NavLink to="/seller" label="Orders" /><NavLink to="/seller/products" label="Products" /><NavLink to="/seller/analytics" label="Analytics" /></>}
          {(user?.role === 'admin' || user?.role === 'superadmin') && <><NavLink to="/admin" label="Dashboard" /></>}
        </div>

        {/* Right actions */}
        <div style={S.right}>
          {/* Theme toggle */}
          <button style={S.iconBtn} onClick={toggleTheme} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
            {theme === 'dark' ? <Icon.Sun /> : <Icon.Moon />}
          </button>

          {/* Cart */}
          {user?.role === 'user' && (
            <button style={S.iconBtn} onClick={() => navigate('/cart')} title="Cart">
              <Icon.Cart />
              {cartCount > 0 && <span style={S.badge}>{cartCount > 9 ? '9+' : cartCount}</span>}
            </button>
          )}

          {/* Notifications */}
          {user?.role === 'user' && (
            <button style={S.iconBtn} onClick={() => navigate('/notifications')} title="Notifications">
              <Icon.Bell />
              {notifCount > 0 && <span style={S.badge}>{notifCount > 9 ? '9+' : notifCount}</span>}
            </button>
          )}

          {/* CTA for guests */}
          {!user && (
            <Link to="/register" className="btn btn-primary btn-sm hide-mobile">Get Started</Link>
          )}

          {/* Desktop user menu */}
          {user && (
            <div style={{ position: 'relative' }} className="hide-mobile">
              <div style={S.avatar} onClick={() => setDropOpen(o => !o)} title={user.name}>{initials}</div>
              {dropOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setDropOpen(false)} />
                  <div style={S.dropdown}>
                    <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                      <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 14 }}>{user.name}</p>
                      <p style={{ color: 'var(--text3)', fontSize: 12 }}>{user.email}</p>
                      <span style={roleBadgeStyle}>{user.role}</span>
                    </div>
                    <Link to="/profile" style={S.dropItem} onClick={() => setDropOpen(false)}><Icon.User /> My Profile</Link>
                    {user.role === 'user' && <>
                      <Link to="/orders" style={S.dropItem} onClick={() => setDropOpen(false)}><Icon.Package /> My Orders</Link>
                      <Link to="/wishlist" style={S.dropItem} onClick={() => setDropOpen(false)}><Icon.Heart /> Wishlist</Link>
                    </>}
                    {user.role === 'seller' && (
                      <Link to="/seller/chats" style={S.dropItem} onClick={() => setDropOpen(false)}><Icon.Chat /> Customer Chats</Link>
                    )}
                    <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                    <button style={{ ...S.dropItem, color: 'var(--red)' }} onClick={handleLogout}><Icon.LogOut /> Sign Out</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Mobile hamburger */}
          <button style={{ ...S.iconBtn, display: 'none' }} className="show-mobile" onClick={() => setMobileOpen(o => !o)}>
            {mobileOpen ? <Icon.X /> : <Icon.Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', flexDirection: 'column' }}>
          {/* Backdrop */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setMobileOpen(false)} />

          {/* Drawer */}
          <div style={{
            position: 'absolute', top: 62, right: 0, width: '100%', maxWidth: 320,
            background: 'var(--card)', borderLeft: '1px solid var(--border)',
            height: 'calc(100vh - 62px)', overflowY: 'auto',
            padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {user && (
              <div style={{ padding: '12px 16px', background: 'var(--card2)', borderRadius: 12, marginBottom: 8 }}>
                <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15 }}>{user.name}</p>
                <p style={{ color: 'var(--text3)', fontSize: 12 }}>{user.email}</p>
                <span style={roleBadgeStyle}>{user.role}</span>
              </div>
            )}

            {!user && <><DrawerLink to="/" label="Shop" icon={null} onClick={() => setMobileOpen(false)} /><DrawerLink to="/login" label="Sign In" onClick={() => setMobileOpen(false)} /><DrawerLink to="/register" label="Create Account" onClick={() => setMobileOpen(false)} /></>}

            {user?.role === 'user' && <>
              <DrawerLink to="/" label="Shop" onClick={() => setMobileOpen(false)} />
              <DrawerLink to="/wishlist" label="Wishlist" icon={Icon.Heart} onClick={() => setMobileOpen(false)} />
              <DrawerLink to="/orders" label="My Orders" icon={Icon.Package} onClick={() => setMobileOpen(false)} />
              <DrawerLink to="/cart" label={`Cart${cartCount > 0 ? ` (${cartCount})` : ''}`} icon={Icon.Cart} onClick={() => setMobileOpen(false)} />
              <DrawerLink to="/notifications" label={`Notifications${notifCount > 0 ? ` (${notifCount})` : ''}`} icon={Icon.Bell} onClick={() => setMobileOpen(false)} />
            </>}

            {user?.role === 'seller' && <>
              <DrawerLink to="/seller" label="Orders" icon={Icon.Package} onClick={() => setMobileOpen(false)} />
              <DrawerLink to="/seller/products" label="My Products" onClick={() => setMobileOpen(false)} />
              <DrawerLink to="/seller/analytics" label="Analytics" icon={Icon.BarChart} onClick={() => setMobileOpen(false)} />
              <DrawerLink to="/seller/chats" label="Customer Chats" icon={Icon.Chat} onClick={() => setMobileOpen(false)} />
            </>}

            {(user?.role === 'admin' || user?.role === 'superadmin') && (
              <DrawerLink to="/admin" label="Admin Dashboard" onClick={() => setMobileOpen(false)} />
            )}

            {user && <>
              <DrawerLink to="/profile" label="My Profile" icon={Icon.User} onClick={() => setMobileOpen(false)} />
              <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
              <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderRadius: 10, background: 'transparent', border: 'none', color: 'var(--red)', fontWeight: 500, fontSize: 15, cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}>
                <Icon.LogOut /> Sign Out
              </button>
            </>}
          </div>
        </div>
      )}
    </>
  )
}
