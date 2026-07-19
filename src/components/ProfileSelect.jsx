import { useState, useEffect } from 'react'
import { dbGet, dbSet } from '../lib/api'
import { uid, fmtDate } from '../lib/helpers'
import s from './ProfileSelect.module.css'

export function ProfileSelect({ onSelect, onLogout, user, forcePicker = false }) {
  const [profiles, setProfiles] = useState([])
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', email: '' })
  const [loaded, setLoaded] = useState(false)
  // hoveredProfile state REMOVED — CSS handles hover

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      // First attempt
      let p = await dbGet('jh_profiles')
      // If null, the auth token may not have been ready yet — retry once
      if (p === null) {
        await new Promise((r) => setTimeout(r, 800))
        p = await dbGet('jh_profiles')
      }
      if (cancelled) return
      const list = p || []
      setProfiles(list)
      if (list.length === 1 && !forcePicker) {
        onSelect(list[0])
        return
      }
      setLoaded(true)
      if (list.length === 0) {
        setForm({
          name: user?.user_metadata?.full_name || '',
          email: user?.email || '',
        })
        setCreating(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const create = async () => {
    if (!form.name.trim()) return
    // Guard against duplicate profiles with the same name+email
    const duplicate = profiles.find(
      (p) => p.name.trim().toLowerCase() === form.name.trim().toLowerCase() && p.email.trim().toLowerCase() === form.email.trim().toLowerCase()
    )
    if (duplicate) { onSelect(duplicate); return }
    const p = { id: uid(), name: form.name.trim(), email: form.email.trim(), createdAt: new Date().toISOString() }
    const full = { ...p, resumeText: '', analyzedResume: null, preferences: { locations: 'Remote, United States', roles: '' } }
    const all = [...profiles, p]
    await dbSet('jh_profiles', all)
    await dbSet(`jh_p_${p.id}`, full)
    setProfiles(all); setCreating(false); setForm({ name: '', email: '' }); onSelect(p)
  }

  const del = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('Delete this profile and all its data?')) return
    const all = profiles.filter((p) => p.id !== id)
    await dbSet('jh_profiles', all); setProfiles(all)
  }

  if (!loaded) return (
    <div className={s.loading}>
      <p className={s.loadingText}>Loading…</p>
    </div>
  )

  return (
    <div className={s.page}>
      <div className={s.container}>
        <div className={s.header}>
          <div className={s.brand}>
            <div className={s.brandIcon}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="white">
                <circle cx="9" cy="6.5" r="3.5"/>
                <path d="M2 16c0-3.5 3.1-5.5 7-5.5s7 2 7 5.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h1 className={s.brandTitle}>Job Neuron</h1>
              <div className={s.brandSub}>AI Job Search</div>
            </div>
          </div>
          <p className={s.subtitle}>Select a profile or create a new one.</p>
        </div>

        {profiles.length > 0 && (
          <div className={s.profileList}>
            {profiles.map((p) => (
              <div
                key={p.id}
                className={s.profileCard}
                onClick={() => onSelect(p)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelect(p)}
              >
                <div className={s.profileLeft}>
                  <div className={s.avatar}>{p.name.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <p className={s.profileName}>{p.name}</p>
                    <p className={s.profileMeta}>{p.email || 'No email'} · {fmtDate(p.createdAt)}</p>
                  </div>
                </div>
                <button className={s.deleteBtn} onClick={(e) => del(p.id, e)} title="Delete profile">✕</button>
              </div>
            ))}
          </div>
        )}

        {!creating ? (
          <button className={s.createBtn} onClick={() => setCreating(true)}>+ Create new profile</button>
        ) : (
          <div className={s.createForm}>
            <p className={s.createTitle}>New profile</p>
            <div className={s.formFields}>
              <input
                className={s.input}
                placeholder="Full name *"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && create()}
                autoFocus
              />
              <input
                className={s.input}
                placeholder="Email address"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && create()}
              />
              <div className={s.formActions}>
                <button className={s.btnPrimary} onClick={create}>Create profile</button>
                <button className={s.btnGhost} onClick={() => setCreating(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        <button className={`${s.btnGhost} ${s.signOut}`} onClick={onLogout}>Sign out</button>
      </div>
    </div>
  )
}
