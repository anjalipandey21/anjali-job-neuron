# Job Search Quality Improvements — Design Spec
**Date:** 2026-04-12
**Status:** Approved

---

## Overview

Improve job search result quality and UX through four coordinated changes:
1. Remove description truncation so full job text is stored and used for scoring.
2. Upgrade link verification from HEAD to GET with content-based dead-listing detection (bounded body read, short timeout to stay within Netlify's 26s function limit).
3. Pre-fetch a larger pool of jobs upfront (5 SerpApi pages in parallel) and serve them via infinite scroll.
4. Applied-job filtering runs client-side per scroll so users never see roles they've already applied to during the current session (the server-side pipeline already filters prior-session applied jobs before they enter the pool).

---

## 1. Backend — `netlify/functions/lib/job-providers/serpapi.js`

### 1a. Remove description truncation
`normaliseJob` currently does `.slice(0, 1200)` on the description field. Remove this cap entirely.

### 1b. SerpApi pagination support

**`fetchOnePage` new signature:**
```js
async function fetchOnePage(query, location, dateWindowDays, jobType, apiKey, start = 0)
```
`start` is added as the last parameter so the existing `fetchJobs` call-site at line 163 is unaffected (positional arguments don't change). Map `start` to SerpApi's `start` query param when non-zero.

**`fetchAllPages(filters, pageCount = 5)`:**
- Build `query`, `location`, `days`, `jobType` from `filters` once.
- Use `withKeyRotation('SERPAPI_KEY', ...)` a single time to obtain one API key for the full batch (the key is passed explicitly to all 5 `fetchOnePage` calls). This respects the key-rotation contract — one logical operation, one key selection — while allowing the 5 parallel requests to use that key concurrently.
- Fire all 5 `fetchOnePage` calls in parallel (`start = 0, 10, 20, 30, 40`).
- Deduplicate by `serpApiJobId` first (exact match), then by the normalized `company::title` key (same logic as the existing `deduplicateSimilar` in `job-search-core.js`) to handle near-duplicates across pages.
- Sort by `_sourcePriority` before returning, then strip the `_sourcePriority` field from each job (same as `fetchJobs` does at its line 179 — `_sourcePriority` is an internal sort field and must not be stored in KV).
- Return up to ~50 results.

**`fetchJobs` is kept unchanged** — used by existing tests and as a single-page fallback. Its call-site in `job-search-core.js` is replaced by `fetchAllPages`.

---

## 2. Backend — `netlify/functions/lib/expiry-checker.js`

### GET + bounded content-based dead-listing detection

**`isLinkAlive` updated strategy** (stays within the 26s function timeout):
- Switch from `HEAD` to `GET` with a **2-second timeout** (reduced from 5s).
- Read only the **first 8 KB** of the response body using the Streams API (`res.body.getReader()` + cancel after 8192 bytes). This is sufficient for page title / early body content where closed-job banners appear; it also prevents large-page body transfers.
- Scan the extracted text (lowercased) for dead-listing signals:
  - `"no longer accepting applications"`
  - `"this position has been filled"`
  - `"job is no longer available"`
  - `"posting has expired"`
  - `"this job has been closed"`
  - `"position is no longer open"`
- Use **complete phrase matching only** (not short substrings like "no longer available") to minimize false positives against job descriptions that mention policy text.
- Return `false` if any phrase matches or if status is 404/410.
- Return `null` on timeout, network error, or non-text `Content-Type` (job is kept).
- Return `true` otherwise.

**Timeout budget analysis:**
- 50 jobs ÷ `concurrency=10` = 5 serial batches × 2s timeout = ≤10s for link validation.
- Combined with 5 parallel SerpApi fetches (~3s) and AI scoring (~5s): total ≤18s — within the 26s limit.

`validateJobLinks` concurrency updated from 5 to 10 to match the tighter timeout budget.

---

## 3. Backend — `netlify/functions/lib/job-search-core.js`

### 3a. Full descriptions in AI scoring

In `scoreJobs`:
- Remove `.slice(0, 300)` on description — use the full description text.
- Remove the filter limiting highlights to only the "Qualifications" section — include all `job_highlights` sections (`Qualifications`, `Responsibilities`, `Benefits`, etc.).
- Remove the `.slice(0, 5)` cap on highlight items.
- Increase the `tokens` parameter from `2000` to `4000` for the AI scoring call. With 25 full descriptions, expected output is ~25 × 40 tokens = ~1,000 tokens; 4,000 provides comfortable headroom.
- Score the **top 25** jobs after quality-filter (up from 20). Pass `jobs.slice(0, 25)` to `scoreJobs`.

**Note for implementors:** `TailorModal` in `Jobs.jsx` (line 237) reads `highlights` with its own `.find('Qualifications')` logic — this is intentionally separate from backend scoring and is **out of scope** for this spec.

### 3b. Larger pool

`fetchAndScoreJobs` calls `fetchAllPages` instead of `fetchJobs`. The final pool cap increases from 20 to 50:
- `validJobs.slice(0, 50)` for annotation.
- `jobs.slice(0, 50)` returned to the caller.
- Variable name `top20` in `jobs-search.js` is renamed to `jobs` for accuracy.

### 3c. Scheduled search compatibility

`scheduled-job-search-background.js` also calls `fetchAndScoreJobs`. After this change, it will return up to 50 jobs. The scheduled search should write the full 50 to `jh_jobs_pool_{profileId}_{localDate}` and write the **first 10** to `jh_jobs_{profileId}_{localDate}` for backward compatibility with `MainApp.jsx` and `Dashboard.jsx` badge counts until those are updated.

---

## 4. Frontend — `src/components/Jobs.jsx`

### 4a. KV key roles (post-refactor)

| Key | Shape | Purpose |
|-----|-------|---------|
| `jh_jobs_pool_{profileId}_{date}` | `Job[]` (up to 50) | Full pool from backend. Written once per search. Never mutated by UI actions. |
| `jh_jobs_{profileId}_{date}` | `{ id, status, customResume, tailorResult, appliedAt }[]` | Sparse mutation log. Written on apply/customize/tailor. One entry per job that has been interacted with. |

`visibleJobs` is derived by:
1. Filtering `jobPool` to exclude jobs in the current-session `appliedSet`.
2. Slicing to `visibleCount`.
3. For each job, merging any matching entry from the mutation log (`jh_jobs_`) by `id` — overlaying `status`, `customResume`, `tailorResult`, `appliedAt`.

### 4b. New state

```js
const [jobPool, setJobPool]         = useState([])   // full fetched pool
const [visibleCount, setVisibleCount] = useState(10)  // cards to render
const [appliedSet, setAppliedSet]   = useState(new Set())  // url + serpApiJobId
const [mutations, setMutations]     = useState([])    // jh_jobs_ log
```

The existing `jobs` state is **removed**. All render logic that referenced `jobs` moves to the derived `visibleJobs` computation.

### 4c. On mount

```js
useEffect(() => {
  Promise.all([
    dbGet(`jh_jobs_pool_${profile.id}_${todayStr()}`),
    dbGet(`jh_jobs_${profile.id}_${todayStr()}`),
    dbGet(`jh_applied_urls_${profile.id}`),
  ]).then(([pool, muts, applied]) => {
    setJobPool(pool || [])
    setMutations(muts || [])
    const aSet = new Set()
    ;(applied || []).forEach((a) => { if (a.url) aSet.add(a.url); if (a.serpApiJobId) aSet.add(a.serpApiJobId) })
    setAppliedSet(aSet)
  })
}, [profile.id])
```

### 4d. Infinite scroll mechanic

An `IntersectionObserver` is created once in a `useEffect` with no state dependencies. It watches a sentinel `<div ref={sentinelRef}>` rendered after the last card. To avoid stale closure bugs, the `visibleCount` increment uses a **ref** (`visibleCountRef`) that stays in sync with `setVisibleCount`:

```js
const visibleCountRef = useRef(10)

const observer = new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) return
  const next = visibleCountRef.current + 10
  visibleCountRef.current = next
  setVisibleCount(next)
})
if (sentinelRef.current) observer.observe(sentinelRef.current)
return () => observer.disconnect()
```

The sentinel `<div ref={sentinelRef}>` must be rendered **unconditionally** (always present in the DOM), not conditionally on `jobPool.length > 0`. This ensures the single-run observer effect can observe it on mount. When the pool is empty, style the sentinel as invisible (`height: 0`, no margin). When the filtered pool is exhausted, hide the sentinel via CSS and show "You've seen all available jobs for today."

### 4e. `handleApply` preservation

`handleApply` retains the existing 750ms `setTimeout` with functional `setMutations((prev) => ...)` updater (analogous to the current `setJobs` pattern). After apply:
1. Write the new application to `jh_apps_` and `jh_applied_urls_` (unchanged).
2. Update `appliedSet` to include the newly-applied URL and `serpApiJobId` — this immediately removes the job from future scroll chunks without a re-fetch.
3. Update `mutations` with `{ id, status: 'applied', appliedAt }` after the 750ms animation delay (functional updater to avoid stale closure).

### 4f. "Find Jobs" on new search

1. Reset: `setJobPool([])`, `setVisibleCount(10)`, `visibleCountRef.current = 10`.
2. Clear `jh_jobs_pool_` and `jh_jobs_` for today in KV.
3. Trigger background search (unchanged).
4. On search complete: set `jobPool` from result, write `jh_jobs_pool_`, write first mutation-log entries if any.

### 4g. UI copy updates

The following exact strings must be updated (case-sensitive search for `"Find 20"` will find all of them):
- `Jobs.jsx`: `'Find 20 jobs'` → `'Find jobs'`
- `Jobs.jsx`: `'Find 20 matching jobs'` → `'Find jobs'` (check for any variant)
- `Dashboard.jsx` line 66: `'Find 20 matching jobs today'` → `'Find jobs'`

When in doubt, search the entire `src/` tree for the substring `"Find 20"` and update every occurrence.

### 4h. `MainApp.jsx` and `Dashboard.jsx` badge counts

`MainApp.jsx` (line 112) and `Dashboard.jsx` read job counts from `jh_jobs_{profileId}_{date}`. Update both to read from `jh_jobs_pool_{profileId}_{date}` for the count. The pool key length is the authoritative total.

---

## 5. Data Flow Summary

```
User clicks "Find Jobs"
  → jobs-search.js: fetchAllPages (5× SerpApi in parallel, single key from rotation)
  → pipeline: date filter → applied filter → skipped filter → quality filter
             → GET link check (8KB body, 2s timeout, concurrency=10)
             → AI score (full desc + all quals, top 25, tokens=4000)
  → returns up to 50 jobs → stored in bg_jobs.result.jobs
  → frontend polls → writes jh_jobs_pool_ (50) + clears jh_jobs_
  → UI renders first 10 (filtered for current-session applied jobs)

User scrolls to bottom sentinel
  → IntersectionObserver fires → visibleCountRef +10 → setVisibleCount
  → visibleJobs re-derived: jobPool.filter(notInAppliedSet).slice(0, visibleCount).map(mergeStatus)
  → 10 more cards appear instantly (no network call)

User clicks Apply on a job
  → window.open, setApplyingId (animation)
  → write jh_apps_, jh_applied_urls_ (unchanged)
  → add to appliedSet (job vanishes from next scroll chunk)
  → after 750ms: update mutations with applied status
             + dbSet(`jh_jobs_${profile.id}_${todayStr()}`, updatedMutations)
```

---

## 5a. Implementation Traps

These are non-obvious pitfalls that must be observed during implementation:

1. **Do not name any local variable `s` in `Jobs.jsx`** — the CSS Module is imported as `import s from './Jobs.module.css'`. Any temporary variable inside a callback (e.g. the `new Set()` builder in the on-mount effect) must use a different name such as `aSet` or `newSet`. This is called out in `CLAUDE.md`.

2. **Null-guard `sentinelRef` before `observer.observe`** — the sentinel `<div>` may not be mounted on first render (e.g. while `jobPool` is empty). The `useEffect` must check `if (sentinelRef.current) observer.observe(sentinelRef.current)` before calling observe.

3. **Reset `mutations` and clear `jh_jobs_` KV on new search** — `findJobs` must call `setMutations([])` and `dbSet(`jh_jobs_${profile.id}_${todayStr()}`, [])` alongside resetting `jobPool` and `visibleCount`. Without this, stale applied/customized status from the previous search overlays new results.

4. **`handleApply` must persist mutations to KV inside the functional updater** — `dbSet` must be called inside the `setMutations` functional updater (not after it), so it has access to the computed `updated` value without a stale closure. Follow the exact same pattern as the current `setJobs` updater in `handleApply`:
   ```js
   setMutations((prev) => {
     const updated = [...prev, { id: jobId, status: 'applied', appliedAt: new Date().toISOString() }]
     dbSet(`jh_jobs_${profile.id}_${todayStr()}`, updated)
     return updated
   })
   ```

5. **`jobs-search.js` must NOT write to KV** — it only writes to `bg_jobs.result`. The frontend's `callJobsSearch` handler is responsible for writing `jh_jobs_pool_` after polling completes. Do not add a Supabase KV write inside `jobs-search.js`.

---

## 6. Files Changed

| File | Change |
|------|--------|
| `netlify/functions/lib/job-providers/serpapi.js` | Remove description truncation; add `start` param to `fetchOnePage`; add `fetchAllPages` |
| `netlify/functions/lib/expiry-checker.js` | HEAD → GET, 8KB body read, phrase matching, concurrency=10 |
| `netlify/functions/lib/job-search-core.js` | Full desc in scoring, tokens=4000, top-25 scoring, cap=50, call `fetchAllPages` |
| `netlify/functions/jobs-search.js` | Rename `top20` → `jobs` only — no KV write (frontend handles that) |
| `netlify/functions/scheduled-job-search-background.js` | Write full 50 to pool key; write first 10 to `jh_jobs_` for badge compat |
| `src/components/Jobs.jsx` | New state model, infinite scroll, apply/mutation refactor, copy update |
| `src/components/Dashboard.jsx` | Read count from `jh_jobs_pool_` |
| `src/components/MainApp.jsx` | Read count from `jh_jobs_pool_` |
| `CLAUDE.md` | Add `jh_jobs_pool_{profileId}_{date}` to KV key table |

---

## 7. Unchanged

- `jh_applied_urls_{profileId}` write path in `handleApply` — no change
- `jh_skipped_{profileId}` — no change
- Auth, background job polling mechanics — no change
- `TailorModal` highlights logic (`Jobs.jsx` line 237) — intentionally out of scope
- All existing exported function signatures — backward compatible

---

## 8. Out of Scope

- Camoufox-based description enrichment (deferred — Netlify Functions can't run a browser; camoufox is local-only)
- Search result caching across days (each day's search is independent)
- Streaming/progressive result display during the initial fetch
