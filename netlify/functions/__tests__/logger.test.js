import { createLogger } from '../lib/logger'

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

  it('silences debug/info/warn when DEBUG is not set', () => {
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

  it('always emits metric via console.log regardless of DEBUG', () => {
    delete process.env.DEBUG
    const log = createLogger('test-rid')
    log.metric('ai.usage', { inputTokens: 100, outputTokens: 50 })
    expect(logSpy).toHaveBeenCalledTimes(1)
    const arg = JSON.parse(logSpy.mock.calls[0][0])
    expect(arg).toMatchObject({ level: 'metric', rid: 'test-rid', op: 'ai.usage', inputTokens: 100 })
  })

  it('metric does not emit via console.error', () => {
    delete process.env.DEBUG
    const log = createLogger('test-rid')
    log.metric('ai.usage', { inputTokens: 100 })
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('metric still emits when DEBUG=true', () => {
    process.env.DEBUG = 'true'
    const log = createLogger('test-rid')
    log.metric('ai.usage', { inputTokens: 5 })
    expect(logSpy).toHaveBeenCalledTimes(1)
  })
})
