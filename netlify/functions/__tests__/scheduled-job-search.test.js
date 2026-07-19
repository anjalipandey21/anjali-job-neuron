// netlify/functions/__tests__/scheduled-job-search.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { getLocalDate, isProfileDue, getProfilesToRun, handler } = require('../scheduled-job-search-background')

// ── getLocalDate ──────────────────────────────────────────────────────────────

describe('getLocalDate', () => {
  it('returns YYYY-MM-DD for a valid timezone', () => {
    // 2026-03-18T12:00:00Z = 8:00 AM EDT (UTC-4 in March)
    expect(getLocalDate('America/New_York', '2026-03-18T12:00:00Z')).toBe('2026-03-18')
  })

  it('crosses a date boundary for a timezone ahead of UTC', () => {
    // 2026-03-18T23:00:00Z = 2026-03-19 01:00 in Africa/Johannesburg (UTC+2)
    expect(getLocalDate('Africa/Johannesburg', '2026-03-18T23:00:00Z')).toBe('2026-03-19')
  })

  it('returns null for an invalid timezone', () => {
    expect(getLocalDate('Not/ATimezone', '2026-03-18T12:00:00Z')).toBeNull()
  })
})

// ── isProfileDue ──────────────────────────────────────────────────────────────
// America/New_York in March is EDT (UTC-4): 8 AM local = 12:00 UTC
// At 12:30 UTC: utcHour=12 → window [12,18) → 8 AM ET maps to UTC 12 → IN window ✓
// At 07:00 UTC: utcHour=7  → window [6,12)  → 8 AM ET maps to UTC 12 → NOT in window ✓

describe('isProfileDue', () => {
  const IN_WINDOW  = '2026-03-18T12:30:00Z'  // 8:30 AM EDT
  const OUT_WINDOW = '2026-03-18T07:00:00Z'  // 3:00 AM EDT

  it('returns true when opted in, in-window, and not yet run today', () => {
    const prefs = { scheduledSearch: true, timezone: 'America/New_York' }
    expect(isProfileDue(prefs, null, IN_WINDOW)).toBe(true)
  })

  it('returns false when outside the 6-hour window', () => {
    const prefs = { scheduledSearch: true, timezone: 'America/New_York' }
    expect(isProfileDue(prefs, null, OUT_WINDOW)).toBe(false)
  })

  it('returns false when already ran today', () => {
    const prefs = { scheduledSearch: true, timezone: 'America/New_York' }
    const statusRecord = { lastRunDate: '2026-03-18', status: 'success', error: null }
    expect(isProfileDue(prefs, statusRecord, IN_WINDOW)).toBe(false)
  })

  it('returns true when lastRunDate is a previous day', () => {
    const prefs = { scheduledSearch: true, timezone: 'America/New_York' }
    const statusRecord = { lastRunDate: '2026-03-17', status: 'success', error: null }
    expect(isProfileDue(prefs, statusRecord, IN_WINDOW)).toBe(true)
  })

  it('returns false when scheduledSearch is false', () => {
    const prefs = { scheduledSearch: false, timezone: 'America/New_York' }
    expect(isProfileDue(prefs, null, IN_WINDOW)).toBe(false)
  })

  it('returns false when timezone is missing', () => {
    const prefs = { scheduledSearch: true }
    expect(isProfileDue(prefs, null, IN_WINDOW)).toBe(false)
  })
})

// ── getProfilesToRun ──────────────────────────────────────────────────────────
// NOTE: getProfilesToRun takes a flat array of PRE-FETCHED candidates (not raw Supabase rows).
// The handler does the Supabase reads and builds this flat list before calling getProfilesToRun.
// Shape: [{ userId, profileId, prefs, resumeText, statusRecord }]

describe('getProfilesToRun', () => {
  const IN_WINDOW = '2026-03-18T12:30:00Z'
  const base = {
    userId: 'user1', profileId: 'p1',
    prefs: { scheduledSearch: true, timezone: 'America/New_York' },
    resumeText: 'some resume content',
    statusRecord: null,
  }

  it('includes a profile that is due and has a resume', () => {
    expect(getProfilesToRun([base], IN_WINDOW)).toHaveLength(1)
  })

  it('excludes a profile with scheduledSearch: false', () => {
    const c = { ...base, prefs: { ...base.prefs, scheduledSearch: false } }
    expect(getProfilesToRun([c], IN_WINDOW)).toHaveLength(0)
  })

  it('excludes a profile that already ran today', () => {
    const c = { ...base, statusRecord: { lastRunDate: '2026-03-18', status: 'success', error: null } }
    expect(getProfilesToRun([c], IN_WINDOW)).toHaveLength(0)
  })

  it('excludes a profile with no resume', () => {
    const c = { ...base, resumeText: null }
    expect(getProfilesToRun([c], IN_WINDOW)).toHaveLength(0)
  })

  it('filters correctly across multiple users and profiles', () => {
    const candidates = [
      base,
      { ...base, userId: 'user2', profileId: 'p2', prefs: { scheduledSearch: false, timezone: 'America/New_York' } },
      { ...base, userId: 'user3', profileId: 'p3', statusRecord: { lastRunDate: '2026-03-18', status: 'success', error: null } },
    ]
    const result = getProfilesToRun(candidates, IN_WINDOW)
    expect(result).toHaveLength(1)
    expect(result[0].profileId).toBe('p1')
  })
})

// ── handler — dual KV write (pool + first 10) ─────────────────────────────────
// The handler accepts an optional injected Supabase client as the third argument
// { supabase } — this avoids the CJS/ESM mock interop issue with @supabase/supabase-js.
describe('handler — dual KV write after fetchAndScoreJobs', () => {
  const PROFILE_ID = 'prof-abc123'
  const USER_ID    = 'user-xyz'
  // 8:30 AM EDT = in-window for America/New_York (UTC 12:30)
  const NOW_UTC    = '2026-03-18T12:30:00Z'
  const LOCAL_DATE = '2026-03-18'

  // 50 fake jobs — confirms pool receives all 50 and legacy key receives only 10
  const FIFTY_JOBS = Array.from({ length: 50 }, (_, i) => ({ id: `job-${i}` }))

  let mockUpsert
  let mockSb
  let mockFetchJobs

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_UTC))

    mockFetchJobs = vi.fn().mockResolvedValue(FIFTY_JOBS)

    mockUpsert = vi.fn().mockResolvedValue({ error: null })

    // Build a call-count-aware mock Supabase client
    let callCount = 0
    mockSb = {
      from: vi.fn(() => {
        callCount++
        const builder = {
          select: vi.fn().mockReturnThis(),
          eq:     vi.fn().mockReturnThis(),
          single: vi.fn(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          upsert: mockUpsert,
        }

        if (callCount === 1) {
          // sb.from('kv_store').select('user_id, value').eq('key', 'jh_profiles')
          // The last .eq() in the chain is what the handler awaits
          let eqCallIndex = 0
          builder.eq.mockImplementation(function () {
            eqCallIndex++
            if (eqCallIndex === 1) {
              return Promise.resolve({
                data: [{ user_id: USER_ID, value: [{ id: PROFILE_ID }] }],
                error: null,
              })
            }
            return this
          })
        } else if (callCount === 2) {
          // Load full profile: jh_p_{profileId}
          builder.single.mockResolvedValue({
            data: {
              value: {
                resumeText: 'my resume text',
                preferences: {
                  scheduledSearch: true,
                  timezone: 'America/New_York',
                  roles: 'engineer',
                  locations: 'remote',
                  workType: 'any',
                  jobType: 'any',
                  dateWindowDays: 30,
                },
              },
            },
          })
        }
        // callCount === 3: status record — maybeSingle returns { data: null } (default)
        // callCount >= 4: upsert calls — mockUpsert handles those

        return builder
      }),
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('writes full pool (50 jobs) to jh_jobs_pool_ key and first 10 to jh_jobs_ key', async () => {
    await handler(undefined, undefined, { supabase: mockSb, fetchJobs: mockFetchJobs })

    // Collect all upsert call arguments (first positional arg of each call)
    const upsertCalls = mockUpsert.mock.calls.map((args) => args[0])

    const poolWrite   = upsertCalls.find((arg) => arg.key && arg.key.includes('jh_jobs_pool_'))
    const legacyWrite = upsertCalls.find(
      (arg) => arg.key && arg.key.includes('jh_jobs_') && !arg.key.includes('pool')
    )

    // Pool key must contain all 50 jobs
    expect(poolWrite).toBeDefined()
    expect(poolWrite.key).toContain(`jh_jobs_pool_${PROFILE_ID}_${LOCAL_DATE}`)
    expect(poolWrite.value).toHaveLength(50)

    // Legacy key must contain exactly the first 10 jobs
    expect(legacyWrite).toBeDefined()
    expect(legacyWrite.key).toContain(`jh_jobs_${PROFILE_ID}_${LOCAL_DATE}`)
    expect(legacyWrite.value).toHaveLength(10)
  })
})
