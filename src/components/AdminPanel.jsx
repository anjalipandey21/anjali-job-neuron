import { useState, useEffect } from 'react'
import {
  adminGetStats, adminListUsers, adminGetUserDetail,
  adminSetRole, adminSetDisabled, adminDeleteUser,
} from '../lib/api'
import { fmtDate } from '../lib/helpers'
import s from './AdminPanel.module.css'
const fmtTime = (d) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

const NAV = ['Overview', 'Users', 'Activity']

// ── Stat card ─────────────────────────────────────────────────────────────────
function Metric({ label, value, sub, color }) {
  return (
    <div className={s.metricCard} style={{ borderLeft: color ? `3px solid ${color}` : undefined }}>
      <p className={s.metricLabel}>{label}</p>
      <p className={s.metricValue} style={{ color: color || undefined }}>{value ?? '—'}</p>
      {sub && <p className={s.metricSub}>{sub}</p>}
    </div>
  )
}

// ── User row ──────────────────────────────────────────────────────────────────
function UserRow({ user, onSelect, onToggleDisable, onSetRole, onDelete, isSelf }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className={s.userRow}>
      <div className={s.cardEdge} />
      <div className={s.userRowInner}>
        <div className={`${s.userAvatar} ${user.role === 'admin' ? s.avatarAdmin : s.avatarUser}`}>
          {user.email.slice(0, 2).toUpperCase()}
        </div>

        <div className={s.userInfo}>
          <div className={s.userEmailRow}>
            <span className={s.userEmail}>{user.email}</span>
            {isSelf && <span className={`${s.pill} ${s.pillSelf}`}>you</span>}
            <span className={`${s.pill} ${user.role === 'admin' ? s.pillAdmin : s.pillUser}`}>{user.role}</span>
            {user.disabled && <span className={`${s.pill} ${s.pillDisabled}`}>disabled</span>}
          </div>
          <p className={s.userMeta}>
            Joined {fmtDate(user.createdAt)} · Last active {fmtTime(user.lastActive)} · {user.appRowCount} app record{user.appRowCount !== 1 ? 's' : ''}
          </p>
        </div>

        <div className={s.userActions}>
          <button onClick={() => onSelect(user)} className={s.btn}>View →</button>
          {!isSelf && (
            <>
              <button onClick={() => onSetRole(user.userId, user.role === 'admin' ? 'user' : 'admin')} className={s.btn}>
                {user.role === 'admin' ? 'Remove admin' : 'Make admin'}
              </button>
              <button onClick={() => onToggleDisable(user.userId, !user.disabled)} className={`${s.btn} ${user.disabled ? '' : s.btnDanger}`}>
                {user.disabled ? 'Enable' : 'Disable'}
              </button>
              {!confirming
                ? <button onClick={() => setConfirming(true)} className={`${s.btn} ${s.btnDanger}`}>Delete</button>
                : <button onClick={() => { setConfirming(false); onDelete(user.userId) }} className={`${s.btnPrimary} ${s.btnPrimaryDanger}`}>Confirm?</button>
              }
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── User detail drawer ────────────────────────────────────────────────────────
function UserDetail({ user, detail, onClose }) {
  const [profileIdx, setProfileIdx] = useState(0)
  if (!detail) return (
    <div className={s.drawerOverlay}>
      <div className={s.drawerPanel}>
        <p style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</p>
      </div>
    </div>
  )

  const profiles = detail.profiles || []
  const profile = profiles[profileIdx]

  return (
    <div className={s.drawerOverlay}>
      <div className={s.drawerPanel}>
        <div className={s.drawerHeader}>
          <div>
            <p className={s.drawerTitle}>{user.email}</p>
            <p className={s.drawerSub}>Joined {fmtDate(user.createdAt)} · {profiles.length} profile{profiles.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className={s.drawerClose}>✕</button>
        </div>

        <div className={s.drawerBody}>
          {profiles.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>This user has no profiles yet.</p>
          )}

          {profiles.length > 1 && (
            <div className={s.profileTabBar}>
              {profiles.map((p, i) => (
                <button key={p.id} onClick={() => setProfileIdx(i)} className={`${s.profileTabBtn} ${profileIdx === i ? s.profileTabBtnActive : ''}`}>
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {profile && (
            <>
              <div className={s.card}>
                <div className={s.cardEdge} />
                <p className={s.cardLabel}>Profile</p>
                <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 500 }}>{profile.name}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{profile.email || 'No email'} · Created {fmtDate(profile.createdAt)}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <Metric label="Applications" value={profile.applications?.length || 0} />
                <Metric label="Job searches" value={profile.jobSearches?.length || 0} />
                <Metric label="Interviews" value={(profile.applications || []).filter((a) => a.status === 'interview').length} color="#b06000" />
              </div>

              {(profile.applications || []).length > 0 && (
                <div className={s.card}>
                  <div className={s.cardEdge} />
                  <p className={s.cardLabel}>Applications ({profile.applications.length})</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[...profile.applications].reverse().map((a, i) => (
                      <div key={i} className={s.appRow}>
                        <div className={s.appRowInfo}>
                          <p className={s.appTitle}>{a.jobTitle}</p>
                          <p className={s.appMeta}>{a.company} · {fmtDate(a.appliedAt)}</p>
                        </div>
                        <span className={`${s.pill} ${
                          a.status === 'offer' ? s.pillOffer :
                          a.status === 'interview' ? s.pillAdmin :
                          a.status === 'rejected' ? s.pillDisabled : s.pillUser
                        }`} style={{ whiteSpace: 'nowrap' }}>{a.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(profile.jobSearches || []).length > 0 && (
                <div className={s.card}>
                  <div className={s.cardEdge} />
                  <p className={s.cardLabel}>Job searches ({profile.jobSearches.length})</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[...profile.jobSearches].reverse().map((js, i) => (
                      <div key={i} className={s.searchRow}>
                        <p style={{ margin: 0, fontSize: 13 }}>{js.date}</p>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{js.jobs?.length || 0} jobs found</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {profile.resumeText && (
                <div className={s.card}>
                  <div className={s.cardEdge} />
                  <p className={s.cardLabel}>Resume (preview)</p>
                  <p className={s.resumePreview}>{profile.resumeText?.slice(0, 400)}…</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Activity tab ──────────────────────────────────────────────────────────────
function ActivityTab({ users }) {
  const events = users
    .flatMap((u) => [
      { type: 'join',   email: u.email, date: u.createdAt,  label: 'Joined' },
      { type: 'active', email: u.email, date: u.lastActive, label: 'Last active' },
    ])
    .filter((e) => e.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 40)

  return (
    <div>
      <p style={{ margin: '0 0 1rem', fontSize: 13, color: 'var(--text-muted)' }}>Recent platform activity across all users.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {events.map((e, i) => (
          <div key={i} className={s.activityRow}>
            <span className={e.type === 'join' ? s.activityBadgeJoin : s.activityBadgeActive}>{e.label}</span>
            <span style={{ fontSize: 13, flex: 1 }}>{e.email}</span>
            <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>{fmtTime(e.date)}</span>
          </div>
        ))}
        {events.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No activity yet.</p>}
      </div>
    </div>
  )
}

// ── Main AdminPanel ───────────────────────────────────────────────────────────
export default function AdminPanel({ user, onExit }) {
  const [tab, setTab] = useState(() => sessionStorage.getItem('jh_admin_tab') || 'Overview')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [st, u] = await Promise.all([adminGetStats(), adminListUsers()])
      setStats(st)
      setUsers(u.users || [])
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => { sessionStorage.setItem('jh_admin_tab', tab) }, [tab])

  const openDetail = async (u) => {
    setSelectedUser(u); setSelectedDetail(null)
    try {
      const d = await adminGetUserDetail(u.userId)
      setSelectedDetail(d)
    } catch (e) { console.error(e) }
  }

  const handleSetRole = async (userId, role) => {
    await adminSetRole(userId, role)
    setUsers((prev) => prev.map((u) => u.userId === userId ? { ...u, role } : u))
  }

  const handleToggleDisable = async (userId, disabled) => {
    await adminSetDisabled(userId, disabled)
    setUsers((prev) => prev.map((u) => u.userId === userId ? { ...u, disabled } : u))
  }

  const handleDelete = async (userId) => {
    if (!window.confirm('Delete ALL data for this user? This cannot be undone.')) return
    await adminDeleteUser(userId)
    setUsers((prev) => prev.filter((u) => u.userId !== userId))
  }

  const filtered = users.filter((u) => u.email.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className={s.layout}>
      {/* Top bar */}
      <header className={s.topBar}>
        <div className={s.brand}>
          <div className={s.brandIcon}>
            <svg width="14" height="14" viewBox="0 0 18 18" fill="white">
              <circle cx="9" cy="6.5" r="3.5"/>
              <path d="M2 16c0-3.5 3.1-5.5 7-5.5s7 2 7 5.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            </svg>
          </div>
          <span className={s.brandName}>Job Neuron</span>
          <span className={s.adminBadge}>ADMIN</span>
        </div>

        <nav className={s.nav} aria-label="Admin navigation">
          {NAV.map((n) => (
            <button
              key={n}
              onClick={() => setTab(n)}
              className={`${s.navBtn} ${tab === n ? s.navBtnActive : ''}`}
              aria-current={tab === n ? 'page' : undefined}
            >
              {n}
            </button>
          ))}
        </nav>

        <div className={s.topBarRight}>
          <span className={s.footerEmail}>{user?.email}</span>
          <button onClick={onExit} className={s.backBtn}>← Back to app</button>
        </div>
      </header>

      {/* Main */}
      <main className={s.main}>
        <div className={s.content}>
          <div className={s.pageHeader}>
            <h2 className={s.pageTitle}>{tab}</h2>
            <button onClick={load} className={s.btn}>↻ Refresh</button>
          </div>

          {error && <p className={s.errorBox}>{error}</p>}
          {loading && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</p>}

          {/* ── Overview ── */}
          {!loading && tab === 'Overview' && stats && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className={s.metricsGrid4}>
                <Metric label="Total users"       value={stats.totalUsers}       sub="registered accounts" />
                <Metric label="Admins"            value={stats.totalAdmins}      color="#b06000" />
                <Metric label="Disabled"          value={stats.disabledUsers}    color="#c5221f" />
                <Metric label="New this week"     value={stats.newUsersThisWeek} color="#137333" />
              </div>
              <div className={s.metricsGrid3}>
                <Metric label="Profiles created"   value={stats.totalProfiles} />
                <Metric label="Job searches today" value={stats.jobSearchesToday} color="#1a56e8" />
                <Metric label="AI provider"        value={(import.meta.env.VITE_AI_PROVIDER || 'gemini').toUpperCase()} />
              </div>

              <div className={s.card}>
                <div className={s.cardEdge} />
                <p className={s.cardLabel}>Recent users</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {users.slice(0, 5).map((u) => (
                    <div key={u.userId} className={s.recentUserRow}>
                      <div className={s.recentUserLeft}>
                        <div className={s.recentAvatar}>{u.email.slice(0, 2).toUpperCase()}</div>
                        <span style={{ fontSize: 13 }}>{u.email}</span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Joined {fmtDate(u.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Users ── */}
          {!loading && tab === 'Users' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by email…"
                  className={s.searchInput}
                />
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{filtered.length} user{filtered.length !== 1 ? 's' : ''}</p>
              </div>
              {filtered.map((u) => (
                <UserRow
                  key={u.userId}
                  user={u}
                  isSelf={u.userId === user?.sub}
                  onSelect={openDetail}
                  onToggleDisable={handleToggleDisable}
                  onSetRole={handleSetRole}
                  onDelete={handleDelete}
                />
              ))}
              {filtered.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No users found.</p>}
            </div>
          )}

          {/* ── Activity ── */}
          {!loading && tab === 'Activity' && <ActivityTab users={users} />}
        </div>
      </main>

      {selectedUser && (
        <UserDetail
          user={selectedUser}
          detail={selectedDetail}
          onClose={() => { setSelectedUser(null); setSelectedDetail(null) }}
        />
      )}
    </div>
  )
}
