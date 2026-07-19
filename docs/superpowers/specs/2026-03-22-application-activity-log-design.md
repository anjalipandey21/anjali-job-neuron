# Application Activity Log — Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Inspired by:** [JobSync](https://github.com/Gsync/jobsync) activity log concept

---

## Overview

A timestamped event log per job application. Users can record what happened during the application process (calls, emails, interviews, rejections, etc.) and view a full history timeline. Status changes are auto-logged so the timeline fills in even without manual entries.

---

## Goals

- Give users a chronological, auditable history of each application
- Require minimal effort to log — one dropdown + optional note
- Auto-capture status transitions so the log is useful from day one
- Follow existing codebase patterns exactly (no new architectural ideas)

## Non-Goals

- Global activity timeline across all applications
- Time/duration tracking (that's JobSync's scope, not ours)
- Editing entries (append-only log; delete if needed)
- User-managed activity type categories

---

## Data Model

**KV key:** `jh_activity_{profileId}_{jobId}`

**Value:** JSON array of activity entry objects, ordered oldest-first (newest displayed first in UI).

```js
[
  {
    id: "abc1234",                          // uid() — 7-char random string from src/lib/helpers.js
    type: "Phone call",                     // one of ACTIVITY_TYPES preset list
    note: "Recruiter intro, remote-first",  // optional free text, may be ""
    createdAt: "2026-03-19T14:32:00.000Z",  // ISO timestamp, set on add, never edited
  },
  ...
]
```

**Preset type list (fixed in code):**
```js
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

Auto-logged entries (from status changes) use `type: 'Status change'` and a generated note like `"applied → interview"`. `'Status change'` is not in the user-selectable preset list — it only appears via automation.

---

## Components

### `ActivityModal` (private, co-located in `Applications.jsx`)

Co-located alongside `TaskModal` in the same file. Not exported.

**Props:**
```js
ActivityModal({ app, profileId, onClose })
```

**State:**
```js
const [entries, setEntries] = useState([])
const [newType, setNewType] = useState(ACTIVITY_TYPES[0])
const [newNote, setNewNote] = useState('')
```

**KV key:** `jh_activity_${profileId}_${app.jobId}`

**Layout — Timeline top, add form pinned at bottom:**

```
┌─ Activity Log · {jobTitle} @ {company} ─────────────┐
│                                            [✕ close] │
├─────────────────────────────────────────────────────┤
│ (scrollable timeline, flex:1 overflow:auto)         │
│  ● Interview (technical)        Mar 22, 2026  [✕]  │
│    Went well — asked about distributed systems      │
│                                                     │
│  ● Phone call                   Mar 19, 2026  [✕]  │
│    Recruiter intro, 30 min, remote-first            │
│                                                     │
│  ● Email sent                   Mar 17, 2026  [✕]  │
├─────────────────────────────────────────────────────┤
│ (add form — always visible, not scrolled)           │
│ [select type ▾]                                     │
│ [note (optional)........................]            │
│ [+ Log]                                             │
└─────────────────────────────────────────────────────┘
```

The add form is a vertical stack (type select, note input, button on separate lines) — not a single horizontal row — so `C.input` `width: 100%` applies without override.

There is **no "Done" footer button** — the only dismiss affordance is the ✕ in the header. This is intentional and differs from `TaskModal`.

**Behaviour:**
- On mount: `dbGet(key).then(data => setEntries(data || []))`
- Add: append `{ id: uid(), type: newType, note: newNote.trim(), createdAt: new Date().toISOString() }` → `dbSet(key, updated)`. `newNote` cleared after add; `newType` resets to `ACTIVITY_TYPES[0]`.
- Delete: no `window.confirm` (entries are small, easily re-added; confirm friction not worth it). Filter by id → `dbSet(key, updated)`.
- Display: `[...entries].reverse()` (newest first)
- Empty state: `"No activity logged yet."` centred in the scroll area
- `uid` is imported from `../lib/helpers` — do not redefine locally

**Date display:** Do **not** use `fmtDate()` for activity timestamps — `fmtDate` calls `new Date(s)` on a date-only string which parses as UTC midnight and shifts the date for users in UTC− timezones. Since `createdAt` is a full ISO timestamp, call `toLocaleDateString` directly:
```js
new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
```

### Trigger in `Applications` component

Adds `activityModalApp` state alongside the existing `taskModalApp`. Both modals can be open simultaneously (same as the existing pattern — no guard needed):

```jsx
const [activityModalApp, setActivityModalApp] = useState(null)

// Button inside the existing button row, alongside "Tasks"
<button onClick={() => setActivityModalApp(a)} style={{ ...btn(), fontSize: 11, padding: '4px 8px' }}>Activity</button>

// Modal mount alongside existing TaskModal mount
{activityModalApp && (
  <ActivityModal app={activityModalApp} profileId={profile.id} onClose={() => setActivityModalApp(null)} />
)}
```

### Application removal — clean up orphaned activity key

`remove(jobId)` must also delete the activity KV key to avoid orphaned data:

```js
const remove = (jobId) => {
  if (window.confirm('Remove this application?')) {
    save(apps.filter((a) => a.jobId !== jobId))
    dbDelete(`jh_activity_${profile.id}_${jobId}`)  // add this line
  }
}
```

`dbDelete` is already exported from `src/lib/api.js` — import it alongside `dbGet`/`dbSet`.

---

## Auto-Logging Status Changes

When `updateStatus(jobId, newStatus)` is called, an activity entry is automatically appended **after** the apps save succeeds. The auto-log is independent — if it fails, it is swallowed silently and does not affect the status update. If the apps save itself fails, the auto-log is still attempted (the two operations are independent; both run on a best-effort basis).

`profile` referenced below is the `profile` prop already in scope in the `Applications` component closure — no extra argument needed.

```js
const updateStatus = async (jobId, newStatus) => {
  const app = apps.find((a) => a.jobId === jobId)
  // ... existing status update + applied-url index logic (unchanged) ...

  // Auto-log — non-fatal, runs independently of save() result
  try {
    const activityKey = `jh_activity_${profile.id}_${jobId}`
    const existing = (await dbGet(activityKey)) || []
    await dbSet(activityKey, [
      ...existing,
      {
        id: uid(),
        type: 'Status change',
        note: `${app.status} → ${newStatus}`,   // app.status is the OLD status (captured before save)
        createdAt: new Date().toISOString(),
      },
    ])
  } catch (e) {
    console.error(e)
  }
}
```

---

## Timeline Entry Styling

Each entry in the timeline:

```
● {type}                          {new Date(createdAt).toLocaleDateString(...)}  [✕]
  {note}                          (only shown if note is non-empty)
```

- Dot: 8×8px circle, `background: var(--btn-primary-bg)`, `border-radius: 50%`, `margin-top: 4px`, `flex-shrink: 0`
- Type label: `font-size: 13`, `font-weight: 500`
- Date: `font-size: 11`, `color: var(--text-light)`, right side of a flex row with type label
- Note: `font-size: 12`, `color: var(--text-muted)`, `margin-top: 2px`
- Delete button: `✕`, `background: none`, `border: none`, `color: var(--text-faint)`, `cursor: pointer`
- Entries separated by `border-bottom: 1px solid var(--border-light)`
- Single accent colour (`var(--btn-primary-bg)`) for all entry types — no per-type colour mapping

---

## Error Handling

- KV read failure on modal open: silently falls back to `[]`
- KV write failure on add/delete: `console.error` only
- Auto-log failure in `updateStatus`: `try/catch` — `console.error`, status update unaffected
- `dbDelete` failure in `remove`: non-fatal, no guard needed (orphaned key is harmless)

---

## KV Keys Summary

| Key | Content |
|---|---|
| `jh_activity_{profileId}_{jobId}` | Array of activity entry objects for one application |

The `dev_` prefix applies automatically in local dev via `db.js`. No other new keys.

---

## Tests

Four new tests in `src/__tests__/Applications.test.jsx`. All mock `src/lib/api` with:
```js
vi.mock('../lib/api', () => ({ dbGet: vi.fn(), dbSet: vi.fn(), dbDelete: vi.fn() }))
```

Each test that exercises add/delete must configure `dbGet` to return a pre-populated array for the modal's `useEffect` load:
```js
dbGet.mockResolvedValueOnce([
  { id: 'e1', type: 'Phone call', note: 'test', createdAt: '2026-03-19T10:00:00.000Z' }
])
```

| # | Test | Assertion |
|---|---|---|
| 1 | Loading state | `ActivityModal` renders "No activity logged yet." when `dbGet` returns `null` |
| 2 | Add entry | After clicking "+ Log", `dbSet` is called with the activity key as first arg and an array including a new entry object as second arg |
| 3 | Delete entry | After clicking ✕ on an entry (with pre-populated `dbGet` mock), `dbSet` is called with the activity key and an array that no longer contains that entry |
| 4 | Auto-log on status change | Changing the status `<select>` triggers `dbSet` called with `jh_activity_{profileId}_{jobId}` as first arg and an array containing `{ type: 'Status change', ... }` — distinct from the `dbSet` call for `jh_apps_{profileId}` |

---

## Implementation Checklist

- [ ] Import `dbDelete` alongside `dbGet`/`dbSet` in `Applications.jsx`
- [ ] Add `ACTIVITY_TYPES` constant to `Applications.jsx`
- [ ] Add `ActivityModal` component (private) to `Applications.jsx`
- [ ] Add `activityModalApp` state and "Activity" button to `Applications` component
- [ ] Add `ActivityModal` mount at the bottom of `Applications` JSX
- [ ] Update `updateStatus` to auto-log status changes
- [ ] Update `remove` to call `dbDelete` on the activity key
- [ ] Update the existing `vi.mock('../lib/api', ...)` in `Applications.test.jsx` to include `dbDelete: vi.fn()`
- [ ] Add 4 tests to `src/__tests__/Applications.test.jsx`
- [ ] Update `CHANGELOG.md`
- [ ] Update `ROADMAP.md` (move item from Backlog → Implemented)
