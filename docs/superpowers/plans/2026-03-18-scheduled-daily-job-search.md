# Scheduled Daily Job Search Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-profile opt-in toggle that automatically runs each profile's job search at 8 AM local time via a Netlify scheduled background function, storing results silently and showing a visible error banner if the run fails.

**Architecture:** Extract all job-search logic from `jobs-search.js` into a shared `lib/job-search-core.js` module, then wire a new Netlify scheduled background function that queries all users' profiles from Supabase, checks which ones are due for their 8 AM run in their local timezone, and calls the shared core logic directly — bypassing the HTTP handler and `bg_jobs` table entirely.

**Tech Stack:** Netlify scheduled background functions, Supabase service key (cross-user KV scan), `Intl.DateTimeFormat` for timezone handling, Vitest (node environment), React (jsdom environment).

**Spec:** `docs/superpowers/specs/2026-03-18-scheduled-daily-job-search-design.md`

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `netlify/functions/lib/job-search-core.js` | **Create** | All job-search logic: fetch, filter, score, normalize → `fetchAndScoreJobs` |
| `netlify/functions/jobs-search.js` | **Modify** | Strip to auth + `bg_jobs` plumbing; delegate to `job-search-core.js` |
| `netlify/functions/scheduled-job-search-background.js` | **Create** | Scheduled handler + pure timing helpers (`isProfileDue`, `getLocalDate`, `getProfilesToRun`) |
| `netlify/functions/__tests__/scheduled-job-search.test.js` | **Create** | Unit tests for the three pure timing helpers |
| `netlify.toml` | **Modify** | Add cron schedule + `timeout = 900` override |
| `src/components/Settings.jsx` | **Modify** | Add `scheduledSearch` to form state; add Job Search card; inject timezone on save |
| `src/components/Jobs.jsx` | **Modify** | Fetch scheduled status on mount; show dismissible error banner |

---

## Task 1: Create `netlify/functions/lib/job-search-core.js`

**Files:**
- Create: `netlify/functions/lib/job-search-core.js`

This is a pure extraction — no logic changes. Copy everything except `parseJWT` and the `handler` out of `jobs-search.js` and add a new `fetchAndScoreJobs` wrapper that runs the full pipeline.

- [ ] **Step 1: Create the lib directory and file**

```bash
mkdir -p netlify/functions/lib
```

Create `netlify/functions/lib/job-search-core.js` with this content:

```js
// Shared job-search logic — used by jobs-search.js (HTTP) and scheduled-job-search-background.js
// fetchAndScoreJobs: full pipeline → fetch → filter → score → normalize → top 20 job objects

'use strict'

const { routeAI } = require('../ai-router')
const { createLogger } = require('../logger')

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_QUERIES = [
  'Data Engineer OR ETL Engineer OR Data Pipeline Engineer OR Big Data Engineer',
  'Software Engineer OR Software Developer OR Backend Engineer OR Full Stack Engineer',
  'AI Engineer OR Artificial Intelligence Engineer OR Applied AI Engineer OR AI Developer',
  'Machine Learning Engineer OR ML Engineer OR MLOps Engineer OR Applied ML Engineer',
  'BI Engineer OR Business Intelligence Engineer OR Analytics Engineer OR BI Developer',
]

const STAFFING_BLACKLIST = [
  'staffmark', 'staffing', 'recruit', 'manpower', 'randstad', 'adecco',
  'kelly services', 'robert half', 'spherion', 'aerotek', 'apex systems',
  'insight global', 'teksynap', 'cybercoders', 'dice', 'hired.com',
  'toptal', 'hired', 'crossover', 'andela', 'turing.com', 'gun.io',
  'kforce', 'tek systems', 'teksystems', 'hays', 'modis', 'experis',
  'mastech', 'iqtalent', 'motion recruitment', 'vaco', 'compunnel',
]

const REPUTABLE_SOURCES = [
  'linkedin.com', 'indeed.com', 'glassdoor.com', 'greenhouse.io',
  'lever.co', 'myworkdayjobs', 'workday.com', 'smartrecruiters.com',
  'icims.com', 'jobvite.com', 'taleo.net', 'successfactors',
  'google.com/about/careers', 'amazon.jobs', 'microsoft.com/careers',
  'apple.com/jobs', 'meta.com/careers', 'netflix.jobs',
]

// ── Quality filters ───────────────────────────────────────────────────────────

function is60DaysOld(dateStr) {
  if (!dateStr) return false
  const posted = new Date(dateStr)
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
  return posted >= cutoff
}

function isStaffingAgency(job) {
  const name = (job.employer_name || '').toLowerCase()
  const desc = (job.job_description || '').toLowerCase()
  return STAFFING_BLACKLIST.some((kw) => name.includes(kw) || desc.slice(0, 200).includes(kw))
}

function hasGoodDescription(job) {
  return (job.job_description || '').length >= 200
}

function isReputableSource(job) {
  const links = [job.job_apply_link, job.job_google_link, job.employer_website]
    .filter(Boolean).join(' ').toLowerCase()
  return REPUTABLE_SOURCES.some((s) => links.includes(s))
}

function deduplicateSimilar(jobs) {
  const seen = new Map()
  return jobs.filter((j) => {
    const title = (j.job_title || '').toLowerCase()
      .replace(/senior|sr\.|junior|jr\.|lead|principal|staff/gi, '').trim()
    const company = (j.employer_name || '').toLowerCase()
    const key = `${company}::${title}`
    if (seen.has(key)) return false
    seen.set(key, true)
    return true
  })
}

function applyQualityFilters(jobs) {
  let filtered = jobs.filter((j) => !isStaffingAgency(j))
  filtered = filtered.filter((j) => hasGoodDescription(j))
  filtered = deduplicateSimilar(filtered)
  filtered.sort((a, b) => {
    const aRep = isReputableSource(a) ? 1 : 0
    const bRep = isReputableSource(b) ? 1 : 0
    if (bRep !== aRep) return bRep - aRep
    const aDate = a.job_posted_at_datetime_utc ? new Date(a.job_posted_at_datetime_utc) : new Date(0)
    const bDate = b.job_posted_at_datetime_utc ? new Date(b.job_posted_at_datetime_utc) : new Date(0)
    return bDate - aDate
  })
  return filtered
}

function getBestLink(job) {
  if (job.job_apply_link) {
    const skipDomains = ['ziprecruiter.com/c/', 'snagajob.com']
    if (!skipDomains.some((d) => job.job_apply_link.includes(d))) return job.job_apply_link
  }
  if (job.employer_website) return job.employer_website
  if (job.job_google_link) return job.job_google_link
  return ''
}

function detectPlatform(url) {
  if (!url) return null
  if (url.includes('linkedin.com'))    return 'LinkedIn'
  if (url.includes('indeed.com'))      return 'Indeed'
  if (url.includes('glassdoor.com'))   return 'Glassdoor'
  if (url.includes('ziprecruiter'))    return 'ZipRecruiter'
  if (url.includes('monster.com'))     return 'Monster'
  if (url.includes('dice.com'))        return 'Dice'
  if (url.includes('lever.co'))        return 'Lever'
  if (url.includes('greenhouse.io'))   return 'Greenhouse'
  if (url.includes('myworkdayjobs') || url.includes('workday.com')) return 'Workday'
  if (url.includes('jobs.google.com')) return 'Google Jobs'
  return 'Company site'
}

function getAllLinks(job) {
  const links = []
  const seen = new Set()
  const skipDomains = ['ziprecruiter.com/c/', 'snagajob.com']
  const add = (url) => {
    if (!url || seen.has(url)) return
    if (skipDomains.some((d) => url.includes(d))) return
    seen.add(url)
    links.push({ url, label: detectPlatform(url) || 'Apply' })
  }
  add(job.job_apply_link)
  add(job.job_google_link)
  add(job.employer_website)
  return links
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchOnePage(query, location, page = 1) {
  const url = new URL('https://jsearch.p.rapidapi.com/search')
  url.searchParams.set('query', `${query} in ${location}`)
  url.searchParams.set('page', page)
  url.searchParams.set('num_pages', 1)
  url.searchParams.set('date_posted', 'all')
  url.searchParams.set('employment_types', 'FULLTIME')
  const res = await fetch(url.toString(), {
    headers: {
      'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
    },
  })
  if (!res.ok) throw new Error(`JSearch error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.data || []
}

async function fetchJobs(customQuery, location) {
  const queries = customQuery ? [customQuery] : ROLE_QUERIES
  const results = await Promise.allSettled(queries.map((q) => fetchOnePage(q, location, 1)))
  const seen = new Set()
  const allJobs = []
  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    for (const job of result.value) {
      if (seen.has(job.job_id)) continue
      seen.add(job.job_id)
      allJobs.push(job)
    }
  }
  const recent = allJobs.filter((j) => is60DaysOld(j.job_posted_at_datetime_utc))
  return recent.length >= 10 ? recent : allJobs
}

// ── Score ─────────────────────────────────────────────────────────────────────

async function scoreJobs(jobs, resumeText, targetRoles, rid) {
  const jobSummaries = jobs.slice(0, 20).map((j, i) => ({
    idx: i,
    title: j.job_title,
    company: j.employer_name,
    description: (j.job_description || '').slice(0, 300),
  }))
  const prompt = `You are a resume-job matcher. Score how well this candidate's resume matches each job.

Resume summary:
${resumeText.slice(0, 1500)}

Target roles: ${targetRoles}

Jobs to score (return matchScore 0-100 for each):
${JSON.stringify(jobSummaries)}

Return ONLY a valid JSON array:
[{"idx":0,"matchScore":85,"reason":"Strong match — 4 of 5 required skills present"}]

Be realistic. Only give 85+ if it's a genuinely strong match.`

  const text = await routeAI({
    messages: [{ role: 'user', content: prompt }],
    tokens: 2000,
    rid,
  }).then((r) => r.text)

  try {
    const raw = text.trim()
    const arr = raw.startsWith('[') ? JSON.parse(raw) :
      JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] || '[]')
    return arr.reduce((map, item) => {
      map[item.idx] = { matchScore: item.matchScore || 70, reason: item.reason || '' }
      return map
    }, {})
  } catch {
    return jobs.reduce((map, _, i) => { map[i] = { matchScore: 70, reason: '' }; return map }, {})
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

// Full pipeline: fetch → quality filter → AI score → normalize to final shape
// Returns up to 20 normalized job objects ready to store
// Throws on JSearch API failure or when no jobs are found
async function fetchAndScoreJobs({ query, location, resumeText, targetRoles, rid }) {
  const log = createLogger(rid)

  const rawJobs = await fetchJobs(query !== 'default' ? query : null, location || 'United States')
  log.info('jobSearchCore.fetched', { rawCount: rawJobs.length })

  if (rawJobs.length === 0) throw new Error('No jobs found for this query. Try different roles or location.')

  const qualityJobs = applyQualityFilters(rawJobs)
  const jobsToScore = qualityJobs.length >= 5 ? qualityJobs : rawJobs
  log.info('jobSearchCore.filtered', { filteredCount: jobsToScore.length })

  let scores = {}
  if (resumeText) {
    try {
      scores = await scoreJobs(jobsToScore, resumeText, targetRoles || query, rid)
      log.info('jobSearchCore.scored', { scoredCount: Object.keys(scores).length })
    } catch (err) {
      log.error('jobSearchCore.score', { error: err.message })
    }
  }

  const uidGen = () => Math.random().toString(36).slice(2, 9)
  const jobs = jobsToScore.slice(0, 25).map((j, i) => {
    const score = scores[i] || { matchScore: 70, reason: '' }
    const isRemote = j.job_is_remote || j.job_title?.toLowerCase().includes('remote')
    let jobLocation = 'United States'
    if (isRemote) { jobLocation = 'Remote (US)' }
    else if (j.job_city && j.job_state) { jobLocation = `${j.job_city}, ${j.job_state}` }
    else if (j.job_city) { jobLocation = `${j.job_city}, US` }
    else if (j.job_state) { jobLocation = `${j.job_state}, US` }
    return {
      id: uidGen(),
      title: j.job_title || 'Unknown Title',
      company: j.employer_name || 'Unknown Company',
      location: jobLocation,
      url: getBestLink(j),
      links: getAllLinks(j),
      description: (j.job_description || '').slice(0, 400),
      jobType: 'Full-time',
      salary: j.job_min_salary
        ? `$${Math.round(j.job_min_salary).toLocaleString()}${j.job_max_salary ? `–$${Math.round(j.job_max_salary).toLocaleString()}` : '+'}`
        : '',
      postedAt: j.job_posted_at_datetime_utc || '',
      matchScore: Math.min(100, Math.max(50, score.matchScore)),
      matchReason: score.reason,
      isReputable: isReputableSource(j),
      status: 'new',
      source: 'jsearch',
    }
  }).filter((j) => j.url)

  jobs.sort((a, b) => {
    if (b.isReputable !== a.isReputable) return b.isReputable ? 1 : -1
    return b.matchScore - a.matchScore
  })

  log.info('jobSearchCore.done', { savedCount: Math.min(jobs.length, 20) })
  return jobs.slice(0, 20)
}

module.exports = {
  fetchAndScoreJobs,
  is60DaysOld,
  isStaffingAgency,
  hasGoodDescription,
  isReputableSource,
  deduplicateSimilar,
  applyQualityFilters,
  getBestLink,
}
```

- [ ] **Step 2: Verify the file was created**

```bash
ls netlify/functions/lib/job-search-core.js
```

Expected: file exists. Do not run tests yet — `jobs-search.test.js` still imports from `jobs-search.js` (unchanged), so a test run here passes for the wrong reason. Tests are verified in Task 2 after the refactor.

---

## Task 2: Refactor `jobs-search.js` to use the lib

**Files:**
- Modify: `netlify/functions/jobs-search.js`

Strip out all the logic that moved to `job-search-core.js`. Keep only: `parseJWT`, the Supabase client, and the handler. The handler calls `fetchAndScoreJobs` and manages `bg_jobs` state.

- [ ] **Step 1: Replace jobs-search.js contents**

```js
// Netlify Function: /.netlify/functions/jobs-search
// HTTP-triggered background function: auth → create bg_jobs record → fetchAndScoreJobs → store result

'use strict'

const { createClient } = require('@supabase/supabase-js')
const { fetchAndScoreJobs, is60DaysOld, isStaffingAgency, hasGoodDescription,
        isReputableSource, deduplicateSimilar, applyQualityFilters, getBestLink } = require('./lib/job-search-core')
const { createLogger } = require('./logger')

const getSupabase = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

function parseJWT(authHeader) {
  try {
    const token = (authHeader || '').replace('Bearer ', '').trim()
    if (!token) return null
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch { return null }
}

exports.handler = async (event) => {
  const user = parseJWT(event.headers?.authorization || event.headers?.Authorization)
  if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }

  let payload
  try { payload = JSON.parse(event.body || '{}') }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) } }

  const { jobId, query, location, resumeText, targetRoles } = payload
  const rid = event.headers['x-request-id'] || 'no-rid'
  const log = createLogger(rid)

  if (!jobId || !query) return { statusCode: 400, body: JSON.stringify({ error: 'jobId and query required' }) }

  const sb = getSupabase()

  await sb.from('bg_jobs').upsert({
    id: jobId,
    user_id: user.sub,
    type: 'find_jobs',
    status: 'processing',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })

  log.info('jobsSearch.start', { location })

  try {
    const top20 = await fetchAndScoreJobs({ query, location, resumeText, targetRoles, rid })
    await sb.from('bg_jobs').update({
      status: 'done',
      result: { jobs: top20 },
      updated_at: new Date().toISOString(),
    }).eq('id', jobId)
    log.info('jobsSearch.done', { savedCount: top20.length })
    return { statusCode: 200, body: JSON.stringify({ jobId, count: top20.length }) }
  } catch (err) {
    log.error('jobsSearch.error', { error: err.message })
    await sb.from('bg_jobs').update({
      status: 'error',
      error: err.message,
      updated_at: new Date().toISOString(),
    }).eq('id', jobId)
    return { statusCode: 200, body: JSON.stringify({ jobId, error: err.message }) }
  }
}

// Re-exported for backward compatibility with existing tests
module.exports.is60DaysOld        = is60DaysOld
module.exports.isStaffingAgency   = isStaffingAgency
module.exports.hasGoodDescription = hasGoodDescription
module.exports.isReputableSource  = isReputableSource
module.exports.deduplicateSimilar = deduplicateSimilar
module.exports.applyQualityFilters = applyQualityFilters
module.exports.getBestLink        = getBestLink
```

- [ ] **Step 2: Run existing tests — must still pass**

```bash
npm test netlify/functions/__tests__/jobs-search.test.js
```

Expected: all 28 tests pass. If any fail, something was missed in the re-exports or extraction — fix before proceeding.

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/lib/job-search-core.js netlify/functions/jobs-search.js
git commit -m "refactor: extract job-search logic into shared lib/job-search-core.js"
```

---

## Task 3: Write failing tests for scheduled function pure helpers

**Files:**
- Create: `netlify/functions/__tests__/scheduled-job-search.test.js`

Write the tests first (TDD). These three pure functions don't exist yet so all tests will fail. The test file imports from the function that will be created in Task 4.

- [ ] **Step 1: Create the test file**

```js
// netlify/functions/__tests__/scheduled-job-search.test.js
const { getLocalDate, isProfileDue, getProfilesToRun } = require('../scheduled-job-search-background')

// ── getLocalDate ──────────────────────────────────────────────────────────────

describe('getLocalDate', () => {
  it('returns YYYY-MM-DD for a valid timezone', () => {
    // 2026-03-18T12:00:00Z = 8:00 AM EDT (UTC-4 in March)
    expect(getLocalDate('America/New_York', '2026-03-18T12:00:00Z')).toBe('2026-03-18')
  })

  it('crosses a date boundary for a timezone ahead of UTC', () => {
    // 2026-03-18T23:00:00Z = 2026-03-19 01:00 in Africa/Johannesburg (UTC+2)
    expect(getLocalDate('Africa/Johannesburg', '2026-03-18T23:00:00Z')).toBe('2026-03-19')
  })

  it('returns null for an invalid timezone', () => {
    expect(getLocalDate('Not/ATimezone', '2026-03-18T12:00:00Z')).toBeNull()
  })
})

// ── isProfileDue ──────────────────────────────────────────────────────────────
// America/New_York in March is EDT (UTC-4): 8 AM local = 12:00 UTC
// At 12:30 UTC: utcHour=12 → window [12,18) → 8 AM ET maps to UTC 12 → IN window ✓
// At 07:00 UTC: utcHour=7  → window [6,12)  → 8 AM ET maps to UTC 12 → NOT in window ✓

describe('isProfileDue', () => {
  const IN_WINDOW  = '2026-03-18T12:30:00Z'  // 8:30 AM EDT
  const OUT_WINDOW = '2026-03-18T07:00:00Z'  // 3:00 AM EDT

  it('returns true when opted in, in-window, and not yet run today', () => {
    const prefs = { scheduledSearch: true, timezone: 'America/New_York' }
    expect(isProfileDue(prefs, null, IN_WINDOW)).toBe(true)
  })

  it('returns false when outside the 6-hour window', () => {
    const prefs = { scheduledSearch: true, timezone: 'America/New_York' }
    expect(isProfileDue(prefs, null, OUT_WINDOW)).toBe(false)
  })

  it('returns false when already ran today', () => {
    const prefs = { scheduledSearch: true, timezone: 'America/New_York' }
    const statusRecord = { lastRunDate: '2026-03-18', status: 'success', error: null }
    expect(isProfileDue(prefs, statusRecord, IN_WINDOW)).toBe(false)
  })

  it('returns true when lastRunDate is a previous day', () => {
    const prefs = { scheduledSearch: true, timezone: 'America/New_York' }
    const statusRecord = { lastRunDate: '2026-03-17', status: 'success', error: null }
    expect(isProfileDue(prefs, statusRecord, IN_WINDOW)).toBe(true)
  })

  it('returns false when scheduledSearch is false', () => {
    const prefs = { scheduledSearch: false, timezone: 'America/New_York' }
    expect(isProfileDue(prefs, null, IN_WINDOW)).toBe(false)
  })

  it('returns false when timezone is missing', () => {
    const prefs = { scheduledSearch: true }
    expect(isProfileDue(prefs, null, IN_WINDOW)).toBe(false)
  })
})

// ── getProfilesToRun ──────────────────────────────────────────────────────────
// NOTE: getProfilesToRun takes a flat array of PRE-FETCHED candidates (not raw Supabase rows).
// The handler does the Supabase reads and builds this flat list before calling getProfilesToRun.
// Shape: [{ userId, profileId, prefs, resumeText, statusRecord }]

describe('getProfilesToRun', () => {
  const IN_WINDOW = '2026-03-18T12:30:00Z'
  const base = {
    userId: 'user1', profileId: 'p1',
    prefs: { scheduledSearch: true, timezone: 'America/New_York' },
    resumeText: 'some resume content',
    statusRecord: null,
  }

  it('includes a profile that is due and has a resume', () => {
    expect(getProfilesToRun([base], IN_WINDOW)).toHaveLength(1)
  })

  it('excludes a profile with scheduledSearch: false', () => {
    const c = { ...base, prefs: { ...base.prefs, scheduledSearch: false } }
    expect(getProfilesToRun([c], IN_WINDOW)).toHaveLength(0)
  })

  it('excludes a profile that already ran today', () => {
    const c = { ...base, statusRecord: { lastRunDate: '2026-03-18', status: 'success', error: null } }
    expect(getProfilesToRun([c], IN_WINDOW)).toHaveLength(0)
  })

  it('excludes a profile with no resume', () => {
    const c = { ...base, resumeText: null }
    expect(getProfilesToRun([c], IN_WINDOW)).toHaveLength(0)
  })

  it('filters correctly across multiple users and profiles', () => {
    const candidates = [
      base,
      { ...base, userId: 'user2', profileId: 'p2', prefs: { scheduledSearch: false, timezone: 'America/New_York' } },
      { ...base, userId: 'user3', profileId: 'p3', statusRecord: { lastRunDate: '2026-03-18', status: 'success', error: null } },
    ]
    const result = getProfilesToRun(candidates, IN_WINDOW)
    expect(result).toHaveLength(1)
    expect(result[0].profileId).toBe('p1')
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail with "Cannot find module"**

```bash
npm test netlify/functions/__tests__/scheduled-job-search.test.js
```

Expected: FAIL — `Cannot find module '../scheduled-job-search-background'`

---

## Task 4: Implement the scheduled function

**Files:**
- Create: `netlify/functions/scheduled-job-search-background.js`

Implement the pure helpers first (to make tests pass), then the handler.

- [ ] **Step 1: Create the scheduled function file**

```js
// Netlify scheduled background function — runs every 6 hours, finds profiles due at 8 AM local time
// Cron: 0 */6 * * * (netlify.toml)
// Uses bare KV keys (no dev_ prefix) — only runs in production via Netlify scheduler

'use strict'

const { createClient } = require('@supabase/supabase-js')
const { fetchAndScoreJobs } = require('./lib/job-search-core')
const { createLogger } = require('./logger')

const getSupabase = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

// ── Pure timing helpers (exported for unit testing) ───────────────────────────

// Returns the local date string (YYYY-MM-DD) for nowUtc in the given timezone.
// Returns null if timezone is invalid.
function getLocalDate(timezone, nowUtc) {
  try {
    return new Date(nowUtc).toLocaleDateString('en-CA', { timeZone: timezone })
  } catch {
    return null
  }
}

// Returns the UTC hour (0-23) at which 8 AM occurs on localDateStr in the given timezone.
// Returns -1 if timezone is invalid or 8 AM cannot be found.
function get8amUtcHour(timezone, localDateStr) {
  try {
    for (let h = 0; h < 24; h++) {
      const d = new Date(`${localDateStr}T${String(h).padStart(2, '0')}:00:00Z`)
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        hour12: false,
      }).formatToParts(d)
      const localHour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '-1', 10)
      if (localHour === 8) return h
    }
    return -1
  } catch {
    return -1
  }
}

// Returns true if this profile is due to run now:
// - scheduledSearch is opted in
// - timezone is present and valid
// - hasn't already run today (local date in their timezone)
// - 8 AM in their timezone falls within the current 6-hour UTC window
function isProfileDue(prefs, statusRecord, nowUtc) {
  if (!prefs?.scheduledSearch) return false
  if (!prefs?.timezone) return false

  const localDate = getLocalDate(prefs.timezone, nowUtc)
  if (!localDate) return false

  if (statusRecord?.lastRunDate === localDate) return false

  const utcHour = new Date(nowUtc).getUTCHours()
  const windowStart = Math.floor(utcHour / 6) * 6
  const windowEnd = windowStart + 6

  const eightAmUtcHour = get8amUtcHour(prefs.timezone, localDate)
  if (eightAmUtcHour === -1) return false

  return eightAmUtcHour >= windowStart && eightAmUtcHour < windowEnd
}

// Filters a flat list of candidates to those due to run now and with a resume.
// candidates: [{ userId, profileId, prefs, resumeText, statusRecord }]
function getProfilesToRun(candidates, nowUtc) {
  return candidates.filter((c) => isProfileDue(c.prefs, c.statusRecord, nowUtc) && c.resumeText)
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async () => {
  const runRid = `sched-run-${Date.now()}`
  const log = createLogger(runRid)
  log.info('scheduledSearch.start', {})

  const sb = getSupabase()
  const nowUtc = new Date().toISOString()

  // Cross-user scan — no user_id filter; returns one row per user
  const { data: rows, error: rowsError } = await sb
    .from('kv_store')
    .select('user_id, value')
    .eq('key', 'jh_profiles')

  if (rowsError) {
    log.error('scheduledSearch.scanFailed', { error: rowsError.message })
    return
  }

  log.info('scheduledSearch.usersFound', { count: rows?.length ?? 0 })

  for (const row of (rows || [])) {
    const userId = row.user_id
    const profiles = Array.isArray(row.value) ? row.value : []

    for (const profileStub of profiles) {
      const profileId = profileStub.id
      const rid = `sched-${profileId.slice(0, 6)}-${Date.now()}`
      const plog = createLogger(rid)

      // Load full profile data — always scope by both user_id and key
      const { data: pd } = await sb
        .from('kv_store')
        .select('value')
        .eq('user_id', userId)
        .eq('key', `jh_p_${profileId}`)
        .single()

      if (!pd?.value) {
        plog.warn('scheduledSearch.profileMissing', { profileId })
        continue
      }

      const profileData = pd.value
      const prefs = profileData.preferences || {}

      if (!prefs.scheduledSearch) continue

      if (!prefs.timezone) {
        plog.warn('scheduledSearch.noTimezone', { profileId })
        continue
      }

      // Load status record (may not exist yet)
      const { data: sr } = await sb
        .from('kv_store')
        .select('value')
        .eq('user_id', userId)
        .eq('key', `jh_scheduled_status_${profileId}`)
        .maybeSingle()

      const statusRecord = sr?.value || null
      const localDate = getLocalDate(prefs.timezone, nowUtc)

      if (!isProfileDue(prefs, statusRecord, nowUtc)) {
        plog.info('scheduledSearch.skipped', { profileId })
        continue
      }

      if (!profileData.resumeText) {
        await sb.from('kv_store').upsert(
          { user_id: userId, key: `jh_scheduled_status_${profileId}`,
            value: { lastRunDate: localDate, status: 'error', error: 'No resume found' } },
          { onConflict: 'user_id,key' }
        )
        plog.warn('scheduledSearch.noResume', { profileId })
        continue
      }

      plog.info('scheduledSearch.running', { profileId })

      const query       = prefs.roles || 'default'
      const location    = (prefs.locations || 'United States').split(',')[0].trim()
      const resumeText  = profileData.resumeText
      const targetRoles = prefs.roles || ''

      try {
        const jobs = await fetchAndScoreJobs({ query, location, resumeText, targetRoles, rid })

        await sb.from('kv_store').upsert(
          { user_id: userId, key: `jh_jobs_${profileId}_${localDate}`, value: jobs },
          { onConflict: 'user_id,key' }
        )
        await sb.from('kv_store').upsert(
          { user_id: userId, key: `jh_scheduled_status_${profileId}`,
            value: { lastRunDate: localDate, status: 'success', error: null } },
          { onConflict: 'user_id,key' }
        )
        plog.info('scheduledSearch.done', { profileId, count: jobs.length })
      } catch (err) {
        await sb.from('kv_store').upsert(
          { user_id: userId, key: `jh_scheduled_status_${profileId}`,
            value: { lastRunDate: localDate, status: 'error', error: err.message } },
          { onConflict: 'user_id,key' }
        )
        plog.error('scheduledSearch.profileError', { profileId, error: err.message })
      }
    }
  }

  log.info('scheduledSearch.complete', {})
}

module.exports.getLocalDate      = getLocalDate
module.exports.isProfileDue      = isProfileDue
module.exports.getProfilesToRun  = getProfilesToRun
```

- [ ] **Step 2: Run tests — confirm they now pass**

```bash
npm test netlify/functions/__tests__/scheduled-job-search.test.js
```

Expected: all 14 tests pass.

- [ ] **Step 3: Run full test suite — confirm nothing broken**

```bash
npm test
```

Expected: all tests pass (84+14 = 98 total).

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/scheduled-job-search-background.js netlify/functions/__tests__/scheduled-job-search.test.js
git commit -m "feat: add scheduled daily job search function with unit-tested timing helpers"
```

---

## Task 5: Add cron schedule to `netlify.toml`

**Files:**
- Modify: `netlify.toml`

- [ ] **Step 1: Append the cron stanza to the end of `netlify.toml`**

The current file ends at line 25 (a blank line after `timeout = 26`). Append after that line. The new stanza is a sibling of `[functions."*"]` — both are named-key variants of `[functions]`. TOML processes all matching stanzas; Netlify uses the most-specific match, so `[functions."scheduled-job-search-background"]` overrides `[functions."*"]` for this one function.

The final `netlify.toml` should end with:
```toml
# Increase timeout for all functions (max 26s on free tier)
[functions."*"]
  timeout = 26

# Scheduled background function — runs every 6 hours; timeout overrides the wildcard 26s cap
[functions."scheduled-job-search-background"]
  schedule = "0 */6 * * *"
  timeout  = 900
```

- [ ] **Step 2: Commit**

```bash
git add netlify.toml
git commit -m "feat: register scheduled-job-search-background cron (0 */6 * * *)"
```

---

## Task 6: Update `Settings.jsx` — Job Search card

**Files:**
- Modify: `src/components/Settings.jsx`

Three changes: (1) add `scheduledSearch: false` to the initial form state, (2) update `save` to inject `timezone`, (3) add the Job Search card.

- [ ] **Step 1: Update `useState` initial value (line 6)**

Current:
```js
const [form, setForm] = useState({ locations: 'Remote, United States', roles: '', darkMode: false })
```

Replace with:
```js
const [form, setForm] = useState({ locations: 'Remote, United States', roles: '', darkMode: false, scheduledSearch: false })
```

- [ ] **Step 2: Update `save` to inject timezone (line 14)**

Current:
```js
const save = async () => { await onUpdate((prev) => ({ ...prev, preferences: form })); setSaved(true); setTimeout(() => setSaved(false), 2000) }
```

Replace with:
```js
const save = async () => {
  const formWithTz = { ...form, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
  await onUpdate((prev) => ({ ...prev, preferences: formWithTz }))
  setSaved(true)
  setTimeout(() => setSaved(false), 2000)
}
```

- [ ] **Step 3: Add Job Search card after the Developer tools card (after line 71, before the closing `</div>` of the outer wrapper)**

```jsx
      <div style={{ ...C.card, marginTop: '1rem' }}>
        <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 500 }}>Job Search</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.scheduledSearch || false}
            onChange={(e) => setForm((f) => ({ ...f, scheduledSearch: e.target.checked }))}
          />
          <span style={{ fontSize: 13, color: 'var(--text-main)' }}>Run daily job search automatically</span>
        </label>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted, #888)' }}>
          Runs at 8 AM in your local timezone. Save preferences to apply.
        </p>
      </div>
```

- [ ] **Step 4: Run Settings smoke test**

```bash
npm test src/__tests__/Settings.test.jsx
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/Settings.jsx
git commit -m "feat: add scheduled search toggle to Settings Job Search card"
```

---

## Task 7: Update `Jobs.jsx` — scheduled status banner

**Files:**
- Modify: `src/components/Jobs.jsx`

Two changes: (1) fetch the status KV key on mount/profile-change, (2) render a dismissible error banner.

- [ ] **Step 1: Add state and useEffect (after the existing `useEffect` on line 156)**

Add two new state variables after line 154 (`const [filter, setFilter] = useState('all')`):
```js
  const [scheduledStatus, setScheduledStatus] = useState(null)
  const [statusDismissed, setStatusDismissed] = useState(false)
```

Add a new `useEffect` after line 156:
```js
  useEffect(() => {
    setScheduledStatus(null)
    setStatusDismissed(false)
    dbGet(`jh_scheduled_status_${profile.id}`).then(setScheduledStatus)
  }, [profile.id])
```

- [ ] **Step 2: Add the error banner in the JSX (after the `{error && ...}` block on line 222)**

After:
```jsx
      {error && <div style={{ ...C.card, marginBottom: '1rem', background: '#fce8e6', borderColor: '#f5c6c6' }}><p style={{ margin: 0, fontSize: 13, color: '#c5221f' }}>{error}</p></div>}
```

Add:
```jsx
      {scheduledStatus?.status === 'error' && !statusDismissed && (
        <div style={{ ...C.card, marginBottom: '1rem', background: '#fffbeb', borderColor: '#ffd166', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#b06000' }}>
            Scheduled job search failed — {scheduledStatus.error}. You can run it manually.
          </p>
          <button onClick={() => setStatusDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#888', padding: '0 4px', flexShrink: 0 }}>✕</button>
        </div>
      )}
```

- [ ] **Step 3: Run Jobs smoke test**

```bash
npm test src/__tests__/Jobs.test.jsx
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/Jobs.jsx
git commit -m "feat: show dismissible error banner when scheduled job search fails"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all tests pass. Count should be ≥ 95 (84 existing + 14 new scheduled-job-search tests).

- [ ] **Step 2: Confirm test count in output**

Look for a line like `Tests: X passed` and verify no failures or skipped tests.

- [ ] **Step 3: Verify new files exist**

```bash
ls netlify/functions/lib/job-search-core.js netlify/functions/scheduled-job-search-background.js netlify/functions/__tests__/scheduled-job-search.test.js
```

Expected: all three files exist.

---

## Summary

| Task | Files touched | Tests |
|---|---|---|
| 1 | `lib/job-search-core.js` (create) | Existing 24 pass |
| 2 | `jobs-search.js` (refactor) | Existing 24 pass |
| 3 | `__tests__/scheduled-job-search.test.js` (create) | 14 fail (expected) |
| 4 | `scheduled-job-search-background.js` (create) | 14 pass |
| 5 | `netlify.toml` | — |
| 6 | `Settings.jsx` | Smoke test passes |
| 7 | `Jobs.jsx` | Smoke test passes |
| 8 | All | 95+ pass |
