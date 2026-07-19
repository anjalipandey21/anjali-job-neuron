// Shared job-search logic — used by jobs-search.js (HTTP) and scheduled-job-search-background.js
// fetchAndScoreJobs: full pipeline → fetch → filter → score → normalize → top 50 job objects

'use strict'

const { fetchAllPages } = require('./job-providers/serpapi')
const { validateJobLinks } = require('./expiry-checker')
const { routeAI } = require('../ai-router')
const { createLogger } = require('./logger')

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

  const schema = {
    type: 'array',
    items: { idx: 'number', matchScore: 'number', reason: 'string' },
  }

  const { parsed } = await routeAI({
    system: `You are a resume-job matcher. Score how well this candidate matches each job.\n\nCandidate resume:\n${resumeText.slice(0, 1500)}\n\nTarget roles: ${targetRoles || 'any'}`,
    messages: [{
      role: 'user',
      content: `Score each job 0-100 for fit with the candidate. Be realistic — only give 85+ for genuinely strong matches.\n\nReturn ONLY a JSON array:\n[{"idx":0,"matchScore":85,"reason":"Strong match — 4 of 5 required skills present"}]\n\nJobs:\n${JSON.stringify(jobSummaries)}`,
    }],
    schema,
    cacheSystem: true,
    tokens: 4000,
    rid,
    op: 'scoreJobs',
  })

  // parsed is the validated array; any SchemaValidationError propagates to fetchAndScoreJobs's try/catch
  return (parsed || []).reduce((map, item) => {
    map[item.idx] = { matchScore: item.matchScore || 70, reason: item.reason || '' }
    return map
  }, {})
}

// ── Main entry point ──────────────────────────────────────────────────────────

// Full pipeline: fetch → date filter → applied filter → quality filter →
//   link validation → AI score → sort/cap at 50
// Throws on SerpApi failure or when no jobs survive filtering.
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
  const rawJobs = await fetchAllPages(filters || {})
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

  // Step 4: Quality filter
  const qualityJobs = applyQualityFilters(afterSkippedFilter)
  const jobsToProcess = qualityJobs.length >= 5 ? qualityJobs : afterSkippedFilter
  log.info('jobSearchCore.qualityFiltered', { count: jobsToProcess.length })

  // Step 5: Link validation
  const validJobs = await validateJobLinks(jobsToProcess)
  log.info('jobSearchCore.linkValidated', { count: validJobs.length })

  if (validJobs.length === 0) throw new Error('No jobs found for this query. Try different roles or location.')

  // Step 6: AI scoring
  let scores = {}
  if (resumeText) {
    try {
      scores = await scoreJobs(validJobs, resumeText, targetRoles || filters?.roles || '', rid)
      log.info('jobSearchCore.scored', { scoredCount: Object.keys(scores).length })
    } catch (err) {
      log.error('jobSearchCore.score', { error: err.message })
    }
  }

  // Step 7: Annotate, sort, cap at 50
  const uidGen = () => Math.random().toString(36).slice(2, 9)
  const jobs = validJobs.slice(0, 50).map((j, i) => {
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

  log.info('jobSearchCore.done', { savedCount: Math.min(jobs.length, 50) })
  return jobs.slice(0, 50)
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
