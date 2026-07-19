# Job Search Filters, Skip Feature + Quick Fixes — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed 5-query fan-out with a single profile-driven SerpApi query, add a collapsible filter bar to the Jobs page, add a "Skip / Not Interested" feature with undo, sort jobs by match %, and add "Saved ✓" feedback to the Resume save button.

**Architecture:** The `filters` object (`{ roles, location, workType, jobType, dateWindowDays }`) flows from the Jobs filter bar → `callJobsSearch` → `jobs-search.js` → `fetchAndScoreJobs` → `fetchJobs`. The backend always makes exactly one SerpApi call. A new Step 3b in the pipeline filters skipped jobs server-side using a new `jh_skipped_{profileId}` KV key.

**Tech Stack:** Node.js (CommonJS) for Netlify functions, React + ESM for frontend, Vitest for tests, SerpApi Google Jobs API, Supabase KV store.

---

## File Map

| File | What changes |
|---|---|
| `netlify/functions/lib/job-providers/serpapi.js` | Add `buildQuery`, `parseLocation`; refactor `fetchOnePage` to accept `jobType`; replace `fetchJobs(customQuery, location, dateWindowDays)` with `fetchJobs(filters)`; delete `ROLE_QUERIES`; export new helpers |
| `netlify/functions/__tests__/serpapi.test.js` | Add tests for `buildQuery`, `parseLocation`; update source-sort-order test to new `fetchJobs(filters)` call form |
| `netlify/functions/lib/job-search-core.js` | Replace `query`/`location`/`dateWindowDays` params with `filters`; delete `query !== 'default'` sentinel; fix `scoreJobs` fallback; add Step 3b skipped-job filter |
| `netlify/functions/jobs-search.js` | Update payload destructure, validation guard, and `fetchAndScoreJobs` call-site; keep re-export lines unchanged |
| `netlify/functions/scheduled-job-search-background.js` | Replace `const query`/`const location` derivation with `const filters = { ... }` |
| `src/lib/api.js` | Replace `callJobsSearch({ query, location, ... })` with `callJobsSearch({ filters, ... })`; update POST body; fix `log.debug` |
| `src/components/Jobs.jsx` | Add filter bar state + UI; delete old query derivation in `findJobs`; add Skip button + `skippedJobs` state; sort `filtered` by `matchScore` |
| `src/components/Resume.jsx` | Make `save` async; add `saved` state + "Saved ✓" feedback |

---

## Task 1: serpapi.js — adaptive query helpers + fetchJobs refactor

> This task must update both `serpapi.js` and `serpapi.test.js` in the same commit. The test at line 156 of the test file calls `fetchJobs` with the old positional signature and will fail immediately if `serpapi.js` is changed without updating the test.

**Files:**
- Modify: `netlify/functions/lib/job-providers/serpapi.js`
- Modify: `netlify/functions/__tests__/serpapi.test.js`

### Background

Current `serpapi.js`:
- Has `ROLE_QUERIES` constant (5 entries, lines 7–13)
- `fetchOnePage(query, location, dateWindowDays)` — builds SerpApi URL (line 88)
- `fetchJobs(customQuery, location, dateWindowDays)` — fans out to `ROLE_QUERIES` if no custom query (line 106–129)
- `module.exports = { fetchJobs, parseRelativeDate, getBestApplyLink, normaliseJob }` (line 131)

Current test at `serpapi.test.js` line 156:
```js
const jobs = await fetchJobs('Software Engineer', 'United States', 30)
```

---

- [ ] **Step 1: Add failing tests for `buildQuery` and `parseLocation`**

Open `netlify/functions/__tests__/serpapi.test.js`. Add these two new `describe` blocks **after** the existing `normaliseJob` block and **before** the `fetchJobs source sort order` block:

```js
// ── buildQuery ─────────────────────────────────────────────────────────────
describe('buildQuery', () => {
  it('joins multiple roles with OR', () => {
    expect(buildQuery({ roles: 'Data Engineer, AI Engineer', workType: 'any' }))
      .toBe('Data Engineer OR AI Engineer')
  })
  it('appends "remote" suffix for remote workType', () => {
    expect(buildQuery({ roles: 'Data Engineer', workType: 'remote' }))
      .toBe('Data Engineer remote')
  })
  it('appends "on-site" suffix for onsite workType', () => {
    expect(buildQuery({ roles: 'Data Engineer', workType: 'onsite' }))
      .toBe('Data Engineer on-site')
  })
  it('uses fallback query when roles is empty', () => {
    expect(buildQuery({ roles: '', workType: 'any' }))
      .toBe('Data Engineer OR Software Engineer OR AI Engineer OR ML Engineer OR BI Engineer')
  })
})

// ── parseLocation ──────────────────────────────────────────────────────────
describe('parseLocation', () => {
  it('returns first non-Remote entry', () => {
    expect(parseLocation('Remote, New York')).toBe('New York')
  })
  it('returns "United States" when all entries are Remote', () => {
    expect(parseLocation('Remote')).toBe('United States')
  })
  it('returns "United States" for empty string', () => {
    expect(parseLocation('')).toBe('United States')
  })
})
```

Also add a `fetchJobs` test block that verifies the `employment_type` param is passed to SerpApi. Add this **before** the existing `fetchJobs source sort order` describe block:

```js
// ── fetchJobs employment_type ──────────────────────────────────────────────
describe('fetchJobs employment_type param', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jobs_results: [] }),
    }))
  })

  it('passes employment_type=FULLTIME when jobType is "fulltime"', async () => {
    await fetchJobs({ roles: 'Engineer', location: '', workType: 'any', jobType: 'fulltime', dateWindowDays: 30 })
    const calledUrl = new URL(global.fetch.mock.calls[0][0])
    expect(calledUrl.searchParams.get('employment_type')).toBe('FULLTIME')
  })

  it('omits employment_type when jobType is "any"', async () => {
    await fetchJobs({ roles: 'Engineer', location: '', workType: 'any', jobType: 'any', dateWindowDays: 30 })
    const calledUrl = new URL(global.fetch.mock.calls[0][0])
    expect(calledUrl.searchParams.has('employment_type')).toBe(false)
  })
})
```

Also update the import on line 2 to include the new exports:
```js
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { parseRelativeDate, getBestApplyLink, normaliseJob, fetchJobs, buildQuery, parseLocation } from '../lib/job-providers/serpapi.js'
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```bash
npm test -- netlify/functions/__tests__/serpapi.test.js 2>&1 | tail -20
```

Expected: `buildQuery` and `parseLocation` tests fail with "not a function" or "is not exported".

- [ ] **Step 3: Implement `buildQuery`, `parseLocation`, updated `fetchOnePage`, and refactored `fetchJobs` in serpapi.js**

Replace the entire contents of `netlify/functions/lib/job-providers/serpapi.js` with:

```js
// SerpApi Google Jobs provider
// Handles HTTP, response normalisation, source prioritisation, apply-link selection.
// TODO: add pagination support (start=10, start=20, ...) when needed.

'use strict'

const KNOWN_AGGREGATORS = [
  'linkedin', 'indeed', 'glassdoor', 'ziprecruiter', 'monster', 'dice',
  'top jobs today', 'hiringcafe', 'virtualinterview.ai', 'jobscroller',
  'factoryfix', 'talentify', 'job abstracts', 'experteer', 'snagajob',
]

// Builds a SerpApi query string from a filters object.
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

// Extracts the first non-"Remote" location from a comma-separated string.
// Falls back to "United States".
function parseLocation(locationsStr) {
  const parts = (locationsStr || '').split(',').map((l) => l.trim())
  return parts.find((l) => l.toLowerCase() !== 'remote') || 'United States'
}

// Returns approximate ISO datetime from SerpApi relative date string.
function parseRelativeDate(str) {
  if (!str) return new Date().toISOString()
  const s = str.toLowerCase().trim()
  const m = s.match(/^(\d+)\s+(hour|day|week|month)s?\s+ago$/)
  if (!m) return new Date().toISOString()
  const n = parseInt(m[1], 10)
  const unit = m[2]
  const ms = unit === 'hour'  ? n * 3600000
           : unit === 'day'   ? n * 86400000
           : unit === 'week'  ? n * 7 * 86400000
           : n * 30 * 86400000
  return new Date(Date.now() - ms).toISOString()
}

// Returns the best apply URL from apply_options array.
// Priority: direct company page → LinkedIn → Indeed → Glassdoor → first option.
function getBestApplyLink(applyOptions) {
  if (!applyOptions?.length) return ''
  const direct = applyOptions.find(
    (o) => !KNOWN_AGGREGATORS.some((a) => o.title.toLowerCase().includes(a))
  )
  if (direct) return direct.link
  const li = applyOptions.find((o) => o.title.toLowerCase().includes('linkedin'))
  if (li) return li.link
  const ind = applyOptions.find((o) => o.title.toLowerCase().includes('indeed'))
  if (ind) return ind.link
  const gd = applyOptions.find((o) => o.title.toLowerCase().includes('glassdoor'))
  if (gd) return gd.link
  return applyOptions[0].link
}

// Source sort priority: 1 = LinkedIn/Indeed/Glassdoor, 2 = other boards, 3 = direct/unknown.
function getSourcePriority(via) {
  const v = (via || '').toLowerCase()
  if (v.includes('linkedin') || v.includes('indeed') || v.includes('glassdoor')) return 1
  if (KNOWN_AGGREGATORS.some((a) => v.includes(a))) return 2
  return 3
}

// Normalises a raw SerpApi jobs_results entry to the internal job shape.
function normaliseJob(raw) {
  const ext = raw.detected_extensions || {}
  return {
    serpApiJobId:  raw.job_id || '',
    title:         raw.title || 'Unknown Title',
    company:       raw.company_name || 'Unknown Company',
    location:      raw.location || '',
    sourcePlatform: raw.via || '',
    companyLogo:   raw.thumbnail || '',
    description:   (raw.description || '').slice(0, 400),
    highlights:    raw.job_highlights || [],
    postedAt:      parseRelativeDate(ext.posted_at),
    jobType:       ext.schedule_type || 'Full-time',
    benefits: {
      healthInsurance: ext.health_insurance  || false,
      paidTimeOff:     ext.paid_time_off     || false,
      dental:          ext.dental_coverage   || false,
    },
    links: (raw.apply_options || []).map((o) => ({ title: o.title, link: o.link })),
    url:   getBestApplyLink(raw.apply_options),
    salary: ext.salary || '',
    _sourcePriority: getSourcePriority(raw.via),
  }
}

// Fetches one page of Google Jobs results for a single query string.
// jobType is used to set the SerpApi employment_type param.
async function fetchOnePage(query, location, dateWindowDays, jobType) {
  const url = new URL('https://serpapi.com/search')
  url.searchParams.set('engine', 'google_jobs')
  url.searchParams.set('q', query)
  if (location) url.searchParams.set('location', location)
  if (dateWindowDays === 30) url.searchParams.set('date_posted', 'month')
  if (jobType && jobType !== 'any') {
    const typeMap = { fulltime: 'FULLTIME', parttime: 'PARTTIME', contractor: 'CONTRACTOR' }
    if (typeMap[jobType]) url.searchParams.set('employment_type', typeMap[jobType])
  }
  url.searchParams.set('api_key', process.env.SERPAPI_KEY)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`SerpApi error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return (data.jobs_results || []).map(normaliseJob)
}

// Fetches jobs from SerpApi using a single targeted query built from filters.
// Always makes exactly one fetchOnePage call (1 API credit).
async function fetchJobs(filters) {
  const query    = buildQuery(filters)
  const location = parseLocation(filters.location)
  const days     = filters.dateWindowDays || 30
  const jobType  = filters.jobType || 'any'

  const jobs = await fetchOnePage(query, location, days, jobType)

  const seen = new Set()
  const deduped = []
  for (const job of jobs) {
    const key = job.serpApiJobId || `${job.company}::${job.title}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(job)
  }

  // Sort by source priority before returning (quality filter + AI scoring may re-sort later)
  deduped.sort((a, b) => a._sourcePriority - b._sourcePriority)

  // Strip internal sort field — not stored in KV
  return deduped.map(({ _sourcePriority, ...job }) => job)
}

module.exports = { fetchJobs, parseRelativeDate, getBestApplyLink, normaliseJob, buildQuery, parseLocation }
```

- [ ] **Step 4: Update the source sort order test to use new `fetchJobs(filters)` call form**

In `netlify/functions/__tests__/serpapi.test.js`, find line 156:
```js
const jobs = await fetchJobs('Software Engineer', 'United States', 30)
```
Replace it with:
```js
const jobs = await fetchJobs({ roles: 'Software Engineer', location: 'United States', workType: 'any', jobType: 'any', dateWindowDays: 30 })
```

- [ ] **Step 5: Run the full serpapi test suite**

```bash
npm test -- netlify/functions/__tests__/serpapi.test.js 2>&1 | tail -30
```

Expected: All tests pass (existing + new `buildQuery` + new `parseLocation` tests).

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/lib/job-providers/serpapi.js netlify/functions/__tests__/serpapi.test.js
git commit -m "feat: replace ROLE_QUERIES fan-out with adaptive single-query fetchJobs(filters)"
```

---

## Task 2: job-search-core.js — accept `filters`, add Step 3b skipped-job filter

**Files:**
- Modify: `netlify/functions/lib/job-search-core.js`

### Background

Current `fetchAndScoreJobs` signature (lines 142–152):
```js
async function fetchAndScoreJobs({
  query, location, resumeText, targetRoles, rid, profileId,
  dateWindowDays = 30, userId, supabase,
})
```

Line 156–157:
```js
const customQuery = query !== 'default' ? query : null
const rawJobs = await fetchJobs(customQuery, location || 'United States', dateWindowDays)
```

Line 211:
```js
scores = await scoreJobs(validJobs, resumeText, targetRoles || query, rid)
```

After Step 3 (applied-job filter, lines 167–194) there is no Step 3b yet.

---

- [ ] **Step 1: Update `fetchAndScoreJobs` signature and remove sentinel**

Replace lines 142–158 in `netlify/functions/lib/job-search-core.js`:

Old:
```js
async function fetchAndScoreJobs({
  query,
  location,
  resumeText,
  targetRoles,
  rid,
  profileId,
  dateWindowDays = 30,
  userId,
  supabase,
}) {
  const log = createLogger(rid)

  // Step 1: Fetch
  const customQuery = query !== 'default' ? query : null
  const rawJobs = await fetchJobs(customQuery, location || 'United States', dateWindowDays)
```

New:
```js
async function fetchAndScoreJobs({
  filters,
  resumeText,
  targetRoles,
  rid,
  profileId,
  userId,
  supabase,
}) {
  const log = createLogger(rid)
  const dateWindowDays = filters?.dateWindowDays || 30

  // Step 1: Fetch
  const rawJobs = await fetchJobs(filters || {})
```

- [ ] **Step 2: Fix `scoreJobs` fallback on line 211**

Find:
```js
scores = await scoreJobs(validJobs, resumeText, targetRoles || query, rid)
```
Replace with:
```js
scores = await scoreJobs(validJobs, resumeText, targetRoles || filters?.roles || '', rid)
```

- [ ] **Step 3: Add Step 3b — skipped-job filter**

After the applied-job filter block (which ends around line 194 with `}`), add Step 3b. The new step mirrors the applied-job filter pattern exactly. Insert after the closing `}` of the applied-job filter try/catch block:

```js
  // Step 3b: Skipped-job filter (skip gracefully if params not provided)
  let afterSkippedFilter = afterAppliedFilter
  if (profileId && userId && supabase) {
    try {
      const { data } = await supabase
        .from('kv_store')
        .select('value')
        .eq('user_id', userId)
        .eq('key', `jh_skipped_${profileId}`)
        .maybeSingle()
      const skipped = Array.isArray(data?.value) ? data.value : []
      const skippedUrls = new Set(skipped.map((s) => s.url).filter(Boolean))
      const skippedIds  = new Set(skipped.map((s) => s.serpApiJobId).filter(Boolean))
      const skippedKeys = new Set(skipped.map((s) => normKey(s.company, s.title)))
      afterSkippedFilter = afterAppliedFilter.filter((j) =>
        !skippedUrls.has(j.url) &&
        !skippedIds.has(j.serpApiJobId) &&
        !skippedKeys.has(normKey(j.company, j.title))
      )
      log.info('jobSearchCore.skippedFiltered', {
        before: afterAppliedFilter.length,
        after: afterSkippedFilter.length,
      })
    } catch (err) {
      log.error('jobSearchCore.skippedFilterError', { error: err.message })
      // Non-fatal: continue without skipped-job filtering
    }
  }
```

- [ ] **Step 4: Update Step 4 to use `afterSkippedFilter`**

Find (around line 197):
```js
  // Step 4: Quality filter
  const qualityJobs = applyQualityFilters(afterAppliedFilter)
  const jobsToProcess = qualityJobs.length >= 5 ? qualityJobs : afterAppliedFilter
```

Replace with:
```js
  // Step 4: Quality filter
  const qualityJobs = applyQualityFilters(afterSkippedFilter)
  const jobsToProcess = qualityJobs.length >= 5 ? qualityJobs : afterSkippedFilter
```

- [ ] **Step 5: Run the full jobs-search test suite**

```bash
npm test -- netlify/functions/__tests__/jobs-search.test.js 2>&1 | tail -30
```

Expected: All tests pass. (The tests import filter helpers from `jobs-search.js` which re-exports from `job-search-core.js` — those are unchanged.)

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/lib/job-search-core.js
git commit -m "feat: fetchAndScoreJobs accepts filters object; add Step 3b skipped-job filter"
```

---

## Task 3: Wire up `filters` in jobs-search.js and scheduled-job-search-background.js

**Files:**
- Modify: `netlify/functions/jobs-search.js` (lines 34, 38, 51, 54–60)
- Modify: `netlify/functions/scheduled-job-search-background.js` (lines 159–172)

---

- [ ] **Step 1: Update `jobs-search.js` payload destructure, guard, log, and call-site**

In `netlify/functions/jobs-search.js`:

Replace line 34:
```js
const { jobId, query, location, resumeText, targetRoles, profileId, dateWindowDays = 30 } = payload
```
With:
```js
const { jobId, filters, resumeText, targetRoles, profileId } = payload
```

Replace line 38:
```js
if (!jobId || !query) return { statusCode: 400, body: JSON.stringify({ error: 'jobId and query required' }) }
```
With:
```js
if (!jobId || !filters) return { statusCode: 400, body: JSON.stringify({ error: 'jobId and filters required' }) }
```

Replace line 51:
```js
log.info('jobsSearch.start', { location })
```
With:
```js
log.info('jobsSearch.start', { roles: filters?.roles })
```

Replace lines 54–60:
```js
    const top20 = await fetchAndScoreJobs({
      query, location, resumeText, targetRoles, rid,
      profileId,
      dateWindowDays,
      userId: user.sub,
      supabase: sb,
    })
```
With:
```js
    const top20 = await fetchAndScoreJobs({
      filters, resumeText, targetRoles, rid,
      profileId,
      userId: user.sub,
      supabase: sb,
    })
```

- [ ] **Step 2: Update `scheduled-job-search-background.js`**

In `netlify/functions/scheduled-job-search-background.js`, replace lines 159–172:

Old:
```js
      const query       = prefs.roles || 'default'
      const location    = (prefs.locations || 'United States').split(',')[0].trim()
      const resumeText  = profileData.resumeText
      const targetRoles = prefs.roles || ''

      try {
        const dateWindowDays = prefs.dateWindowDays || 30
        const jobs = await fetchAndScoreJobs({
          query, location, resumeText, targetRoles, rid,
          profileId,
          dateWindowDays,
          userId,
          supabase: sb,
        })
```

New:
```js
      const filters = {
        roles:          prefs.roles || '',
        location:       prefs.locations || '',
        workType:       prefs.workType || 'any',
        jobType:        prefs.jobType || 'any',
        dateWindowDays: prefs.dateWindowDays || 30,
      }
      const resumeText  = profileData.resumeText
      const targetRoles = prefs.roles || ''

      try {
        const jobs = await fetchAndScoreJobs({
          filters, resumeText, targetRoles, rid,
          profileId,
          userId,
          supabase: sb,
        })
```

- [ ] **Step 3: Run tests**

```bash
npm test -- netlify/functions/__tests__/ 2>&1 | tail -30
```

Expected: All backend tests pass.

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/jobs-search.js netlify/functions/scheduled-job-search-background.js
git commit -m "feat: wire filters object through jobs-search and scheduled-job-search endpoints"
```

---

## Task 4: api.js — refactor `callJobsSearch` to accept and send `filters`

**Files:**
- Modify: `src/lib/api.js` (lines 142–165)

### Background

Current `callJobsSearch` (line 142):
```js
export async function callJobsSearch({ query, location, resumeText, targetRoles, profileId, dateWindowDays = 30, onStatus } = {}) {
  ...
  log.debug('callJobsSearch', { query })
  ...
  body: JSON.stringify({ jobId, query, location, resumeText, targetRoles, profileId, dateWindowDays }),
```

---

- [ ] **Step 1: Replace `callJobsSearch` in `src/lib/api.js`**

Replace lines 141–165 with:

```js
// Real jobs search via SerpApi + AI scoring
export async function callJobsSearch({ filters, resumeText, targetRoles, profileId, onStatus } = {}) {
  const rid = genRid()
  const log = logger.withRid(rid)
  const token = await getToken()
  const jobId = uid()
  log.debug('callJobsSearch', { roles: filters?.roles })

  const submitRes = await fetch('/.netlify/functions/jobs-search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Request-ID': rid,
    },
    body: JSON.stringify({ jobId, filters, resumeText, targetRoles, profileId }),
  })

  if (!submitRes.ok) {
    const d = await submitRes.json().catch(() => ({}))
    throw new Error(d.error || 'Failed to submit job search')
  }

  return pollForResult(jobId, token, onStatus, rid, true)
}
```

- [ ] **Step 2: Run all tests**

```bash
npm test 2>&1 | tail -30
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.js
git commit -m "feat: callJobsSearch sends filters object to backend"
```

---

## Task 5: Jobs.jsx — filter bar, skip feature, sort by match %

**Files:**
- Modify: `src/components/Jobs.jsx`

### Background

Current `Jobs` component state (lines 177–185):
```js
const [jobs, setJobs] = useState([])
const [loading, setLoading] = useState(false)
const [bgStatus, setBgStatus] = useState('')
const [error, setError] = useState('')
const [customizeJob, setCustomizeJob] = useState(null)
const [applyJob, setApplyJob] = useState(null)
const [filter, setFilter] = useState('all')
const [scheduledStatus, setScheduledStatus] = useState(null)
const [statusDismissed, setStatusDismissed] = useState(false)
```

Current `findJobs` (lines 197–227) builds `query` and `location` locally.

Current `filtered` derivation (line 263):
```js
const filtered = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter)
```

The `JobCard` component (lines 100–173) receives `job`, `onApply`, `onCustomize` props.

---

- [ ] **Step 1: Add filter bar state and `skippedJobs` state**

After line 185 (`const [statusDismissed, setStatusDismissed] = useState(false)`), add:

```js
  // Filter bar state — pre-filled from profile preferences, local only
  const pref = profileData?.preferences || {}
  const [filterRoles, setFilterRoles] = useState(pref.roles || '')
  const [filterLocation, setFilterLocation] = useState(
    (pref.locations || '').split(',').map((l) => l.trim()).find((l) => l.toLowerCase() !== 'remote') || ''
  )
  const [filterWorkType, setFilterWorkType] = useState(pref.workType || 'any')
  const [filterJobType, setFilterJobType] = useState('any')
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Skip / Not Interested state
  const [skippedJobs, setSkippedJobs] = useState([])
  const [showSkipList, setShowSkipList] = useState(false)
```

- [ ] **Step 2: Load `skippedJobs` from KV on mount**

After the existing `useEffect` that loads `scheduledStatus` (around line 189–193), add:

```js
  useEffect(() => {
    dbGet(`jh_skipped_${profile.id}`).then((s) => setSkippedJobs(s || []))
  }, [profile.id])
```

- [ ] **Step 3: Set `filtersOpen` default based on whether jobs exist**

Add a `useEffect` that opens the filter bar when there are no jobs yet:

```js
  useEffect(() => {
    setFiltersOpen(jobs.length === 0)
  }, [jobs.length])
```

- [ ] **Step 4: Replace `findJobs` query derivation with filter bar state**

Replace the `findJobs` function body. Find (lines 197–227):

```js
  const findJobs = async () => {
    if (!profileData?.analyzedResume) { setError('Please analyze your resume first in the Resume tab.'); return }
    setLoading(true); setError(''); setBgStatus('')
    try {
      const { summary = '', skills = [], targetRoles = [], locations = [] } = profileData.analyzedResume
      const pref = profileData.preferences || {}
      const roleList = pref.roles?.trim() || ''
      const locList = pref.locations?.split(',')[0]?.trim() || locations[0] || 'United States'
      const workType = pref.workType || 'any'

      // If user has custom roles use them, otherwise signal backend to use all default roles
      const query = roleList
        ? (workType === 'remote' ? `${roleList} remote` : roleList)
        : 'default'
      const location = workType === 'remote' ? 'United States' : locList

      const jobs = await callJobsSearch({
        query,
        location,
        resumeText: profileData.resumeText,
        targetRoles: roleList || 'Data Engineer, Software Engineer, AI Engineer, ML Engineer, BI Engineer',
        profileId: profile.id,
        dateWindowDays: profileData?.preferences?.dateWindowDays || 30,
        onStatus: (s) => setBgStatus(s),
      })
```

Replace the `findJobs` function entirely (from `const findJobs = async () => {` through its closing `}`) with:

```js
  const findJobs = async () => {
    if (!profileData?.analyzedResume) { setError('Please analyze your resume first in the Resume tab.'); return }
    setLoading(true); setError(''); setBgStatus('')
    try {
      const filters = {
        roles:          filterRoles,
        location:       filterLocation,
        workType:       filterWorkType,
        jobType:        filterJobType,
        dateWindowDays: profileData?.preferences?.dateWindowDays || 30,
      }
      const { targetRoles = [] } = profileData.analyzedResume

      const jobs = await callJobsSearch({
        filters,
        resumeText: profileData.resumeText,
        targetRoles: filterRoles || targetRoles.join(', ') || 'Data Engineer, Software Engineer, AI Engineer',
        profileId: profile.id,
        onStatus: (s) => setBgStatus(s),
      })

      if (!jobs || jobs.length === 0) throw new Error('No jobs found. Try updating your role preferences in Settings.')
      await saveJobs(jobs)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }
```

- [ ] **Step 5: Add `handleSkip` and `handleUndoSkip` handlers**

After `handleApply` (around line 260), add:

```js
  const handleSkip = async (job) => {
    const updated = jobs.filter((j) => j.id !== job.id)
    setJobs(updated)
    const newSkipped = [...skippedJobs, { url: job.url || '', serpApiJobId: job.serpApiJobId || '', company: job.company, title: job.title }]
    setSkippedJobs(newSkipped)
    await dbSet(`jh_skipped_${profile.id}`, newSkipped)
  }

  const handleUndoSkip = async (entry) => {
    // Guard against empty-string field matching by only matching non-empty values
    const newSkipped = skippedJobs.filter((s) =>
      !(s.url && s.url === entry.url) &&
      !(s.serpApiJobId && s.serpApiJobId === entry.serpApiJobId) &&
      !(s.company === entry.company && s.title === entry.title)
    )
    setSkippedJobs(newSkipped)
    await dbSet(`jh_skipped_${profile.id}`, newSkipped)
  }
```

- [ ] **Step 6: Sort `filtered` by `matchScore`**

Find line 263:
```js
  const filtered = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter)
```

Replace with:
```js
  const filtered = (filter === 'all' ? jobs : jobs.filter((j) => j.status === filter))
    .slice()
    .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
```

- [ ] **Step 7: Add `onSkip` prop to `JobCard` calls and add Skip button to `JobCard`**

In `JobCard` component (lines 100–173), update the props signature from:
```js
function JobCard({ job, onApply, onCustomize }) {
```
To:
```js
function JobCard({ job, onApply, onCustomize, onSkip }) {
```

In the button row (around line 159–169), add a Skip button before the Apply button:
```js
        {job.status !== 'applied' && (
          <button onClick={() => onSkip(job)} style={{ ...btn(), fontSize: 12, padding: '5px 9px', color: '#888' }}>Skip</button>
        )}
```

Update the `JobCard` render calls in the `Jobs` component (around line 307):
```js
      {!loading && filtered.map((job) => (
        <JobCard key={job.id} job={job} onApply={(j) => setApplyJob(j)} onCustomize={(j) => setCustomizeJob(j)} onSkip={handleSkip} />
      ))}
```

- [ ] **Step 8: Add the filter bar UI to the `Jobs` return JSX**

After the `noAnalysis` warning card (around line 277) and before the `error` card, insert the filter bar:

```jsx
      {/* Filter bar */}
      <div style={{ ...C.card, marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#555', padding: 0, fontFamily: 'inherit' }}
          >
            {filtersOpen ? '▾ Filters' : '▸ Filters'}
          </button>
          {skippedJobs.length > 0 && (
            <button
              onClick={() => setShowSkipList((v) => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#888', padding: 0, fontFamily: 'inherit' }}
            >
              {skippedJobs.length} skipped
            </button>
          )}
        </div>
        {filtersOpen && (
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>Roles / keywords</label>
              <input value={filterRoles} onChange={(e) => setFilterRoles(e.target.value)} placeholder="Data Engineer, AI Engineer" style={{ ...C.input, fontSize: 13 }} />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>Location</label>
              <input value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} placeholder="New York" style={{ ...C.input, fontSize: 13 }} />
            </div>
            <div style={{ flex: '0 1 120px' }}>
              <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>Work type</label>
              <select value={filterWorkType} onChange={(e) => setFilterWorkType(e.target.value)} style={{ ...C.input, fontSize: 13 }}>
                <option value="any">Any</option>
                <option value="remote">Remote</option>
                <option value="onsite">On-site</option>
              </select>
            </div>
            <div style={{ flex: '0 1 120px' }}>
              <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>Job type</label>
              <select value={filterJobType} onChange={(e) => setFilterJobType(e.target.value)} style={{ ...C.input, fontSize: 13 }}>
                <option value="any">Any</option>
                <option value="fulltime">Full-time</option>
                <option value="contractor">Contract</option>
                <option value="parttime">Part-time</option>
              </select>
            </div>
            <button onClick={findJobs} disabled={loading || noAnalysis} style={{ ...btn('primary'), fontSize: 13, flexShrink: 0, opacity: loading || noAnalysis ? 0.5 : 1 }}>
              Search
            </button>
          </div>
        )}
        {showSkipList && skippedJobs.length > 0 && (
          <div style={{ marginTop: 12, borderTop: '1px solid #e8e8e8', paddingTop: 12 }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#888' }}>Skipped jobs — job will reappear in your next search after undo.</p>
            {skippedJobs.map((entry, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                <span style={{ color: '#555' }}>{entry.title} · {entry.company}</span>
                <button onClick={() => handleUndoSkip(entry)} style={{ ...btn(), fontSize: 11, padding: '3px 8px' }}>Undo</button>
              </div>
            ))}
          </div>
        )}
      </div>
```

- [ ] **Step 9: Run the frontend tests**

```bash
npm test -- src/__tests__/Jobs.test.jsx 2>&1 | tail -30
```

Expected: All existing Jobs tests pass. (No new frontend tests are required per spec — the skip logic mirrors the applied-job pattern which is already tested on the backend.)

- [ ] **Step 10: Run all tests**

```bash
npm test 2>&1 | tail -30
```

Expected: All tests pass.

- [ ] **Step 11: Commit**

```bash
git add src/components/Jobs.jsx
git commit -m "feat: add filter bar, Skip button, skipped-job undo, and sort jobs by match %"
```

---

## Task 6: Resume.jsx — save button "Saved ✓" feedback

**Files:**
- Modify: `src/components/Resume.jsx` (line 110, line 143)

### Background

Current `save` (line 110):
```js
const save = () => onUpdate((prev) => ({ ...prev, resumeText: text }))
```

Current button (line 143):
```js
<button onClick={save} disabled={!text.trim()} style={{ ...btn(), opacity: !text.trim() ? 0.5 : 1 }}>Save</button>
```

The `onUpdate` function in the parent component (`MainApp.jsx`) is already async — it calls `dbSet` internally — so `await onUpdate(...)` will correctly wait for the KV write before showing "Saved ✓".

---

- [ ] **Step 1: Add `saved` state**

Near the top of the `Resume` component function body, find other `useState` declarations and add:

```js
const [saved, setSaved] = useState(false)
```

- [ ] **Step 2: Make `save` async with feedback**

Replace line 110:
```js
  const save = () => onUpdate((prev) => ({ ...prev, resumeText: text }))
```
With:
```js
  const save = async () => {
    await onUpdate((prev) => ({ ...prev, resumeText: text }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }
```

- [ ] **Step 3: Update button label**

Replace line 143:
```js
          <button onClick={save} disabled={!text.trim()} style={{ ...btn(), opacity: !text.trim() ? 0.5 : 1 }}>Save</button>
```
With:
```js
          <button onClick={save} disabled={!text.trim() || saved} style={{ ...btn(), opacity: !text.trim() ? 0.5 : 1 }}>{saved ? 'Saved ✓' : 'Save'}</button>
```

- [ ] **Step 4: Run tests**

```bash
npm test 2>&1 | tail -30
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Resume.jsx
git commit -m "fix: Resume save button shows Saved checkmark feedback after successful save"
```

---

## Final Verification

- [ ] **Run the full test suite one last time**

```bash
npm test 2>&1 | tail -40
```

Expected: All tests pass with no failures.
