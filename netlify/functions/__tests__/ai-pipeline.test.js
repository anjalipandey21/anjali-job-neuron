import {
  validateShape,
  SchemaValidationError,
  schemaMiddleware,
  cacheMiddleware,
  traceMiddleware,
  callMiddleware,
  buildPipeline,
} from '../lib/ai-pipeline.js'

// ── SchemaValidationError ─────────────────────────────────────────────────────

describe('SchemaValidationError', () => {
  it('is an instance of Error', () => {
    const e = new SchemaValidationError('missing key: foo')
    expect(e).toBeInstanceOf(Error)
    expect(e.message).toBe('missing key: foo')
    expect(e.name).toBe('SchemaValidationError')
  })
})

// ── validateShape ─────────────────────────────────────────────────────────────

describe('validateShape', () => {
  it('passes a flat object matching shorthand shape', () => {
    expect(() => validateShape({ score: 85, label: 'good' }, { score: 'number', label: 'string' })).not.toThrow()
  })

  it('throws on missing required key', () => {
    expect(() => validateShape({ score: 85 }, { score: 'number', label: 'string' }))
      .toThrow(SchemaValidationError)
  })

  it('throws with the missing key name in message', () => {
    try { validateShape({ score: 85 }, { score: 'number', label: 'string' }) }
    catch (e) { expect(e.message).toContain('label') }
  })

  it('throws on wrong type', () => {
    expect(() => validateShape({ score: 'eighty-five' }, { score: 'number' }))
      .toThrow(SchemaValidationError)
  })

  it('allows extra keys (non-strict)', () => {
    expect(() => validateShape({ score: 85, extra: 'ignored' }, { score: 'number' })).not.toThrow()
  })

  it('throws when null provided for required string', () => {
    expect(() => validateShape({ label: null }, { label: 'string' }))
      .toThrow(SchemaValidationError)
  })

  it('validates array shape', () => {
    const data = [{ idx: 0, matchScore: 85, reason: 'good' }]
    const schema = { type: 'array', items: { idx: 'number', matchScore: 'number', reason: 'string' } }
    expect(() => validateShape(data, schema)).not.toThrow()
  })

  it('throws when array element fails item shape', () => {
    const data = [{ idx: 0, matchScore: 'not-a-number', reason: 'good' }]
    const schema = { type: 'array', items: { idx: 'number', matchScore: 'number', reason: 'string' } }
    expect(() => validateShape(data, schema)).toThrow(SchemaValidationError)
  })

  it('throws when value is not an array for array schema', () => {
    expect(() => validateShape({ idx: 0 }, { type: 'array', items: { idx: 'number' } }))
      .toThrow(SchemaValidationError)
  })

  it('validates nested object via type:object props', () => {
    const data = { outer: { inner: 42 } }
    const schema = { type: 'object', props: { outer: { type: 'object', props: { inner: 'number' } } } }
    expect(() => validateShape(data, schema)).not.toThrow()
  })

  it('passes empty array for array schema', () => {
    expect(() => validateShape([], { type: 'array', items: { idx: 'number' } })).not.toThrow()
  })

  it('throws SchemaValidationError (not TypeError) when null given for object schema', () => {
    expect(() => validateShape(null, { score: 'number' })).toThrow(SchemaValidationError)
  })

  it('throws SchemaValidationError (not TypeError) when primitive given for object schema', () => {
    expect(() => validateShape('hello', { score: 'number' })).toThrow(SchemaValidationError)
  })
})

// ── schemaMiddleware ──────────────────────────────────────────────────────────

describe('schemaMiddleware', () => {
  const noop = async () => {}

  it('sets ctx.parsed when text is valid JSON matching schema', async () => {
    const ctx = {
      text: '[{"idx":0,"matchScore":85,"reason":"good"}]',
      schema: { type: 'array', items: { idx: 'number', matchScore: 'number', reason: 'string' } },
    }
    await schemaMiddleware(ctx, noop)
    expect(ctx.parsed).toEqual([{ idx: 0, matchScore: 85, reason: 'good' }])
  })

  it('sets ctx.parsed = null when no schema provided', async () => {
    const ctx = { text: 'some text', schema: undefined }
    await schemaMiddleware(ctx, noop)
    expect(ctx.parsed).toBeNull()
  })

  it('extracts JSON array embedded in prose', async () => {
    const ctx = {
      text: 'Here are the scores: [{"idx":0,"matchScore":90,"reason":"great"}] done.',
      schema: { type: 'array', items: { idx: 'number', matchScore: 'number', reason: 'string' } },
    }
    await schemaMiddleware(ctx, noop)
    expect(ctx.parsed[0].matchScore).toBe(90)
  })

  it('extracts JSON object embedded in prose', async () => {
    const ctx = {
      text: 'Result: {"score":75,"feedback":"ok"} end.',
      schema: { score: 'number', feedback: 'string' },
    }
    await schemaMiddleware(ctx, noop)
    expect(ctx.parsed.score).toBe(75)
  })

  it('throws SchemaValidationError when text is not parseable JSON', async () => {
    const ctx = { text: 'not json at all', schema: { score: 'number' } }
    await expect(schemaMiddleware(ctx, noop)).rejects.toBeInstanceOf(SchemaValidationError)
  })

  it('throws SchemaValidationError when parsed JSON fails shape validation', async () => {
    const ctx = {
      text: '{"score":"wrong-type"}',
      schema: { score: 'number' },
    }
    await expect(schemaMiddleware(ctx, noop)).rejects.toBeInstanceOf(SchemaValidationError)
  })

  it('calls next() before returning', async () => {
    let called = false
    const ctx = { text: '{"score":1}', schema: { score: 'number' } }
    await schemaMiddleware(ctx, async () => { called = true })
    expect(called).toBe(true)
  })
})

// ── cacheMiddleware ───────────────────────────────────────────────────────────

describe('cacheMiddleware', () => {
  const noop = async () => {}

  it('sets systemBlocks with cache_control on Anthropic when cacheSystem:true', async () => {
    const ctx = { provider: 'anthropic', cacheSystem: true, system: 'You are a helper.' }
    await cacheMiddleware(ctx, noop)
    expect(ctx.systemBlocks).toEqual([
      { type: 'text', text: 'You are a helper.', cache_control: { type: 'ephemeral' } },
    ])
  })

  it('does NOT mutate ctx.system', async () => {
    const ctx = { provider: 'anthropic', cacheSystem: true, system: 'original' }
    await cacheMiddleware(ctx, noop)
    expect(ctx.system).toBe('original')
  })

  it('leaves systemBlocks undefined when cacheSystem:false on Anthropic', async () => {
    const ctx = { provider: 'anthropic', cacheSystem: false, system: 'hello' }
    await cacheMiddleware(ctx, noop)
    expect(ctx.systemBlocks).toBeUndefined()
  })

  it('leaves systemBlocks undefined when cacheSystem:true on Gemini', async () => {
    const ctx = { provider: 'gemini', cacheSystem: true, system: 'hello' }
    await cacheMiddleware(ctx, noop)
    expect(ctx.systemBlocks).toBeUndefined()
  })

  it('leaves systemBlocks undefined when cacheSystem:true on OpenAI', async () => {
    const ctx = { provider: 'openai', cacheSystem: true, system: 'hello' }
    await cacheMiddleware(ctx, noop)
    expect(ctx.systemBlocks).toBeUndefined()
  })

  it('leaves systemBlocks undefined when cacheSystem:true on Groq', async () => {
    const ctx = { provider: 'groq', cacheSystem: true, system: 'hello' }
    await cacheMiddleware(ctx, noop)
    expect(ctx.systemBlocks).toBeUndefined()
  })

  it('leaves systemBlocks undefined when cacheSystem:true on Anthropic but system is absent', async () => {
    const ctx = { provider: 'anthropic', cacheSystem: true }
    await cacheMiddleware(ctx, noop)
    expect(ctx.systemBlocks).toBeUndefined()
  })

  it('calls next()', async () => {
    let called = false
    const ctx = { provider: 'anthropic', cacheSystem: true, system: 'x' }
    await cacheMiddleware(ctx, async () => { called = true })
    expect(called).toBe(true)
  })
})

// ── traceMiddleware ───────────────────────────────────────────────────────────

describe('traceMiddleware', () => {
  let logSpy
  beforeEach(() => { logSpy = vi.spyOn(console, 'log').mockImplementation(() => {}) })
  afterEach(() => { vi.restoreAllMocks() })

  it('assembles ctx.usage from ctx.rawUsage after next()', async () => {
    const ctx = {
      provider: 'gemini', model: 'gemini-2.0-flash', op: 'test',
      rawUsage: { inputTokens: 100, outputTokens: 50, cacheHit: false },
    }
    // Simulate callMiddleware setting rawUsage inside next()
    await traceMiddleware(ctx, async () => {})
    expect(ctx.usage).toMatchObject({
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      inputTokens: 100,
      outputTokens: 50,
      cacheHit: false,
    })
    expect(typeof ctx.usage.latencyMs).toBe('number')
    expect(ctx.usage.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('defaults to 0 tokens when rawUsage is missing', async () => {
    const ctx = { provider: 'gemini', model: 'gemini-2.0-flash', op: 'test' }
    await traceMiddleware(ctx, async () => {})
    expect(ctx.usage.inputTokens).toBe(0)
    expect(ctx.usage.outputTokens).toBe(0)
    expect(ctx.usage.cacheHit).toBe(false)
  })

  it('emits ai.usage log via console.log regardless of DEBUG env', async () => {
    delete process.env.DEBUG
    const ctx = {
      provider: 'gemini', model: 'gemini-2.0-flash', op: 'scoreJobs',
      rawUsage: { inputTokens: 200, outputTokens: 100, cacheHit: false },
    }
    await traceMiddleware(ctx, async () => {})
    expect(logSpy).toHaveBeenCalledTimes(1)
    const logged = JSON.parse(logSpy.mock.calls[0][0])
    expect(logged).toMatchObject({ level: 'metric', op: 'ai.usage', callOp: 'scoreJobs' })
    expect(logged.inputTokens).toBe(200)
  })

  it('calls next() before assembling usage', async () => {
    const ctx = { provider: 'gemini', model: 'gemini-2.0-flash', op: 'test' }
    await traceMiddleware(ctx, async () => {
      ctx.rawUsage = { inputTokens: 10, outputTokens: 5, cacheHit: false }
    })
    expect(ctx.usage.inputTokens).toBe(10)  // rawUsage set inside next(), available after
  })
})

// ── callMiddleware ────────────────────────────────────────────────────────────

describe('callMiddleware', () => {
  const noop = async () => {}

  beforeEach(() => {
    process.env.TEST_PROVIDER_KEY = 'test-api-key-123'
  })
  afterEach(() => {
    delete process.env.TEST_PROVIDER_KEY
  })

  it('calls _providerFn and sets ctx.text from result', async () => {
    const fakeProvider = vi.fn().mockResolvedValue({
      text: 'hello world',
      usage: { inputTokens: 10, outputTokens: 5, cacheHit: false },
    })
    const ctx = {
      provider: 'gemini',
      messages: [{ role: 'user', content: 'hi' }],
      system: 'you are helpful',
      search: false, tokens: 100, schema: null, model: 'gemini-2.0-flash', rid: 'test',
      _providerFn: fakeProvider,
      _envVar: 'TEST_PROVIDER_KEY',
    }
    await callMiddleware(ctx, noop)
    expect(ctx.text).toBe('hello world')
    expect(fakeProvider).toHaveBeenCalled()
  })

  it('sets ctx.rawUsage from provider usage', async () => {
    const fakeProvider = vi.fn().mockResolvedValue({
      text: 'result',
      usage: { inputTokens: 200, outputTokens: 80, cacheHit: true },
    })
    const ctx = {
      provider: 'anthropic',
      messages: [], system: 'sys', search: false, tokens: 500,
      schema: null, model: 'claude-sonnet', rid: 'rid',
      _providerFn: fakeProvider, _envVar: 'TEST_PROVIDER_KEY',
    }
    await callMiddleware(ctx, noop)
    expect(ctx.rawUsage).toEqual({ inputTokens: 200, outputTokens: 80, cacheHit: true })
  })

  it('passes systemBlocks to Anthropic provider', async () => {
    const fakeProvider = vi.fn().mockResolvedValue({
      text: 'ok', usage: { inputTokens: 5, outputTokens: 2, cacheHit: false },
    })
    const systemBlocks = [{ type: 'text', text: 'sys', cache_control: { type: 'ephemeral' } }]
    const ctx = {
      provider: 'anthropic',
      messages: [], system: 'sys', systemBlocks, search: false,
      tokens: 100, schema: null, model: 'claude', rid: 'r',
      _providerFn: fakeProvider, _envVar: 'TEST_PROVIDER_KEY',
    }
    await callMiddleware(ctx, noop)
    const callArgs = fakeProvider.mock.calls[0][0]
    expect(callArgs.systemBlocks).toBe(systemBlocks)
  })

  it('does NOT pass systemBlocks to non-Anthropic providers', async () => {
    const fakeProvider = vi.fn().mockResolvedValue({
      text: 'ok', usage: { inputTokens: 5, outputTokens: 2, cacheHit: false },
    })
    const ctx = {
      provider: 'gemini',
      messages: [], system: 'sys', systemBlocks: [{ type: 'text' }], search: false,
      tokens: 100, schema: null, model: 'gemini', rid: 'r',
      _providerFn: fakeProvider, _envVar: 'TEST_PROVIDER_KEY',
    }
    await callMiddleware(ctx, noop)
    const callArgs = fakeProvider.mock.calls[0][0]
    expect(callArgs.systemBlocks).toBeUndefined()
  })

  it('calls next() after setting text and rawUsage', async () => {
    let textAtNextCall = null
    const fakeProvider = vi.fn().mockResolvedValue({
      text: 'done', usage: { inputTokens: 1, outputTokens: 1, cacheHit: false },
    })
    const ctx = {
      provider: 'gemini', messages: [], system: '', search: false, tokens: 10,
      schema: null, model: 'm', rid: 'r', _providerFn: fakeProvider, _envVar: 'TEST_PROVIDER_KEY',
    }
    await callMiddleware(ctx, async () => { textAtNextCall = ctx.text })
    expect(textAtNextCall).toBe('done')
  })
})

// ── buildPipeline ─────────────────────────────────────────────────────────────

describe('buildPipeline', () => {
  it('runs middleware in order', async () => {
    const order = []
    const m1 = async (ctx, next) => { order.push('m1-before'); await next(); order.push('m1-after') }
    const m2 = async (ctx, next) => { order.push('m2-before'); await next(); order.push('m2-after') }
    const pipeline = buildPipeline([m1, m2])
    await pipeline({})
    expect(order).toEqual(['m1-before', 'm2-before', 'm2-after', 'm1-after'])
  })

  it('passes ctx through all middleware', async () => {
    const m1 = async (ctx, next) => { ctx.a = 1; await next() }
    const m2 = async (ctx, next) => { ctx.b = 2; await next() }
    const ctx = {}
    await buildPipeline([m1, m2])(ctx)
    expect(ctx.a).toBe(1)
    expect(ctx.b).toBe(2)
  })

  it('propagates errors from middleware', async () => {
    const pipeline = buildPipeline([async () => { throw new Error('boom') }])
    await expect(pipeline({})).rejects.toThrow('boom')
  })
})

// ── routeAI integration ───────────────────────────────────────────────────────
// Uses buildPipeline with a fake callMiddleware to test the full pipeline
// without hitting real APIs.

describe('routeAI integration (mocked call)', () => {
  it('returns { text, parsed: null, usage } for call without schema', async () => {
    const fakeCall = async (ctx, next) => {
      ctx.text = 'raw response'
      ctx.rawUsage = { inputTokens: 50, outputTokens: 25, cacheHit: false }
      await next()
    }
    const pipeline = buildPipeline([traceMiddleware, cacheMiddleware, fakeCall, schemaMiddleware])
    const ctx = {
      messages: [{ role: 'user', content: 'hello' }],
      system: 'be helpful', schema: undefined, cacheSystem: false,
      tokens: 100, rid: 'test-rid', op: 'test',
      provider: 'gemini', model: 'gemini-2.0-flash',
    }
    await pipeline(ctx)
    expect(ctx.text).toBe('raw response')
    expect(ctx.parsed).toBeNull()
    expect(ctx.usage.inputTokens).toBe(50)
    expect(ctx.usage.provider).toBe('gemini')
  })

  it('returns parsed object when schema provided and text is valid JSON', async () => {
    const fakeCall = async (ctx, next) => {
      ctx.text = '{"score":88,"label":"good"}'
      ctx.rawUsage = { inputTokens: 30, outputTokens: 10, cacheHit: false }
      await next()
    }
    const pipeline = buildPipeline([traceMiddleware, cacheMiddleware, fakeCall, schemaMiddleware])
    const ctx = {
      messages: [{ role: 'user', content: 'score this' }],
      system: 'you are a scorer', schema: { score: 'number', label: 'string' },
      cacheSystem: false, tokens: 100, rid: 'r', op: 'test',
      provider: 'openai', model: 'gpt-4o-mini',
    }
    await pipeline(ctx)
    expect(ctx.parsed).toEqual({ score: 88, label: 'good' })
  })
})
