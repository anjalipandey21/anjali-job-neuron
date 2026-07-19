# SerpApi Job Search + Job Expiry Checker Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace JSearch (RapidAPI) with SerpApi Google Jobs, add a job expiry checker (fetch-time + scheduled), filter already-applied jobs from search results, and surface richer job data (company logo, benefits, structured highlights).

**Architecture:** Provider pattern — `serpapi.js` handles all SerpApi HTTP + normalisation; `job-search-core.js` delegates to it and gains an applied-jobs filter + link-validation step. A new daily scheduled function re-checks stored job URLs and flags expired ones. All changes are additive to the stored job shape — no KV migration needed.

**Tech Stack:** Node.js (CommonJS) Netlify Functions, Supabase KV (`kv_store`), SerpApi Google Jobs API, Vitest, React (ESM, inline styles)

**Spec:** `docs/superpowers/specs/2026-03-18-serpapi-job-search-expiry-checker-design.md`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `netlify/functions/lib/job-providers/serpapi.js` | SerpApi HTTP, normalisation, link selection, source sort |
| Create | `netlify/functions/lib/expiry-checker.js` | `isLinkAlive` + `validateJobLinks` |
| Create | `netlify/functions/check-job-expiry-background.js` | Scheduled daily job URL re-checker |
| Create | `netlify/functions/__tests__/serpapi.test.js` | Tests for serpapi.js |
| Create | `netlify/functions/__tests__/expiry-checker.test.js` | Tests for expiry-checker.js |
| Modify | `netlify/functions/lib/job-search-core.js` | Wire serpapi provider, add applied-filter + link-validation, `isWithinDateWindow` |
| Modify | `netlify/functions/jobs-search.js` | Forward `profileId`, `dateWindowDays` |
| Modify | `netlify/functions/scheduled-job-search-background.js` | Forward `profileId`, `dateWindowDays`, `userId`, `supabase` |
| Modify | `netlify/functions/__tests__/jobs-search.test.js` | Update `makeJob` + all assertions to normalised shape |
| Modify | `netlify.toml` | Register expiry checker cron + timeout |
| Modify | `src/lib/api.js` | Add `profileId` + `dateWindowDays` to `callJobsSearch` body |
| Modify | `src/components/Jobs.jsx` | Expired banner, logo, benefits, highlights, apply-index write, pass new params |
| Modify | `src/components/Applications.jsx` | Remove from apply-index on status change |
| Modify | `src/components/Settings.jsx` | Date window dropdown |
| Modify | `.env.example` + `CLAUDE.md` + `README.md` | Swap `RAPIDAPI_KEY` → `SERPAPI_KEY` |

**Run tests with:** `npm test` (from `/workspaces/jobhunter-ai`)
**Current passing count:** 98 tests across 15 suites. Target after this plan: ~118 tests across 17 suites.

---

## Task 1: Update existing test helper + quality filter field names

**Files:**
- Modify: `netlify/functions/__tests__/jobs-search.test.js`
- Modify: `netlify/functions/lib/job-search-core.js`

The existing quality-filter functions (`isStaffingAgency`, `hasGoodDescription`, `deduplicateSimilar`, `isReputableSource`) and the `applyQualityFilters` sort all read JSearch-specific field names (`job_title`, `employer_name`, `job_description`, `job_apply_link`, `job_google_link`, `employer_website`, `job_posted_at_datetime_utc`). After the SerpApi migration the normalised shape uses `title`, `company`, `description`, `url`, `links[]`, `postedAt`. Update tests first, then functions.

- [ ] **Step 1: Update `makeJob` and all test assertions to use normalised field names**

Replace the entire `makeJob` helper and all test bodies in `netlify/functions/__tests__/jobs-search.test.js`:

```js
// ── Helpers ───────────────────────────────────────────────────────────────────
const makeJob = (overrides = {}) => ({
  serpApiJobId: 'serpapi_job_1',
  title: 'Software Engineer',
  company: 'Acme Corp',
  description: 'A'.repeat(300),
  url: 'https://acme.com/jobs/1',
  links: [{ title: 'Acme Careers', link: 'https://acme.com/jobs/1' }],
  postedAt: new Date().toISOString(),
  sourcePlatform: 'Acme Careers',
  companyLogo: '',
  highlights: [],
  benefits: { healthInsurance: false, paidTimeOff: false, dental: false },
  jobType: 'Full-time',
  ...overrides,
})
```

Update `isStaffingAgency` tests:
```js
describe('isStaffingAgency', () => {
  it('flags a known staffing agency by name', () => {
    expect(isStaffingAgency(makeJob({ company: 'Randstad Solutions' }))).toBe(true)
  })
  it('flags Robert Half', () => {
    expect(isStaffingAgency(makeJob({ company: 'Robert Half International' }))).toBe(true)
  })
  it('flags staffing keyword in first 200 chars of description', () => {
    const description = 'We are a staffing company placing candidates. ' + 'A'.repeat(300)
    expect(isStaffingAgency(makeJob({ description }))).toBe(true)
  })
  it('passes a legitimate direct employer', () => {
    expect(isStaffingAgency(makeJob({ company: 'Google LLC' }))).toBe(false)
  })
  it('passes when staffing word appears only after 200 chars', () => {
    const description = 'A'.repeat(201) + ' staffing company'
    expect(isStaffingAgency(makeJob({ company: 'Acme Corp', description }))).toBe(false)
  })
})
```

Update `hasGoodDescription` tests (field `description` already matches — but double-check `makeJob` uses `description` not `job_description` in overrides):
```js
describe('hasGoodDescription', () => {
  it('passes descriptions with 200+ characters', () => {
    expect(hasGoodDescription(makeJob({ description: 'A'.repeat(200) }))).toBe(true)
  })
  it('fails descriptions shorter than 200 characters', () => {
    expect(hasGoodDescription(makeJob({ description: 'Short desc' }))).toBe(false)
  })
  it('fails missing description', () => {
    expect(hasGoodDescription(makeJob({ description: '' }))).toBe(false)
  })
  it('fails undefined description', () => {
    expect(hasGoodDescription(makeJob({ description: undefined }))).toBe(false)
  })
})
```

Update `isReputableSource` tests:
```js
describe('isReputableSource', () => {
  it('identifies a LinkedIn url as reputable', () => {
    expect(isReputableSource(makeJob({ url: 'https://linkedin.com/jobs/12345', links: [] }))).toBe(true)
  })
  it('identifies a Greenhouse link in links array as reputable', () => {
    expect(isReputableSource(makeJob({
      url: 'https://example.com',
      links: [{ title: 'Greenhouse', link: 'https://boards.greenhouse.io/acme/jobs/1' }],
    }))).toBe(true)
  })
  it('identifies amazon.jobs in links as reputable', () => {
    expect(isReputableSource(makeJob({
      url: 'https://example.com',
      links: [{ title: 'Amazon', link: 'https://amazon.jobs/en/jobs/123' }],
    }))).toBe(true)
  })
  it('returns false for an unknown source', () => {
    expect(isReputableSource(makeJob({
      url: 'https://unknownsite.com/apply',
      links: [{ title: 'Unknown', link: 'https://unknownsite.com/apply' }],
    }))).toBe(false)
  })
})
```

Update `deduplicateSimilar` tests:
```js
describe('deduplicateSimilar', () => {
  it('removes duplicate titles at the same company', () => {
    const jobs = [
      makeJob({ title: 'Senior Software Engineer', company: 'Acme' }),
      makeJob({ title: 'Software Engineer', company: 'Acme' }),
    ]
    expect(deduplicateSimilar(jobs)).toHaveLength(1)
  })
  it('keeps distinct roles at the same company', () => {
    const jobs = [
      makeJob({ title: 'Software Engineer', company: 'Acme' }),
      makeJob({ title: 'Data Engineer', company: 'Acme' }),
    ]
    expect(deduplicateSimilar(jobs)).toHaveLength(2)
  })
  it('keeps same title at different companies', () => {
    const jobs = [
      makeJob({ title: 'Software Engineer', company: 'Acme' }),
      makeJob({ title: 'Software Engineer', company: 'Betacorp' }),
    ]
    expect(deduplicateSimilar(jobs)).toHaveLength(2)
  })
  it('strips lead and principal prefixes when comparing', () => {
    const jobs = [
      makeJob({ title: 'Lead Software Engineer', company: 'Acme' }),
      makeJob({ title: 'Principal Software Engineer', company: 'Acme' }),
    ]
    expect(deduplicateSimilar(jobs)).toHaveLength(1)
  })
})
```

Update `applyQualityFilters` tests:
```js
describe('applyQualityFilters', () => {
  it('removes staffing agency jobs', () => {
    const jobs = [
      makeJob({ company: 'Randstad' }),
      makeJob({ company: 'Google' }),
    ]
    const result = applyQualityFilters(jobs)
    expect(result).toHaveLength(1)
    expect(result[0].company).toBe('Google')
  })
  it('removes jobs with short descriptions', () => {
    const jobs = [
      makeJob({ description: 'Too short' }),
      makeJob({ company: 'Acme' }),
    ]
    expect(applyQualityFilters(jobs)).toHaveLength(1)
  })
  it('sorts reputable sources before unknown sources', () => {
    const jobs = [
      makeJob({ company: 'Unknown Co', url: 'https://unknownco.com/apply', links: [] }),
      makeJob({ company: 'Acme', url: 'https://boards.greenhouse.io/acme/1', links: [] }),
    ]
    const result = applyQualityFilters(jobs)
    expect(result[0].company).toBe('Acme')
  })
})
```

Remove `getBestLink` tests entirely — `getBestLink` operated on JSearch raw job fields and is no longer used in the pipeline. Delete its `describe` block.

Replace `is60DaysOld` tests with `isWithinDateWindow` tests. Update the import line too:
```js
const {
  isStaffingAgency,
  hasGoodDescription,
  isReputableSource,
  deduplicateSimilar,
  applyQualityFilters,
  isWithinDateWindow,  // replaces is60DaysOld
} = require('../jobs-search')
```

```js
// ── isWithinDateWindow ────────────────────────────────────────────────────────
describe('isWithinDateWindow', () => {
  it('returns true for a job posted today (30-day window)', () => {
    expect(isWithinDateWindow(new Date().toISOString(), 30)).toBe(true)
  })
  it('returns true for a job posted 29 days ago (30-day window)', () => {
    const d = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)
    expect(isWithinDateWindow(d.toISOString(), 30)).toBe(true)
  })
  it('returns false for a job posted 31 days ago (30-day window)', () => {
    const d = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    expect(isWithinDateWindow(d.toISOString(), 30)).toBe(false)
  })
  it('returns true for a job posted 59 days ago (60-day window)', () => {
    const d = new Date(Date.now() - 59 * 24 * 60 * 60 * 1000)
    expect(isWithinDateWindow(d.toISOString(), 60)).toBe(true)
  })
  it('returns false for a job posted 61 days ago (60-day window)', () => {
    const d = new Date(Date.now() - 61 * 24 * 60 * 60 * 1000)
    expect(isWithinDateWindow(d.toISOString(), 60)).toBe(false)
  })
  it('returns false for a missing date', () => {
    expect(isWithinDateWindow(null, 30)).toBe(false)
    expect(isWithinDateWindow(undefined, 30)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd /workspaces/jobhunter-ai && npm test -- netlify/functions/__tests__/jobs-search.test.js
```

Expected: multiple FAIL — functions still read old field names like `j.employer_name`, `j.job_description`, `j.job_title`.

- [ ] **Step 3: Update quality-filter functions in `job-search-core.js`**

In `netlify/functions/lib/job-search-core.js`:

**`isStaffingAgency`:** change `j.employer_name` → `j.company`, `j.job_description` → `j.description`:
```js
function isStaffingAgency(job) {
  const name = (job.company || '').toLowerCase()
  const desc = (job.description || '').toLowerCase()
  return STAFFING_BLACKLIST.some((kw) => name.includes(kw) || desc.slice(0, 200).includes(kw))
}
```

**`hasGoodDescription`:** change `job.job_description` → `job.description`:
```js
function hasGoodDescription(job) {
  return (job.description || '').length >= 200
}
```

**`deduplicateSimilar`:** change `j.job_title` → `j.title`, `j.employer_name` → `j.company`:
```js
function deduplicateSimilar(jobs) {
  const seen = new Map()
  return jobs.filter((j) => {
    const title = (j.title || '').toLowerCase()
      .replace(/senior|sr\.|junior|jr\.|lead|principal|staff/gi, '').trim()
    const company = (j.company || '').toLowerCase()
    const key = `${company}::${title}`
    if (seen.has(key)) return false
    seen.set(key, true)
    return true
  })
}
```

**`isReputableSource`:** replace JSearch field access with normalised `url` and `links` array:
```js
function isReputableSource(job) {
  const allLinks = [job.url, ...(job.links || []).map((l) => l.link)]
    .filter(Boolean).join(' ').toLowerCase()
  return REPUTABLE_SOURCES.some((s) => allLinks.includes(s))
}
```

**`applyQualityFilters`:** update the sort's date field from `job_posted_at_datetime_utc` → `postedAt`:
```js
function applyQualityFilters(jobs) {
  let filtered = jobs.filter((j) => !isStaffingAgency(j))
  filtered = filtered.filter((j) => hasGoodDescription(j))
  filtered = deduplicateSimilar(filtered)
  filtered.sort((a, b) => {
    const aRep = isReputableSource(a) ? 1 : 0
    const bRep = isReputableSource(b) ? 1 : 0
    if (bRep !== aRep) return bRep - aRep
    const aDate = a.postedAt ? new Date(a.postedAt) : new Date(0)
    const bDate = b.postedAt ? new Date(b.postedAt) : new Date(0)
    return bDate - aDate
  })
  return filtered
}
```

**Add `isWithinDateWindow`** (replaces `is60DaysOld`):
```js
function isWithinDateWindow(dateStr, days) {
  if (!dateStr) return false
  const posted = new Date(dateStr)
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return posted >= cutoff
}
```

In the `module.exports` at the bottom, replace `is60DaysOld` with `isWithinDateWindow`:
```js
module.exports = {
  fetchAndScoreJobs,
  isWithinDateWindow,   // was is60DaysOld
  isStaffingAgency,
  hasGoodDescription,
  isReputableSource,
  deduplicateSimilar,
  applyQualityFilters,
  getBestLink,
}
```

Also update `jobs-search.js` re-export at the bottom of that file:
```js
module.exports.isWithinDateWindow = isWithinDateWindow  // was is60DaysOld
// remove: module.exports.is60DaysOld
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /workspaces/jobhunter-ai && npm test -- netlify/functions/__tests__/jobs-search.test.js
```

Expected: all jobs-search tests PASS. (getBestLink tests gone, isWithinDateWindow tests green.)

- [ ] **Step 5: Commit**

```bash
cd /workspaces/jobhunter-ai
git add netlify/functions/__tests__/jobs-search.test.js netlify/functions/lib/job-search-core.js netlify/functions/jobs-search.js
git commit -m "$(cat <<'EOF'
refactor: update quality-filter field names to normalised job shape

isStaffingAgency, hasGoodDescription, deduplicateSimilar, isReputableSource,
applyQualityFilters sort — all updated from JSearch raw fields to normalised
shape (title/company/description/url/links/postedAt).
Replaces is60DaysOld with isWithinDateWindow(dateStr, days).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create `serpapi.js` provider (TDD)

**Files:**
- Create: `netlify/functions/lib/job-providers/serpapi.js`
- Create: `netlify/functions/__tests__/serpapi.test.js`

- [ ] **Step 1: Create the test file**

Create `netlify/functions/__tests__/serpapi.test.js`:

```js
'use strict'

const { vi, describe, it, expect, beforeEach } = require('vitest')
const { parseRelativeDate, getBestApplyLink, normaliseJob, fetchJobs } = require('../lib/job-providers/serpapi')

// ── parseRelativeDate ─────────────────────────────────────────────────────────
describe('parseRelativeDate', () => {
  it('parses "17 hours ago"', () => {
    const result = new Date(parseRelativeDate('17 hours ago'))
    const expected = new Date(Date.now() - 17 * 3600000)
    expect(Math.abs(result - expected)).toBeLessThan(5000)
  })
  it('parses "3 days ago"', () => {
    const result = new Date(parseRelativeDate('3 days ago'))
    const expected = new Date(Date.now() - 3 * 86400000)
    expect(Math.abs(result - expected)).toBeLessThan(5000)
  })
  it('parses "2 weeks ago"', () => {
    const result = new Date(parseRelativeDate('2 weeks ago'))
    const expected = new Date(Date.now() - 14 * 86400000)
    expect(Math.abs(result - expected)).toBeLessThan(5000)
  })
  it('parses "1 month ago"', () => {
    const result = new Date(parseRelativeDate('1 month ago'))
    const expected = new Date(Date.now() - 30 * 86400000)
    expect(Math.abs(result - expected)).toBeLessThan(5000)
  })
  it('returns today for an unparseable string', () => {
    const result = new Date(parseRelativeDate('recently'))
    const now = new Date()
    expect(result.toDateString()).toBe(now.toDateString())
  })
  it('returns today for null', () => {
    const result = new Date(parseRelativeDate(null))
    expect(result.toDateString()).toBe(new Date().toDateString())
  })
})

// ── getBestApplyLink ──────────────────────────────────────────────────────────
describe('getBestApplyLink', () => {
  it('prefers the direct company careers link over aggregators', () => {
    const options = [
      { title: 'GitHub Careers', link: 'https://github.careers/jobs/1' },
      { title: 'LinkedIn', link: 'https://linkedin.com/jobs/1' },
      { title: 'Indeed', link: 'https://indeed.com/viewjob?jk=1' },
    ]
    expect(getBestApplyLink(options)).toBe('https://github.careers/jobs/1')
  })
  it('falls back to LinkedIn when no direct company link', () => {
    const options = [
      { title: 'LinkedIn', link: 'https://linkedin.com/jobs/1' },
      { title: 'Indeed', link: 'https://indeed.com/viewjob?jk=1' },
    ]
    expect(getBestApplyLink(options)).toBe('https://linkedin.com/jobs/1')
  })
  it('falls back to Indeed when no LinkedIn', () => {
    const options = [
      { title: 'Indeed', link: 'https://indeed.com/viewjob?jk=1' },
      { title: 'Glassdoor', link: 'https://glassdoor.com/jobs/1' },
    ]
    expect(getBestApplyLink(options)).toBe('https://indeed.com/viewjob?jk=1')
  })
  it('falls back to first option when all are aggregators', () => {
    const options = [
      { title: 'ZipRecruiter', link: 'https://ziprecruiter.com/1' },
      { title: 'Monster', link: 'https://monster.com/1' },
    ]
    expect(getBestApplyLink(options)).toBe('https://ziprecruiter.com/1')
  })
  it('returns empty string for empty array', () => {
    expect(getBestApplyLink([])).toBe('')
  })
  it('returns empty string for null', () => {
    expect(getBestApplyLink(null)).toBe('')
  })
})

// ── normaliseJob ──────────────────────────────────────────────────────────────
describe('normaliseJob', () => {
  const rawJob = {
    job_id: 'eyJqb2JfdGl0bGUiOiJTb2Z0d2FyZSBFbmdpbmVlciJ9',
    title: 'Software Engineer II, Security',
    company_name: 'GitHub, Inc.',
    location: 'United States',
    via: 'GitHub Careers',
    thumbnail: 'https://serpapi.com/logo.png',
    description: 'About GitHub. '.repeat(30),
    job_highlights: [
      { title: 'Qualifications', items: ['2+ years experience'] },
    ],
    detected_extensions: {
      posted_at: '2 days ago',
      schedule_type: 'Full-time',
      health_insurance: true,
      paid_time_off: true,
      dental_coverage: false,
    },
    apply_options: [
      { title: 'GitHub Careers', link: 'https://github.careers/jobs/1' },
      { title: 'LinkedIn', link: 'https://linkedin.com/jobs/1' },
    ],
  }

  it('maps all fields correctly', () => {
    const job = normaliseJob(rawJob)
    expect(job.serpApiJobId).toBe(rawJob.job_id)
    expect(job.title).toBe('Software Engineer II, Security')
    expect(job.company).toBe('GitHub, Inc.')
    expect(job.location).toBe('United States')
    expect(job.sourcePlatform).toBe('GitHub Careers')
    expect(job.companyLogo).toBe('https://serpapi.com/logo.png')
    expect(job.description.length).toBeLessThanOrEqual(400)
    expect(job.highlights).toHaveLength(1)
    expect(job.highlights[0].title).toBe('Qualifications')
    expect(job.jobType).toBe('Full-time')
    expect(job.benefits.healthInsurance).toBe(true)
    expect(job.benefits.paidTimeOff).toBe(true)
    expect(job.benefits.dental).toBe(false)
    expect(job.links).toHaveLength(2)
    expect(job.url).toBe('https://github.careers/jobs/1')
  })

  it('sets companyLogo to empty string when thumbnail absent', () => {
    const job = normaliseJob({ ...rawJob, thumbnail: undefined })
    expect(job.companyLogo).toBe('')
  })
})

// ── fetchJobs source sort order ───────────────────────────────────────────────
describe('fetchJobs source sort order', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('sorts LinkedIn/Indeed/Glassdoor jobs before company-direct jobs', async () => {
    const makeRaw = (via, jobId) => ({
      job_id: jobId,
      title: 'Engineer',
      company_name: 'Co',
      location: 'US',
      via,
      description: 'x'.repeat(50),
      detected_extensions: {},
      apply_options: [{ title: via, link: `https://example.com/${jobId}` }],
    })

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        jobs_results: [
          makeRaw('GitHub Careers', 'id1'),
          makeRaw('LinkedIn', 'id2'),
          makeRaw('Indeed', 'id3'),
        ],
      }),
    })

    const jobs = await fetchJobs('Software Engineer', 'United States', 30)
    // LinkedIn and Indeed should sort before GitHub Careers
    const liIdx = jobs.findIndex((j) => j.sourcePlatform === 'LinkedIn')
    const ghIdx = jobs.findIndex((j) => j.sourcePlatform === 'GitHub Careers')
    expect(liIdx).toBeLessThan(ghIdx)
  })
})
```

- [ ] **Step 2: Run tests — expect failures (file does not exist yet)**

```bash
cd /workspaces/jobhunter-ai && npm test -- netlify/functions/__tests__/serpapi.test.js
```

Expected: FAIL — `Cannot find module '../lib/job-providers/serpapi'`

- [ ] **Step 3: Create the serpapi.js provider**

Create `netlify/functions/lib/job-providers/serpapi.js`:

```js
// SerpApi Google Jobs provider
// Handles HTTP, response normalisation, source prioritisation, apply-link selection.
// TODO: add pagination support (start=10, start=20, ...) when needed.

'use strict'

const ROLE_QUERIES = [
  'Data Engineer OR ETL Engineer OR Data Pipeline Engineer OR Big Data Engineer',
  'Software Engineer OR Software Developer OR Backend Engineer OR Full Stack Engineer',
  'AI Engineer OR Artificial Intelligence Engineer OR Applied AI Engineer OR AI Developer',
  'Machine Learning Engineer OR ML Engineer OR MLOps Engineer OR Applied ML Engineer',
  'BI Engineer OR Business Intelligence Engineer OR Analytics Engineer OR BI Developer',
]

const KNOWN_AGGREGATORS = [
  'linkedin', 'indeed', 'glassdoor', 'ziprecruiter', 'monster', 'dice',
  'top jobs today', 'hiringcafe', 'virtualinterview.ai', 'jobscroller',
  'factoryfix', 'talentify', 'job abstracts', 'experteer', 'snagajob',
]

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
async function fetchOnePage(query, location, dateWindowDays) {
  const url = new URL('https://serpapi.com/search')
  url.searchParams.set('engine', 'google_jobs')
  url.searchParams.set('q', query)
  if (location) url.searchParams.set('location', location)
  if (dateWindowDays === 30) url.searchParams.set('date_posted', 'month')
  url.searchParams.set('api_key', process.env.SERPAPI_KEY)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`SerpApi error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return (data.jobs_results || []).map(normaliseJob)
}

// Fetches jobs from SerpApi using adaptive query logic:
// - Custom query → 1 API call
// - No custom query → 5 parallel calls using ROLE_QUERIES
// Returns normalised jobs deduped by serpApiJobId, sorted by source priority.
async function fetchJobs(customQuery, location, dateWindowDays = 30) {
  const queries = customQuery ? [customQuery] : ROLE_QUERIES
  const results = await Promise.allSettled(
    queries.map((q) => fetchOnePage(q, location, dateWindowDays))
  )

  const seen = new Set()
  const allJobs = []
  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    for (const job of result.value) {
      const key = job.serpApiJobId || `${job.company}::${job.title}`
      if (seen.has(key)) continue
      seen.add(key)
      allJobs.push(job)
    }
  }

  // Sort by source priority before returning (quality filter + AI scoring may re-sort later)
  allJobs.sort((a, b) => a._sourcePriority - b._sourcePriority)

  // Strip internal sort field — not stored in KV
  return allJobs.map(({ _sourcePriority, ...job }) => job)
}

module.exports = { fetchJobs, parseRelativeDate, getBestApplyLink, normaliseJob }
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /workspaces/jobhunter-ai && npm test -- netlify/functions/__tests__/serpapi.test.js
```

Expected: all 12 serpapi tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /workspaces/jobhunter-ai
git add netlify/functions/lib/job-providers/serpapi.js netlify/functions/__tests__/serpapi.test.js
git commit -m "$(cat <<'EOF'
feat: add SerpApi Google Jobs provider with normalisation and source sort

parseRelativeDate, getBestApplyLink, normaliseJob, fetchJobs (adaptive queries).
12 unit tests.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create `expiry-checker.js` (TDD)

**Files:**
- Create: `netlify/functions/lib/expiry-checker.js`
- Create: `netlify/functions/__tests__/expiry-checker.test.js`

- [ ] **Step 1: Write the tests**

Create `netlify/functions/__tests__/expiry-checker.test.js`:

```js
'use strict'

const { vi, describe, it, expect, beforeEach } = require('vitest')
const { isLinkAlive, validateJobLinks } = require('../lib/expiry-checker')

const makeJob = (url) => ({ url, title: 'Engineer', company: 'Co' })

describe('isLinkAlive', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns true for HTTP 200', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200 })
    expect(await isLinkAlive('https://example.com')).toBe(true)
  })

  it('returns true for HTTP 301 redirect', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 301 })
    expect(await isLinkAlive('https://example.com')).toBe(true)
  })

  it('returns false for HTTP 404', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 404 })
    expect(await isLinkAlive('https://example.com')).toBe(false)
  })

  it('returns false for HTTP 410 (Gone)', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 410 })
    expect(await isLinkAlive('https://example.com')).toBe(false)
  })

  it('returns null for HTTP 403 (ambiguous)', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 403 })
    expect(await isLinkAlive('https://example.com')).toBeNull()
  })

  it('returns null for HTTP 429 (ambiguous)', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 429 })
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
})

describe('validateJobLinks', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('removes jobs with dead links (404)', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 404 })
    const jobs = [makeJob('https://dead.com'), makeJob('https://also-dead.com')]
    expect(await validateJobLinks(jobs)).toHaveLength(0)
  })

  it('keeps jobs with alive links', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200 })
    const jobs = [makeJob('https://alive.com')]
    expect(await validateJobLinks(jobs)).toHaveLength(1)
  })

  it('keeps jobs with ambiguous links (403)', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 403 })
    const jobs = [makeJob('https://blocked.com')]
    expect(await validateJobLinks(jobs)).toHaveLength(1)
  })

  it('keeps jobs with no url (cannot check)', async () => {
    const jobs = [{ title: 'No URL job', company: 'Co', url: '' }]
    expect(await validateJobLinks(jobs)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd /workspaces/jobhunter-ai && npm test -- netlify/functions/__tests__/expiry-checker.test.js
```

Expected: FAIL — `Cannot find module '../lib/expiry-checker'`

- [ ] **Step 3: Implement expiry-checker.js**

Create `netlify/functions/lib/expiry-checker.js`:

```js
'use strict'

// Returns true (alive), false (definitively dead: 404/410), or null (ambiguous/error).
async function isLinkAlive(url, timeoutMs = 5000) {
  if (!url) return null
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' })
    clearTimeout(timer)
    if (res.status === 404 || res.status === 410) return false
    if (res.status >= 200 && res.status < 400) return true
    return null
  } catch {
    return null
  }
}

// Runs isLinkAlive in batches of `concurrency`.
// Returns jobs array with definitively-dead-link jobs removed.
// Jobs with ambiguous results (null) or no URL are kept.
async function validateJobLinks(jobs, concurrency = 5) {
  const results = []
  for (let i = 0; i < jobs.length; i += concurrency) {
    const batch = jobs.slice(i, i + concurrency)
    const checks = await Promise.all(batch.map((j) => isLinkAlive(j.url)))
    for (let k = 0; k < batch.length; k++) {
      if (checks[k] !== false) results.push(batch[k])
    }
  }
  return results
}

module.exports = { isLinkAlive, validateJobLinks }
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /workspaces/jobhunter-ai && npm test -- netlify/functions/__tests__/expiry-checker.test.js
```

Expected: all 12 expiry-checker tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /workspaces/jobhunter-ai
git add netlify/functions/lib/expiry-checker.js netlify/functions/__tests__/expiry-checker.test.js
git commit -m "$(cat <<'EOF'
feat: add expiry-checker module with isLinkAlive and validateJobLinks

HEAD-check with 5s timeout. Returns true/false/null for alive/dead/ambiguous.
Batched concurrency=5. 12 unit tests.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire `job-search-core.js` to new provider and pipeline

**Files:**
- Modify: `netlify/functions/lib/job-search-core.js`

The core pipeline must now: use `serpapi.fetchJobs` instead of the old JSearch fetch layer, apply the 7-step pipeline order (fetch → date-window filter → applied-job filter → quality filter → link validation → AI scoring → sort/cap).

`fetchAndScoreJobs` gains new optional params: `profileId`, `dateWindowDays`, `userId`, `supabase`. When all four are present, the applied-job filter runs. When absent (e.g. in tests), it is skipped gracefully.

- [ ] **Step 1: Rewrite `job-search-core.js`**

Replace the entire file content of `netlify/functions/lib/job-search-core.js`. Key structural changes:
- Remove `ROLE_QUERIES`, `fetchOnePage`, `fetchJobs`, `is60DaysOld` (all moved to `serpapi.js`)
- Remove `detectPlatform`, `getAllLinks` (replaced by `normaliseJob` in `serpapi.js`)
- Keep: `STAFFING_BLACKLIST`, `REPUTABLE_SOURCES`, all quality-filter functions (already updated in Task 1), `scoreJobs`, `fetchAndScoreJobs`
- Add `normKey` helper for company+title dedup in applied-job filter

```js
// Shared job-search logic — used by jobs-search.js (HTTP) and scheduled-job-search-background.js
// fetchAndScoreJobs: full pipeline → fetch → filter → score → normalize → top 20 job objects

'use strict'

const { fetchJobs } = require('./job-providers/serpapi')
const { validateJobLinks } = require('./expiry-checker')
const { routeAI } = require('../ai-router')
const { createLogger } = require('../logger')

// ── Constants ─────────────────────────────────────────────────────────────────

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

function isWithinDateWindow(dateStr, days) {
  if (!dateStr) return false
  const posted = new Date(dateStr)
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return posted >= cutoff
}

function isStaffingAgency(job) {
  const name = (job.company || '').toLowerCase()
  const desc = (job.description || '').toLowerCase()
  return STAFFING_BLACKLIST.some((kw) => name.includes(kw) || desc.slice(0, 200).includes(kw))
}

function hasGoodDescription(job) {
  return (job.description || '').length >= 200
}

function isReputableSource(job) {
  const allLinks = [job.url, ...(job.links || []).map((l) => l.link)]
    .filter(Boolean).join(' ').toLowerCase()
  return REPUTABLE_SOURCES.some((s) => allLinks.includes(s))
}

function deduplicateSimilar(jobs) {
  const seen = new Map()
  return jobs.filter((j) => {
    const title = (j.title || '').toLowerCase()
      .replace(/senior|sr\.|junior|jr\.|lead|principal|staff/gi, '').trim()
    const company = (j.company || '').toLowerCase()
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
    const aDate = a.postedAt ? new Date(a.postedAt) : new Date(0)
    const bDate = b.postedAt ? new Date(b.postedAt) : new Date(0)
    return bDate - aDate
  })
  return filtered
}

// Normalise company+title for fuzzy applied-job matching.
function normKey(company, title) {
  return `${(company || '').toLowerCase()}::${(title || '').toLowerCase()
    .replace(/\b(senior|sr\.|junior|jr\.|lead|principal|staff)\b/gi, '').trim()}`
}

// ── Score ─────────────────────────────────────────────────────────────────────

async function scoreJobs(jobs, resumeText, targetRoles, rid) {
  const jobSummaries = jobs.slice(0, 20).map((j, i) => {
    const quals = j.highlights?.find((h) => h.title === 'Qualifications')?.items || []
    return {
      idx: i,
      title: j.title,
      company: j.company,
      // Prefer structured qualifications over raw description snippet for better AI matching
      description: quals.length > 0 ? quals.slice(0, 5).join('; ') : (j.description || '').slice(0, 300),
    }
  })

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

// Full pipeline: fetch → date filter → applied filter → quality filter →
//   link validation → AI score → sort/cap at 20
// Throws on SerpApi failure or when no jobs survive filtering.
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
  log.info('jobSearchCore.fetched', { rawCount: rawJobs.length })

  if (rawJobs.length === 0) throw new Error('No jobs found for this query. Try different roles or location.')

  // Step 2: Date-window filter
  const recentJobs = rawJobs.filter((j) => isWithinDateWindow(j.postedAt, dateWindowDays))
  const dateFiltered = recentJobs.length >= 10 ? recentJobs : rawJobs
  log.info('jobSearchCore.dateFiltered', { count: dateFiltered.length })

  // Step 3: Applied-job filter (skip gracefully if params not provided)
  let afterAppliedFilter = dateFiltered
  if (profileId && userId && supabase) {
    try {
      const { data } = await supabase
        .from('kv_store')
        .select('value')
        .eq('user_id', userId)
        .eq('key', `jh_applied_urls_${profileId}`)
        .maybeSingle()
      const applied = Array.isArray(data?.value) ? data.value : []
      const appliedUrls = new Set(applied.map((a) => a.url).filter(Boolean))
      const appliedIds  = new Set(applied.map((a) => a.serpApiJobId).filter(Boolean))
      const appliedKeys = new Set(applied.map((a) => normKey(a.company, a.title)))
      afterAppliedFilter = dateFiltered.filter((j) =>
        !appliedUrls.has(j.url) &&
        !appliedIds.has(j.serpApiJobId) &&
        !appliedKeys.has(normKey(j.company, j.title))
      )
      log.info('jobSearchCore.appliedFiltered', {
        before: dateFiltered.length,
        after: afterAppliedFilter.length,
      })
    } catch (err) {
      log.error('jobSearchCore.appliedFilterError', { error: err.message })
      // Non-fatal: continue without applied-job filtering
    }
  }

  // Step 4: Quality filter
  const qualityJobs = applyQualityFilters(afterAppliedFilter)
  const jobsToProcess = qualityJobs.length >= 5 ? qualityJobs : afterAppliedFilter
  log.info('jobSearchCore.qualityFiltered', { count: jobsToProcess.length })

  // Step 5: Link validation
  const validJobs = await validateJobLinks(jobsToProcess)
  log.info('jobSearchCore.linkValidated', { count: validJobs.length })

  if (validJobs.length === 0) throw new Error('No jobs found for this query. Try different roles or location.')

  // Step 6: AI scoring
  let scores = {}
  if (resumeText) {
    try {
      scores = await scoreJobs(validJobs, resumeText, targetRoles || query, rid)
      log.info('jobSearchCore.scored', { scoredCount: Object.keys(scores).length })
    } catch (err) {
      log.error('jobSearchCore.score', { error: err.message })
    }
  }

  // Step 7: Annotate, sort, cap at 20
  const uidGen = () => Math.random().toString(36).slice(2, 9)
  const jobs = validJobs.slice(0, 25).map((j, i) => {
    const score = scores[i] || { matchScore: 70, reason: '' }
    return {
      id: uidGen(),
      ...j,
      matchScore:   Math.min(100, Math.max(50, score.matchScore)),
      matchReason:  score.reason,
      isReputable:  isReputableSource(j),
      status:       'new',
      source:       'serpapi',
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
  isWithinDateWindow,
  isStaffingAgency,
  hasGoodDescription,
  isReputableSource,
  deduplicateSimilar,
  applyQualityFilters,
}
```

- [ ] **Step 2: Run full test suite**

```bash
cd /workspaces/jobhunter-ai && npm test
```

Expected: all previously-passing tests still PASS. The jobs-search tests from Task 1 should still be green.

- [ ] **Step 3: Commit**

```bash
cd /workspaces/jobhunter-ai
git add netlify/functions/lib/job-search-core.js
git commit -m "$(cat <<'EOF'
feat: wire job-search-core to SerpApi provider with full 7-step pipeline

Replaces JSearch fetch layer with serpapi.fetchJobs. Adds applied-job filter
(injected supabase), link validation, isWithinDateWindow. Uses structured
job_highlights for AI scoring input. Removes ROLE_QUERIES/fetchOnePage/is60DaysOld.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Update HTTP handler and API client

**Files:**
- Modify: `netlify/functions/jobs-search.js`
- Modify: `src/lib/api.js`

`jobs-search.js` needs to forward `profileId` and `dateWindowDays` from the request body to `fetchAndScoreJobs`, along with the user's `userId` and the Supabase client. `src/lib/api.js`'s `callJobsSearch` needs to include these in the request body.

- [ ] **Step 1: Update `jobs-search.js`**

Change the payload destructuring to include `profileId` and `dateWindowDays`:
```js
const { jobId, query, location, resumeText, targetRoles, profileId, dateWindowDays = 30 } = payload
```

Update the `fetchAndScoreJobs` call inside the `try` block:
```js
const top20 = await fetchAndScoreJobs({
  query, location, resumeText, targetRoles, rid,
  profileId,
  dateWindowDays,
  userId: user.sub,
  supabase: sb,
})
```

- [ ] **Step 2: Update `src/lib/api.js`**

In `callJobsSearch`, add `profileId` and `dateWindowDays` parameters and include them in the request body:

```js
export async function callJobsSearch({ query, location, resumeText, targetRoles, profileId, dateWindowDays = 30, onStatus } = {}) {
  // ... existing setup code unchanged ...
  body: JSON.stringify({ jobId, query, location, resumeText, targetRoles, profileId, dateWindowDays }),
  // ... rest unchanged ...
}
```

- [ ] **Step 3: Run tests**

```bash
cd /workspaces/jobhunter-ai && npm test
```

Expected: all tests PASS (no logic change, only parameter threading).

- [ ] **Step 4: Commit**

```bash
cd /workspaces/jobhunter-ai
git add netlify/functions/jobs-search.js src/lib/api.js
git commit -m "$(cat <<'EOF'
feat: thread profileId and dateWindowDays through jobs-search handler and API client

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Update scheduled job search to pass new params

**Files:**
- Modify: `netlify/functions/scheduled-job-search-background.js`

The scheduled function already has `userId`, `sb` (Supabase client), and `profileData.preferences`. It just needs to read `dateWindowDays` from preferences and pass it (along with `profileId`, `userId`, `supabase`) to `fetchAndScoreJobs`.

- [ ] **Step 1: Update the `fetchAndScoreJobs` call**

Locate the `try` block where `fetchAndScoreJobs` is called (around line 164). Change:
```js
const jobs = await fetchAndScoreJobs({ query, location, resumeText, targetRoles, rid })
```
To:
```js
const dateWindowDays = prefs.dateWindowDays || 30
const jobs = await fetchAndScoreJobs({
  query, location, resumeText, targetRoles, rid,
  profileId,
  dateWindowDays,
  userId,
  supabase: sb,
})
```

- [ ] **Step 2: Run tests**

```bash
cd /workspaces/jobhunter-ai && npm test
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
cd /workspaces/jobhunter-ai
git add netlify/functions/scheduled-job-search-background.js
git commit -m "$(cat <<'EOF'
feat: pass profileId, dateWindowDays, userId, supabase to scheduled job search

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Create scheduled expiry checker + update `netlify.toml`

**Files:**
- Create: `netlify/functions/check-job-expiry-background.js`
- Modify: `netlify.toml`

- [ ] **Step 1: Update `netlify.toml`**

Add the expiry checker scheduled function after the existing `scheduled-job-search-background` entry:

```toml
# Daily job expiry checker — re-checks stored job URLs older than 14 days
[functions."check-job-expiry-background"]
  schedule = "0 4 * * *"
  timeout  = 900
```

- [ ] **Step 2: Create `check-job-expiry-background.js`**

```js
// Netlify scheduled background function — daily job link expiry checker
// Cron: 0 4 * * * (4 AM UTC daily)
// Scans stored jh_jobs_* keys for jobs older than 14 days, HEAD-checks URLs,
// flags dead ones with expired: true. Does not delete jobs.
// Uses bare KV keys (no dev_ prefix) — only runs in production.

'use strict'

const { createClient } = require('@supabase/supabase-js')
const { isLinkAlive } = require('./lib/expiry-checker')
const { createLogger } = require('./logger')

const getSupabase = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const RECHECK_AFTER_DAYS = 14

exports.handler = async () => {
  const rid = `expiry-${Date.now()}`
  const log = createLogger(rid)
  log.info('expiryChecker.start', {})

  const sb = getSupabase()
  const cutoff = new Date(Date.now() - RECHECK_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Step 1: Get all users via jh_profiles (same cross-user scan pattern as scheduled-job-search)
  const { data: rows, error } = await sb
    .from('kv_store')
    .select('user_id, value')
    .eq('key', 'jh_profiles')

  if (error) {
    log.error('expiryChecker.scanFailed', { error: error.message })
    return
  }

  log.info('expiryChecker.usersFound', { count: rows?.length ?? 0 })

  for (const row of (rows || [])) {
    const userId = row.user_id
    const profiles = Array.isArray(row.value) ? row.value : []

    for (const profileStub of profiles) {
      const profileId = profileStub.id

      // Step 2: Get job keys for this profile — always scope by user_id
      const { data: jobRows } = await sb
        .from('kv_store')
        .select('key, value')
        .eq('user_id', userId)
        .like('key', `jh_jobs_${profileId}_%`)

      for (const jobRow of (jobRows || [])) {
        const jobs = Array.isArray(jobRow.value) ? jobRow.value : []
        let updated = false

        const checkedJobs = await Promise.all(jobs.map(async (job) => {
          // Skip: no URL, already flagged, or posted too recently to need re-checking
          if (!job.url) return job
          if (job.expired) return job
          if (!job.postedAt || job.postedAt > cutoff) return job

          const alive = await isLinkAlive(job.url)
          if (alive === false) {
            updated = true
            return { ...job, expired: true, expiredAt: new Date().toISOString() }
          }
          return job
        }))

        if (updated) {
          await sb.from('kv_store').upsert(
            { user_id: userId, key: jobRow.key, value: checkedJobs },
            { onConflict: 'user_id,key' }
          )
          log.info('expiryChecker.flagged', { key: jobRow.key })
        }
      }
    }
  }

  log.info('expiryChecker.complete', {})
}
```

- [ ] **Step 3: Run tests**

```bash
cd /workspaces/jobhunter-ai && npm test
```

Expected: all tests PASS (new file has no tests — logic is covered by expiry-checker unit tests from Task 3).

- [ ] **Step 4: Commit**

```bash
cd /workspaces/jobhunter-ai
git add netlify/functions/check-job-expiry-background.js netlify.toml
git commit -m "$(cat <<'EOF'
feat: add daily job expiry checker scheduled function

Runs at 4 AM UTC, scans jh_jobs_* keys, HEAD-checks URLs older than 14 days,
flags dead links with expired: true. Timeout 900s in netlify.toml.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Update Settings.jsx — date window preference

**Files:**
- Modify: `src/components/Settings.jsx`

- [ ] **Step 1: Add the date window dropdown**

In `Settings.jsx`, find the `form` initial state at line 6. Add `dateWindowDays: 30` as a default:
```js
const [form, setForm] = useState({
  locations: 'Remote, United States',
  roles: '',
  darkMode: false,
  scheduledSearch: false,
  dateWindowDays: 30,
})
```

Find the "Job search preferences" section (`<div style={C.card}>` around line 38). After the existing "Work preference" `<select>` block (around line 56), add a new date window block:

```jsx
<div>
  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 5 }}>
    Job search date window
  </label>
  <select
    style={{ ...C.input, width: 'auto' }}
    value={form.dateWindowDays || 30}
    onChange={(e) => setForm((f) => ({ ...f, dateWindowDays: Number(e.target.value) }))}
  >
    <option value={30}>Last 30 days</option>
    <option value={60}>Last 60 days</option>
  </select>
</div>
```

- [ ] **Step 2: Run tests**

```bash
cd /workspaces/jobhunter-ai && npm test
```

Expected: all tests PASS. (Settings smoke test covers render.)

- [ ] **Step 3: Commit**

```bash
cd /workspaces/jobhunter-ai
git add src/components/Settings.jsx
git commit -m "$(cat <<'EOF'
feat: add date window preference (30/60 days) to job search settings

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Update `Jobs.jsx` — richer UI + apply-index write

**Files:**
- Modify: `src/components/Jobs.jsx`

Three changes: (1) pass `profileId` and `dateWindowDays` to `callJobsSearch`; (2) write to the applied-urls index in `handleApply`; (3) add expired banner, company logo, benefits badges, and highlights to `JobCard`.

- [ ] **Step 1: Update `findJobs` to pass new params**

In `findJobs()`, update the `callJobsSearch` call (around line 184):
```js
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

- [ ] **Step 2: Update `handleApply` to write to the applied-urls index**

Replace `handleApply` (around line 203):
```js
const handleApply = async (job) => {
  if (job.url) window.open(job.url, '_blank')
  const updated = jobs.map((j) => j.id === job.id ? { ...j, status: 'applied', appliedAt: new Date().toISOString() } : j)
  await saveJobs(updated)
  const apps = (await dbGet(`jh_apps_${profile.id}`)) || []
  if (!apps.find((a) => a.jobId === job.id)) {
    const newApp = {
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      location: job.location,
      url: job.url || '',
      serpApiJobId: job.serpApiJobId || '',
      status: 'applied',
      appliedAt: new Date().toISOString(),
      notes: '',
    }
    await dbSet(`jh_apps_${profile.id}`, [...apps, newApp])
    // Write to applied-urls index so future searches filter this job out
    const index = (await dbGet(`jh_applied_urls_${profile.id}`)) || []
    await dbSet(`jh_applied_urls_${profile.id}`, [
      ...index,
      { url: job.url || '', serpApiJobId: job.serpApiJobId || '', company: job.company, title: job.title },
    ])
  }
  setApplyJob(null)
}
```

- [ ] **Step 3: Update `JobCard` to show expired banner, company logo, benefits badges, and highlights**

Replace the `JobCard` function (lines 101–144) with:
```jsx
function JobCard({ job, onApply, onCustomize }) {
  const [expanded, setExpanded] = useState(false)
  const sc = job.matchScore >= 85 ? '#137333' : job.matchScore >= 70 ? '#b06000' : '#888'
  const postedDate = job.postedAt ? new Date(job.postedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''

  return (
    <div style={{ ...C.card, marginBottom: 8 }}>
      {job.expired && (
        <div style={{ background: '#fffbeb', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
          <p style={{ margin: 0, fontSize: 11, color: '#b06000' }}>⚠ This job may no longer be available</p>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {job.companyLogo && (
          <img
            src={job.companyLogo}
            alt={job.company}
            style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'contain', flexShrink: 0, marginTop: 2 }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{job.title}</span>
            <Badge status={job.status || 'new'} />
            {job.jobType && <span style={{ fontSize: 11, color: '#888' }}>{job.jobType}</span>}
            {job.salary && <span style={{ fontSize: 11, color: '#137333', fontWeight: 500 }}>{job.salary}</span>}
            {job.isReputable && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#e8f0fe', color: '#1a56e8', fontWeight: 500 }}>✓ Verified source</span>}
            {job.benefits?.healthInsurance && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#e6f4ea', color: '#137333' }}>Health</span>}
            {job.benefits?.paidTimeOff && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#e8f0fe', color: '#1a56e8' }}>PTO</span>}
            {job.benefits?.dental && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#f3e8ff', color: '#6b21a8' }}>Dental</span>}
          </div>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: '#666' }}>
            {job.company} · {job.location}
            {postedDate && <span style={{ color: '#aaa' }}> · Posted {postedDate}</span>}
            {job.sourcePlatform && <span style={{ color: '#aaa' }}> · via {job.sourcePlatform}</span>}
          </p>
          {job.matchReason && <p style={{ margin: '0 0 4px', fontSize: 11, color: '#1a56e8', fontStyle: 'italic' }}>{job.matchReason}</p>}
          {expanded && <p style={{ margin: '8px 0', fontSize: 13, lineHeight: 1.65 }}>{job.description}</p>}
          {expanded && job.highlights?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {job.highlights.map((h, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h.title}</p>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {(h.items || []).slice(0, 5).map((item, j) => (
                      <li key={j} style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 2 }}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 500, color: sc, fontFamily: 'monospace' }}>{job.matchScore}%</p>
          <p style={{ margin: 0, fontSize: 10, color: '#aaa' }}>match</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setExpanded((v) => !v)} style={{ ...btn(), fontSize: 12, padding: '5px 9px' }}>{expanded ? 'Less' : 'Details'}</button>
        <button onClick={() => onCustomize(job)} style={{ ...btn(), fontSize: 12, padding: '5px 9px' }}>✦ Customize resume</button>
        <button onClick={() => onApply(job)} disabled={job.status === 'applied'} style={{ ...btn('primary'), fontSize: 12, padding: '5px 9px', opacity: job.status === 'applied' ? 0.5 : 1 }}>
          {job.status === 'applied' ? 'Applied ✓' : 'Apply →'}
        </button>
        {(job.links?.length > 0 ? job.links : job.url ? [{ link: job.url, title: 'View' }] : []).map((link) => (
          <a key={link.link} href={link.link} target="_blank" rel="noreferrer" style={{ ...btn(), fontSize: 11, padding: '5px 9px', textDecoration: 'none' }}>
            {link.title} ↗
          </a>
        ))}
      </div>
    </div>
  )
}
```

Note: the links array now uses `link.link` (from SerpApi's `apply_options`) rather than `link.url` from the old JSearch shape. The existing `job.links` already handles this but double-check the render — the old code used `link.url` and `link.label`; the new shape has `link.link` and `link.title`.

- [ ] **Step 4: Run tests**

```bash
cd /workspaces/jobhunter-ai && npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /workspaces/jobhunter-ai
git add src/components/Jobs.jsx
git commit -m "$(cat <<'EOF'
feat: update Jobs.jsx with richer UI (logo, benefits, highlights, expired banner)

Adds company logo, benefits badges (health/PTO/dental), structured highlights
panel, expired job banner. handleApply writes serpApiJobId to applied-urls index.
Passes profileId and dateWindowDays to callJobsSearch.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Update `Applications.jsx` — remove from applied-urls index on status change

**Files:**
- Modify: `src/components/Applications.jsx`

When a user changes an application's status away from `"applied"` (e.g. sets it to `"rejected"`), the job should be removed from `jh_applied_urls_{profileId}` so it can appear in future searches again.

- [ ] **Step 1: Add `dbGet` and `dbSet` imports**

`Applications.jsx` currently only imports `dbGet` and `dbSet` from `../lib/api` — confirm they're already there (line 2). They are. No change needed.

- [ ] **Step 2: Make `updateStatus` async and update applied-urls index**

Replace `updateStatus` (line 107):
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
}
```

Note: `Applications` receives `profile` as a prop — confirm it's in the function signature (line 98: `export function Applications({ profile })`). It is. The `profile.id` access is valid.

The `onChange` handler in the select already calls `updateStatus` — now it handles an async function, which is fine in a React event handler (fire-and-forget pattern matches existing `save` behaviour).

- [ ] **Step 3: Run tests**

```bash
cd /workspaces/jobhunter-ai && npm test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
cd /workspaces/jobhunter-ai
git add src/components/Applications.jsx
git commit -m "$(cat <<'EOF'
feat: remove job from applied-urls index when status moves away from applied

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Update environment docs

**Files:**
- Modify: `.env.example`
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Update `.env.example`**

Replace `RAPIDAPI_KEY=your_rapidapi_key` with `SERPAPI_KEY=your_serpapi_key`.

- [ ] **Step 2: Update `CLAUDE.md`**

In the Environment Variables table, replace:
```
| `RAPIDAPI_KEY` | JSearch API key |
```
with:
```
| `SERPAPI_KEY` | SerpApi API key (Google Jobs) |
```

- [ ] **Step 3: Update `README.md`**

In the environment variables setup table (around line 102), replace:
```
| `RAPIDAPI_KEY` | your RapidAPI key | ✓ |
```
with:
```
| `SERPAPI_KEY` | your SerpApi key | ✓ |
```

Also update the stack table entry for job listings from `JSearch API via RapidAPI` to `SerpApi Google Jobs API`.

Update the test count from `84 tests across 14 suites` to `~118 tests across 17 suites`.

- [ ] **Step 4: Run tests and commit**

```bash
cd /workspaces/jobhunter-ai && npm test
```

Expected: all ~118 tests PASS.

```bash
cd /workspaces/jobhunter-ai
git add .env.example CLAUDE.md README.md
git commit -m "$(cat <<'EOF'
docs: swap RAPIDAPI_KEY → SERPAPI_KEY, update test counts and stack description

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Final verification

- [ ] **Step 1: Run the full test suite and verify count**

```bash
cd /workspaces/jobhunter-ai && npm test
```

Expected output: ~118 tests passing across 17 suites. Zero failures.

- [ ] **Step 2: Add `SERPAPI_KEY` to local `.env`**

```bash
echo "SERPAPI_KEY=your_actual_serpapi_key" >> /workspaces/jobhunter-ai/.env
```

(Replace with the real key. Verify `.env` is in `.gitignore` — it is.)

- [ ] **Step 3: Verify `RAPIDAPI_KEY` is gone**

```bash
grep -r "RAPIDAPI_KEY" /workspaces/jobhunter-ai --include="*.js" --include="*.jsx" --include="*.toml" --include="*.example" -l
```

Expected: no files found. If any appear, remove the reference.

- [ ] **Step 4: Tag and summarise**

```bash
cd /workspaces/jobhunter-ai
git log --oneline -15
```

Verify all task commits are present in order.
