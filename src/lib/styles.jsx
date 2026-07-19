export const GlobalStyles = () => (
  <style>{`
    body {
      background: var(--bg-page-gradient);
      color: var(--text-main);
      font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
    }

    /* [data-bottom-nav] — styles the mobile bottom nav bar */
    [data-bottom-nav] {
      background: var(--bg-bottom-nav);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding-bottom: env(safe-area-inset-bottom);
    }
  `}</style>
)

const STATUS_STYLES = {
  new:        { background: 'var(--badge-new-bg)',    color: 'var(--badge-new-text)',    borderColor: 'var(--badge-new-border)' },
  viewed:     { background: 'var(--badge-viewed-bg)', color: 'var(--badge-viewed-text)', borderColor: 'var(--badge-viewed-border)' },
  customized: { background: 'var(--badge-cust-bg)',   color: 'var(--badge-cust-text)',   borderColor: 'var(--badge-cust-border)' },
  applied:    { background: 'var(--badge-app-bg)',    color: 'var(--badge-app-text)',    borderColor: 'var(--badge-app-border)' },
  interview:  { background: 'var(--badge-int-bg)',    color: 'var(--badge-int-text)',    borderColor: 'var(--badge-int-border)' },
  offer:      { background: 'var(--badge-off-bg)',    color: 'var(--badge-off-text)',    borderColor: 'var(--badge-off-border)' },
  rejected:   { background: 'var(--badge-rej-bg)',    color: 'var(--badge-rej-text)',    borderColor: 'var(--badge-rej-border)' },
}

export const Badge = ({ status }) => {
  const st = STATUS_STYLES[status] || STATUS_STYLES.new
  return (
    <span style={{ ...st, border: '1px solid', fontSize: 11, padding: '2px 7px', borderRadius: 20, fontWeight: 500, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  )
}
