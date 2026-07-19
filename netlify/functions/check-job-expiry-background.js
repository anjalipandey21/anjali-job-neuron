// Netlify scheduled background function — daily job link expiry checker
// Cron: 0 4 * * * (4 AM UTC daily)
// Scans stored jh_jobs_* keys for jobs older than 14 days, HEAD-checks URLs,
// flags dead ones with expired: true. Does not delete jobs.
// Uses bare KV keys (no dev_ prefix) — only runs in production.

'use strict'

const { createClient } = require('@supabase/supabase-js')
const { isLinkAlive } = require('./lib/expiry-checker')
const { createLogger } = require('./lib/logger')

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
