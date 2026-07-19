// SerpApi Google Jobs provider
// Handles HTTP, response normalisation, source prioritisation, apply-link selection.
// Pagination: fetchAllPages fires up to 5 parallel pages (start=0,10,20,30,40).

'use strict'

const { withKeyRotation } = require('../key-rotator')

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

// Best-effort sponsorship detection from description text.
function detectSponsorship(desc) {
  if (!desc) return null
  const lower = desc.toLowerCase()
  const sponsorYes = [
    'visa sponsorship available', 'visa sponsorship provided', 'will sponsor',
    'sponsorship available', 'h1b sponsorship', 'h-1b sponsorship',
    'open to sponsorship', 'sponsor h1b', 'sponsor h-1b', 'sponsor visa',
  ]
  const sponsorNo = [
    'no visa sponsorship', 'not sponsor', 'cannot sponsor', 'will not sponsor',
    'does not sponsor', 'no sponsorship', 'without sponsorship',
    'must be authorized', 'must be eligible to work', 'u.s. citizen',
    'us citizen required', 'permanent resident', 'no h1b', 'no h-1b',
  ]
  for (const phrase of sponsorNo) {
    if (lower.includes(phrase)) return 'no'
  }
  for (const phrase of sponsorYes) {
    if (lower.includes(phrase)) return 'yes'
  }
  return null
}

// Best-effort salary extraction from description when SerpApi doesn't provide it.
function extractSalaryFromDesc(desc) {
  if (!desc) return ''
  const m = desc.match(/\$[\d,]+(?:\s*[-–]\s*\$?[\d,]+)?(?:\s*(?:per\s+(?:year|annum|hour)|\/(?:yr|hr|year|hour)|(?:k|K))?)/i)
  return m ? m[0].trim() : ''
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
    description:   raw.description || '',
    highlights:    raw.job_highlights || [],
    postedAt:      parseRelativeDate(ext.posted_at),
    jobType:       ext.schedule_type || 'Full-time',
    sponsorship:   detectSponsorship(raw.description || ''),
    benefits: {
      healthInsurance: ext.health_insurance  || false,
      paidTimeOff:     ext.paid_time_off     || false,
      dental:          ext.dental_coverage   || false,
    },
    links: (raw.apply_options || []).map((o) => ({ title: o.title, link: o.link })),
    url:   getBestApplyLink(raw.apply_options),
    salary: ext.salary || extractSalaryFromDesc(raw.description) || '',
    _sourcePriority: getSourcePriority(raw.via),
  }
}

// Fetches one page of Google Jobs results for a single query string.
// jobType is used to set the SerpApi employment_type param.
// apiKey is optional — if provided, overrides process.env.SERPAPI_KEY.
async function fetchOnePage(query, location, dateWindowDays, jobType, apiKey, start = 0) {
  const key = apiKey || process.env.SERPAPI_KEY
  const url = new URL('https://serpapi.com/search')
  url.searchParams.set('engine', 'google_jobs')
  url.searchParams.set('q', query)
  if (location) url.searchParams.set('location', location)
  if (dateWindowDays === 30) url.searchParams.set('date_posted', 'month')
  if (jobType && jobType !== 'any') {
    const typeMap = { fulltime: 'FULLTIME', parttime: 'PARTTIME', contractor: 'CONTRACTOR' }
    if (typeMap[jobType]) url.searchParams.set('employment_type', typeMap[jobType])
  }
  if (start > 0) url.searchParams.set('start', String(start))
  url.searchParams.set('api_key', key)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`SerpApi error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return (data.jobs_results || []).map(normaliseJob)
}

// Deduplicates by exact serpApiJobId then by normalised company::title (seniority words stripped).
// Sorts by _sourcePriority then strips the internal field.
function deduplicateJobs(jobs) {
  const seenIds  = new Set()
  const seenKeys = new Set()
  const deduped  = []
  for (const job of jobs) {
    const idKey    = job.serpApiJobId || ''
    const titleKey = `${(job.company || '').toLowerCase()}::${(job.title || '').toLowerCase()
      .replace(/\b(senior|sr\.|junior|jr\.|lead|principal|staff)\b/gi, '').trim()}`
    if (idKey && seenIds.has(idKey)) continue
    if (seenKeys.has(titleKey))      continue
    if (idKey) seenIds.add(idKey)
    seenKeys.add(titleKey)
    deduped.push(job)
  }
  deduped.sort((a, b) => (a._sourcePriority || 3) - (b._sourcePriority || 3))
  return deduped.map(({ _sourcePriority, ...job }) => job)
}

// Fetches jobs from SerpApi using a single targeted query built from filters.
// Always makes exactly one fetchOnePage call (1 API credit).
// Supports multiple SERPAPI_KEY values (comma-separated) with automatic rotation.
async function fetchJobs(filters) {
  const query    = buildQuery(filters)
  const location = parseLocation(filters.location)
  const days     = filters.dateWindowDays || 30
  const jobType  = filters.jobType || 'any'

  const jobs = await withKeyRotation('SERPAPI_KEY', (apiKey) =>
    fetchOnePage(query, location, days, jobType, apiKey)
  )
  return deduplicateJobs(jobs)
}

// Fetches up to 5 pages of Google Jobs results in parallel using one API key.
// One withKeyRotation call ensures a single consistent key for the whole batch.
async function fetchAllPages(filters, pageCount = 5) {
  const query    = buildQuery(filters)
  const location = parseLocation(filters.location)
  const days     = filters.dateWindowDays || 30
  const jobType  = filters.jobType || 'any'
  const starts   = Array.from({ length: pageCount }, (_, i) => i * 10)

  const allJobs = await withKeyRotation('SERPAPI_KEY', async (apiKey) => {
    const pages = await Promise.all(
      starts.map((start) => fetchOnePage(query, location, days, jobType, apiKey, start))
    )
    return pages.flat()
  })
  return deduplicateJobs(allJobs)
}

module.exports = { fetchJobs, fetchAllPages, parseRelativeDate, getBestApplyLink, normaliseJob, buildQuery, parseLocation, detectSponsorship, extractSalaryFromDesc }
