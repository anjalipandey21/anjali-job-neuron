const { createClient } = require('@supabase/supabase-js')
const { createLogger } = require('./lib/logger')

const getSupabase = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

exports.handler = async (event, context) => {
  const { user } = context.clientContext || {}
  if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }

  const jobId = event.queryStringParameters?.jobId
  if (!jobId) return { statusCode: 400, body: JSON.stringify({ error: 'jobId required' }) }

  const rid = event.headers['x-request-id'] || 'no-rid'
  const log = createLogger(rid)
  const sb = getSupabase()

  const { data, error } = await sb
    .from('bg_jobs')
    .select('id, status, result, error, updated_at')
    .eq('id', jobId)
    .eq('user_id', user.sub)
    .single()

  if (error) {
    if (error.code !== 'PGRST116') log.error('ai-status.query', { jobId, error: error.message })
    return { statusCode: 404, body: JSON.stringify({ error: 'Job not found' }) }
  }
  if (!data) return { statusCode: 404, body: JSON.stringify({ error: 'Job not found' }) }

  log.debug('ai-status', { jobId, status: data.status })

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId: data.id, status: data.status, text: data.result?.text,
      jobs: data.result?.jobs, error: data.error, updatedAt: data.updated_at,
    }),
  }
}
