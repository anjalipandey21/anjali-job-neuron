# Application Activity Log Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-application activity log modal that lets users record timestamped events (calls, emails, interviews, etc.) and auto-logs status changes.

**Architecture:** A private `ActivityModal` component is co-located in `Applications.jsx` alongside the existing `TaskModal`, following the exact same pattern. Activity data lives in a separate KV key `jh_activity_{profileId}_{jobId}` per application. Status changes in `updateStatus` automatically append a `'Status change'` entry to the log.

**Tech Stack:** React (hooks, inline styles), Supabase KV via `dbGet`/`dbSet`/`dbDelete` helpers, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-03-22-application-activity-log-design.md`

---

## File Map

| File | Change |
|---|---|
| `src/components/Applications.jsx` | Add `ACTIVITY_TYPES`, `ActivityModal`, `activityModalApp` state, Activity button, modal mount; update `updateStatus` and `remove` |
| `src/__tests__/Applications.test.jsx` | Add `dbDelete` to mock; add 4 new tests |
| `CHANGELOG.md` | Document the new feature |
| `ROADMAP.md` | Mark activity log item as implemented |

---

## Mock strategy — read this before writing any tests

The tests render `<Applications profile={profile} />` directly (not through the full app shell), so the only `dbGet` calls are:
1. On mount: `jh_apps_p1` (Applications useEffect)
2. On ActivityModal open: `jh_activity_p1_j1` (ActivityModal useEffect)
3. During `updateStatus` when moving away from `'applied'`: `jh_applied_urls_p1` (existing applied-url cleanup logic)
4. During auto-log block in `updateStatus`: `jh_activity_p1_j1`

Use `mockImplementation` keyed by the `key` argument so the order of calls never matters:

```js
dbGet.mockImplementation((key) => {
  if (key === 'jh_apps_p1') return Promise.resolve([mockApp])
  if (key === 'jh_activity_p1_j1') return Promise.resolve(/* per-test value */)
  return Promise.resolve(null)  // safe fallback for jh_applied_urls_p1 etc.
})
```

Override the activity key return value per-test using `mockImplementation` inside each test body. This is more robust than `mockResolvedValueOnce` chaining which breaks when call order shifts.

---

## Task 1: Add foundation — import dbDelete and ACTIVITY_TYPES constant

**Files:**
- Modify: `src/components/Applications.jsx:2`

- [ ] **Step 1: Update the api import**

Change line 2 of `src/components/Applications.jsx` from:
```js
import { dbGet, dbSet } from '../lib/api'
```
To:
```js
import { dbGet, dbSet, dbDelete } from '../lib/api'
```

- [ ] **Step 2: Add `ACTIVITY_TYPES` constant after the imports, before `// ─── Task Modal ───`**

```js
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
```

- [ ] **Step 3: Run existing tests — must still pass**

```bash
npm test
```

Note: the current test mock does not include `dbDelete`, so `dbDelete` will be `undefined` inside the module during this test run. That is safe here because `remove()` (the only caller of `dbDelete`) is not invoked by the smoke test. The mock will be updated in Task 2.

- [ ] **Step 4: Commit**

```bash
git add src/components/Applications.jsx
git commit -m "feat: add ACTIVITY_TYPES constant and import dbDelete"
```

---

## Task 2: Write failing tests

**Files:**
- Modify: `src/__tests__/Applications.test.jsx`

- [ ] **Step 1: Replace the entire test file with the expanded version**

The current file is 17 lines (a single smoke test). Replace it entirely:

```jsx
import { describe, it, vi, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../lib/api', () => ({
  dbGet: vi.fn(),
  dbSet: vi.fn().mockResolvedValue(undefined),
  dbDelete: vi.fn().mockResolvedValue(undefined),
}))

import { dbGet, dbSet } from '../lib/api'
import { Applications } from '../components/Applications'

const profile = { id: 'p1', name: 'Test User' }

const mockApp = {
  jobId: 'j1',
  jobTitle: 'Software Engineer',
  company: 'Stripe',
  location: 'Remote',
  url: 'https://stripe.com/jobs/1',
  status: 'applied',
  appliedAt: '2026-03-17',
  notes: '',
}

// Helper: render Applications with one app, then open ActivityModal.
// Sets up dbGet via mockImplementation before calling — caller provides activityEntries.
async function openActivityModal(user, activityEntries = null) {
  dbGet.mockImplementation((key) => {
    if (key === 'jh_apps_p1') return Promise.resolve([mockApp])
    if (key === 'jh_activity_p1_j1') return Promise.resolve(activityEntries)
    return Promise.resolve(null)
  })
  render(<Applications profile={profile} />)
  const activityBtn = await screen.findByRole('button', { name: 'Activity' })
  await user.click(activityBtn)
}

describe('Applications smoke test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbGet.mockResolvedValue(null)
  })

  it('renders without crashing', () => {
    render(<Applications profile={profile} />)
  })
})

describe('ActivityModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbSet.mockResolvedValue(undefined)
  })

  it('shows empty state when there are no activity entries', async () => {
    const user = userEvent.setup()
    await openActivityModal(user, null)
    expect(await screen.findByText('No activity logged yet.')).toBeInTheDocument()
  })

  it('adds a new entry and calls dbSet with the activity key', async () => {
    const user = userEvent.setup()
    await openActivityModal(user, [])

    await screen.findByText('No activity logged yet.')

    // Default type is ACTIVITY_TYPES[0] = 'Phone call'
    await user.click(screen.getByRole('button', { name: /Log/i }))

    await waitFor(() => {
      expect(dbSet).toHaveBeenCalledWith(
        'jh_activity_p1_j1',
        expect.arrayContaining([
          expect.objectContaining({ type: 'Phone call' }),
        ])
      )
    })
  })

  it('deletes an entry and calls dbSet without that entry', async () => {
    const user = userEvent.setup()
    const existingEntry = {
      id: 'e1',
      type: 'Phone call',
      note: 'test note',
      createdAt: '2026-03-19T10:00:00.000Z',
    }
    await openActivityModal(user, [existingEntry])

    await screen.findByText('Phone call')

    // The modal has two ✕ buttons: header close (first in DOM) and entry delete (last).
    const deleteBtns = screen.getAllByRole('button', { name: '✕' })
    await user.click(deleteBtns[deleteBtns.length - 1])

    await waitFor(() => {
      expect(dbSet).toHaveBeenCalledWith(
        'jh_activity_p1_j1',
        expect.not.arrayContaining([expect.objectContaining({ id: 'e1' })])
      )
    })
  })
})

describe('Applications auto-log', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbSet.mockResolvedValue(undefined)
  })

  it('auto-logs a Status change entry when status dropdown changes', async () => {
    const user = userEvent.setup()
    // updateStatus calls dbGet for jh_applied_urls_p1 (moving away from 'applied')
    // and then for jh_activity_p1_j1 (auto-log). mockImplementation handles both.
    dbGet.mockImplementation((key) => {
      if (key === 'jh_apps_p1') return Promise.resolve([mockApp])
      return Promise.resolve([])  // safe for jh_applied_urls_p1 and jh_activity_p1_j1
    })

    render(<Applications profile={profile} />)

    const statusSelect = await screen.findByRole('combobox')
    await user.selectOptions(statusSelect, 'interview')

    await waitFor(() => {
      // Find the dbSet call for the activity key specifically
      const activityCall = dbSet.mock.calls.find(
        ([key]) => key === 'jh_activity_p1_j1'
      )
      expect(activityCall).toBeDefined()
      expect(activityCall[1]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'Status change' }),
        ])
      )
    })
  })
})
```

- [ ] **Step 2: Run the tests — the 4 new tests must FAIL, smoke test must PASS**

```bash
npm test src/__tests__/Applications.test.jsx
```

The 4 new tests will fail because `ActivityModal` doesn't exist and the Activity button is not in the DOM yet. The smoke test must still pass. If any of the 4 new tests pass before implementation, the assertions are wrong — stop and fix.

---

## Task 3: Implement ActivityModal component

**Files:**
- Modify: `src/components/Applications.jsx`

- [ ] **Step 1: Insert `ActivityModal` between the end of `TaskModal` and `// ─── Applications ─────`**

```jsx
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
    <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}>

        <div style={{ padding: '1.25rem 1.25rem 0.75rem', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Activity Log</h3>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{app.jobTitle} · {app.company}</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-faint)', padding: 0, lineHeight: 1 }}>✕</button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '0.75rem 1.25rem' }}>
          {entries.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-faint)', textAlign: 'center', margin: '1.5rem 0 0.5rem' }}>No activity logged yet.</p>
          ) : (
            [...entries].reverse().map((e) => (
              <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--btn-primary-bg)', marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{e.type}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-light)', flexShrink: 0 }}>{fmtEntryDate(e.createdAt)}</span>
                  </div>
                  {e.note && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{e.note}</p>}
                </div>
                <button onClick={() => removeEntry(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 14, padding: '2px 4px', flexShrink: 0 }}>✕</button>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <select value={newType} onChange={(e) => setNewType(e.target.value)} style={C.input}>
            {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            style={C.input}
            placeholder="Note (optional)"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addEntry()}
          />
          <button onClick={addEntry} style={{ ...btn('primary'), fontSize: 12, padding: '5px 12px', alignSelf: 'flex-start' }}>+ Log</button>
        </div>

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit (do not run tests yet — Activity button not wired until Task 4)**

```bash
git add src/components/Applications.jsx
git commit -m "feat: implement ActivityModal component"
```

---

## Task 4: Wire up ActivityModal in Applications and verify tests 1–3

**Files:**
- Modify: `src/components/Applications.jsx`

- [ ] **Step 1: Add `activityModalApp` state alongside `taskModalApp`**

Find:
```js
const [taskModalApp, setTaskModalApp] = useState(null)
```
Add directly below:
```js
const [activityModalApp, setActivityModalApp] = useState(null)
```

- [ ] **Step 2: Add Activity button in the card button row, after the Tasks button**

Find:
```jsx
<button onClick={() => setTaskModalApp(a)} style={{ ...btn(), fontSize: 11, padding: '4px 8px' }}>Tasks</button>
```
Add after it:
```jsx
<button onClick={() => setActivityModalApp(a)} style={{ ...btn(), fontSize: 11, padding: '4px 8px' }}>Activity</button>
```

- [ ] **Step 3: Mount ActivityModal alongside TaskModal at the bottom of the Applications return**

Find:
```jsx
{taskModalApp && <TaskModal app={taskModalApp} profileId={profile.id} onClose={() => setTaskModalApp(null)} />}
```
Add directly after:
```jsx
{activityModalApp && <ActivityModal app={activityModalApp} profileId={profile.id} onClose={() => setActivityModalApp(null)} />}
```

- [ ] **Step 4: Update `remove` to delete the activity KV key**

Find:
```js
const remove = (jobId) => { if (window.confirm('Remove this application?')) save(apps.filter((a) => a.jobId !== jobId)) }
```
Replace with:
```js
const remove = (jobId) => {
  if (window.confirm('Remove this application?')) {
    save(apps.filter((a) => a.jobId !== jobId))
    dbDelete(`jh_activity_${profile.id}_${jobId}`)
  }
}
```

- [ ] **Step 5: Run tests — ActivityModal tests 1, 2, 3 must now PASS**

```bash
npm test src/__tests__/Applications.test.jsx
```

Expected: smoke test passes, ActivityModal tests 1–3 pass, auto-log test still fails (not implemented yet). If tests 1–3 fail, debug before continuing — do not move to Task 5.

- [ ] **Step 6: Commit**

```bash
git add src/components/Applications.jsx
git commit -m "feat: wire up Activity button, modal mount, and dbDelete on remove"
```

---

## Task 5: Implement auto-logging of status changes

**Files:**
- Modify: `src/components/Applications.jsx`

- [ ] **Step 1: Replace the full `updateStatus` function**

Find the entire `updateStatus` function (it ends after the applied-url cleanup block) and replace it with:

```js
const updateStatus = async (jobId, newStatus) => {
  const app = apps.find((a) => a.jobId === jobId)
  await save(apps.map((a) => a.jobId === jobId ? { ...a, status: newStatus } : a))
  // If moving away from 'applied', remove from the applied-urls index
  if (app?.status === 'applied' && newStatus !== 'applied') {
    const index = (await dbGet(`jh_applied_urls_${profile.id}`)) || []
    const updated = index.filter((e) =>
      e.serpApiJobId && app.serpApiJobId
        ? e.serpApiJobId !== app.serpApiJobId
        : e.url !== app.url
    )
    await dbSet(`jh_applied_urls_${profile.id}`, updated)
  }
  // Auto-log the status change — non-fatal, independent of save() result
  try {
    const activityKey = `jh_activity_${profile.id}_${jobId}`
    const existing = (await dbGet(activityKey)) || []
    await dbSet(activityKey, [
      ...existing,
      {
        id: uid(),
        type: 'Status change',
        note: `${app.status} → ${newStatus}`,
        createdAt: new Date().toISOString(),
      },
    ])
  } catch (e) {
    console.error(e)
  }
}
```

Note: `app.status` is the **old** status — captured via `apps.find()` before `save()` runs. This is intentional and correct for the `"applied → interview"` note.

- [ ] **Step 2: Run all tests — all 5 must PASS**

```bash
npm test
```

If the auto-log test fails, check:
- `dbGet.mockImplementation` in the test returns `[]` for any key that isn't `jh_apps_p1` — this covers both `jh_applied_urls_p1` (consumed by the existing applied-url cleanup) and `jh_activity_p1_j1` (consumed by the auto-log block).
- The `dbSet.mock.calls.find(([key]) => key === 'jh_activity_p1_j1')` assertion correctly isolates the activity-key call from the apps-key call.

- [ ] **Step 3: Commit**

```bash
git add src/components/Applications.jsx
git commit -m "feat: auto-log status changes to application activity log"
```

---

## Task 6: Update docs

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `ROADMAP.md`

- [ ] **Step 1: Add entry to `CHANGELOG.md` under `## [Unreleased]`** (create the section if absent)

```markdown
### Added
- **Application activity log** — per-application event timeline (phone calls, emails, interviews, etc.) accessible via "Activity" button on each card; status changes are auto-logged
```

- [ ] **Step 2: Update `ROADMAP.md`** — find the activity log item and mark it as implemented (move to a completed/done section, or add a checkmark). If the item is absent from the backlog, add it to the implemented section directly.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md ROADMAP.md
git commit -m "docs: update CHANGELOG and ROADMAP for activity log release"
```

---

## Final Verification

- [ ] `npm test` — all tests pass, zero failures
- [ ] Manual smoke in `netlify dev` (port 9000):
  - "Activity" button appears on each application card
  - Empty state shows "No activity logged yet."
  - Log a Phone call entry → appears in timeline newest-first
  - Delete an entry → disappears immediately
  - Change application status → open Activity modal → "Status change" entry present with correct old→new text
  - Remove an application → no console errors
