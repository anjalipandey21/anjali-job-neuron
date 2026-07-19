# Scheduled Daily Job Search — Design Spec

**Date:** 2026-03-18
**Status:** Approved (v3 — post spec-review round 2)
**Feature:** Automatically run each profile's job search at 8 AM local time, per-profile opt-in

---

## Overview

A Netlify scheduled background function runs every 6 hours. It scans all opted-in profiles across all users, determines which ones are due for their 8 AM local-time run, executes the job search, and records the outcome. The user experience is silent on success; a visible error banner appears on the Jobs tab if the run fails.

> **Reliability note:** Netlify scheduled functions are best-effort, not guaranteed. A missed window is acceptable — the run will be attempted on the next 6-hour tick, and the already-ran-today guard prevents double-runs.

---

## 1. Data Model

### Profile object additions (`jh_p_{profileId}`)

Two new fields added **inside `preferences`** (same object as `locations`, `roles`, `darkMode`):

```js
preferences: {
  locations: "...",
  roles: "...",
  darkMode: false,
  scheduledSearch: false,          // NEW — opt-in toggle, default false
  timezone: "America/New_York",    // NEW — IANA string; re-detected from browser on every save
}
```

`timezone` is re-detected via `Intl.DateTimeFormat().resolvedOptions().timeZone` on **every** save of the preferences form — not just the first save. This keeps it current if the user's location changes. No user action beyond a normal preferences save is required.

These fields are saved by the existing `onUpdate((prev) => ({ ...prev, preferences: form }))` flow — no separate save action is needed.

### New KV key: `jh_scheduled_status_{profileId}`

```js
{
  lastRunDate: "2026-03-18",      // user's local date in their timezone (YYYY-MM-DD)
  status: "success" | "error",
  error: string | null
}
```

`lastRunDate` is always the user's local date in `preferences.timezone`, never the server's UTC date.

---

## 2. Shared Job-Search Library

**File:** `netlify/functions/lib/job-search-core.js`

The core search-and-score logic currently in `jobs-search.js` is extracted into a shared CommonJS module so the scheduled function can reuse it without duplicating code.

**Exported:**

```js
// Main entry point — full pipeline: fetch → quality filter → AI score → normalize to final shape
// Returns up to 20 normalized job objects ready to store (id, title, company, url, links,
// matchScore, matchReason, isReputable, status, source, etc.)
// Throws on JSearch API failure
async function fetchAndScoreJobs({ query, location, resumeText, targetRoles, rid })

// Quality filter helpers — re-exported for backward compatibility with existing tests
module.exports.isStaffingAgency   = ...
module.exports.hasGoodDescription = ...
module.exports.isReputableSource  = ...
module.exports.deduplicateSimilar = ...
module.exports.applyQualityFilters = ...
module.exports.getBestLink        = ...
module.exports.is60DaysOld        = ...
```

**`jobs-search.js` is refactored** to import `fetchAndScoreJobs` from this lib and **re-export all quality filter functions** so existing test imports from `jobs-search.js` continue to work without modification:

```js
// jobs-search.js (after refactor)
const { fetchAndScoreJobs, isStaffingAgency, ... } = require('./lib/job-search-core')
// ...handler logic...
module.exports.isStaffingAgency   = isStaffingAgency  // re-exported for tests
// etc.
```

> **Important:** The scheduled function writes results **directly to `kv_store`** (`jh_jobs_{profileId}_{date}`), bypassing `bg_jobs` entirely. `bg_jobs` is only used by the HTTP-triggered flow where the frontend polls for completion. The scheduled function has no frontend polling it, so the `bg_jobs` pattern does not apply.

---

## 3. Scheduled Function

**File:** `netlify/functions/scheduled-job-search-background.js`

The `-background` suffix is intentional: this is a **Netlify scheduled background function** (combines scheduled trigger + background timeout). It gets up to 15 minutes, which is needed to process multiple profiles sequentially. Regular scheduled functions have a 10-second limit, which is insufficient.

**Cron:** `0 */6 * * *` — fires at 00:00, 06:00, 12:00, 18:00 UTC (4×/day)

**`netlify.toml` entry:**
```toml
[functions."scheduled-job-search-background"]
  schedule = "0 */6 * * *"
  timeout  = 900
```

> **Timeout override required:** The existing `[functions."*"] timeout = 26` wildcard in `netlify.toml` caps all functions at 26 seconds. Background functions normally get up to 15 minutes (900 s), but the wildcard may override this. Setting `timeout = 900` explicitly in the per-function stanza ensures the full timeout is available to process multiple user profiles without being killed early.

> **Dev environment:** Netlify scheduled functions are triggered by Netlify's infrastructure only — they do not run via `netlify dev`. The function always uses **bare (non-prefixed) KV keys** (e.g. `jh_profiles`, not `dev_jh_profiles`). Local end-to-end testing of the scheduled flow is not supported; test the logic via unit tests instead.

### Request ID

Scheduled functions receive no HTTP headers, so `rid` is generated per-profile as:
```js
const rid = `sched-${profileStub.id.slice(0, 6)}-${Date.now()}`
```

### Algorithm

```
sb = supabaseServiceClient()

// Cross-user scan — no user_id filter; service key required; returns one row per user
// Supabase call: sb.from('kv_store').select('user_id, value').eq('key', 'jh_profiles')
rows = await sb.from('kv_store').select('user_id, value').eq('key', 'jh_profiles')

for each row (one row per user):
  userId = row.user_id
  profiles = row.value   // array of profile stubs

  for each profileStub in profiles:
    rid = `sched-${profileStub.id.slice(0,6)}-${Date.now()}`

    // Always filter by both user_id and key on every Supabase read
    profileData = sb.from('kv_store').select('value')
                    .eq('user_id', userId)
                    .eq('key', `jh_p_${profileStub.id}`)
                    .single()
    prefs = profileData.preferences

    if prefs.scheduledSearch !== true → skip
    if prefs.timezone missing or invalid → log warning, skip

    statusRecord = sb.from('kv_store').select('value')
                     .eq('user_id', userId)
                     .eq('key', `jh_scheduled_status_${profileStub.id}`)
                     .maybeSingle()

    localDate = getLocalDate(prefs.timezone, nowUtc)  // YYYY-MM-DD in user's TZ

    if statusRecord?.lastRunDate === localDate → skip (already ran today)
    if 8 AM in prefs.timezone does NOT fall in current 6-hr UTC window → skip
    if !profileData.resumeText → upsert error status, skip

    query       = prefs.roles || 'default'
    location    = (prefs.locations || 'United States').split(',')[0].trim()
    resumeText  = profileData.resumeText
    targetRoles = prefs.roles || ''   // same as query; used in AI scoring prompt

    try:
      jobs = await fetchAndScoreJobs({ query, location, resumeText, targetRoles, rid })
      sb.upsert({ user_id: userId, key: `jh_jobs_${profileStub.id}_${localDate}`, value: jobs },
                { onConflict: 'user_id,key' })
      sb.upsert({ user_id: userId, key: `jh_scheduled_status_${profileStub.id}`,
                  value: { lastRunDate: localDate, status: 'success', error: null } },
                { onConflict: 'user_id,key' })
    catch err:
      sb.upsert({ user_id: userId, key: `jh_scheduled_status_${profileStub.id}`,
                  value: { lastRunDate: localDate, status: 'error', error: err.message } },
                { onConflict: 'user_id,key' })
```

### 6-hour window logic

Window = `[floor(hour/6)*6, floor(hour/6)*6 + 6)`. A profile is due if:
1. 8 AM in `prefs.timezone` maps to a UTC hour that falls within this window, AND
2. `statusRecord?.lastRunDate !== localDate` (hasn't run yet today in the profile's local TZ)

---

## 4. UI Changes

### Settings.jsx — Job Search card

New card added below "Job search preferences":

```
┌─ Job Search ─────────────────────────────────────────────┐
│ ☐  Run daily job search automatically                     │
│    Runs at 8 AM in your local timezone                    │
└───────────────────────────────────────────────────────────┘
```

**Form state changes:**
- `scheduledSearch: false` added to the initial `useState` default (alongside `locations`, `roles`, `darkMode`)
- The `useEffect` that sets form from `profileData.preferences` already overwrites all fields — the default ensures the field exists even before `profileData` loads
- `timezone` is **not** part of the visible form; it is injected into `form` inside the `save()` handler just before calling `onUpdate`:

```js
const save = async () => {
  const formWithTz = { ...form, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
  await onUpdate((prev) => ({ ...prev, preferences: formWithTz }))
  setSaved(true)
  setTimeout(() => setSaved(false), 2000)
}
```

### Jobs.jsx — Error banner + status fetch

New `useEffect` alongside the existing jobs fetch:

```js
const [scheduledStatus, setScheduledStatus] = useState(null)

useEffect(() => {
  dbGet(`jh_scheduled_status_${profile.id}`).then(setScheduledStatus)
}, [profile.id])
```

When `scheduledStatus?.status === 'error'`, render a dismissible banner above the jobs list:

```
⚠  Scheduled job search failed — [scheduledStatus.error]. You can run it manually.  ✕
```

- `✕` sets local `dismissed` state to `true` — not persisted, resets on profile change
- No UI shown on success (silent)

---

## 5. Error Handling & Edge Cases

| Scenario | Behaviour |
|---|---|
| Profile has no resume | Upsert `{ status: 'error', error: 'No resume found' }`; skip |
| JSearch API failure | Upsert error status; continue processing other profiles |
| Invalid or missing timezone | Log warning; skip profile entirely |
| Already ran today | `lastRunDate === localDate` guard (local date in profile's TZ) |
| 8 AM not in current window | Skip; picked up on the correct 6-hr window |
| Function crash | Netlify logs capture it; next run retries affected profiles |
| Profile data missing/null | Skip with warning; don't crash the loop |

---

## 6. Testing

**File:** `netlify/functions/__tests__/scheduled-job-search.test.js`

### Pure functions to export and test

| Function | Tests |
|---|---|
| `isProfileDue(prefs, statusRecord, nowUtc)` | In-window at 8 AM; outside window; already ran today; opted-out; missing TZ |
| `getLocalDate(timezone, nowUtc)` | Timezone conversion; invalid TZ returns null |
| `getProfilesToRun(allRows, nowUtc)` | Multi-user/profile; filters opted-out; respects already-ran; missing profileData |

### Coverage notes

- `fetchAndScoreJobs` logic covered by existing `jobs-search.test.js` — not duplicated
- Existing tests that import quality filter functions from `jobs-search.js` continue to work (re-exported after refactor)
- Live Supabase + JSearch calls skipped in CI per project convention
- Error paths (no resume, API throw) tested via mocked `fetchAndScoreJobs`

---

## 7. Files Changed / Created

| File | Change |
|---|---|
| `netlify/functions/lib/job-search-core.js` | New — `fetchAndScoreJobs` + all quality filter exports |
| `netlify/functions/jobs-search.js` | Refactored to use lib; re-exports quality filters for test compat |
| `netlify/functions/scheduled-job-search-background.js` | New — scheduled background function |
| `netlify/functions/__tests__/scheduled-job-search.test.js` | New — unit tests |
| `netlify.toml` | Add cron schedule entry |
| `src/components/Settings.jsx` | Add Job Search card; inject timezone in save handler |
| `src/components/Jobs.jsx` | Add status fetch on mount; add dismissible error banner |

---

## 8. Out of Scope

- Email notifications on success or failure (separate roadmap item: Email digest)
- User-visible timezone picker (auto-detection on save is sufficient)
- Retry logic on failure
- Dev environment scheduled runs
- `bg_jobs` integration for scheduled runs (no frontend polling required)
