import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// key-rotator is CJS, import via require-style
const { withKeyRotation, parseKeys, isRateLimitError } = require('../lib/key-rotator')

describe('key-rotator', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Reset env before each test
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('parseKeys', () => {
    it('splits comma-separated keys', () => {
      process.env.TEST_KEYS = 'key1,key2,key3'
      expect(parseKeys('TEST_KEYS')).toEqual(['key1', 'key2', 'key3'])
    })

    it('trims whitespace', () => {
      process.env.TEST_KEYS = ' key1 , key2 , key3 '
      expect(parseKeys('TEST_KEYS')).toEqual(['key1', 'key2', 'key3'])
    })

    it('returns empty array for missing env var', () => {
      expect(parseKeys('NONEXISTENT')).toEqual([])
    })

    it('handles single key', () => {
      process.env.TEST_KEYS = 'only-one'
      expect(parseKeys('TEST_KEYS')).toEqual(['only-one'])
    })

    it('filters empty entries from trailing commas', () => {
      process.env.TEST_KEYS = 'key1,,key2,'
      expect(parseKeys('TEST_KEYS')).toEqual(['key1', 'key2'])
    })
  })

  describe('isRateLimitError', () => {
    it('detects 429 in message', () => {
      expect(isRateLimitError(new Error('Gemini error 429'))).toBe(true)
    })

    it('detects rate limit phrase', () => {
      expect(isRateLimitError(new Error('Rate limit exceeded'))).toBe(true)
    })

    it('detects quota phrase', () => {
      expect(isRateLimitError(new Error('Quota exhausted for today'))).toBe(true)
    })

    it('detects resource exhausted', () => {
      expect(isRateLimitError(new Error('RESOURCE_EXHAUSTED'))).toBe(true)
    })

    it('detects too many requests', () => {
      expect(isRateLimitError(new Error('Too many requests'))).toBe(true)
    })

    it('detects status 429', () => {
      const err = new Error('fail')
      err.status = 429
      expect(isRateLimitError(err)).toBe(true)
    })

    it('returns false for non-rate-limit errors', () => {
      expect(isRateLimitError(new Error('Invalid API key'))).toBe(false)
    })
  })

  describe('withKeyRotation', () => {
    it('throws when no keys are configured', async () => {
      await expect(withKeyRotation('EMPTY_VAR', async () => 'ok'))
        .rejects.toThrow('No API keys found')
    })

    it('calls fn with single key (no rotation overhead)', async () => {
      process.env.SINGLE_KEY = 'abc123'
      const fn = vi.fn().mockResolvedValue('result')
      const result = await withKeyRotation('SINGLE_KEY', fn)
      expect(result).toBe('result')
      expect(fn).toHaveBeenCalledWith('abc123')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('uses first key on success', async () => {
      process.env.MULTI_KEYS = 'key-a,key-b,key-c'
      const fn = vi.fn().mockResolvedValue('ok')
      await withKeyRotation('MULTI_KEYS', fn)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('rotates to next key on rate limit', async () => {
      process.env.MULTI_KEYS = 'key-a,key-b,key-c'
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('429 rate limit'))
        .mockResolvedValueOnce('success-on-b')

      const result = await withKeyRotation('MULTI_KEYS', fn)
      expect(result).toBe('success-on-b')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('tries all keys before giving up', async () => {
      process.env.MULTI_KEYS = 'key-a,key-b,key-c'
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('429'))
        .mockRejectedValueOnce(new Error('Rate limit'))
        .mockRejectedValueOnce(new Error('Quota exhausted'))

      await expect(withKeyRotation('MULTI_KEYS', fn))
        .rejects.toThrow('Quota exhausted')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('throws immediately on non-rate-limit errors', async () => {
      process.env.MULTI_KEYS = 'key-a,key-b'
      const fn = vi.fn().mockRejectedValueOnce(new Error('Invalid API key'))

      await expect(withKeyRotation('MULTI_KEYS', fn))
        .rejects.toThrow('Invalid API key')
      expect(fn).toHaveBeenCalledTimes(1) // Did NOT try key-b
    })

    it('round-robins starting key across calls', async () => {
      process.env.RR_KEYS = 'key-a,key-b,key-c'
      const keysUsed = []
      const fn = vi.fn().mockImplementation(async (key) => {
        keysUsed.push(key)
        return 'ok'
      })

      // Make 4 sequential calls — should cycle through keys
      await withKeyRotation('RR_KEYS', fn)
      await withKeyRotation('RR_KEYS', fn)
      await withKeyRotation('RR_KEYS', fn)
      await withKeyRotation('RR_KEYS', fn)

      // Should have used different starting keys (round-robin)
      // Exact order depends on initial counter, but all 3 keys should appear
      const uniqueKeys = new Set(keysUsed)
      expect(uniqueKeys.size).toBe(3)
    })

    it('passes log to warn on rotation', async () => {
      process.env.LOG_KEYS = 'key-a,key-b'
      const log = { warn: vi.fn() }
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('429'))
        .mockResolvedValueOnce('ok')

      await withKeyRotation('LOG_KEYS', fn, log)
      expect(log.warn).toHaveBeenCalledWith('key-rotator', expect.objectContaining({
        envVar: 'LOG_KEYS',
        attempt: 1,
        total: 2,
      }))
    })
  })
})
