import s from './BottomNav.module.css'

const NAV = [
  {
    id: 'dashboard', label: 'Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="2" fill="currentColor" opacity="0.9"/>
        <rect x="9" y="1" width="6" height="6" rx="2" fill="currentColor" opacity="0.5"/>
        <rect x="1" y="9" width="6" height="6" rx="2" fill="currentColor" opacity="0.5"/>
        <rect x="9" y="9" width="6" height="6" rx="2" fill="currentColor" opacity="0.5"/>
      </svg>
    ),
  },
  {
    id: 'resume', label: 'Resume',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/>
        <line x1="5" y1="5.5" x2="11" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="5" y1="8.5" x2="11" y2="8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="5" y1="11.5" x2="8" y2="11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'jobs', label: 'Find Jobs',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4"/>
        <line x1="11" y1="11" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'applications', label: 'Applications',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M1 5l7 5 7-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'settings', label: 'Settings',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export function BottomNav({ tab, setTab, todayJobCount = 0, openAppCount = 0, isMobile = false }) {
  if (!isMobile) return null

  return (
    <nav className={s.nav} aria-label="Bottom navigation">
      {NAV.map((n) => {
        const isActive = tab === n.id
        const count = n.id === 'jobs' ? todayJobCount : n.id === 'applications' ? openAppCount : 0
        return (
          <button
            key={n.id}
            className={`${s.tab} ${isActive ? s.tabActive : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => setTab(n.id)}
          >
            <span className={s.tabIcon}>
              {n.icon}
              {count > 0 && <span className={s.tabBadge}>{count}</span>}
            </span>
            <span className={`${s.tabLabel} ${isActive ? s.tabLabelActive : ''}`}>
              {n.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
