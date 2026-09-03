import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
      <div className="fade-up">
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 96, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>404</h1>
        <p style={{ color: 'var(--text)', fontSize: 20, fontWeight: 700, marginTop: 16 }}>Page Not Found</p>
        <p style={{ color: 'var(--text3)', marginTop: 8, marginBottom: 32 }}>The page you're looking for doesn't exist.</p>
        <Link to="/" className="btn btn-primary">Back to Shop</Link>
      </div>
    </div>
  )
}
