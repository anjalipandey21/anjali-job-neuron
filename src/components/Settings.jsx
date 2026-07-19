import { useState, useEffect } from 'react'
import { fmtDate } from '../lib/helpers'
import s from './Settings.module.css'

export function Settings({ profile, profileData, onUpdate, onSwitch, onLogout, isMobile = false, isTablet = false, isAdmin = false, onOpenAdmin }) {
  const [form, setForm] = useState({ locations: 'United States', roles: '', scheduledSearch: false, dateWindowDays: 30 })
  const [saved, setSaved] = useState(false)
  const toggleDebug = (e) => {
    localStorage.setItem('jh_debug', String(e.target.checked))
  }

  useEffect(() => { if (profileData?.preferences) setForm(profileData.preferences) }, [profileData])

  const save = async () => {
    const formWithTz = { ...form, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
    await onUpdate((prev) => ({ ...prev, preferences: formWithTz }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className={s.page}>
      {/* Page header */}
      <div className={s.header}>
        <p className={s.headerEyebrow}>Preferences</p>
        <h1 className={s.headerTitle}>Settings</h1>
        <p className={s.headerSub}>Configure your profile preferences, job search filters, and account settings</p>
      </div>

      <div className={s.content}>
        {/* Profile card */}
        <div className={s.card}>
          <p className={s.cardTitle}><span className={s.cardTitleDot} />Profile</p>
          <div className={s.profileRow}>
            <div className={s.profileAvatar}>{profile.name.slice(0, 2).toUpperCase()}</div>
            <div>
              <p className={s.profileName}>{profile.name}</p>
              <p className={s.profileMeta}>{profile.email || 'No email'} · Since {fmtDate(profile.createdAt)}</p>
            </div>
          </div>
          <div className={s.profileActions}>
            <button className={s.btn} onClick={onSwitch}>Switch profile</button>
            <button className={`${s.btn} ${s.btnDanger}`} onClick={onLogout}>Sign out</button>
            {(isTablet || isMobile) && isAdmin && (
              <button className={`${s.btn} ${s.btnWarning}`} onClick={onOpenAdmin}>Admin panel</button>
            )}
          </div>
        </div>

        {/* Job search preferences */}
        <div className={s.card}>
          <p className={s.cardTitle}><span className={s.cardTitleDot} />Job search preferences</p>
          <div className={s.fieldList}>
            <div>
              <label className={s.fieldLabel}>Preferred locations (comma-separated)</label>
              <input className={s.input} value={form.locations} onChange={(e) => setForm((f) => ({ ...f, locations: e.target.value }))} placeholder="Remote, San Francisco, New York" />
            </div>
            <div>
              <label className={s.fieldLabel}>Target roles (overrides resume analysis)</label>
              <input className={s.input} value={form.roles} onChange={(e) => setForm((f) => ({ ...f, roles: e.target.value }))} placeholder="Software Engineer, Frontend Developer" />
            </div>
            <div>
              <label className={s.fieldLabel}>Work preference</label>
              <select className={`${s.input} ${s.inputAuto}`} value={form.workType || 'any'} onChange={(e) => setForm((f) => ({ ...f, workType: e.target.value }))}>
                <option value="any">Any (remote + on-site)</option>
                <option value="remote">Remote only</option>
                <option value="onsite">On-site only</option>
              </select>
            </div>
            <div>
              <label className={s.fieldLabel}>Job search date window</label>
              <select className={`${s.input} ${s.inputAuto}`} value={form.dateWindowDays || 30} onChange={(e) => setForm((f) => ({ ...f, dateWindowDays: Number(e.target.value) }))}>
                <option value={30}>Last 30 days</option>
                <option value={60}>Last 60 days</option>
              </select>
            </div>
            <button className={s.btnPrimary} onClick={save}>{saved ? 'Saved ✓' : 'Save preferences'}</button>
          </div>
        </div>

        {/* Job Search — auto-run */}
        <div className={s.card}>
          <p className={s.cardTitle}><span className={s.cardTitleDot} />Job Search</p>
          <label className={s.toggleRow}>
            <input
              type="checkbox"
              checked={form.scheduledSearch || false}
              onChange={(e) => setForm((f) => ({ ...f, scheduledSearch: e.target.checked }))}
            />
            <span className={s.toggleLabel}>Run daily job search automatically</span>
          </label>
          <p className={s.toggleHint}>Runs at 8 AM in your local timezone. Save preferences to apply.</p>
        </div>

        {/* Developer tools */}
        <div className={s.card}>
          <p className={s.cardTitle}><span className={s.cardTitleDot} />Developer tools</p>
          <label className={s.toggleRow}>
            <input type="checkbox" defaultChecked={localStorage.getItem('jh_debug') === 'true'} onChange={toggleDebug} />
            <span className={s.toggleLabel}>Debug logging</span>
          </label>
          <p className={s.toggleHint}>Logs structured JSON to the browser console and Netlify function logs.</p>
        </div>

        {/* Help & Feedback */}
        <div className={s.card}>
          <p className={s.cardTitle}><span className={`${s.cardTitleDot} ${s.cardTitleDotRed}`} />Help &amp; Feedback</p>
          <p className={s.toggleHint} style={{ marginTop: 0, marginBottom: 10 }}>Found a bug or have a suggestion? Let us know.</p>
          <a
            href="https://github.com/jadhavnikhil78/jobhunter-ai/issues"
            target="_blank"
            rel="noreferrer"
            className={s.btn}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3"/>
              <line x1="7" y1="4" x2="7" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="7" cy="10" r="0.7" fill="currentColor"/>
            </svg>
            Report a bug
          </a>
        </div>
      </div>
    </div>
  )
}
