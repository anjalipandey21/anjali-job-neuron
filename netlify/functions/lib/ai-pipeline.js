'use strict'

const { createLogger } = require('./logger')
const { withKeyRotation } = require('./key-rotator')

// ── SchemaValidationError ─────────────────────────────────────────────────────

class SchemaValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SchemaValidationError'
  }
}

// ── validateShape ─────────────────────────────────────────────────────────────
// Validates `parsed` against a ShapeDescriptor. Throws SchemaValidationError on mismatch.
// ShapeDescriptor forms:
//   Primitive:  'string' | 'number' | 'boolean'
//   Array:      { type: 'array', items: ShapeDescriptor }
//   Object:     { type: 'object', props: { key: ShapeDescriptor } }
//   Shorthand:  { key: 'string' | 'number' | 'boolean' }  (implies type:'object')
// Rules: required keys must be present; extra keys allowed; typeof checks; recursive.

function validateShape(value, schema) {
  // Array schema
  if (schema && schema.type === 'array') {
    if (!Array.isArray(value)) {
      throw new SchemaValidationError(`expected array, got ${typeof value}`)
    }
    for (let i = 0; i < value.length; i++) {
      validateShape(value[i], schema.items)
    }
    return
  }

  // Object schema (explicit type:'object' with props)
  if (schema && schema.type === 'object') {
    _validateObjectProps(value, schema.props)
    return
  }

  // Primitive type string
  if (typeof schema === 'string') {
    if (value === null || value === undefined || typeof value !== schema) {
      throw new SchemaValidationError(`expected ${schema}, got ${value === null ? 'null' : typeof value}`)
    }
    return
  }

  // Shorthand object { key: 'type', ... }
  if (schema && typeof schema === 'object') {
    _validateObjectProps(value, schema)
  }
}

function _validateObjectProps(obj, props) {
  if (obj === null || obj === undefined || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new SchemaValidationError(`expected object, got ${obj === null ? 'null' : typeof obj}`)
  }
  for (const [key, childSchema] of Object.entries(props)) {
    if (!(key in obj)) {
      throw new SchemaValidationError(`missing key: ${key}`)
    }
    validateShape(obj[key], childSchema)
  }
}

// ── schemaMiddleware ──────────────────────────────────────────────────────────

async function schemaMiddleware(ctx, next) {
  await next()
  if (!ctx.schema) {
    ctx.parsed = null
    return
  }
  let parsed
  const text = (ctx.text || '').trim()
  // Attempt 1: direct parse
  try { parsed = JSON.parse(text) } catch { parsed = null }
  // Attempt 2: extract array
  if (parsed === null) {
    const arrMatch = text.match(/\[[\s\S]*\]/)
    if (arrMatch) try { parsed = JSON.parse(arrMatch[0]) } catch {}
  }
  // Attempt 3: extract object
  if (parsed === null) {
    const objMatch = text.match(/\{[\s\S]*\}/)
    if (objMatch) try { parsed = JSON.parse(objMatch[0]) } catch {}
  }
  if (parsed === null) {
    throw new SchemaValidationError(`could not parse JSON from response: ${text.slice(0, 100)}`)
  }
  validateShape(parsed, ctx.schema)
  ctx.parsed = parsed
}

// ── cacheMiddleware ───────────────────────────────────────────────────────────

async function cacheMiddleware(ctx, next) {
  if (ctx.provider === 'anthropic' && ctx.cacheSystem === true && ctx.system) {
    ctx.systemBlocks = [
      { type: 'text', text: ctx.system, cache_control: { type: 'ephemeral' } },
    ]
    // ctx.system is NOT mutated — Anthropic provider reads systemBlocks when present
  }
  await next()
}

// ── traceMiddleware ───────────────────────────────────────────────────────────

async function traceMiddleware(ctx, next) {
  const log = createLogger(ctx.rid || 'no-rid')
  ctx._startTime = Date.now()
  try {
    await next()
  } finally {
    const latencyMs = Date.now() - ctx._startTime
    delete ctx._startTime
    ctx.usage = {
      provider:     ctx.provider,
      model:        ctx.model,
      inputTokens:  ctx.rawUsage?.inputTokens  ?? 0,
      outputTokens: ctx.rawUsage?.outputTokens ?? 0,
      latencyMs,
      cacheHit:     ctx.rawUsage?.cacheHit     ?? false,
    }
    log.metric('ai.usage', { callOp: ctx.op ?? 'unknown', ...ctx.usage })
  }
}

// ── callMiddleware ────────────────────────────────────────────────────────────
// Requires ctx._providerFn and ctx._envVar to be set by routeAI() before pipeline runs.

async function callMiddleware(ctx, next) {
  if (typeof ctx._providerFn !== 'function') {
    throw new Error('callMiddleware requires ctx._providerFn — inject it via routeAI()')
  }
  if (!ctx._envVar) {
    throw new Error('callMiddleware requires ctx._envVar — inject it via routeAI()')
  }
  const log = createLogger(ctx.rid || 'no-rid')

  const baseArgs = {
    messages: ctx.messages,
    system:   ctx.system,
    search:   ctx.search,
    tokens:   ctx.tokens,
    schema:   ctx.schema,
    model:    ctx.model,
    rid:      ctx.rid,
  }
  // Only Anthropic receives systemBlocks; all other providers are unaware of it
  if (ctx.provider === 'anthropic') baseArgs.systemBlocks = ctx.systemBlocks

  const result = await withKeyRotation(
    ctx._envVar,
    (apiKey) => ctx._providerFn({ ...baseArgs, apiKey }),
    log,
  )
  ctx.text     = result.text
  ctx.rawUsage = result.usage
  await next()
}

// ── buildPipeline ─────────────────────────────────────────────────────────────

function buildPipeline(middlewares) {
  return async function runPipeline(ctx) {
    let i = 0
    const next = async () => {
      if (i < middlewares.length) await middlewares[i++](ctx, next)
    }
    await next()
    return ctx
  }
}

module.exports = {
  SchemaValidationError, validateShape,
  schemaMiddleware, cacheMiddleware, traceMiddleware, callMiddleware,
  buildPipeline,
}
