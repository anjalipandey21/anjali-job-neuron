// Netlify Function: /.netlify/functions/jobs-search
// HTTP-triggered background function: auth → create bg_jobs record → fetchAndScoreJobs → store result

'use strict'

const { createClient } = require('@supabase/supabase-js')
const { fetchAndScoreJobs, isWithinDateWindow, isStaffingAgency, hasGoodDescription,
        isReputableSource, deduplicateSimilar, applyQualityFilters } = require('./lib/job-search-core')
const { createLogger } = require('./lib/logger')

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

  const { jobId, filters, resumeText, targetRoles, profileId } = payload
  const rid = event.headers['x-request-id'] || 'no-rid'
  const log = createLogger(rid)

  if (!jobId || !profileId) return { statusCode: 400, body: JSON.stringify({ error: 'Missing jobId or profileId' }) }

  const sb = getSupabase()

  await sb.from('bg_jobs').upsert({
    id: jobId,
    user_id: user.sub,
    type: 'find_jobs',
    status: 'processing',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })

  log.info('jobsSearch.start', { filters })

  try {
    const jobs = await fetchAndScoreJobs({
      filters,
      resumeText,
      targetRoles,
      rid,
      profileId,
      userId: user.sub,
      supabase: sb,
    })
    await sb.from('bg_jobs').update({
      status: 'done',
      result: { jobs },
      updated_at: new Date().toISOString(),
    }).eq('id', jobId)
    log.info('jobsSearch.done', { savedCount: jobs.length })
    return { statusCode: 200, body: JSON.stringify({ jobId, count: jobs.length }) }
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
module.exports.isWithinDateWindow = isWithinDateWindow
module.exports.isStaffingAgency   = isStaffingAgency
module.exports.hasGoodDescription = hasGoodDescription
module.exports.isReputableSource  = isReputableSource
module.exports.deduplicateSimilar = deduplicateSimilar
module.exports.applyQualityFilters = applyQualityFilters
