// Netlify scheduled background function — runs every 6 hours, finds profiles due at 8 AM local time
// Cron: 0 */6 * * * (netlify.toml)
// Uses bare KV keys (no dev_ prefix) — only runs in production via Netlify scheduler

'use strict'

const { createClient } = require('@supabase/supabase-js')
const { fetchAndScoreJobs } = require('./lib/job-search-core')
const { createLogger } = require('./lib/logger')

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

exports.handler = async (_event, _context, { supabase: injectedSb, fetchJobs: injectedFetchJobs } = {}) => {
  const runRid = `sched-run-${Date.now()}`
  const log = createLogger(runRid)
  log.info('scheduledSearch.start', {})

  const sb         = injectedSb || getSupabase()
  const fetchJobsFn = injectedFetchJobs || fetchAndScoreJobs
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

      if (!isProfileDue(prefs, statusRecord, nowUtc)) {
        plog.info('scheduledSearch.skipped', { profileId })
        continue
      }

      const localDate = getLocalDate(prefs.timezone, nowUtc)

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

      const resumeText  = profileData.resumeText

      // Build filters from profile preferences
      const filters = {
        roles:          prefs.roles           || '',
        location:       prefs.locations       || '',
        workType:       prefs.workType        || 'any',
        jobType:        prefs.jobType         || 'any',
        dateWindowDays: prefs.dateWindowDays  || 30,
      }

      try {
        const jobs = await fetchJobsFn({
          filters,
          resumeText,
          targetRoles: prefs.roles,
          rid,
          profileId,
          userId,
          supabase: sb,
        })

        await Promise.all([
          sb.from('kv_store').upsert(
            { user_id: userId, key: `jh_jobs_pool_${profileId}_${localDate}`, value: jobs },
            { onConflict: 'user_id,key' }
          ),
          sb.from('kv_store').upsert(
            { user_id: userId, key: `jh_jobs_${profileId}_${localDate}`, value: jobs.slice(0, 10) },
            { onConflict: 'user_id,key' }
          ),
          sb.from('kv_store').upsert(
            { user_id: userId, key: `jh_scheduled_status_${profileId}`,
              value: { lastRunDate: localDate, status: 'success', error: null } },
            { onConflict: 'user_id,key' }
          ),
        ])
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
