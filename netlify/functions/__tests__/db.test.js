import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// ── Import only the pure-function exports (no Supabase dependency) ────────────
import { devKeyNs } from '../db.js'

// ── Helpers ───────────────────────────────────────────────────────────────────
// Build a minimal Netlify event + context for the handler
const makeEvent = (body)          => ({ httpMethod: 'POST', body: JSON.stringify(body) })
const makeBadEvent = ()           => ({ httpMethod: 'POST', body: 'not-json' })
const makeGetEvent = ()           => ({ httpMethod: 'GET', body: '' })
const makeCtx   = (sub = 'u123') => ({ clientContext: { user: { sub } } })
const noUserCtx = { clientContext: {} }

// ── devKeyNs — the key namespacing pure function ──────────────────────────────
describe('devKeyNs', () => {
  afterEach(() => { delete process.env.NETLIFY_DEV })

  it('returns "dev_" when NETLIFY_DEV is set', () => {
    process.env.NETLIFY_DEV = 'true'
    expect(devKeyNs()).toBe('dev_')
  })

  it('returns "" in production (no NETLIFY_DEV)', () => {
    delete process.env.NETLIFY_DEV
    expect(devKeyNs()).toBe('')
  })

  it('applies correctly as a key prefix', () => {
    process.env.NETLIFY_DEV = 'true'
    expect(devKeyNs() + 'jh_profiles').toBe('dev_jh_profiles')
    expect(devKeyNs() + 'jh_apps_p1').toBe('dev_jh_apps_p1')
  })

  it('leaves keys unchanged in production', () => {
    delete process.env.NETLIFY_DEV
    expect(devKeyNs() + 'jh_profiles').toBe('jh_profiles')
  })
})

// ── Handler auth — these tests do NOT need Supabase ──────────────────────────
// We import the handler separately so Supabase errors are caught at handler level
describe('db handler — auth guards', () => {
  // Lazy-import to avoid top-level Supabase init failing in test env
  let handler
  beforeEach(async () => {
    // The handler catches Supabase errors internally (after auth check)
    // Auth checks run BEFORE any Supabase call, so they're safe to test
    const mod = await import('../db.js')
    handler = mod.handler
  })

  it('returns 401 when no user is present', async () => {
    const res = await handler(makeEvent({ action: 'get', key: 'foo' }), noUserCtx)
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body).error).toMatch(/Unauthorized/)
  })

  it('returns 405 for non-POST requests', async () => {
    const res = await handler(makeGetEvent(), makeCtx())
    expect(res.statusCode).toBe(405)
  })

  it('returns 400 for malformed JSON body', async () => {
    const res = await handler(makeBadEvent(), makeCtx())
    expect(res.statusCode).toBe(400)
  })

  // Note: 'unknown action' reaches getSupabase() before the action switch,
  // so it requires a live Supabase connection — tested in integration tests instead.
})
