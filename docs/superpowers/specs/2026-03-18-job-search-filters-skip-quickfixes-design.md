# Design Spec: Job Search Filters, Skip Feature + Quick Fixes

**Date:** 2026-03-18
**Status:** Draft
**Scope:** Replace fixed ROLE_QUERIES with a profile-driven adaptive query; add a filter bar to the Jobs page for per-search overrides; add a "Not Interested" skip feature; fix sort order, save button feedback, and Resume.jsx save feedback.

---

## 1. Overview

Four improvements shipped together:

1. **Adaptive query** — build 1 targeted SerpApi query from profile preferences (roles, location, work type) instead of 5 fixed ROLE_QUERIES. Reduces API usage from 5 credits/search to 1.
2. **Filter bar** — collapsible panel on the Jobs page; pre-filled from profile; user can override roles, location, work type, job type before triggering a search.
3. **Skip / Not Interested** — button on each job card to exclude a job from current and future results; stored in KV; undo available via a skip count badge.
4. **Quick fixes** — sort jobs by match % in the display; add "Saved ✓" feedback to the Resume save button.

---

## 2. Architecture

### Modified files

| File | Change |
|---|---|
| `netlify/functions/lib/job-providers/serpapi.js` | `fetchJobs()` accepts a `filters` object; builds adaptive query |
| `netlify/functions/lib/job-search-core.js` | `fetchAndScoreJobs` accepts `filters` object; adds skipped-job filter step (Step 3b) |
| `netlify/functions/jobs-search.js` | Accepts `filters` from request body; `module.exports.*` re-export lines at bottom of file are unchanged |
| `netlify/functions/scheduled-job-search-background.js` | Builds `filters` from profile preferences |
| `src/lib/api.js` | `callJobsSearch` accepts and passes `filters` |
| `src/components/Jobs.jsx` | Filter bar, Skip button, skip management, sort by matchScore |
| `src/components/Resume.jsx` | Add `saved` state + "Saved ✓" feedback |

### New KV key

| Key | Content |
|---|---|
| `jh_skipped_{profileId}` | `Array<{ url, serpApiJobId, company, title }>` |

### Unchanged
`expiry-checker.js`, `check-job-expiry-background.js`, `ai-status.js` (continues to surface `result.jobs` to the frontend poller unchanged), all auth logic, AI scoring, all other functions.

---

## 3. Adaptive Query Building

### `filters` object shape

```js
{
  roles: string,        // e.g. "Data Engineer, AI Engineer" — comma-separated
  location: string,     // e.g. "New York" — first non-"Remote" entry from preferences.locations
  workType: string,     // "remote" | "onsite" | "any"
  jobType: string,      // "any" | "fulltime" | "parttime" | "contractor"
  dateWindowDays: number, // 30 | 60
}
```

### `buildQuery(filters)` — new helper in `serpapi.js`

```js
function buildQuery(filters) {
  const roles = (filters.roles || '').split(',').map((r) => r.trim()).filter(Boolean)
  const base = roles.length > 0
    ? roles.join(' OR ')
    : 'Data Engineer OR Software Engineer OR AI Engineer OR ML Engineer OR BI Engineer'
  const workSuffix = filters.workType === 'remote' ? ' remote'
                   : filters.workType === 'onsite' ? ' on-site'
                   : ''
  return base + workSuffix
}
```

### `parseLocation(locationsStr)` — new helper in `serpapi.js`

Extracts the first non-"Remote" location from the comma-separated preferences string. Falls back to `"United States"`.

```js
function parseLocation(locationsStr) {
  const parts = (locationsStr || '').split(',').map((l) => l.trim())
  return parts.find((l) => l.toLowerCase() !== 'remote') || 'United States'
}
```

### SerpApi employment_type mapping

| `jobType` filter value | SerpApi `employment_type` |
|---|---|
| `any` | (omit param) |
| `fulltime` | `FULLTIME` |
| `parttime` | `PARTTIME` |
| `contractor` | `CONTRACTOR` |

### Updated `fetchJobs(filters)` signature

Replaces the old `fetchJobs(customQuery, location, dateWindowDays)` signature. Makes a single `fetchOnePage` call using `buildQuery(filters)` and `parseLocation(filters.location)`.

Delete the `customQuery ? [customQuery] : ROLE_QUERIES` fan-out branching and the `ROLE_QUERIES` constant entirely — after this change `fetchJobs` always makes exactly one `fetchOnePage` call.

Export `buildQuery` and `parseLocation` from `module.exports` so they can be unit-tested directly.

### `fetchOnePage` — add `employment_type` param

`fetchOnePage` is the only place the SerpApi URL is built. Update its signature to `fetchOnePage(query, location, dateWindowDays, jobType)` and conditionally append the `employment_type` param using the mapping table above:

```js
if (jobType && jobType !== 'any') {
  const typeMap = { fulltime: 'FULLTIME', parttime: 'PARTTIME', contractor: 'CONTRACTOR' }
  if (typeMap[jobType]) url.searchParams.set('employment_type', typeMap[jobType])
}
```

`fetchJobs(filters)` passes `filters.jobType` as the fourth argument to `fetchOnePage`.

### Updated `fetchAndScoreJobs` signature (`job-search-core.js`)

The `query` and `location` params are replaced by a single `filters` object. The new signature:

```js
async function fetchAndScoreJobs({
  filters,           // { roles, location, workType, jobType, dateWindowDays }
  resumeText,
  targetRoles,
  rid,
  profileId,
  userId,
  supabase,
})
```

`dateWindowDays` is read from `filters.dateWindowDays` (default `30`). The old `query`, `location`, and top-level `dateWindowDays` params are **removed** from the destructure. Delete the `query !== 'default'` sentinel line — `buildQuery(filters)` now always produces an explicit query string.

### `callJobsSearch` in `src/lib/api.js`

`callJobsSearch` is updated to accept a `filters` object and individual meta params:

```js
async function callJobsSearch({ filters, resumeText, targetRoles, profileId, onStatus }) { ... }
```

Update the `log.debug` call inside: replace `log.debug('callJobsSearch', { query })` with `log.debug('callJobsSearch', { roles: filters?.roles })`.

POST body sent to `/.netlify/functions/jobs-search`:

```json
{
  "filters": { "roles": "...", "location": "...", "workType": "...", "jobType": "...", "dateWindowDays": 30 },
  "resumeText": "...",
  "targetRoles": "...",
  "profileId": "..."
}
```

`jobs-search.js` changes:
- Destructure `{ jobId, filters, resumeText, targetRoles, profileId }` from payload (remove `query`, `location`, top-level `dateWindowDays`)
- Update validation guard: `if (!jobId || !query)` → `if (!jobId || !filters)`
- Replace the `fetchAndScoreJobs({ query, location, ... })` call-site with: `fetchAndScoreJobs({ filters, resumeText, targetRoles, rid, profileId, userId: user.sub, supabase: sb })`

The `scoreJobs` call inside `fetchAndScoreJobs` (line 211) currently falls back to `targetRoles || query`. After removing `query`, update this line to `targetRoles || filters.roles || ''`. Missing this change will cause a `ReferenceError` at runtime.

### `scheduled-job-search-background.js` — builds `filters` from profile

The background function constructs a `filters` object from profile preferences before calling `fetchAndScoreJobs`. The existing `const query = ...` and `const location = ...` derivation lines are **deleted** and replaced:

```js
const filters = {
  roles: prefs.roles || '',
  location: prefs.locations || '',        // parseLocation() is called inside fetchJobs
  workType: prefs.workType || 'any',
  jobType: prefs.jobType || 'any',
  dateWindowDays: prefs.dateWindowDays || 30,
}
await fetchAndScoreJobs({ filters, resumeText, targetRoles, rid, profileId, userId, supabase })
```

---

## 4. Filter Bar (Jobs.jsx)

A collapsible section above the job list. Pre-filled from `profileData.preferences` on mount. State is local to the component — not persisted.

The existing `const query = ...` and `const location = ...` derivation logic inside `findJobs` is **deleted**. `findJobs` reads directly from the filter bar's local state object and passes it as `filters` to `callJobsSearch`.

### Controls

| Label | Control | Default value |
|---|---|---|
| Roles / keywords | `<input>` | `preferences.roles` |
| Location | `<input>` | first non-"Remote" from `preferences.locations` |
| Work type | `<select>` Any / Remote / On-site | `preferences.workType` |
| Job type | `<select>` Any / Full-time / Contract / Part-time | `"any"` |

A **"Search"** button applies the filters and triggers a new search. Filters do not auto-trigger on change (avoids accidental API credit use).

A **collapse toggle** ("▸ Filters" / "▾ Filters") shows/hides the bar.
- **No results yet** (first visit or after clear): filter bar **expanded** by default.
- **Results already showing**: filter bar **collapsed** by default.

---

## 5. Skip / Not Interested Feature

### State initialisation

On mount, load `jh_skipped_{profileId}` via `dbGet` and initialise `skippedJobs` state from the result (same pattern as `scheduledStatus` in Jobs.jsx). This ensures the skip count badge persists across page refreshes.

### UI

A **"Skip"** button on each job card (next to "Apply →"). Visible only on jobs with `status !== 'applied'`.

On click:
1. Removes the job from the current displayed list immediately (local state update)
2. Appends `{ url, serpApiJobId, company, title }` to `jh_skipped_{profileId}` via `dbSet`

### Undo

A **"X skipped"** text link shown in the filter bar area when `skippedJobs.length > 0`. Clicking opens an inline list of skipped jobs, each with an **"Undo"** button that:
1. Removes the matching entry from the `skippedJobs` local state array (immediate UI update)
2. Writes the updated array back to `jh_skipped_{profileId}` via `dbSet`

No network re-fetch is triggered — undo is a local state splice only. The undone job does not reappear in the current displayed list (the job list is not re-queried); it simply means the job will no longer be filtered out in future searches. Add a note next to the Undo button: *"Job will reappear in your next search."*

### Pipeline integration (`job-search-core.js`)

New Step 3b, inserted between the applied-job filter and the quality filter:

```
Step 1: Fetch
Step 2: Date-window filter
Step 3: Applied-job filter   ← existing
Step 3b: Skipped-job filter  ← NEW
Step 4: Quality filter
Step 5: Link validation
Step 6: AI scoring
Step 7: Sort / cap at 20
```

Uses the same three-level match logic as applied-job filter: URL match → `serpApiJobId` match → normalised `company+title` match.

Reads `jh_skipped_{profileId}` from Supabase (same pattern as `jh_applied_urls_{profileId}`). Requires `profileId`, `userId`, `supabase` — skipped gracefully if absent (same guard as applied-filter).

---

## 6. Quick Fixes

### Sort by match % (Jobs.jsx)

Add `.sort((a, b) => b.matchScore - a.matchScore)` to the `filtered` derivation in Jobs.jsx. Jobs without a `matchScore` (old stored jobs) sort to the bottom.

### Resume save button feedback (Resume.jsx)

Make `save` async, await `onUpdate`, then set a `saved` state for 2 seconds — identical pattern to Settings.jsx:

```js
const [saved, setSaved] = useState(false)
const save = async () => {
  await onUpdate((prev) => ({ ...prev, resumeText: text }))
  setSaved(true)
  setTimeout(() => setSaved(false), 2000)
}
```

Button label: `{saved ? 'Saved ✓' : 'Save'}`.

---

## 7. Data Model Changes

No new fields on stored job objects. New KV key only:

| Key | Type | Description |
|---|---|---|
| `jh_skipped_{profileId}` | `Array<{url, serpApiJobId, company, title}>` | Jobs the user has dismissed |

---

## 8. Testing

### Updated tests (`netlify/functions/__tests__/serpapi.test.js`)
- `buildQuery`: roles only; roles + remote; roles + onsite; empty roles → fallback query
- `parseLocation`: "Remote, New York" → "New York"; "Remote" only → "United States"; empty → "United States"
- `fetchJobs(filters)`: verify query built correctly; verify `employment_type` param set when jobType is not "any"
- Source sort order test: replace old `fetchJobs('Software Engineer', 'United States', 30)` call with `fetchJobs({ roles: 'Software Engineer', location: 'United States', workType: 'any', jobType: 'any', dateWindowDays: 30 })`. **This must be done in the same commit as the `serpapi.js` change** — the test will fail immediately after `serpapi.js` is updated if not updated together.

### New tests (`netlify/functions/__tests__/jobs-search.test.js`)
- `isWithinDateWindow` — unchanged
- Quality filters — unchanged
- No new backend tests needed for skip filter (mirrors applied-filter logic already tested)

### No new test files — ~5 updated tests in serpapi.test.js

---

## 9. Out of Scope

- Persisting filter bar state across sessions (always resets to profile defaults)
- Salary range filter (SerpApi doesn't support server-side salary filtering)
- Seniority level filter (SerpApi `chips` param is unstable across regions)
- Moving semantic keyword analysis tab
