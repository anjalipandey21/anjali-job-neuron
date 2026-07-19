import { useState, useRef, useEffect } from 'react'
import s from './TopNav.module.css'

const NAV = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'resume', label: 'Resume' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'applications', label: 'Applications' },
  { id: 'settings', label: 'Settings' },
]

export function TopNav({ tab, setTab, profile, onSwitch, onLogout, userEmail, isAdmin, onOpenAdmin, todayJobCount = 0, openAppCount = 0 }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  const getBadge = (id) => {
    if (id === 'jobs' && todayJobCount > 0) return todayJobCount
    if (id === 'applications' && openAppCount > 0) return openAppCount
    return null
  }

  return (
    <nav className={s.nav} aria-label="Main navigation">
      {/* Brand */}
      <div className={s.brand}>
        <div className={s.brandIcon}>
          <svg width="16" height="16" viewBox="0 0 18 18" fill="white">
            <circle cx="9" cy="6.5" r="3.5"/>
            <path d="M2 16c0-3.5 3.1-5.5 7-5.5s7 2 7 5.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          </svg>
        </div>
        <span className={s.brandName}>Job Neuron</span>
      </div>

      {/* Nav links */}
      <div className={s.links}>
        {NAV.map((n) => {
          const isActive = tab === n.id
          const badge = getBadge(n.id)
          return (
            <button
              key={n.id}
              className={`${s.link} ${isActive ? s.linkActive : ''}`}
              data-active={isActive || undefined}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => setTab(n.id)}
            >
              {n.label}
              {badge && <span className={s.badge}>{badge}</span>}
            </button>
          )
        })}
      </div>

      {/* Right section — profile dropdown */}
      <div className={s.right} ref={dropdownRef}>
        <button
          className={s.profileBtn}
          onClick={() => setDropdownOpen((v) => !v)}
          aria-label={profile?.name || userEmail}
        >
          <div className={s.avatar}>
            {(userEmail?.[0] || 'U').toUpperCase()}
          </div>
          <span>{profile?.name || userEmail}</span>
        </button>

        {dropdownOpen && (
          <div className={s.dropdown}>
            <div style={{ padding: 'var(--space-1) var(--space-4) var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
              {userEmail}
            </div>
            <div className={s.dropdownDivider} />
            <button className={s.dropdownItem} onClick={() => { setDropdownOpen(false); onSwitch() }}>
              Switch profile
            </button>
            {isAdmin && (
              <button className={s.dropdownItem} onClick={() => { setDropdownOpen(false); onOpenAdmin() }}>
                Admin panel
              </button>
            )}
            <a
              className={s.dropdownItem}
              href="https://github.com/jadhavnikhil78/jobhunter-ai/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              Report a bug
            </a>
            <div className={s.dropdownDivider} />
            <button className={`${s.dropdownItem} ${s.signOut}`} onClick={() => { setDropdownOpen(false); onLogout() }}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
