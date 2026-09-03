import { Link } from 'react-router-dom'
import PageShell from '../layouts/PageShell'
import { EmptyState } from '../components/UI'
import * as Icon from '../components/Icons'

export default function NotFound() {
  return (
    <PageShell title="Page not found">
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '52vh' }}>
        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              fontFamily: "'Syne', sans-serif", fontSize: 'clamp(3rem, 12vw, 5rem)',
              fontWeight: 800, color: 'var(--accent)', lineHeight: 1,
            }}
          >
            404
          </p>
          <EmptyState
            icon={Icon.Search}
            title="We couldn't find that page"
            description="The link may be out of date, or the page may have moved."
            action={<Link to="/" className="btn btn-primary">Back to the shop</Link>}
          />
        </div>
      </div>
    </PageShell>
  )
}
