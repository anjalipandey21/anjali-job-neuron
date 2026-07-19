const { createClient } = require('@supabase/supabase-js')
const { routeAI } = require('./ai-router')
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

async function updateJob(sb, jobId, fields, log) {
  const { error } = await sb.from('bg_jobs')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', jobId)
  if (error) log.error('ai-bg.updateJob', { jobId, error: error.message })
}

exports.handler = async (event, context) => {
  let payload = {}
  try { payload = JSON.parse(event.body || '{}') } catch {}

  const { jobId, messages, system, search, schema, cacheSystem, tokens = 6000, type = 'ai_task' } = payload
  const rid = event.headers?.['x-request-id'] || event.headers?.['X-Request-ID'] || 'no-rid'
  const sb = getSupabase()

  const user = parseJWT(event.headers?.authorization || event.headers?.Authorization)
  const log = createLogger(rid)

  log.info('ai-bg.handler', { jobId, userId: user?.sub || 'NOT FOUND' })

  if (!user || !jobId) {
    log.error('ai-bg.handler', { error: 'Missing user or jobId', hasUser: !!user, jobId })
    return { statusCode: 202 }
  }

  const { error: upsertErr } = await sb.from('bg_jobs').upsert({
    id: jobId, user_id: user.sub, type, status: 'processing',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })

  if (upsertErr) {
    log.error('ai-bg.upsert', { jobId, error: upsertErr.message })
    return { statusCode: 202 }
  }

  try {
    const { text } = await routeAI({ messages, system, search, schema, cacheSystem, tokens, rid, op: type })
    log.info('ai-bg.done', { jobId, textLen: text?.length })
    await updateJob(sb, jobId, { status: 'done', result: { text } }, log)
  } catch (err) {
    log.error('ai-bg.error', { jobId, error: err.message })
    await updateJob(sb, jobId, { status: 'error', error: err.message }, log)
  }

  return { statusCode: 202 }
}
