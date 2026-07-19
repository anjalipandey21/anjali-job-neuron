import { useState, useEffect } from 'react'
import { callAI, dbGet, dbSet, dbDelete } from '../lib/api'
import { uid, todayStr, fmtDate, parseJSON } from '../lib/helpers'
import { Badge } from '../lib/styles'
import s from './Applications.module.css'

// ─── Status border map ────────────────────────────────────────────────────────
const STATUS_BORDER = {
  new:        '#1e66f5',
  viewed:     'var(--border)',
  customized: '#8839ef',
  applied:    '#40a02b',
  interview:  '#df8e1d',
  offer:      '#179299',
  rejected:   '#d20f39',
}

// ─── Activity Types ────────────────────────────────────────────────────────────
const ACTIVITY_TYPES = [
  'Phone call',
  'Email sent',
  'Email received',
  'Interview (phone screen)',
  'Interview (technical)',
  'Interview (final round)',
  'Offer received',
  'Rejection',
  'Recruiter contact',
  'Follow-up',
  'Other',
]

// ─── Task Modal ───────────────────────────────────────────────────────────────
const TASK_PRESETS = ['Prepare for interview', 'Send thank you email', 'Follow up', 'Research company', 'Negotiate offer']

function DragHandle() {
  return (
    <div className={s.dragHandle}>
      <div className={s.dragHandleBar} />
    </div>
  )
}

function TaskModal({ app, profileId, onClose, isMobile = false }) {
  const [tasks, setTasks] = useState([])
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDue, setNewDue] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const key = `jh_tasks_${profileId}_${app.jobId}`

  useEffect(() => { dbGet(key).then((t) => setTasks(t || [])) }, [key])

  const save = async (updated) => { setTasks(updated); await dbSet(key, updated) }
  const addTask = () => {
    if (!newTitle.trim()) return
    save([...tasks, { id: uid(), title: newTitle.trim(), dueDate: newDue, completed: false, notes: newNotes.trim(), createdAt: new Date().toISOString() }])
    setNewTitle(''); setNewDue(''); setNewNotes(''); setAdding(false)
  }
  const toggleDone = (id) => save(tasks.map((t) => t.id === id ? { ...t, completed: !t.completed } : t))
  const removeTask = (id) => save(tasks.filter((t) => t.id !== id))
  const today = todayStr()
  const isOverdue = (t) => !t.completed && t.dueDate && t.dueDate < today

  return (
    <div className={s.overlay}>
      <div className={isMobile ? s.modalSheet : `${s.modal}`} style={isMobile ? {} : { width: '90%', maxWidth: 540, maxHeight: '85vh', animation: 'modalIn 0.2s ease' }}>
        {isMobile && <DragHandle />}
        <div className={s.modalHeader}>
          <div className={s.modalHeaderRow}>
            <div>
              <h3 className={s.modalTitle}>Tasks</h3>
              <p className={s.modalSub}>{app.jobTitle} · {app.company}</p>
            </div>
            <button className={s.modalClose} onClick={onClose}>✕</button>
          </div>
        </div>
        <div className={s.modalBody}>
          {tasks.length === 0 && !adding && (
            <p className={s.taskEmpty}>No tasks yet.</p>
          )}
          {tasks.map((t) => (
            <label key={t.id} htmlFor={`task-${t.id}`} className={s.taskRow}>
              <input
                id={`task-${t.id}`}
                type="checkbox"
                checked={t.completed}
                onChange={() => toggleDone(t.id)}
                className={s.taskCheckbox}
              />
              <div
                className={`${s.taskCheck} ${t.completed ? s.taskCheckComplete : s.taskCheckIncomplete}`}
                onClick={(e) => { e.stopPropagation(); toggleDone(t.id) }}
              >
                {t.completed && <span className={s.taskCheckMark}>✓</span>}
              </div>
              <div className={s.taskInfo}>
                <p className={`${s.taskTitle}${t.completed ? ` ${s.taskTitleDone}` : isOverdue(t) ? ` ${s.taskTitleOverdue}` : ''}`}>
                  {t.title}
                </p>
                {t.notes && <p className={s.taskNotes}>{t.notes}</p>}
              </div>
              {t.dueDate && (
                <span className={`${s.taskDueBadge} ${isOverdue(t) ? s.taskDueOverdue : s.taskDueNormal}`}>
                  {isOverdue(t) ? 'overdue' : `Due ${fmtDate(t.dueDate)}`}
                </span>
              )}
              <button className={s.taskRemove} onClick={(e) => { e.preventDefault(); removeTask(t.id) }}>✕</button>
            </label>
          ))}
          {adding ? (
            <div className={s.addTaskForm}>
              <input className={s.formInput} placeholder="Task title *" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && addTask()} />
              <div>
                <label className={s.formLabel}>Due date (optional)</label>
                <input type="date" className={`${s.formInput} ${s.dateInputAuto}`} value={newDue} onChange={(e) => setNewDue(e.target.value)} />
              </div>
              <input className={s.formInput} placeholder="Notes (optional)" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
              <div className={s.formActions}>
                <button className={`${s.btnPrimary} ${s.btnSm2}`} onClick={addTask}>Add task</button>
                <button className={`${s.btn} ${s.btnSm2}`} onClick={() => { setAdding(false); setNewTitle(''); setNewDue(''); setNewNotes('') }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className={s.addTaskBtnWrap}>
              <button className={`${s.btn} ${s.btnSm2}`} onClick={() => setAdding(true)}>+ Add task</button>
              {tasks.length === 0 && (
                <div className={s.presetsSection}>
                  <p className={s.presetsLabel}>Quick add:</p>
                  <div className={s.presetsList}>
                    {TASK_PRESETS.map((p) => (
                      <button key={p} className={`${s.btn} ${s.btnSm}`} onClick={() => save([...tasks, { id: uid(), title: p, dueDate: '', completed: false, notes: '', createdAt: new Date().toISOString() }])}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className={s.modalFooter}>
          <button className={`${s.btn} ${s.btnSm2}`} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

// ─── Activity Modal ───────────────────────────────────────────────────────────
function ActivityModal({ app, profileId, onClose }) {
  const [entries, setEntries] = useState([])
  const [newType, setNewType] = useState(ACTIVITY_TYPES[0])
  const [newNote, setNewNote] = useState('')
  const key = `jh_activity_${profileId}_${app.jobId}`

  useEffect(() => { dbGet(key).then((data) => setEntries(data || [])) }, [key])

  const save = async (updated) => { setEntries(updated); await dbSet(key, updated) }

  const addEntry = () => {
    save([...entries, { id: uid(), type: newType, note: newNote.trim(), createdAt: new Date().toISOString() }])
    setNewNote('')
    setNewType(ACTIVITY_TYPES[0])
  }

  const removeEntry = (id) => save(entries.filter((e) => e.id !== id))

  const fmtEntryDate = (iso) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className={`${s.overlay} ${s.activityOverlay}`}>
      <div className={`${s.modal} ${s.activityModal}`}>
        <div className={s.modalHeader}>
          <div className={s.modalHeaderRow}>
            <div>
              <h3 className={s.modalTitle}>Activity Log</h3>
              <p className={s.modalSub}>{app.jobTitle} · {app.company}</p>
            </div>
            <button className={s.modalClose} onClick={onClose}>✕</button>
          </div>
        </div>
        <div className={s.modalBody}>
          {entries.length === 0 ? (
            <p className={s.activityEmpty}>No activity logged yet.</p>
          ) : (
            <div className={s.timeline}>
              {[...entries].reverse().map((e) => (
                <div key={e.id} className={s.timelineEntry}>
                  <div className={s.timelineDot} />
                  <div className={s.timelineRow}>
                    <div className={s.timelineBody}>
                      <div className={s.timelineTypeRow}>
                        <span className={s.timelineType}>{e.type}</span>
                        <span className={s.timelineDate}>{fmtEntryDate(e.createdAt)}</span>
                      </div>
                      {e.note && <p className={s.timelineNote}>{e.note}</p>}
                    </div>
                    <button className={s.taskRemove} onClick={() => removeEntry(e.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={s.activityFooter}>
          <select className={s.formInput} value={newType} onChange={(e) => setNewType(e.target.value)}>
            {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            className={s.formInput}
            placeholder="Note (optional)"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEntry()}
          />
          <button className={`${s.btnPrimary} ${s.btnSm2} ${s.logBtnAlignStart}`} onClick={addEntry}>+ Log</button>
        </div>
      </div>
    </div>
  )
}

// ─── App Customize Modal ─────────────────────────────────────────────────────
function AppCustomizeModal({ app, profileData, onClose, isMobile = false }) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const prompt = `You are an expert career coach. Generate a tailored cover letter and key highlights for this job application.

Job: ${app.jobTitle} at ${app.company}
Location: ${app.location}

Candidate resume:
${profileData.resumeText?.slice(0, 5000)}

Return ONLY valid JSON:
{
  "coverLetter": "A 3-paragraph cover letter: (1) Open with a specific hook referencing the company and role. (2) Map 3 concrete achievements from the resume to likely job requirements, include metrics. (3) Close with enthusiasm for the company.",
  "highlights": ["5 bullet points, each starting with a STRONG ACTION VERB, mapping a SPECIFIC resume achievement to a likely requirement for this role, each with a METRIC or QUANTIFIED RESULT"]
}`
        const res = await callAI([{ role: 'user', content: prompt }], { tokens: 4000 })
        const parsed = parseJSON(res)
        if (!parsed) throw new Error('Failed to generate. Try again.')
        setResult(parsed)
      } catch (e) { setError(e.message) }
      setLoading(false)
    })()
  }, [])

  const copy = (text, key) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 2000) }

  return (
    <div className={s.overlay}>
      <div className={isMobile ? s.modalSheet : `${s.modal} ${s.modalLg}`} style={isMobile ? {} : {}}>
        {isMobile && <DragHandle />}
        <div className={s.modalHeaderRow} style={{ marginBottom: 0 }}>
          <div>
            <p className={s.modalTitle} style={{ fontSize: 15, fontWeight: 500, margin: '0 0 2px' }}>Tailored for: {app.jobTitle}</p>
            <p className={s.modalSub}>{app.company} · {app.location}</p>
          </div>
          <button className={s.modalClose} onClick={onClose} style={{ fontSize: 18 }}>✕</button>
        </div>
        {loading && <div className={s.modalLoading}>Generating tailored materials…</div>}
        {error && <p className={s.modalError}>{error}</p>}
        {result && (
          <>
            <div>
              <div className={s.sectionLabelRow}>
                <p className={s.sectionLabel}>Cover Letter</p>
                <button className={`${s.btn} ${s.btnSm}`} onClick={() => copy(result.coverLetter, 'cl')}>{copied === 'cl' ? 'Copied!' : 'Copy'}</button>
              </div>
              <div className={s.preBlock}>{result.coverLetter}</div>
            </div>
            <div>
              <p className={s.sectionLabel}>Key Highlights</p>
              <div className={s.highlightList}>
                {(result.highlights || []).map((h, i) => (
                  <div key={i} className={s.highlightItem}>
                    <span className={s.highlightNum}>0{i + 1}</span>
                    <p className={s.highlightText}>{h}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className={s.customizeActionsRow}>
              <button className={s.btnPrimary} onClick={() => copy(result.coverLetter + '\n\n---\n\n' + (result.highlights || []).join('\n'), 'all')}>{copied === 'all' ? 'Copied!' : 'Copy all'}</button>
              <button className={s.btn} onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Add Job Modal ───────────────────────────────────────────────────────────
function AddJobModal({ onSave, onClose, isMobile = false }) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const canSave = title.trim() && company.trim()

  const handleSave = () => {
    if (!canSave) return
    onSave({
      jobId: uid(),
      jobTitle: title.trim(),
      company: company.trim(),
      location: location.trim() || 'Not specified',
      url: url.trim(),
      serpApiJobId: '',
      status: 'applied',
      appliedAt: new Date().toISOString(),
      notes: notes.trim(),
    })
    onClose()
  }

  return (
    <div className={s.overlay}>
      <div className={isMobile ? s.modalSheet : s.modal} style={isMobile ? {} : { width: '90%', maxWidth: 460, animation: 'modalIn 0.2s ease' }}>
        {isMobile && <DragHandle />}
        <div className={s.modalHeader}>
          <div className={s.modalHeaderRow}>
            <div>
              <h3 className={s.modalTitle}>Add job manually</h3>
              <p className={s.modalSub}>Track a job you found elsewhere</p>
            </div>
            <button className={s.modalClose} onClick={onClose}>✕</button>
          </div>
        </div>
        <div className={s.addJobForm}>
          <div>
            <label className={s.formLabel}>Job URL (optional)</label>
            <input className={s.formInput} placeholder="https://linkedin.com/jobs/..." value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div>
            <label className={s.formLabel}>Job title *</label>
            <input className={s.formInput} placeholder="Software Engineer" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <label className={s.formLabel}>Company *</label>
            <input className={s.formInput} placeholder="Google" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div>
            <label className={s.formLabel}>Location (optional)</label>
            <input className={s.formInput} placeholder="Remote, New York, etc." value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <label className={s.formLabel}>Notes (optional)</label>
            <input className={s.formInput} placeholder="Referred by..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className={s.addJobActions}>
            <button className={s.btnPrimary} onClick={handleSave} disabled={!canSave} style={{ fontSize: 12, padding: '7px 16px' }}>Add to applications</button>
            <button className={s.btn} onClick={onClose} style={{ fontSize: 12, padding: '7px 16px' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Applications ─────────────────────────────────────────────────────────────
export function Applications({ profile, profileData, isMobile = false }) {
  const [apps, setApps] = useState([])
  const [editingNotes, setEditingNotes] = useState(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [taskModalApp, setTaskModalApp] = useState(null)
  const [activityModalApp, setActivityModalApp] = useState(null)
  const [customizeApp, setCustomizeApp] = useState(null)
  const [addJobOpen, setAddJobOpen] = useState(false)
  const [overflowMenuApp, setOverflowMenuApp] = useState(null)

  useEffect(() => { dbGet(`jh_apps_${profile.id}`).then((a) => setApps(a || [])) }, [profile.id])

  const save = async (updated) => { setApps(updated); await dbSet(`jh_apps_${profile.id}`, updated) }
  const updateStatus = async (jobId, newStatus) => {
    const app = apps.find((a) => a.jobId === jobId)
    await save(apps.map((a) => a.jobId === jobId ? { ...a, status: newStatus } : a))
    if (app?.status === 'applied' && newStatus !== 'applied') {
      const index = (await dbGet(`jh_applied_urls_${profile.id}`)) || []
      const updated = index.filter((e) =>
        e.serpApiJobId && app.serpApiJobId
          ? e.serpApiJobId !== app.serpApiJobId
          : e.url !== app.url
      )
      await dbSet(`jh_applied_urls_${profile.id}`, updated)
    }
    try {
      if (app) {
        const activityKey = `jh_activity_${profile.id}_${jobId}`
        const existing = (await dbGet(activityKey)) || []
        await dbSet(activityKey, [
          ...existing,
          { id: uid(), type: 'Status change', note: `${app.status} → ${newStatus}`, createdAt: new Date().toISOString() },
        ])
      }
    } catch (e) {
      console.error(e)
    }
  }
  const saveNotes = (jobId) => { save(apps.map((a) => a.jobId === jobId ? { ...a, notes: notesDraft } : a)); setEditingNotes(null) }
  const remove = (jobId) => {
    if (window.confirm('Remove this application?')) {
      save(apps.filter((a) => a.jobId !== jobId))
      dbDelete(`jh_activity_${profile.id}_${jobId}`)
    }
  }

  const addManualJob = async (newApp) => {
    const updated = [...apps, newApp]
    await save(updated)
    if (newApp.url) {
      const index = (await dbGet(`jh_applied_urls_${profile.id}`)) || []
      await dbSet(`jh_applied_urls_${profile.id}`, [
        ...index,
        { url: newApp.url, serpApiJobId: '', company: newApp.company, title: newApp.jobTitle },
      ])
    }
  }

  const counts = ['applied', 'interview', 'offer', 'rejected'].reduce((acc, st) => ({ ...acc, [st]: apps.filter((a) => a.status === st).length }), {})

  return (
    <div className={s.page}>
      {/* Page header */}
      <div className={s.header}>
        <div className={s.headerText}>
          <p className={s.headerEyebrow}>Pipeline</p>
          <h1 className={s.headerTitle}>Applications</h1>
          <p className={s.headerSub}>Monitor your pipeline from applied through interview to offer, with tasks and notes</p>
        </div>
        <button className={s.btn} onClick={() => setAddJobOpen(true)}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><line x1="6" y1="1" x2="6" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          Add job manually
        </button>
      </div>

      <div className={s.content}>
        {/* Pipeline counters */}
        <div className={s.pipelineGrid}>
          {[
            { label: 'Applied',   key: 'applied',   bg: 'var(--bg-success)', c: 'var(--text-success)' },
            { label: 'Interview', key: 'interview', bg: 'var(--bg-warning)', c: 'var(--text-warning)' },
            { label: 'Offer',     key: 'offer',     bg: 'var(--badge-off-bg)', c: 'var(--badge-off-text)' },
            { label: 'Rejected',  key: 'rejected',  bg: 'var(--bg-error)',   c: 'var(--text-error)' },
          ].map((st) => (
            <div key={st.key} className={s.pipelineCard} style={{ background: st.bg }}>
              <p className={s.pipelineLabel} style={{ color: st.c }}>{st.label}</p>
              <p className={s.pipelineCount} style={{ color: st.c }}>{counts[st.key] || 0}</p>
            </div>
          ))}
        </div>

        {apps.length === 0 ? (
          <div className={s.emptyState}>
            <p className={s.emptyText}>No applications tracked yet. Apply to jobs from the Find Jobs tab.</p>
          </div>
        ) : (
          <div>
            {[...apps].reverse().map((a, index) => (
              <div
                key={a.jobId}
                className={s.appCard}
                style={{
                  borderLeft: `3px solid ${STATUS_BORDER[a.status] || 'var(--border)'}`,
                  animation: `slideUp 0.4s ${index * 0.06}s ease both`,
                }}
              >
                {overflowMenuApp === a.jobId && (
                  <div
                    data-testid="overflow-backdrop"
                    onClick={() => setOverflowMenuApp(null)}
                    className={s.overflowBackdrop}
                  />
                )}
                <div className={s.appCardInner}>
                  <div className={s.companyAvatar}>
                    {a.company?.slice(0, 2).toUpperCase() || '??'}
                  </div>
                  <div className={s.appBody}>
                    <div className={s.appTitleRow}>
                      <span className={s.appTitle}>{a.jobTitle}</span>
                      <Badge status={a.status} />
                    </div>
                    <p className={s.appMeta}>{a.company} · {a.location} · Applied {fmtDate(a.appliedAt)}</p>
                    {editingNotes === a.jobId ? (
                      <div>
                        <textarea
                          className={s.notesTextarea}
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          placeholder="Notes, interview dates, contacts…"
                          autoFocus
                        />
                        <div className={s.notesBtns}>
                          <button className={`${s.btnPrimary} ${s.btnSm}`} onClick={() => saveNotes(a.jobId)}>Save</button>
                          <button className={`${s.btn} ${s.btnSm}`} onClick={() => setEditingNotes(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      a.notes && <p className={s.appNotes}>{a.notes}</p>
                    )}
                  </div>

                  {isMobile ? (
                    <div className={s.overflowWrap}>
                      <button
                        className={`${s.btn} ${s.btnIconOnly}`}
                        onClick={() => setOverflowMenuApp(overflowMenuApp === a.jobId ? null : a.jobId)}
                      >•••</button>
                      {overflowMenuApp === a.jobId && (
                        <div className={s.overflowMenu}>
                          <select
                            aria-label="Application status"
                            className={s.overflowSelect}
                            value={a.status}
                            onChange={(e) => { updateStatus(a.jobId, e.target.value); setOverflowMenuApp(null) }}
                          >
                            {['applied', 'interview', 'offer', 'rejected'].map((st) => (
                              <option key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1)}</option>
                            ))}
                          </select>
                          {[
                            { label: 'Tasks', onClick: () => { setTaskModalApp(a); setOverflowMenuApp(null) } },
                            { label: 'Activity', onClick: () => { setActivityModalApp(a); setOverflowMenuApp(null) } },
                            { label: 'Notes', onClick: () => { setNotesDraft(a.notes || ''); setEditingNotes(a.jobId); setOverflowMenuApp(null) } },
                            ...(profileData?.resumeText ? [{ label: '✦ Customize', onClick: () => { setCustomizeApp(a); setOverflowMenuApp(null) } }] : []),
                            { label: 'Remove', onClick: () => { remove(a.jobId); setOverflowMenuApp(null) }, danger: true },
                          ].map((item) => (
                            <button key={item.label} className={`${s.overflowItem}${item.danger ? ` ${s.overflowItemDanger}` : ''}`} onClick={item.onClick}>
                              {item.label}
                            </button>
                          ))}
                          {a.url && (
                            <a href={a.url} target="_blank" rel="noreferrer" className={s.overflowItemLink}>View ↗</a>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={s.actionCol}>
                      <select
                        aria-label="Application status"
                        className={s.statusSelect}
                        value={a.status}
                        onChange={(e) => updateStatus(a.jobId, e.target.value)}
                      >
                        {['applied', 'interview', 'offer', 'rejected'].map((st) => (
                          <option key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1)}</option>
                        ))}
                      </select>
                      <div className={s.actionRow}>
                        <button className={`${s.btn} ${s.btnSm}`} onClick={() => setTaskModalApp(a)}>Tasks</button>
                        <button className={`${s.btn} ${s.btnSm}`} onClick={() => setActivityModalApp(a)}>Activity</button>
                        <button className={`${s.btn} ${s.btnSm}`} onClick={() => { setNotesDraft(a.notes || ''); setEditingNotes(a.jobId) }}>Notes</button>
                        {profileData?.resumeText && <button className={`${s.btn} ${s.btnSm}`} onClick={() => setCustomizeApp(a)}>✦ Customize</button>}
                      </div>
                      <div className={s.actionRow}>
                        {a.url && <a href={a.url} target="_blank" rel="noreferrer" className={s.btnLink}>View ↗</a>}
                        <button className={`${s.btn} ${s.btnSm} ${s.btnDanger}`} onClick={() => remove(a.jobId)}>Remove</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {taskModalApp && <TaskModal app={taskModalApp} profileId={profile.id} onClose={() => setTaskModalApp(null)} isMobile={isMobile} />}
        {activityModalApp && <ActivityModal app={activityModalApp} profileId={profile.id} onClose={() => setActivityModalApp(null)} />}
        {addJobOpen && <AddJobModal onSave={addManualJob} onClose={() => setAddJobOpen(false)} isMobile={isMobile} />}
        {customizeApp && profileData && <AppCustomizeModal app={customizeApp} profileData={profileData} onClose={() => setCustomizeApp(null)} isMobile={isMobile} />}
      </div>
    </div>
  )
}
