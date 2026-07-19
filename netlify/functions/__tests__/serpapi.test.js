import { vi, describe, it, expect, beforeEach } from 'vitest'
import { parseRelativeDate, getBestApplyLink, normaliseJob, fetchJobs, buildQuery, parseLocation } from '../lib/job-providers/serpapi.js'

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
    expect(job.description).toBe('About GitHub. '.repeat(30))
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

// ── fetchJobs employment_type ──────────────────────────────────────────────
describe('fetchJobs employment_type param', () => {
  beforeEach(() => {
    process.env.SERPAPI_KEY = 'test-key'
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

// ── fetchJobs source sort order ───────────────────────────────────────────────
describe('fetchJobs source sort order', () => {
  beforeEach(() => {
    process.env.SERPAPI_KEY = 'test-key'
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

    const jobs = await fetchJobs({ roles: 'Software Engineer', location: 'United States', workType: 'any', jobType: 'any', dateWindowDays: 30 })
    // LinkedIn and Indeed should sort before GitHub Careers
    const liIdx = jobs.findIndex((j) => j.sourcePlatform === 'LinkedIn')
    const ghIdx = jobs.findIndex((j) => j.sourcePlatform === 'GitHub Careers')
    expect(liIdx).toBeLessThan(ghIdx)
  })
})
