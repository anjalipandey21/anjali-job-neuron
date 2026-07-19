# Logging & Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured JSON logging with request ID (`rid`) propagation across all frontend API calls and Netlify function handlers, plus a debug toggle in Settings.

**Architecture:** Two new logger modules (`src/lib/logger.js` ESM, `netlify/functions/logger.js` CJS). Every frontend API call generates a 6-char `rid`, sends it as `X-Request-ID`, and backend functions echo it in every log line they produce for that request. Debug output is gated by `localStorage.jh_debug` / `VITE_DEBUG` (frontend) and `DEBUG` env var (backend); `error` always fires.

**Tech Stack:** Vitest, jsdom (frontend tests), Node (backend tests), vanilla JS, no new npm dependencies.

---

## File Map

| File | Action | Change |
|---|---|---|
| `src/lib/logger.js` | **Create** | Frontend logger singleton |
| `netlify/functions/logger.js` | **Create** | Backend logger factory |
| `src/__tests__/logger.test.js` | **Create** | Frontend logger tests |
| `netlify/functions/__tests__/logger.test.js` | **Create** | Backend logger tests |
| `src/lib/api.js` | Modify | `rid` generation + header + log points in all API calls; `pollForResult` signature |
| `netlify/functions/ai.js` | Modify | Extract `rid`; `createLogger`; pass to `routeAI` |
| `netlify/functions/ai-router.js` | Modify | Accept `rid` in options; forward to providers; log routing decision |
| `netlify/functions/providers/gemini.js` | Modify | Accept `rid`; replace `console.log/error` |
| `netlify/functions/providers/anthropic.js` | Modify | Accept `rid`; add log points |
| `netlify/functions/providers/openai.js` | Modify | Accept `rid`; add log points |
| `netlify/functions/providers/groq.js` | Modify | Accept `rid`; add log points |
| `netlify/functions/jobs-search.js` | Modify | Extract `rid`; replace all `console.*`; `scoreJobs` signature |
| `netlify/functions/db.js` | Modify | Extract `rid`; `createLogger`; replace `console.error` |
| `netlify/functions/semantic-analyze.js` | Modify | Extract `rid`; `createLogger`; replace `console.error` |
| `netlify/functions/admin.js` | Modify | Extract `rid`; `createLogger`; replace `console.error` |
| `netlify/functions/ai-bg-background.js` | Modify | Extract `rid`; pass to `routeAI`; replace all `console.*` |
| `netlify/functions/ai-status.js` | Modify | Extract `rid`; `createLogger`; add poll log |
| `src/components/Settings.jsx` | Modify | Add "Developer tools" card with debug toggle |
| `.env.example` | Modify | Add `DEBUG` and `VITE_DEBUG` entries |

---

## Task 1: Frontend logger module

**Files:**
- Create: `src/lib/logger.js`
- Create: `src/__tests__/logger.test.js`

- [ ] **Step 1.1 — Write failing tests**

Create `src/__tests__/logger.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger } from '../lib/logger'

describe('logger', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('silences debug/info/warn when jh_debug is not set', () => {
    logger.debug('testOp', { foo: 1 })
    expect(console.debug).not.toHaveBeenCalled()
  })

  it('emits info to console.info when jh_debug=true', () => {
    localStorage.setItem('jh_debug', 'true')
    logger.info('testOp', { foo: 1 })
    expect(console.info).toHaveBeenCalledTimes(1)
    const arg = JSON.parse(console.info.mock.calls[0][0])
    expect(arg).toMatchObject({ level: 'info', op: 'testOp', foo: 1 })
    expect(typeof arg.ts).toBe('string')
  })

  it('emits warn to console.warn when jh_debug=true', () => {
    localStorage.setItem('jh_debug', 'true')
    logger.warn('warnOp', { key: 'val' })
    expect(console.warn).toHaveBeenCalledTimes(1)
    const arg = JSON.parse(console.warn.mock.calls[0][0])
    expect(arg).toMatchObject({ level: 'warn', op: 'warnOp' })
  })

  it('always emits error regardless of debug flag', () => {
    logger.error('errOp', { error: 'boom' })
    expect(console.error).toHaveBeenCalledTimes(1)
    const arg = JSON.parse(console.error.mock.calls[0][0])
    expect(arg).toMatchObject({ level: 'error', op: 'errOp', error: 'boom' })
  })

  it('jh_debug=false disables debug output', () => {
    localStorage.setItem('jh_debug', 'false')
    logger.info('testOp', {})
    expect(console.info).not.toHaveBeenCalled()
  })

  it('withRid binds rid to all log calls', () => {
    localStorage.setItem('jh_debug', 'true')
    const log = logger.withRid('abc123')
    log.info('someOp', { x: 1 })
    const arg = JSON.parse(console.info.mock.calls[0][0])
    expect(arg.rid).toBe('abc123')
    expect(arg.op).toBe('someOp')
    expect(arg.x).toBe(1)
  })

  it('withRid does not mutate the original logger', () => {
    localStorage.setItem('jh_debug', 'true')
    const log = logger.withRid('abc123')
    log.info('boundOp', {})
    logger.info('unboundOp', {})
    const arg = JSON.parse(console.info.mock.calls[1][0])
    expect(arg.rid).toBeUndefined()
  })
})
```

- [ ] **Step 1.2 — Run tests, confirm they fail**

```bash
npm test src/__tests__/logger.test.js
```
Expected: `Cannot find module '../lib/logger'`

- [ ] **Step 1.3 — Implement `src/lib/logger.js`**

```js
// Structured JSON logger for the frontend.
// debug/info/warn only emit when jh_debug is active — error always fires.
// isDebug() is evaluated at emit time so the toggle takes effect immediately.

function isDebug() {
  try {
    const stored = localStorage.getItem('jh_debug')
    if (stored !== null) return stored === 'true'
  } catch {}
  return import.meta.env.VITE_DEBUG === 'true'
}

function emit(level, op, ctx) {
  const line = JSON.stringify({ level, ts: new Date().toISOString(), op, ...ctx })
  if (level === 'error') { console.error(line); return }
  if (!isDebug()) return
  if (level === 'warn') console.warn(line)
  else if (level === 'info') console.info(line)
  else console.debug(line)
}

function makeLogger(defaults = {}) {
  return {
    debug:   (op, ctx = {}) => emit('debug', op, { ...defaults, ...ctx }),
    info:    (op, ctx = {}) => emit('info',  op, { ...defaults, ...ctx }),
    warn:    (op, ctx = {}) => emit('warn',  op, { ...defaults, ...ctx }),
    error:   (op, ctx = {}) => emit('error', op, { ...defaults, ...ctx }),
    withRid: (rid) => makeLogger({ ...defaults, rid }),
  }
}

export const logger = makeLogger()
```

- [ ] **Step 1.4 — Run tests, confirm they pass**

```bash
npm test src/__tests__/logger.test.js
```
Expected: 8 tests pass

- [ ] **Step 1.5 — Commit**

```bash
git add src/lib/logger.js src/__tests__/logger.test.js
git commit -m "feat: add frontend structured logger with rid support and debug toggle"
```

---

## Task 2: Backend logger module

**Files:**
- Create: `netlify/functions/logger.js`
- Create: `netlify/functions/__tests__/logger.test.js`

- [ ] **Step 2.1 — Write failing tests**

Create `netlify/functions/__tests__/logger.test.js`:

```js
import { createLogger } from '../logger'

describe('createLogger', () => {
  let logSpy, errorSpy
  const origDebug = process.env.DEBUG

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    process.env.DEBUG = origDebug
  })

  it('silences all levels when DEBUG is not set', () => {
    delete process.env.DEBUG
    const log = createLogger('test-rid')
    log.debug('testOp', { foo: 1 })
    log.info('testOp', {})
    log.warn('testOp', {})
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('emits all non-error levels via console.log when DEBUG=true', () => {
    process.env.DEBUG = 'true'
    const log = createLogger('test-rid')
    log.info('testOp', { foo: 1 })
    expect(logSpy).toHaveBeenCalledTimes(1)
    const arg = JSON.parse(logSpy.mock.calls[0][0])
    expect(arg).toMatchObject({ level: 'info', rid: 'test-rid', op: 'testOp', foo: 1 })
    expect(typeof arg.ts).toBe('string')
  })

  it('always emits error via console.error regardless of DEBUG', () => {
    delete process.env.DEBUG
    const log = createLogger('test-rid')
    log.error('errOp', { error: 'boom' })
    expect(errorSpy).toHaveBeenCalledTimes(1)
    const arg = JSON.parse(errorSpy.mock.calls[0][0])
    expect(arg).toMatchObject({ level: 'error', rid: 'test-rid', op: 'errOp', error: 'boom' })
  })

  it('bakes rid into every log call', () => {
    process.env.DEBUG = 'true'
    const log = createLogger('abc123')
    log.warn('warnOp', { x: 99 })
    const arg = JSON.parse(logSpy.mock.calls[0][0])
    expect(arg.rid).toBe('abc123')
  })

  it('uses no-rid when called with undefined', () => {
    process.env.DEBUG = 'true'
    const log = createLogger(undefined)
    log.info('testOp', {})
    const arg = JSON.parse(logSpy.mock.calls[0][0])
    expect(arg.rid).toBe('no-rid')
  })
})
```

- [ ] **Step 2.2 — Run tests, confirm they fail**

```bash
npm test netlify/functions/__tests__/logger.test.js
```
Expected: `Cannot find module '../logger'`

- [ ] **Step 2.3 — Implement `netlify/functions/logger.js`**

```js
// Structured JSON logger for Netlify functions.
// debug/info/warn only emit when DEBUG=true — error always fires.
// isDebug is a function so process.env.DEBUG is read at call time (testable).

const isDebug = () => process.env.DEBUG === 'true'

function emit(level, rid, op, ctx) {
  const line = JSON.stringify({ level, ts: new Date().toISOString(), rid, op, ...ctx })
  if (level === 'error') { console.error(line); return }
  if (!isDebug()) return
  console.log(line)
}

function createLogger(rid = 'no-rid') {
  return {
    debug: (op, ctx = {}) => emit('debug', rid, op, ctx),
    info:  (op, ctx = {}) => emit('info',  rid, op, ctx),
    warn:  (op, ctx = {}) => emit('warn',  rid, op, ctx),
    error: (op, ctx = {}) => emit('error', rid, op, ctx),
  }
}

module.exports = { createLogger }
```

- [ ] **Step 2.4 — Run tests, confirm they pass**

```bash
npm test netlify/functions/__tests__/logger.test.js
```
Expected: 5 tests pass

- [ ] **Step 2.5 — Run full test suite to check no regressions**

```bash
npm test
```
Expected: all existing tests still pass

- [ ] **Step 2.6 — Commit**

```bash
git add netlify/functions/logger.js netlify/functions/__tests__/logger.test.js
git commit -m "feat: add backend structured logger factory with rid support"
```

---

## Task 3: Wire `rid` into `src/lib/api.js`

**Files:**
- Modify: `src/lib/api.js`

Key changes:
- Import `logger`
- Each exported API function generates `const rid = Math.random().toString(36).slice(2, 8)` and creates `const log = logger.withRid(rid)`
- `rid` is sent as `X-Request-ID` header on every fetch
- `dbCall(body, rid)` accepts `rid` as second arg and adds the header
- `pollForResult(jobId, token, onStatus, rid, expectJobs = false)` — `rid` inserted as 4th arg
- Existing `console.error('[dbSet]', e)` and `console.error('[dbDelete]', e)` replaced with `log.error`

- [ ] **Step 3.1 — Replace `src/lib/api.js`**

```js
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
  const rid = Math.random().toString(36).slice(2, 8)
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
  if (rid) headers['X-Request-ID'] = rid
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
  const rid = Math.random().toString(36).slice(2, 8)
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
  const rid = Math.random().toString(36).slice(2, 8)
  const log = logger.withRid(rid)
  log.debug('dbSet', { key })
  try {
    await dbCall({ action: 'set', key, value: JSON.stringify(value) }, rid)
  } catch (e) {
    log.error('dbSet', { key, error: e.message })
  }
}

export async function dbDelete(key) {
  const rid = Math.random().toString(36).slice(2, 8)
  const log = logger.withRid(rid)
  log.debug('dbDelete', { key })
  try {
    await dbCall({ action: 'delete', key }, rid)
  } catch (e) {
    log.error('dbDelete', { key, error: e.message })
  }
}

export async function dbList(prefix) {
  const rid = Math.random().toString(36).slice(2, 8)
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

export async function callAIBackground(
  messages,
  { system = '', search = false, tokens = 6000, type = 'ai_task', onStatus } = {}
) {
  const rid = Math.random().toString(36).slice(2, 8)
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
export async function callJobsSearch({ query, location, resumeText, targetRoles, onStatus } = {}) {
  const rid = Math.random().toString(36).slice(2, 8)
  const log = logger.withRid(rid)
  const token = await getToken()
  const jobId = uid()
  log.debug('callJobsSearch', { query })

  const submitRes = await fetch('/.netlify/functions/jobs-search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Request-ID': rid,
    },
    body: JSON.stringify({ jobId, query, location, resumeText, targetRoles }),
  })

  if (!submitRes.ok) {
    const d = await submitRes.json().catch(() => ({}))
    throw new Error(d.error || 'Failed to submit job search')
  }

  return pollForResult(jobId, token, onStatus, rid, true)
}

// Shared polling logic
// rid is 4th arg (before expectJobs) so both callers pass their rid
async function pollForResult(jobId, token, onStatus, rid, expectJobs = false) {
  const log = logger.withRid(rid)
  const POLL_INTERVAL = 3000
  const MAX_WAIT = 5 * 60 * 1000
  const startedAt = Date.now()

  while (Date.now() - startedAt < MAX_WAIT) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL))

    const headers = { Authorization: `Bearer ${token}` }
    if (rid) headers['X-Request-ID'] = rid

    const pollRes = await fetch(`/.netlify/functions/ai-status?jobId=${jobId}`, { headers })
    const data = await pollRes.json()
    if (onStatus) onStatus(data.status)

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
  const rid = Math.random().toString(36).slice(2, 8)
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
  const rid = Math.random().toString(36).slice(2, 8)
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
```

- [ ] **Step 3.2 — Run full test suite**

```bash
npm test
```
Expected: all tests pass (frontend components mock `api.js` entirely so they are unaffected)

- [ ] **Step 3.3 — Commit**

```bash
git add src/lib/api.js
git commit -m "feat: add rid generation and X-Request-ID header to all api.js calls"
```

---

## Task 4: Update `ai.js`, `ai-router.js`, and all providers

**Files:**
- Modify: `netlify/functions/ai.js`
- Modify: `netlify/functions/ai-router.js`
- Modify: `netlify/functions/providers/gemini.js`
- Modify: `netlify/functions/providers/anthropic.js`
- Modify: `netlify/functions/providers/openai.js`
- Modify: `netlify/functions/providers/groq.js`

- [ ] **Step 4.1 — Update `netlify/functions/ai.js`**

```js
const { routeAI } = require('./ai-router')
const { createLogger } = require('./logger')

exports.handler = async (event, context) => {
  const { user } = context.clientContext || {}
  if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized — please sign in.' }) }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }

  let payload
  try { payload = JSON.parse(event.body) }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) } }

  const { messages, system, search, tokens = 2000 } = payload
  const rid = event.headers['x-request-id'] || 'no-rid'
  const log = createLogger(rid)

  log.info('ai.handler', { provider: process.env.AI_PROVIDER || 'gemini' })

  try {
    const { text } = await routeAI({ messages, system, search, tokens, rid })
    log.debug('ai.done', { textLen: (text || '').length })
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }
  } catch (err) {
    log.error('ai.handler', { error: err.message })
    return { statusCode: 502, body: JSON.stringify({ error: err.message }) }
  }
}
```

- [ ] **Step 4.2 — Update `netlify/functions/ai-router.js`**

```js
const { callGemini }    = require('./providers/gemini')
const { callAnthropic } = require('./providers/anthropic')
const { callOpenAI }    = require('./providers/openai')
const { callGroq }      = require('./providers/groq')
const { createLogger }  = require('./logger')

const PROVIDERS = { gemini: callGemini, anthropic: callAnthropic, openai: callOpenAI, groq: callGroq }
const SEARCH_SUPPORTED = { gemini: true, anthropic: true, openai: true, groq: false }

async function routeAI({ messages, system, search, tokens = 2000, rid = 'no-rid' }) {
  const log = createLogger(rid)
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase()
  const callFn = PROVIDERS[provider]

  if (!callFn) throw new Error(`Unknown AI_PROVIDER "${provider}". Supported: ${Object.keys(PROVIDERS).join(', ')}`)

  const useSearch = search && SEARCH_SUPPORTED[provider]
  if (search && !SEARCH_SUPPORTED[provider]) {
    log.warn('ai-router', { provider, message: 'search not supported, running without' })
  }

  log.debug('ai-router', { provider, model: process.env.AI_MODEL || 'default' })

  return callFn({ messages, system, search: useSearch, tokens, rid })
}

module.exports = { routeAI, PROVIDERS, SEARCH_SUPPORTED }
```

- [ ] **Step 4.3 — Update `netlify/functions/providers/gemini.js`**

```js
const { createLogger } = require('../logger')

async function callGeminiOnce({ messages, system, search, tokens, rid = 'no-rid' }) {
  const log = createLogger(rid)
  const model = process.env.AI_MODEL || 'gemini-2.0-flash'
  const apiKey = process.env.GEMINI_KEY

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const responseMimeType = search ? 'text/plain' : 'application/json'
  const body = { contents, generationConfig: { maxOutputTokens: tokens, responseMimeType } }

  if (!search && model.startsWith('gemini-2.5') && !model.includes('lite')) {
    body.generationConfig.thinkingConfig = { thinkingBudget: 0 }
  }
  if (system) body.systemInstruction = { parts: [{ text: system }] }
  if (search) body.tools = [{ googleSearch: {} }]

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  if (!response.ok) {
    log.error('callGemini', { error: data.error?.message, status: response.status })
    throw new Error(data.error?.message || `Gemini error ${response.status}`)
  }

  const finishReason = data.candidates?.[0]?.finishReason
  const parts = data.candidates?.[0]?.content?.parts || []
  const text = parts.filter((p) => !p.thought).map((p) => p.text || '').join('\n').trim()

  log.info('callGemini', { finishReason, textLen: text.length, tokens })

  return { text, finishReason }
}

async function callGemini(opts) {
  const log = createLogger(opts.rid || 'no-rid')
  const { text, finishReason } = await callGeminiOnce(opts)

  if (finishReason === 'MAX_TOKENS' && opts.tokens < 8000) {
    const retryTokens = Math.min(opts.tokens + 2000, 8000)
    log.warn('callGemini.retry', { attempt: 2, newTokens: retryTokens })
    const retry = await callGeminiOnce({ ...opts, tokens: retryTokens })
    if (retry.text) return { text: retry.text }
  }

  if (!text) throw new Error(`Gemini returned empty response. Finish reason: ${finishReason || 'unknown'}`)
  return { text }
}

module.exports = { callGemini }
```

- [ ] **Step 4.4 — Update `netlify/functions/providers/anthropic.js`**

```js
const { createLogger } = require('../logger')

async function callAnthropic({ messages, system, search, tokens, rid = 'no-rid' }) {
  const log = createLogger(rid)
  const body = {
    model: process.env.AI_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: tokens,
    messages,
  }
  if (system) body.system = system
  if (search) body.tools = [{ type: 'web_search_20250305', name: 'web_search' }]

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  if (!response.ok) {
    log.error('callAnthropic', { error: data.error?.message, status: response.status })
    throw new Error(data.error?.message || `Anthropic error ${response.status}`)
  }

  const text = (data.content || []).map((b) => b.text || '').filter(Boolean).join('\n')
  log.info('callAnthropic', { textLen: text.length })
  return { text }
}

module.exports = { callAnthropic }
```

- [ ] **Step 4.5 — Update `netlify/functions/providers/openai.js`**

```js
const { createLogger } = require('../logger')

async function callOpenAI({ messages, system, search, tokens, rid = 'no-rid' }) {
  const log = createLogger(rid)
  const body = {
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    max_tokens: tokens,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages,
    ],
  }
  if (search) { body.tools = [{ type: 'web_search_preview' }]; body.tool_choice = 'auto' }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  if (!response.ok) {
    log.error('callOpenAI', { error: data.error?.message, status: response.status })
    throw new Error(data.error?.message || `OpenAI error ${response.status}`)
  }

  const text = data.choices?.[0]?.message?.content || ''
  log.info('callOpenAI', { textLen: text.length })
  return { text }
}

module.exports = { callOpenAI }
```

- [ ] **Step 4.6 — Update `netlify/functions/providers/groq.js`**

```js
const { createLogger } = require('../logger')

async function callGroq({ messages, system, tokens, rid = 'no-rid' }) {
  const log = createLogger(rid)
  const body = {
    model: process.env.AI_MODEL || 'llama-3.3-70b-versatile',
    max_tokens: tokens,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages,
    ],
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  if (!response.ok) {
    log.error('callGroq', { error: data.error?.message, status: response.status })
    throw new Error(data.error?.message || `Groq error ${response.status}`)
  }

  const text = data.choices?.[0]?.message?.content || ''
  log.info('callGroq', { textLen: text.length })
  return { text }
}

module.exports = { callGroq }
```

- [ ] **Step 4.7 — Run full test suite**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 4.8 — Commit**

```bash
git add netlify/functions/ai.js netlify/functions/ai-router.js netlify/functions/providers/
git commit -m "feat: wire rid through ai.js, ai-router.js and all provider modules"
```

---

## Task 5: Update `jobs-search.js`

**Files:**
- Modify: `netlify/functions/jobs-search.js`

Key changes:
- Extract `rid` from headers at handler start; create `log`
- `scoreJobs(jobs, resumeText, targetRoles, rid)` — add `rid` as 4th param; pass to `routeAI`
- Replace all `console.log/error` in the handler with `log.*` calls
- Remove `console.log` from `fetchJobs` and `applyQualityFilters` (counts now logged at handler level with `rid`)

- [ ] **Step 5.1 — Update `scoreJobs` signature and handler logging**

In `netlify/functions/jobs-search.js`, make these targeted edits:

**1. Add logger require at top (after existing requires):**
```js
const { createLogger } = require('./logger')
```

**2. Update `fetchJobs` — remove its internal `console.log`:**
```js
// Remove this line from fetchJobs:
console.log(`[jobs-search] fetched ${allJobs.length} total, ${recent.length} within 60 days`)
// (counts are logged at handler level with rid instead)
```

**3. Update `applyQualityFilters` — remove its internal `console.log`:**
```js
// Remove this line from applyQualityFilters:
console.log(`[jobs-search] after quality filter: ${filtered.length} jobs remaining`)
```

**4. Update `scoreJobs` signature — add `rid` param and pass to `routeAI`:**
```js
async function scoreJobs(jobs, resumeText, targetRoles, rid) {
  // ... existing prompt setup unchanged ...

  const text = await routeAI({
    messages: [{ role: 'user', content: prompt }],
    tokens: 2000,
    rid,   // ← add this
  }).then((r) => r.text)

  // ... existing parse logic unchanged ...
}
```

**5. Update the handler — replace all `console.*` and add `rid`:**

At the top of `exports.handler`, after auth+parse:
```js
const rid = event.headers['x-request-id'] || 'no-rid'
const log = createLogger(rid)
```

Replace each `console.log/error` in the handler (line numbers reference the original file):
```js
// BEFORE                                                              AFTER
// line 305: pre-fetch log
console.log('[jobs-search] fetching from JSearch, location:', ...)  → log.info('jobsSearch.fetch', { location })
// line 312: post-fetch count
console.log('[jobs-search] fetched', rawJobs.length, ...)           → log.info('jobsSearch.fetched', { rawCount: rawJobs.length })
console.error('[jobs-search] JSearch error:', ...)      → log.error('jobsSearch.fetch', { error: err.message })
console.log(`[jobs-search] raw: ...`)                   → log.info('jobsSearch.filtered', { rawCount: rawJobs.length, filteredCount: jobsToScore.length })
console.log('[jobs-search] scoring done')               → log.info('jobsSearch.scored', { scoredCount: Object.keys(scores).length })
console.error('[jobs-search] scoring error:', ...)      → log.error('jobsSearch.score', { error: err.message })
console.log('[jobs-search] done, saved', ...)           → log.info('jobsSearch.done', { savedCount: top20.length })
```

Also update the `scoreJobs` call to pass `rid`:
```js
scores = await scoreJobs(jobsToScore, resumeText, targetRoles || query, rid)
```

- [ ] **Step 5.2 — Run existing jobs-search tests**

```bash
npm test netlify/functions/__tests__/jobs-search.test.js
```
Expected: all 24 tests pass (exported pure functions are unchanged)

- [ ] **Step 5.3 — Run full test suite**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 5.4 — Commit**

```bash
git add netlify/functions/jobs-search.js
git commit -m "feat: wire rid and structured logging into jobs-search.js"
```

---

## Task 6: Update `db.js`, `semantic-analyze.js`, `admin.js`

**Files:**
- Modify: `netlify/functions/db.js`
- Modify: `netlify/functions/semantic-analyze.js`
- Modify: `netlify/functions/admin.js`

- [ ] **Step 6.1 — Update `netlify/functions/db.js`**

Add after existing `require` lines:
```js
const { createLogger } = require('./logger')
```

Add after auth check, before `try`:
```js
const rid = event.headers['x-request-id'] || 'no-rid'
const log = createLogger(rid)
```

Add a log line at the start of each action branch:
```js
if (action === 'get')    log.debug('db.get',    { action, key })
if (action === 'set')    log.debug('db.set',    { action, key })
if (action === 'delete') log.debug('db.delete', { action, key })
if (action === 'list')   log.debug('db.list',   { action, prefix })
```

Replace in the `catch` block:
```js
// BEFORE
console.error('[db function error]', err)
// AFTER
log.error('db', { error: err.message })
```

- [ ] **Step 6.2 — Update `netlify/functions/semantic-analyze.js`**

Add after existing `require` lines:
```js
const { createLogger } = require('./logger')
```

Add after auth check:
```js
const rid = event.headers['x-request-id'] || 'no-rid'
const log = createLogger(rid)
```

In the `try` block, add a success log after each response:
```js
// After single result:
log.info('semanticAnalyze', { matchCount: Object.keys(result.keywords || {}).length })

// After batch result:
log.info('semanticAnalyze', { matchCount: scores.length })
```

Replace in the `catch` block:
```js
// BEFORE
console.error('[semantic-analyze error]', err.message)
// AFTER
log.error('semanticAnalyze', { error: err.message })
```

- [ ] **Step 6.3 — Update `netlify/functions/admin.js`**

Add after existing `require` lines:
```js
const { createLogger } = require('./logger')
```

Add after auth check (after `const { action } = payload`):
```js
const rid = event.headers['x-request-id'] || 'no-rid'
const log = createLogger(rid)
log.info('admin.handler', { action })
```

Replace in the outer `catch` block at the bottom of the handler:
```js
// BEFORE
console.error('[admin function error]', e)
// AFTER
log.error('admin.handler', { error: e.message })
```

- [ ] **Step 6.4 — Run existing db tests**

```bash
npm test netlify/functions/__tests__/db.test.js
```
Expected: all 7 tests pass (auth guards and `devKeyNs` are unaffected)

- [ ] **Step 6.5 — Run full test suite**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 6.6 — Commit**

```bash
git add netlify/functions/db.js netlify/functions/semantic-analyze.js netlify/functions/admin.js
git commit -m "feat: wire rid and structured logging into db.js, semantic-analyze.js, admin.js"
```

---

## Task 7: Update `ai-bg-background.js` and `ai-status.js`

**Files:**
- Modify: `netlify/functions/ai-bg-background.js`
- Modify: `netlify/functions/ai-status.js`

- [ ] **Step 7.1 — Update `netlify/functions/ai-bg-background.js`**

```js
const { createClient } = require('@supabase/supabase-js')
const { routeAI } = require('./ai-router')
const { createLogger } = require('./logger')

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

  const { jobId, messages, system, search, tokens = 6000, type = 'ai_task' } = payload
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
    const { text } = await routeAI({ messages, system, search, tokens, rid })
    log.info('ai-bg.done', { jobId, textLen: text?.length })
    await updateJob(sb, jobId, { status: 'done', result: { text } }, log)
  } catch (err) {
    log.error('ai-bg.error', { jobId, error: err.message })
    await updateJob(sb, jobId, { status: 'error', error: err.message }, log)
  }

  return { statusCode: 202 }
}
```

- [ ] **Step 7.2 — Update `netlify/functions/ai-status.js`**

```js
const { createClient } = require('@supabase/supabase-js')
const { createLogger } = require('./logger')

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

  if (error || !data) return { statusCode: 404, body: JSON.stringify({ error: 'Job not found' }) }

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
```

- [ ] **Step 7.3 — Run full test suite**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 7.4 — Commit**

```bash
git add netlify/functions/ai-bg-background.js netlify/functions/ai-status.js
git commit -m "feat: wire rid and structured logging into ai-bg-background.js and ai-status.js"
```

---

## Task 8: Settings UI debug toggle + `.env.example`

**Files:**
- Modify: `src/components/Settings.jsx`
- Modify: `.env.example`

- [ ] **Step 8.1 — Add "Developer tools" card to `src/components/Settings.jsx`**

Add `debugMode` state and `toggleDebug` handler after the existing `saved` state:

```js
const [debugMode, setDebugMode] = useState(
  () => localStorage.getItem('jh_debug') === 'true'
)

const toggleDebug = (e) => {
  const val = e.target.checked
  setDebugMode(val)
  localStorage.setItem('jh_debug', String(val))
}
```

Add the "Developer tools" card at the end of the returned JSX, after the existing preferences card:

```jsx
<div style={{ ...C.card, marginTop: '1rem' }}>
  <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 500 }}>Developer tools</p>
  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
    <input type="checkbox" checked={debugMode} onChange={toggleDebug} />
    <span style={{ fontSize: 13, color: 'var(--text-main)' }}>Debug logging</span>
  </label>
  <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted, #888)' }}>
    Logs structured JSON to the browser console and Netlify function logs.
  </p>
</div>
```

Note: this card does NOT use `form` state or the "Save preferences" button — it writes `localStorage.jh_debug` directly on toggle and takes effect immediately.

- [ ] **Step 8.2 — Add env vars to `.env.example`**

Add after the `RAPIDAPI_KEY` block:

```env
# ── Logging & Diagnostics ────────────────────────────────────────────────────
# Set DEBUG=true to enable structured JSON logging in Netlify function logs
DEBUG=false
# Set VITE_DEBUG=true to enable structured JSON logging in the browser console
# (can also be toggled per-session in Settings → Developer tools)
VITE_DEBUG=false
```

- [ ] **Step 8.3 — Run full test suite**

```bash
npm test
```
Expected: all tests pass (Settings smoke test still passes)

- [ ] **Step 8.4 — Commit**

```bash
git add src/components/Settings.jsx .env.example
git commit -m "feat: add debug logging toggle to Settings and document env vars"
```

---

## Task 9: Run simplify skill

- [ ] **Step 9.1 — Invoke simplify**

Run the `simplify` skill to review all changed files for reuse, quality, and efficiency.

Files changed in this feature:
- `src/lib/logger.js`
- `src/lib/api.js`
- `netlify/functions/logger.js`
- `netlify/functions/ai.js`
- `netlify/functions/ai-router.js`
- `netlify/functions/providers/gemini.js`
- `netlify/functions/providers/anthropic.js`
- `netlify/functions/providers/openai.js`
- `netlify/functions/providers/groq.js`
- `netlify/functions/jobs-search.js`
- `netlify/functions/db.js`
- `netlify/functions/semantic-analyze.js`
- `netlify/functions/admin.js`
- `netlify/functions/ai-bg-background.js`
- `netlify/functions/ai-status.js`
- `src/components/Settings.jsx`

- [ ] **Step 9.2 — Run full test suite one final time**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 9.3 — Final commit if simplify made changes**

```bash
git add -p
git commit -m "refactor: simplify logging implementation after skill review"
```

---

## Verification

After all tasks complete, verify end-to-end in local dev:

1. Start dev server: `npm run dev`
2. Open app, go to Settings → enable "Debug logging"
3. Open browser DevTools console
4. Trigger any action (e.g. load profile data)
5. Confirm JSON log lines appear in the console with `rid`, `level`, `op`, `ts` fields
6. Grep Netlify dev terminal for the same `rid` — should appear in backend logs
7. Set `DEBUG=true` in `.env`, restart dev server, confirm backend logs appear in terminal
8. Turn off debug toggle — confirm console goes silent (errors still appear)
