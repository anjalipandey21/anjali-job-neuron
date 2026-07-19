// AI Provider Router
// routeAI() is a thin composer: builds ctx, runs the middleware pipeline, returns result.
// Pipeline: traceMiddleware → cacheMiddleware → callMiddleware → schemaMiddleware
// Providers are injected via ctx._providerFn so callMiddleware has no import dependency on them.

const { createLogger }  = require('./lib/logger')
const { callGemini }    = require('./providers/gemini')
const { callAnthropic } = require('./providers/anthropic')
const { callOpenAI }    = require('./providers/openai')
const { callGroq }      = require('./providers/groq')
const {
  buildPipeline,
  traceMiddleware,
  cacheMiddleware,
  callMiddleware,
  schemaMiddleware,
} = require('./lib/ai-pipeline')

const PROVIDERS = {
  gemini:    callGemini,
  anthropic: callAnthropic,
  openai:    callOpenAI,
  groq:      callGroq,
}

const KEY_ENV_VARS = {
  gemini:    'GEMINI_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  openai:    'OPENAI_API_KEY',
  groq:      'GROQ_API_KEY',
}

const DEFAULT_MODELS = {
  gemini:    'gemini-2.0-flash',
  anthropic: 'claude-sonnet-4-20250514',
  openai:    'gpt-4o-mini',
  groq:      'llama-3.3-70b-versatile',
}

const SEARCH_SUPPORTED = {
  gemini:    true,
  anthropic: true,
  openai:    true,
  groq:      false,
}

const pipeline = buildPipeline([traceMiddleware, cacheMiddleware, callMiddleware, schemaMiddleware])

async function routeAI({
  messages, system, schema, cacheSystem, search,
  tokens = 2000, rid = 'no-rid', op,
}) {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase()
  if (!PROVIDERS[provider]) {
    throw new Error(`Unknown AI_PROVIDER "${provider}". Supported: ${Object.keys(PROVIDERS).join(', ')}`)
  }

  const log = createLogger(rid)
  const useSearch = search && SEARCH_SUPPORTED[provider]
  if (search && !useSearch) log.warn('routeAI.searchUnsupported', { provider })

  const ctx = {
    messages, system, schema, cacheSystem,
    search: useSearch,
    tokens, rid, op,
    provider,
    model: process.env.AI_MODEL || DEFAULT_MODELS[provider],
    // Injectable for callMiddleware — avoids circular imports
    _providerFn: PROVIDERS[provider],
    _envVar:     KEY_ENV_VARS[provider],
  }

  await pipeline(ctx)
  return { text: ctx.text, parsed: ctx.parsed ?? null, usage: ctx.usage }
}

module.exports = { routeAI, PROVIDERS, SEARCH_SUPPORTED, KEY_ENV_VARS }
