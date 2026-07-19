# Job Search Quality Improvements — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve job search quality by removing description truncation, upgrading link verification, pre-fetching a 50-job pool via 5 parallel SerpApi pages, and delivering those results via infinite scroll with client-side applied-job filtering.

**Architecture:** Backend pipeline fetches 5 SerpApi pages in parallel (one key rotation call for the batch), scores top 25 with full descriptions at tokens=4000, and returns up to 50 jobs stored in `bg_jobs.result`. Frontend replaces the single `jobs` state with a `jobPool` + sparse `mutations` log + `appliedSet`, deriving `visibleJobs` on each render and loading 10 more cards per scroll via IntersectionObserver.

**Tech Stack:** Node.js (CommonJS) for Netlify Functions, React (ESM, hooks) for frontend, Vitest for tests, Supabase KV via `dbGet`/`dbSet`, SerpApi Google Jobs API.

---

## File Map

| File | What changes |
|------|-------------|
| `netlify/functions/lib/job-providers/serpapi.js` | Remove description `.slice(0,1200)`; add `start` param to `fetchOnePage`; add + export `fetchAllPages` |
| `netlify/functions/__tests__/serpapi.test.js` | Add tests for truncation removal, `fetchAllPages` dedup + 5-page call |
| `netlify/functions/lib/expiry-checker.js` | HEAD→GET; 8 KB body read via Streams; phrase scan; concurrency 5→10 |
| `netlify/functions/__tests__/expiry-checker.test.js` | Update mocks to supply `headers`/`body`; add phrase-detection tests |
| `netlify/functions/lib/job-search-core.js` | `scoreJobs`: remove .slice(0,300), include all highlights, tokens 2000→4000, pass top 25; `fetchAndScoreJobs`: call `fetchAllPages`, cap 20→50 |
| `netlify/functions/jobs-search.js` | Rename `top20` → `jobs` (no other changes) |
| `netlify/functions/scheduled-job-search-background.js` | Write full 50 to `jh_jobs_pool_`; write first 10 to `jh_jobs_` |
| `netlify/functions/__tests__/scheduled-job-search.test.js` | Add assertion for pool KV write |
| `src/components/Jobs.jsx` | Replace `jobs` state with `jobPool`/`mutations`/`appliedSet`/`visibleCount`; IntersectionObserver; handleApply/handleSkip refactor; copy updates |
| `src/components/Dashboard.jsx` | Read `jh_jobs_pool_` for count; update copy |
| `src/components/MainApp.jsx` | Read `jh_jobs_pool_` for badge count |
| `CLAUDE.md` | Add `jh_jobs_pool_{profileId}_{date}` to KV key table |

---

## Task 1: serpapi.js — remove truncation + add `fetchAllPages`

**Files:**
- Modify: `netlify/functions/lib/job-providers/serpapi.js:113` (remove .slice)
- Modify: `netlify/functions/lib/job-providers/serpapi.js:133` (add start param)
- Modify: `netlify/functions/lib/job-providers/serpapi.js:155-182` (add fetchAllPages, update exports)
- Test: `netlify/functions/__tests__/serpapi.test.js`

- [ ] **Step 1: Write failing tests**

Add to `netlify/functions/__tests__/serpapi.test.js` after the existing `normaliseJob` describe block:

```js
// ── normaliseJob: no description truncation ────────────────────────────────
describe('normaliseJob — no description truncation', () => {
  it('preserves descriptions longer than 1200 chars', () => {
    const longDesc = 'x'.repeat(2000)
    const raw = {
      title: 'Engineer', company_name: 'Acme', description: longDesc,
      apply_options: [], job_highlights: [], detected_extensions: {},
    }
    const job = normaliseJob(raw)
    expect(job.description.length).toBe(2000)
  })
})

// ── fetchAllPages ──────────────────────────────────────────────────────────
describe('fetchAllPages', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('fires 5 parallel requests and deduplicates by serpApiJobId', async () => {
    // Each page returns 2 jobs; job_id 'a' appears on pages 0 and 1 (duplicate)
    const makeResult = (ids) => ({
      ok: true,
      json: async () => ({
        jobs_results: ids.map((id) => ({
          job_id: id, title: `Job ${id}`, company_name: 'Co', description: 'desc',
          apply_options: [{ title: 'Direct', link: `https://co.com/${id}` }],
          job_highlights: [], detected_extensions: {},
        })),
      }),
    })
    global.fetch
      .mockResolvedValueOnce(makeResult(['a', 'b']))   // start=0
      .mockResolvedValueOnce(makeResult(['a', 'c']))   // start=10 (a is duplicate)
      .mockResolvedValueOnce(makeResult(['d', 'e']))   // start=20
      .mockResolvedValueOnce(makeResult(['f', 'g']))   // start=30
      .mockResolvedValueOnce(makeResult(['h', 'i']))   // start=40

    const { fetchAllPages } = await import('../lib/job-providers/serpapi.js')
    process.env.SERPAPI_KEY = 'test-key'
    const results = await fetchAllPages({ roles: 'Engineer', location: 'Remote', dateWindowDays: 30 })

    // 5 pages × 2 jobs = 10 raw; 'a' deduped → 9 unique
    expect(results.length).toBe(9)
    // fetch called 5 times (5 parallel pages)
    expect(global.fetch).toHaveBeenCalledTimes(5)
    // _sourcePriority stripped
    expect(results[0]._sourcePriority).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /workspaces/jobhunter-ai && npm test -- netlify/functions/__tests__/serpapi.test.js --reporter=verbose 2>&1 | tail -20
```
Expected: FAIL — `normaliseJob` truncation test and `fetchAllPages` not found.

- [ ] **Step 3: Remove description truncation in `normaliseJob`**

In `netlify/functions/lib/job-providers/serpapi.js` line 113, change:
```js
description:   (raw.description || '').slice(0, 1200),
```
to:
```js
description:   raw.description || '',
```

- [ ] **Step 4: Add `start` param to `fetchOnePage`**

Change line 133 signature from:
```js
async function fetchOnePage(query, location, dateWindowDays, jobType, apiKey) {
```
to:
```js
async function fetchOnePage(query, location, dateWindowDays, jobType, apiKey, start = 0) {
```

Inside the function body, after the existing `url.searchParams.set` calls, add:
```js
if (start > 0) url.searchParams.set('start', String(start))
```

- [ ] **Step 5: Add `fetchAllPages` function**

Insert after the closing `}` of `fetchJobs` (before `module.exports`):

```js
// Fetches up to 5 pages of Google Jobs results in parallel using one API key.
// Deduplicates by serpApiJobId (exact) then by normalised company::title.
// Uses a single withKeyRotation call — one key for the whole batch.
async function fetchAllPages(filters, pageCount = 5) {
  const { withKeyRotation } = require('../key-rotator')
  const query    = buildQuery(filters)
  const location = parseLocation(filters.location)
  const days     = filters.dateWindowDays || 30
  const jobType  = filters.jobType || 'any'

  const starts = Array.from({ length: pageCount }, (_, i) => i * 10)

  const allJobs = await withKeyRotation('SERPAPI_KEY', async (apiKey) => {
    const pages = await Promise.all(
      starts.map((start) => fetchOnePage(query, location, days, jobType, apiKey, start))
    )
    return pages.flat()
  })

  // Deduplicate: exact serpApiJobId first, then normalised company::title
  const seenIds  = new Set()
  const seenKeys = new Set()
  const deduped  = []
  for (const job of allJobs) {
    const idKey    = job.serpApiJobId || ''
    const titleKey = `${(job.company || '').toLowerCase()}::${(job.title || '').toLowerCase()
      .replace(/\b(senior|sr\.|junior|jr\.|lead|principal|staff)\b/gi, '').trim()}`
    if (idKey && seenIds.has(idKey))    continue
    if (seenKeys.has(titleKey))          continue
    if (idKey) seenIds.add(idKey)
    seenKeys.add(titleKey)
    deduped.push(job)
  }

  // Sort by source priority then strip the internal field (same as fetchJobs)
  deduped.sort((a, b) => (a._sourcePriority || 3) - (b._sourcePriority || 3))
  return deduped.map(({ _sourcePriority, ...job }) => job)
}
```

- [ ] **Step 6: Export `fetchAllPages`**

In the `module.exports` line at the bottom of the file, add `fetchAllPages`:
```js
module.exports = { fetchJobs, fetchAllPages, parseRelativeDate, getBestApplyLink, normaliseJob, buildQuery, parseLocation, detectSponsorship, extractSalaryFromDesc }
```

- [ ] **Step 7: Run tests — expect pass**

```bash
cd /workspaces/jobhunter-ai && npm test -- netlify/functions/__tests__/serpapi.test.js --reporter=verbose 2>&1 | tail -20
```
Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
cd /workspaces/jobhunter-ai && git add netlify/functions/lib/job-providers/serpapi.js netlify/functions/__tests__/serpapi.test.js
git commit -m "feat: remove description truncation and add fetchAllPages for 5-page parallel SerpApi fetch"
```

---

## Task 2: expiry-checker.js — GET + 8 KB body scan

**Files:**
- Modify: `netlify/functions/lib/expiry-checker.js`
- Modify: `netlify/functions/__tests__/expiry-checker.test.js`

- [ ] **Step 1: Write failing tests**

The existing tests mock `fetch` returning `{ ok: true, status: 200 }` with no `body` or `headers`. After this change the implementation will call `res.headers.get('content-type')` and `res.body.getReader()`, so **all existing mocks must be updated** and new phrase-detection tests added.

Replace the entire content of `netlify/functions/__tests__/expiry-checker.test.js` with:

```js
import { vi, describe, it, expect, beforeEach } from 'vitest'
const { isLinkAlive, validateJobLinks } = await import('../lib/expiry-checker.js')

const makeJob = (url) => ({ url, title: 'Engineer', company: 'Co' })

// Helper: build a mock fetch response with optional body text and content-type
function mockResponse({ status = 200, ok = true, contentType = 'text/html', body = '' } = {}) {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(body)
  let done = false
  const reader = {
    read: vi.fn(async () => {
      if (done) return { done: true, value: undefined }
      done = true
      return { done: false, value: bytes }
    }),
    cancel: vi.fn(async () => {}),
  }
  return {
    ok,
    status,
    headers: { get: (h) => h === 'content-type' ? contentType : null },
    body: { getReader: () => reader },
  }
}

describe('isLinkAlive', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('returns true for HTTP 200 with clean body', async () => {
    global.fetch.mockResolvedValue(mockResponse({ status: 200, body: 'Apply now!' }))
    expect(await isLinkAlive('https://example.com')).toBe(true)
  })

  it('returns true for HTTP 301 redirect', async () => {
    global.fetch.mockResolvedValue(mockResponse({ status: 301, body: '' }))
    expect(await isLinkAlive('https://example.com')).toBe(true)
  })

  it('returns false for HTTP 404', async () => {
    global.fetch.mockResolvedValue(mockResponse({ ok: false, status: 404, body: '' }))
    expect(await isLinkAlive('https://example.com')).toBe(false)
  })

  it('returns false for HTTP 410 (Gone)', async () => {
    global.fetch.mockResolvedValue(mockResponse({ ok: false, status: 410, body: '' }))
    expect(await isLinkAlive('https://example.com')).toBe(false)
  })

  it('returns null for HTTP 403 (ambiguous)', async () => {
    global.fetch.mockResolvedValue(mockResponse({ ok: false, status: 403, body: '' }))
    expect(await isLinkAlive('https://example.com')).toBeNull()
  })

  it('returns null for HTTP 429 (ambiguous)', async () => {
    global.fetch.mockResolvedValue(mockResponse({ ok: false, status: 429, body: '' }))
    expect(await isLinkAlive('https://example.com')).toBeNull()
  })

  it('returns null on network error', async () => {
    global.fetch.mockRejectedValue(new Error('network error'))
    expect(await isLinkAlive('https://example.com')).toBeNull()
  })

  it('returns null on timeout (AbortError)', async () => {
    global.fetch.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    expect(await isLinkAlive('https://example.com')).toBeNull()
  })

  it('returns null for non-text content-type (binary)', async () => {
    global.fetch.mockResolvedValue(mockResponse({ status: 200, contentType: 'application/pdf', body: '' }))
    expect(await isLinkAlive('https://example.com')).toBeNull()
  })

  it('returns false when body contains "no longer accepting applications"', async () => {
    global.fetch.mockResolvedValue(mockResponse({
      status: 200,
      body: '<html><body>We are no longer accepting applications for this role.</body></html>',
    }))
    expect(await isLinkAlive('https://example.com')).toBe(false)
  })

  it('returns false when body contains "this position has been filled"', async () => {
    global.fetch.mockResolvedValue(mockResponse({
      status: 200,
      body: '<h1>This position has been filled.</h1>',
    }))
    expect(await isLinkAlive('https://example.com')).toBe(false)
  })

  it('returns false when body contains "job is no longer available"', async () => {
    global.fetch.mockResolvedValue(mockResponse({
      status: 200,
      body: 'Sorry, this job is no longer available.',
    }))
    expect(await isLinkAlive('https://example.com')).toBe(false)
  })

  it('returns true when body mentions "no longer" in an unrelated context', async () => {
    // Short phrase "no longer available" alone is NOT in the phrase list — full phrases only
    global.fetch.mockResolvedValue(mockResponse({
      status: 200,
      body: 'The old process is no longer in use. Apply now!',
    }))
    expect(await isLinkAlive('https://example.com')).toBe(true)
  })
})

describe('validateJobLinks', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('removes jobs with dead links (404)', async () => {
    global.fetch.mockResolvedValue(mockResponse({ ok: false, status: 404 }))
    const jobs = [makeJob('https://dead.com'), makeJob('https://also-dead.com')]
    expect(await validateJobLinks(jobs)).toHaveLength(0)
  })

  it('keeps jobs with alive links', async () => {
    global.fetch.mockResolvedValue(mockResponse({ status: 200, body: 'Apply here' }))
    const jobs = [makeJob('https://alive.com')]
    expect(await validateJobLinks(jobs)).toHaveLength(1)
  })

  it('keeps jobs with ambiguous links (403)', async () => {
    global.fetch.mockResolvedValue(mockResponse({ ok: false, status: 403 }))
    const jobs = [makeJob('https://blocked.com')]
    expect(await validateJobLinks(jobs)).toHaveLength(1)
  })

  it('keeps jobs with no url (cannot check)', async () => {
    const jobs = [{ title: 'No URL job', company: 'Co', url: '' }]
    expect(await validateJobLinks(jobs)).toHaveLength(1)
  })

  it('removes jobs whose body signals a closed listing', async () => {
    global.fetch.mockResolvedValue(mockResponse({
      status: 200,
      body: 'This job has been closed.',
    }))
    const jobs = [makeJob('https://closed.com')]
    expect(await validateJobLinks(jobs)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /workspaces/jobhunter-ai && npm test -- netlify/functions/__tests__/expiry-checker.test.js --reporter=verbose 2>&1 | tail -20
```
Expected: failures on body/headers-related tests and phrase-detection tests (current impl uses HEAD, no body).

- [ ] **Step 3: Rewrite `isLinkAlive` in `expiry-checker.js`**

Replace the entire `isLinkAlive` function (lines 1–17):

```js
'use strict'

const DEAD_PHRASES = [
  'no longer accepting applications',
  'this position has been filled',
  'job is no longer available',
  'posting has expired',
  'this job has been closed',
  'position is no longer open',
]

// Reads up to maxBytes from a fetch response body stream, returns decoded string.
// Cancels the reader after maxBytes to avoid downloading large pages.
async function readBodyPrefix(res, maxBytes = 8192) {
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('text/') && !ct.includes('application/xhtml')) return null
  try {
    const reader = res.body.getReader()
    const chunks = []
    let total = 0
    while (total < maxBytes) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      total += value.length
    }
    await reader.cancel()
    const combined = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length }
    return new TextDecoder().decode(combined)
  } catch {
    return null
  }
}

// Returns true (alive), false (definitively dead), or null (ambiguous/error).
async function isLinkAlive(url, timeoutMs = 2000) {
  if (!url) return null
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, { method: 'GET', signal: controller.signal, redirect: 'follow' })
    clearTimeout(timer)
    if (res.status === 404 || res.status === 410) return false
    if (res.status < 200 || res.status >= 400) return null
    const text = await readBodyPrefix(res)
    if (text === null) return null
    const lower = text.toLowerCase()
    if (DEAD_PHRASES.some((p) => lower.includes(p))) return false
    return true
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Update `validateJobLinks` concurrency**

Change the `concurrency = 5` default on line 22 to `concurrency = 10`:
```js
async function validateJobLinks(jobs, concurrency = 10) {
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd /workspaces/jobhunter-ai && npm test -- netlify/functions/__tests__/expiry-checker.test.js --reporter=verbose 2>&1 | tail -20
```
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /workspaces/jobhunter-ai && git add netlify/functions/lib/expiry-checker.js netlify/functions/__tests__/expiry-checker.test.js
git commit -m "feat: upgrade link checker from HEAD to GET with 8 KB body scan for closed-job detection"
```

---

## Task 3: job-search-core.js — full descriptions, top-25 scoring, 50-job cap

**Files:**
- Modify: `netlify/functions/lib/job-search-core.js`

No new test file — the scoring function calls `routeAI` which is hard to mock in this env. We verify via the unit-testable structural changes (slice sizes) and confirm the full test suite still passes.

- [ ] **Step 1: Update `scoreJobs` — full descriptions, all highlights, tokens=4000**

In `scoreJobs` (around line 92), change the `jobSummaries` map from:
```js
const jobSummaries = jobs.slice(0, 20).map((j, i) => {
  const quals = j.highlights?.find((h) => h.title === 'Qualifications')?.items || []
  return {
    idx: i,
    title: j.title,
    company: j.company,
    description: quals.length > 0 ? quals.slice(0, 5).join('; ') : (j.description || '').slice(0, 300),
  }
})
```
to:
```js
const jobSummaries = jobs.slice(0, 25).map((j, i) => {
  const allHighlights = (j.highlights || [])
    .flatMap((h) => (h.items || []).map((item) => `${h.title}: ${item}`))
  return {
    idx: i,
    title: j.title,
    company: j.company,
    description: allHighlights.length > 0
      ? allHighlights.join('; ')
      : (j.description || ''),
  }
})
```

Change the `routeAI` call's `tokens` from `2000` to `4000`:
```js
const text = await routeAI({
  messages: [{ role: 'user', content: prompt }],
  tokens: 4000,
  rid,
}).then((r) => r.text)
```

- [ ] **Step 2: Update `fetchAndScoreJobs` — call `fetchAllPages`, cap 20→50**

At the top of the file, update the require on line 6:
```js
const { fetchAllPages } = require('./job-providers/serpapi')
```
(Keep `fetchJobs` import removed — it's no longer called here.)

In `fetchAndScoreJobs`, change:
```js
const rawJobs = await fetchJobs(filters || {})
```
to:
```js
const rawJobs = await fetchAllPages(filters || {})
```

Change `validJobs.slice(0, 25)` (annotation loop) to `validJobs.slice(0, 50)`:
```js
const jobs = validJobs.slice(0, 50).map((j, i) => {
```

Change the final return cap from `jobs.slice(0, 20)` to `jobs.slice(0, 50)`:
```js
return jobs.slice(0, 50)
```

Pass top 25 to `scoreJobs`:
```js
scores = await scoreJobs(validJobs.slice(0, 25), resumeText, targetRoles || filters?.roles || '', rid)
```
(This replaces the existing `validJobs` passed without a slice.)

- [ ] **Step 3: Run full backend test suite**

```bash
cd /workspaces/jobhunter-ai && npm test -- netlify/functions/__tests__/ --reporter=verbose 2>&1 | tail -30
```
Expected: all existing tests PASS (no breaking changes to exported signatures).

- [ ] **Step 4: Commit**

```bash
cd /workspaces/jobhunter-ai && git add netlify/functions/lib/job-search-core.js
git commit -m "feat: score top 25 with full descriptions, tokens=4000, increase pool cap to 50"
```

---

## Task 4: jobs-search.js — rename `top20`

**Files:**
- Modify: `netlify/functions/jobs-search.js:54,65,68,69`

- [ ] **Step 1: Rename `top20` to `jobs`**

In `jobs-search.js`, replace all 4 occurrences of `top20` with `jobs`. The relevant lines are:
```js
// line 54 — was: const top20 = await fetchAndScoreJobs({
const jobs = await fetchAndScoreJobs({
// ...

// line 65 — was: result: { jobs: top20 },
result: { jobs },

// line 68 — was: log.info('jobsSearch.done', { savedCount: top20.length })
log.info('jobsSearch.done', { savedCount: jobs.length })

// line 69 — was: return { statusCode: 200, body: JSON.stringify({ jobId, count: top20.length }) }
return { statusCode: 200, body: JSON.stringify({ jobId, count: jobs.length }) }
```

- [ ] **Step 2: Run jobs-search tests**

```bash
cd /workspaces/jobhunter-ai && npm test -- netlify/functions/__tests__/jobs-search.test.js --reporter=verbose 2>&1 | tail -20
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /workspaces/jobhunter-ai && git add netlify/functions/jobs-search.js
git commit -m "refactor: rename top20 to jobs in jobs-search.js"
```

---

## Task 5: scheduled-job-search-background.js — dual KV write

**Files:**
- Modify: `netlify/functions/scheduled-job-search-background.js:181-184`
- Modify: `netlify/functions/__tests__/scheduled-job-search.test.js`

- [ ] **Step 1: Find the pool-write test in `scheduled-job-search.test.js`**

Open `netlify/functions/__tests__/scheduled-job-search.test.js` and locate the test that asserts on the KV write after `fetchAndScoreJobs` resolves. Add an assertion that the pool key is written:

```js
// After the existing assertion for jh_jobs_ write, add:
expect(sb.from).toHaveBeenCalledWith('kv_store')
// Find the upsert call for the pool key:
const upsertCalls = sb.from.mock.results
  .flatMap((r) => r.value?.upsert?.mock?.calls || [])
const poolWrite = upsertCalls.find(([obj]) => obj?.key?.includes('jh_jobs_pool_'))
expect(poolWrite).toBeDefined()
const jobsWrite = upsertCalls.find(([obj]) => obj?.key?.includes('jh_jobs_') && !obj?.key?.includes('pool'))
expect(jobsWrite).toBeDefined()
// The jh_jobs_ write should contain at most 10 entries
expect(jobsWrite[0].value.length).toBeLessThanOrEqual(10)
```

Run tests first to confirm this addition causes a failure:
```bash
cd /workspaces/jobhunter-ai && npm test -- netlify/functions/__tests__/scheduled-job-search.test.js --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 2: Update the KV write block in `scheduled-job-search-background.js`**

Replace lines 181–184:
```js
await sb.from('kv_store').upsert(
  { user_id: userId, key: `jh_jobs_${profileId}_${localDate}`, value: jobs },
  { onConflict: 'user_id,key' }
)
```
with:
```js
// Write full pool (up to 50) for the new pool key
await sb.from('kv_store').upsert(
  { user_id: userId, key: `jh_jobs_pool_${profileId}_${localDate}`, value: jobs },
  { onConflict: 'user_id,key' }
)
// Write first 10 to the legacy key for badge counts in MainApp/Dashboard
await sb.from('kv_store').upsert(
  { user_id: userId, key: `jh_jobs_${profileId}_${localDate}`, value: jobs.slice(0, 10) },
  { onConflict: 'user_id,key' }
)
```

- [ ] **Step 3: Run scheduled search tests**

```bash
cd /workspaces/jobhunter-ai && npm test -- netlify/functions/__tests__/scheduled-job-search.test.js --reporter=verbose 2>&1 | tail -20
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /workspaces/jobhunter-ai && git add netlify/functions/scheduled-job-search-background.js netlify/functions/__tests__/scheduled-job-search.test.js
git commit -m "feat: scheduled search writes full pool to jh_jobs_pool_ and first 10 to jh_jobs_ for badge compat"
```

---

## Task 6: Jobs.jsx — pool state, infinite scroll, apply/mutation refactor

This is the largest task. Read `src/components/Jobs.jsx` in full before starting. It is ~800 lines.

**Files:**
- Modify: `src/components/Jobs.jsx`

**Key traps (from spec section 5a — read before touching the file):**
1. Never use `s` as a local variable name — `import s from './Jobs.module.css'` uses that alias.
2. Sentinel `<div>` must be rendered unconditionally (always in DOM), not conditionally.
3. `findJobs` must reset `mutations` state AND call `dbSet(jh_jobs_, [])`.
4. `dbSet` for mutations must be called **inside** the `setMutations` functional updater.
5. `jobs-search.js` does NOT write KV — `callJobsSearch` returns the jobs array; the frontend writes `jh_jobs_pool_`.

- [ ] **Step 1: Add new state, remove old `jobs` state**

In the `Jobs` component (around line 518), replace:
```js
const [jobs, setJobs] = useState([])
```
with:
```js
const [jobPool, setJobPool]           = useState([])   // full 50-job pool from backend
const [visibleCount, setVisibleCount] = useState(10)   // how many cards to show
const [appliedSet, setAppliedSet]     = useState(() => new Set())  // url + serpApiJobId for current session
const [mutations, setMutations]       = useState([])   // sparse log: { id, status, customResume, tailorResult, appliedAt }
const visibleCountRef                 = useRef(10)
const sentinelRef                     = useRef(null)
```

Also add `useRef` to the React import at the top of the file if it's not already imported.

- [ ] **Step 2: Update on-mount effect**

Replace the existing `useEffect` that loads jobs (line 542):
```js
useEffect(() => { dbGet(`jh_jobs_${profile.id}_${todayStr()}`).then((j) => setJobs(j || [])) }, [profile.id])
```
with:
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
    ;(applied || []).forEach((a) => {
      if (a.url) aSet.add(a.url)
      if (a.serpApiJobId) aSet.add(a.serpApiJobId)
    })
    setAppliedSet(aSet)
  })
}, [profile.id])
```

- [ ] **Step 3: Add IntersectionObserver effect**

After the mount effect, add:
```js
useEffect(() => {
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return
    const next = visibleCountRef.current + 10
    visibleCountRef.current = next
    setVisibleCount(next)
  })
  if (sentinelRef.current) observer.observe(sentinelRef.current)
  return () => observer.disconnect()
}, []) // runs once on mount; sentinel is always in the DOM
```

- [ ] **Step 4: Add `visibleJobs` derivation**

The existing code has a `filtered` and `filterCounts` computation (around line 647). Replace:
```js
const filtered = (filter === 'all' ? jobs : jobs.filter((j) => j.status === filter))
  .slice()
  .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
const filterCounts = ['new', 'customized', 'applied'].reduce((a, st) => ({ ...a, [st]: jobs.filter((j) => j.status === st).length }), {})
```
with:
```js
// Merge pool jobs with the sparse mutations log
const mutationMap = Object.fromEntries(mutations.map((m) => [m.id, m]))

const visibleJobs = jobPool
  .filter((j) => !appliedSet.has(j.url) && !appliedSet.has(j.serpApiJobId))
  .slice(0, visibleCount)
  .map((j) => ({ status: 'new', ...j, ...(mutationMap[j.id] || {}) }))

const filtered = (filter === 'all' ? visibleJobs : visibleJobs.filter((j) => j.status === filter))
  .slice()
  .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))

// Default status to 'new' for jobs with no mutation entry — spread order matters:
// status: 'new' is overridden by the mutation if one exists.
const allMutated = jobPool.map((j) => ({ status: 'new', ...j, ...(mutationMap[j.id] || {}) }))
const filterCounts = ['new', 'customized', 'applied'].reduce(
  (acc, st) => ({ ...acc, [st]: allMutated.filter((j) => j.status === st).length }),
  {}
)
const poolExhausted = jobPool.filter((j) => !appliedSet.has(j.url) && !appliedSet.has(j.serpApiJobId)).length <= visibleCount
```

- [ ] **Step 5: Update `saveJobs` / remove it, update `findJobs`**

Remove `saveJobs` entirely. Update `findJobs`:

```js
const findJobs = async () => {
  if (!profileData?.analyzedResume) { setError('Please analyze your resume first in the Resume tab.'); return }
  setLoading(true); setError(''); setBgStatus('')
  // Reset pool and mutations
  setJobPool([])
  setMutations([])
  setVisibleCount(10)
  visibleCountRef.current = 10
  await Promise.all([
    dbSet(`jh_jobs_pool_${profile.id}_${todayStr()}`, []),
    dbSet(`jh_jobs_${profile.id}_${todayStr()}`, []),
  ])
  try {
    const filters = {
      roles:          filterRoles,
      location:       filterLocation,
      workType:       filterWorkType,
      jobType:        filterJobType,
      dateWindowDays: profileData?.preferences?.dateWindowDays || 30,
    }
    const { targetRoles = [] } = profileData.analyzedResume
    const found = await callJobsSearch({
      filters,
      resumeText: profileData.resumeText,
      targetRoles: filterRoles || targetRoles.join(', ') || 'Data Engineer, Software Engineer, AI Engineer',
      profileId: profile.id,
      onStatus: (st) => setBgStatus(st),
    })
    if (!found || found.length === 0) throw new Error('No jobs found. Try updating your role preferences in Settings.')
    setJobPool(found)
    await dbSet(`jh_jobs_pool_${profile.id}_${todayStr()}`, found)
  } catch (e) { setError(e.message) }
  setLoading(false)
}
```

- [ ] **Step 6: Update `handleCustomizeSave` and `handleTailorSave`**

Replace `handleCustomizeSave`:
```js
const handleCustomizeSave = async (jobId, data) => {
  setMutations((prev) => {
    const existing = prev.find((m) => m.id === jobId)
    const updated = existing
      ? prev.map((m) => m.id === jobId ? { ...m, customResume: data, status: 'customized' } : m)
      : [...prev, { id: jobId, customResume: data, status: 'customized' }]
    dbSet(`jh_jobs_${profile.id}_${todayStr()}`, updated)
    return updated
  })
  setCustomizeJob(null)
}
```

Replace `handleTailorSave`:
```js
const handleTailorSave = (jobId, tailorResult) => {
  setMutations((prev) => {
    const existing = prev.find((m) => m.id === jobId)
    const updated = existing
      ? prev.map((m) => m.id === jobId ? { ...m, tailorResult } : m)
      : [...prev, { id: jobId, tailorResult }]
    dbSet(`jh_jobs_${profile.id}_${todayStr()}`, updated)
    return updated
  })
}
```

- [ ] **Step 7: Update `handleApply`**

The existing `handleApply` uses `setJobs`. Replace the state mutation portion, keeping the 750ms animation pattern exactly:

```js
const handleApply = async (job) => {
  if (job.url) window.open(job.url, '_blank')
  setApplyJob(null)
  setApplyingId(job.id)

  // Write application records (unchanged)
  const apps = (await dbGet(`jh_apps_${profile.id}`)) || []
  if (!apps.find((a) => a.jobId === job.id)) {
    const newApp = {
      jobId: job.id, jobTitle: job.title, company: job.company,
      location: job.location, url: job.url || '',
      serpApiJobId: job.serpApiJobId || '', status: 'applied',
      appliedAt: new Date().toISOString(), notes: '',
    }
    await dbSet(`jh_apps_${profile.id}`, [...apps, newApp])
    const index = (await dbGet(`jh_applied_urls_${profile.id}`)) || []
    await dbSet(`jh_applied_urls_${profile.id}`, [
      ...index,
      { url: job.url || '', serpApiJobId: job.serpApiJobId || '', company: job.company, title: job.title },
    ])
  }

  // Immediately update appliedSet so the job is hidden on next scroll
  setAppliedSet((prev) => {
    const next = new Set(prev)
    if (job.url) next.add(job.url)
    if (job.serpApiJobId) next.add(job.serpApiJobId)
    return next
  })

  // After animation completes, update mutations — dbSet inside functional updater (no stale closure)
  const jobId = job.id
  setTimeout(() => {
    setApplyingId(null)
    setMutations((prev) => {
      const existing = prev.find((m) => m.id === jobId)
      const updated = existing
        ? prev.map((m) => m.id === jobId ? { ...m, status: 'applied', appliedAt: new Date().toISOString() } : m)
        : [...prev, { id: jobId, status: 'applied', appliedAt: new Date().toISOString() }]
      dbSet(`jh_jobs_${profile.id}_${todayStr()}`, updated)
      return updated
    })
  }, 750)
}
```

- [ ] **Step 8: Update `handleSkip`**

Replace the `handleSkip` implementation to operate on `jobPool`:
```js
const handleSkip = async (job) => {
  setJobPool((prev) => prev.filter((j) => j.id !== job.id))
  const newSkipped = [...skippedJobs, { url: job.url || '', serpApiJobId: job.serpApiJobId || '', company: job.company, title: job.title }]
  setSkippedJobs(newSkipped)
  await dbSet(`jh_skipped_${profile.id}`, newSkipped)
}
```

- [ ] **Step 9: Add sentinel div to JSX and update "Find jobs" copy**

1. Search for the string `'Find 20 jobs'` in the file (line 662) and change to `'Find jobs'`. Also search for `'↻ Refresh jobs'` and change to `'↻ Refresh'`. Update the button label logic:
   ```jsx
   {loading ? 'Searching…' : jobPool.length > 0 ? '↻ Refresh' : 'Find jobs'}
   ```

2. Search for any other `'Find 20'` occurrences and replace with `'Find jobs'`.

3. At the bottom of the jobs list (just before the closing `</div>` of the job cards container), add the sentinel:
   ```jsx
   {/* Infinite scroll sentinel — always in DOM, invisible when pool not loaded */}
   <div ref={sentinelRef} style={{ height: 0, margin: 0 }} aria-hidden="true" />
   {poolExhausted && jobPool.length > 0 && (
     <p className={s.exhaustedMsg}>You've seen all available jobs for today.</p>
   )}
   ```
   Add `.exhaustedMsg` to `Jobs.module.css`:
   ```css
   .exhaustedMsg {
     text-align: center;
     color: var(--text-3);
     font-size: var(--text-sm);
     padding: var(--space-6) 0;
   }
   ```

- [ ] **Step 10: Fix any remaining `jobs` references**

Search the file for remaining uses of `setJobs`, `saveJobs`, and standalone `jobs` (not `jobPool`, `visibleJobs`, etc.) and update:
- `jobs.length > 0` → `jobPool.length > 0` (in loading/empty-state conditions)
- `jobs.filter(...)` used for counts → use `allMutated.filter(...)` or `filterCounts` as derived above

- [ ] **Step 11: Run frontend tests**

```bash
cd /workspaces/jobhunter-ai && npm test -- src/__tests__/components/Jobs.test.jsx --reporter=verbose 2>&1 | tail -30
```
Fix any test failures caused by the state rename (mocks expecting `jobs` state should now use `jobPool`).

- [ ] **Step 12: Commit**

```bash
cd /workspaces/jobhunter-ai && git add src/components/Jobs.jsx src/components/Jobs.module.css
git commit -m "feat: replace jobs state with pool+mutations model, add infinite scroll via IntersectionObserver"
```

---

## Task 7: Dashboard.jsx + MainApp.jsx + copy updates + CLAUDE.md

**Files:**
- Modify: `src/components/Dashboard.jsx`
- Modify: `src/components/MainApp.jsx`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update Dashboard.jsx**

In `Dashboard.jsx` line 17, change:
```js
dbGet(`jh_jobs_${profile.id}_${todayStr()}`)
```
to:
```js
dbGet(`jh_jobs_pool_${profile.id}_${todayStr()}`)
```

On line 66, change `'Find 20 matching jobs today'` to `'Find jobs'`.

- [ ] **Step 2: Update MainApp.jsx**

In `MainApp.jsx` line 112, change:
```js
dbGet(`jh_jobs_${profile.id}_${todayStr()}`),
```
to:
```js
dbGet(`jh_jobs_pool_${profile.id}_${todayStr()}`),
```

- [ ] **Step 3: Update CLAUDE.md KV key table**

Find the KV key table in `CLAUDE.md` and add a new row after the `jh_jobs_` row:
```
| `jh_jobs_pool_{profileId}_{YYYY-MM-DD}` | Full pool of up to 50 scored jobs for the day. Written by frontend after `callJobsSearch` completes and by scheduled search. Never mutated by UI actions. |
```

Also update the `jh_jobs_` row description to reflect its new role as the sparse mutation log:
```
| `jh_jobs_{profileId}_{YYYY-MM-DD}` | Sparse mutation log `{ id, status, customResume, tailorResult, appliedAt }[]`. One entry per job the user has interacted with (applied/customized/tailored). |
```

- [ ] **Step 4: Run full test suite**

```bash
cd /workspaces/jobhunter-ai && npm test 2>&1 | tail -30
```
Expected: all 179+ tests pass (or close to it — fix any regressions before committing).

- [ ] **Step 5: Commit**

```bash
cd /workspaces/jobhunter-ai && git add src/components/Dashboard.jsx src/components/MainApp.jsx CLAUDE.md
git commit -m "feat: update Dashboard and MainApp badge counts to read from jh_jobs_pool_; update CLAUDE.md KV key table"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run the complete test suite**

```bash
cd /workspaces/jobhunter-ai && npm test 2>&1 | tail -40
```
Expected: all tests pass. Fix any regressions.

- [ ] **Step 2: Run lint**

```bash
cd /workspaces/jobhunter-ai && npm run lint 2>&1 | tail -20
```
Expected: no errors (warnings for unused vars are OK per project config).

- [ ] **Step 3: Verify "Find 20" is gone**

```bash
grep -r "Find 20" /workspaces/jobhunter-ai/src/ 2>/dev/null
```
Expected: no output.

- [ ] **Step 4: Verify `_sourcePriority` is not exported in `fetchAllPages` output**

This is validated by the `fetchAllPages` test in Task 1 (`expect(results[0]._sourcePriority).toBeUndefined()`).

- [ ] **Step 5: Final commit if any stragglers**

```bash
cd /workspaces/jobhunter-ai && git status
```
If clean, nothing to do. If anything unstaged, commit it now.
