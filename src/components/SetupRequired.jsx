import * as Icon from './Icons'

export default function SetupRequired() {
  return (
    <div className="page" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card" style={{ maxWidth: 560 }}>
        <div
          style={{
            width: 44, height: 44, borderRadius: 'var(--radius)',
            background: 'var(--warning-wash)', color: 'var(--warning)',
            display: 'grid', placeItems: 'center', marginBottom: 16,
          }}
        >
          <Icon.Settings size={22} />
        </div>

        <h1 style={{ fontSize: '1.35rem', marginBottom: 8 }}>SHOP MUMU is not connected yet</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
          The app needs a Supabase project before it can sign anyone in or show a catalogue.
          Add these to a <code>.env</code> file in the project root and restart the dev server:
        </p>

        <pre
          style={{
            padding: 14, borderRadius: 'var(--radius)', background: 'var(--bg-sunk)',
            border: '1px solid var(--border)', fontSize: '0.8125rem',
            overflowX: 'auto', color: 'var(--text-muted)', marginBottom: 20,
          }}
        >
{`VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your anon key>`}
        </pre>

        <p style={{ color: 'var(--text-subtle)', fontSize: '0.875rem' }}>
          Both values are on the API page of your Supabase project settings. The full
          walkthrough — including running the migrations and creating the storage buckets —
          is in the project README.
        </p>
      </div>
    </div>
  )
}
