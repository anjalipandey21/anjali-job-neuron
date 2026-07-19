import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger } from '../../lib/logger'

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
