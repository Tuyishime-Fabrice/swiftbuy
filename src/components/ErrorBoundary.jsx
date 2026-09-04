import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[swiftbuy] render error:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div
        className="page"
        style={{ display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}
      >
        <div style={{ maxWidth: 460 }}>
          <h1 style={{ marginBottom: 10 }}>This page hit a problem</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 22 }}>
            Something went wrong while displaying this page. Reloading usually fixes it — if it
            keeps happening, please let us know what you were doing at the time.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload the page
            </button>
            <a className="btn btn-outline" href="/">Back to the shop</a>
          </div>
          {import.meta.env.DEV && (
            <pre
              style={{
                marginTop: 24, padding: 14, textAlign: 'left', fontSize: '0.75rem',
                background: 'var(--bg-sunk)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', overflowX: 'auto', color: 'var(--danger)',
              }}
            >
              {String(this.state.error?.stack ?? this.state.error)}
            </pre>
          )}
        </div>
      </div>
    )
  }
}
