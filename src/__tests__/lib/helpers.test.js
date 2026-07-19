import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { uid, todayStr, fmtDate, parseJSON } from '../../lib/helpers'

describe('uid', () => {
  it('returns a string', () => {
    expect(typeof uid()).toBe('string')
  })

  it('returns 7 characters', () => {
    expect(uid()).toHaveLength(7)
  })

  it('only contains alphanumeric characters', () => {
    expect(uid()).toMatch(/^[a-z0-9]+$/)
  })

  it('generates unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, uid))
    expect(ids.size).toBe(100)
  })
})

describe('todayStr', () => {
  it('returns YYYY-MM-DD format', () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('matches the current date', () => {
    const expected = new Date().toISOString().split('T')[0]
    expect(todayStr()).toBe(expected)
  })
})

describe('fmtDate', () => {
  it('returns — for falsy values', () => {
    expect(fmtDate(null)).toBe('—')
    expect(fmtDate(undefined)).toBe('—')
    expect(fmtDate('')).toBe('—')
  })

  it('formats a valid ISO date string', () => {
    // Use a fixed date to avoid locale flakiness
    const result = fmtDate('2025-06-15T00:00:00.000Z')
    expect(result).toContain('2025')
    expect(result).toMatch(/Jun|June/)
  })

  it('includes day and year', () => {
    const result = fmtDate('2025-01-07T00:00:00.000Z')
    expect(result).toContain('2025')
    expect(result).toContain('7')
  })
})

describe('parseJSON', () => {
  it('parses a plain JSON object', () => {
    expect(parseJSON('{"a":1}')).toEqual({ a: 1 })
  })

  it('parses a plain JSON array', () => {
    expect(parseJSON('[1,2,3]')).toEqual([1, 2, 3])
  })

  it('parses JSON inside a markdown code block', () => {
    const input = '```json\n{"key":"value"}\n```'
    expect(parseJSON(input)).toEqual({ key: 'value' })
  })

  it('parses JSON inside a plain code block', () => {
    const input = '```\n{"key":"value"}\n```'
    expect(parseJSON(input)).toEqual({ key: 'value' })
  })

  it('extracts an array embedded in surrounding text', () => {
    const input = 'Here is the result: [1, 2, 3] as requested'
    expect(parseJSON(input)).toEqual([1, 2, 3])
  })

  it('extracts an object embedded in surrounding text', () => {
    const input = 'Result: {"score": 85} end'
    expect(parseJSON(input)).toEqual({ score: 85 })
  })

  it('returns null for unparseable input', () => {
    expect(parseJSON('not json at all')).toBeNull()
    expect(parseJSON('')).toBeNull()
  })
})
