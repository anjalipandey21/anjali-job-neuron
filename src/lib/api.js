// All API calls go through Netlify Functions.
// The AI provider key and Supabase service key never reach the browser.

import { logger } from './logger'

// ── Get the current user's JWT from Netlify Identity ─────────────────────────
async function getToken() {
  const user = window.netlifyIdentity?.currentUser?.()
  if (!user) throw new Error('Not signed in')
  return user.jwt()
}

// ── AI proxy (provider-agnostic) ─────────────────────────────────────────────
export async function callAI(messages, { system = '', search = false, tokens = 2000 } = {}) {
  const rid = genRid()
  const log = logger.withRid(rid)
  const token = await getToken()
  log.debug('callAI', { tokens })

  const res = await fetch('/.netlify/functions/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Request-ID': rid,
    },
    body: JSON.stringify({ messages, system, search, tokens }),
  })

  const data = await res.json()
  if (!res.ok || data.error) {
    log.error('callAI', { error: data.error || 'AI request failed' })
    throw new Error(data.error || 'AI request failed')
  }

  log.debug('callAI.done', { textLen: (data.text || '').length })
  return data.text || ''
}

// ── Supabase KV proxy ─────────────────────────────────────────────────────────
async function dbCall(body, rid) {
  const token = await getToken()
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
  headers['X-Request-ID'] = rid
  const res = await fetch('/.netlify/functions/db', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'DB error')
  }
  return res.json()
}

export async function dbGet(key) {
  const rid = genRid()
  const log = logger.withRid(rid)
  log.debug('dbGet', { key })
  try {
    const data = await dbCall({ action: 'get', key }, rid)
    if (!data) return null
    try { return JSON.parse(data.value) } catch { return data.value }
  } catch (e) {
    log.error('dbGet', { key, error: e.message })
    return null
  }
}

export async function dbSet(key, value) {
  const rid = genRid()
  const log = logger.withRid(rid)
  log.debug('dbSet', { key })
  try {
    await dbCall({ action: 'set', key, value: JSON.stringify(value) }, rid)
  } catch (e) {
    log.error('dbSet', { key, error: e.message })
  }
}

export async function dbDelete(key) {
  const rid = genRid()
  const log = logger.withRid(rid)
  log.debug('dbDelete', { key })
  try {
    await dbCall({ action: 'delete', key }, rid)
  } catch (e) {
    log.error('dbDelete', { key, error: e.message })
  }
}

export async function dbList(prefix) {
  const rid = genRid()
  const log = logger.withRid(rid)
  log.debug('dbList', { prefix })
  try {
    const data = await dbCall({ action: 'list', prefix }, rid)
    return data?.keys || []
  } catch (e) {
    log.error('dbList', { prefix, error: e.message })
    return []
  }
}

// ── Background AI jobs ────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10)
const genRid = () => Math.random().toString(36).slice(2, 8)

export async function callAIBackground(
  messages,
  { system = '', search = false, tokens = 6000, type = 'ai_task', onStatus } = {}
) {
  const rid = genRid()
  const log = logger.withRid(rid)
  const token = await getToken()
  const jobId = uid()
  log.debug('callAIBackground', { action: type })

  const submitRes = await fetch('/.netlify/functions/ai-bg-background', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Request-ID': rid,
    },
    body: JSON.stringify({ jobId, type, messages, system, search, tokens }),
  })

  if (!submitRes.ok) {
    const d = await submitRes.json().catch(() => ({}))
    throw new Error(d.error || 'Failed to submit background job')
  }

  return pollForResult(jobId, token, onStatus, rid)
}

// Real jobs search via JSearch API + AI scoring
export async function callJobsSearch({ jobId: jobIdParam, filters, resumeText, targetRoles, profileId, onStatus } = {}) {
  const rid = genRid()
  const log = logger.withRid(rid)
  const token = await getToken()
  const jobId = jobIdParam || uid()
  log.debug('callJobsSearch', { filters })

  const submitRes = await fetch('/.netlify/functions/jobs-search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Request-ID': rid,
    },
    body: JSON.stringify({ jobId, filters, resumeText, targetRoles, profileId }),
  })

  if (!submitRes.ok) {
    const d = await submitRes.json().catch(() => ({}))
    throw new Error(d.error || 'Failed to submit job search')
  }

  return pollForResult(jobId, token, onStatus, rid, true)
}

// Shared polling logic — rid is 4th arg so both callers pass their rid
async function pollForResult(jobId, token, onStatus, rid, expectJobs = false) {
  const log = logger.withRid(rid)
  let lastStatus = null
  const POLL_INTERVAL = 3000
  const MAX_WAIT = 5 * 60 * 1000
  const startedAt = Date.now()

  while (Date.now() - startedAt < MAX_WAIT) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL))

    const headers = { Authorization: `Bearer ${token}`, 'X-Request-ID': rid }

    const pollRes = await fetch(`/.netlify/functions/ai-status?jobId=${jobId}`, { headers })
    const data = await pollRes.json()
    if (onStatus && data.status !== lastStatus) {
      lastStatus = data.status
      onStatus(data.status)
    }

    log.debug('pollForResult', { jobId, status: data.status })

    if (data.status === 'done') {
      if (expectJobs) return data.jobs || []
      return data.text || ''
    }
    if (data.status === 'error') throw new Error(data.error || 'Job failed')
  }

  throw new Error('Job timed out after 5 minutes')
}

async function adminCall(body) {
  const rid = genRid()
  const log = logger.withRid(rid)
  const token = await getToken()
  log.debug('adminCall', { action: body.action })

  const res = await fetch('/.netlify/functions/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Request-ID': rid,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Admin request failed')
  return data
}

export const adminGetStats      = ()               => adminCall({ action: 'get_stats' })
export const adminListUsers     = ()               => adminCall({ action: 'list_users' })
export const adminGetUserDetail = (targetUserId)   => adminCall({ action: 'get_user_detail', targetUserId })
export const adminSetRole       = (targetUserId, role)     => adminCall({ action: 'set_role', targetUserId, role })
export const adminSetDisabled   = (targetUserId, disabled) => adminCall({ action: 'set_disabled', targetUserId, disabled })
export const adminDeleteUser    = (targetUserId)   => adminCall({ action: 'delete_user', targetUserId })

// ── Semantic keyword analysis (TF-IDF, no AI call) ───────────────────────────
export async function callSemanticAnalyze({ resumeText, jobText = '', mode = 'single', jobs } = {}) {
  const rid = genRid()
  const log = logger.withRid(rid)
  const token = await getToken()
  log.debug('callSemanticAnalyze', {})

  const res = await fetch('/.netlify/functions/semantic-analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Request-ID': rid,
    },
    body: JSON.stringify({ mode, resumeText, jobText, jobs }),
  })
  const data = await res.json()
  if (!res.ok) {
    log.error('callSemanticAnalyze', { error: data.error || 'Semantic analysis failed' })
    throw new Error(data.error || 'Semantic analysis failed')
  }
  return data
}

// ── Check if current user is admin ────────────────────────────────────────────
export async function getMyRole() {
  try {
    const cached = JSON.parse(localStorage.getItem('jh_role_cache') || 'null')
    if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.role
  } catch {}

  let role
  try {
    await adminGetStats()
    role = 'admin'
  } catch {
    role = 'user'
  }

  try { localStorage.setItem('jh_role_cache', JSON.stringify({ role, at: Date.now() })) } catch {}
  return role
}
