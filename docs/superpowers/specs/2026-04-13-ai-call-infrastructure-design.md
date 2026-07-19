# AI Call Infrastructure — Design Spec
**Date:** 2026-04-13
**Status:** Approved
**Scope:** Group A of the AI infrastructure upgrade (Groups B and C are separate specs)

---

## Problem Statement

The current AI call layer has three gaps:

1. **No structured output enforcement.** Callers like `scoreJobs()` embed 4-tier JSON fallback logic and silently default to 70% match scores when parsing fails. For the upcoming AI job apply feature, a wrong field value gets submitted to a real employer — silent defaults are unacceptable.

2. **No prompt caching.** The user's resume text (800–2000 tokens) is re-processed on every AI call. With Anthropic's explicit `cache_control` and Gemini/OpenAI's automatic prefix caching, this is free latency and cost reduction.

3. **No token/latency visibility.** Providers return usage data in every response — we discard it. There is no way to know how much an operation costs or how long it took without enabling `DEBUG=true`.

---

## Decision: Middleware Pipeline (Approach 3)

`routeAI()` is refactored into a middleware pipeline. Each concern gets a dedicated middleware with one job. The **external interface is additive** — existing callers that pass no new params and destructure only `{ text }` continue to work without changes. The pipeline is the extension point for AI job apply (retry, audit, human checkpoint middleware slot in without touching existing middleware).

Current `routeAI()` returns `{ text }`. New return is `{ text, parsed, usage }` — purely additive.

---

## Architecture

### New File: `netlify/functions/lib/ai-pipeline.js`

Owns the pipeline runner, all four middleware functions, `SchemaValidationError`, and `validateShape()`.

**Pipeline runner** — Koa-style `(ctx, next)`:

```js
async function runPipeline(middlewares, ctx) {
  let i = 0
  const next = async () => { if (i < middlewares.length) await middlewares[i++](ctx, next) }
  await next()
  return ctx
}
```

Exported as `buildPipeline(middlewares)` returning `(ctx) => runPipeline(middlewares, ctx)` so tests can inject fake middleware without the CJS `vi.mock()` limitation (see Testing section).

**Execution order:**
```
traceMiddleware → cacheMiddleware → callMiddleware → schemaMiddleware
```

---

### Context Object

Passed through every middleware. Middleware reads from and writes to this object. Type contracts are strict — no middleware may mutate a field owned by another middleware.

```js
{
  // ── Input — set by routeAI() before pipeline runs ──────────────────────────
  messages,       // { role: string, content: string }[]
  system,         // string — NEVER mutated after pipeline starts
  schema,         // optional ShapeDescriptor (see validateShape section)
  cacheSystem,    // boolean — whether to cache the system prompt on Anthropic
  tokens,         // number — max output tokens
  rid,            // string — request ID for log correlation
  op,             // string — caller label, used ONLY in log output (not routing)
  search,         // boolean — passed through to providers unchanged; existing behaviour preserved
  provider,       // 'gemini' | 'anthropic' | 'openai' | 'groq'
  model,          // string — resolved from AI_MODEL env or DEFAULT_MODELS[provider]

  // ── Set by cacheMiddleware (Anthropic only) ─────────────────────────────────
  systemBlocks,   // Anthropic content block array with cache_control, or undefined
                  // All non-Anthropic providers ignore this field entirely
                  // ctx.system is NEVER mutated — providers read systemBlocks if present

  // ── Set by callMiddleware ───────────────────────────────────────────────────
  apiKey,         // string — resolved by key rotation inside callMiddleware
  text,           // string — raw text response from provider
  rawUsage,       // { inputTokens: number, outputTokens: number, cacheHit: boolean }
                  // cacheHit: true only on Anthropic when cache_read_input_tokens > 0
                  // cacheHit: false for Gemini, OpenAI, Groq (they do not report it)

  // ── Set by schemaMiddleware ─────────────────────────────────────────────────
  parsed,         // validated JS object when schema passed, null otherwise

  // ── Set by traceMiddleware (after next() returns) ───────────────────────────
  usage,          // { provider, model, inputTokens, outputTokens, latencyMs, cacheHit }
                  // Assembled from ctx.rawUsage by traceMiddleware after next() completes

  // ── Internal ────────────────────────────────────────────────────────────────
  _startTime,     // number — Date.now() set by traceMiddleware before calling next()
}
```

---

## The Four Middleware

### 1. `traceMiddleware`

First in pipeline. Measures total latency including all downstream middleware.

```js
async function traceMiddleware(ctx, next) {
  ctx._startTime = Date.now()
  await next()
  // rawUsage is now set by callMiddleware
  ctx.usage = {
    provider:     ctx.provider,
    model:        ctx.model,
    inputTokens:  ctx.rawUsage?.inputTokens  ?? 0,
    outputTokens: ctx.rawUsage?.outputTokens ?? 0,
    latencyMs:    Date.now() - ctx._startTime,
    cacheHit:     ctx.rawUsage?.cacheHit     ?? false,
  }
  log.metric('ai.usage', { op: ctx.op ?? 'unknown', ...ctx.usage })
}
```

`ai.usage` is **always emitted** — not gated behind `DEBUG=true`. This requires a new `metric` level on the logger (see Logger Change below).

### Logger Change (`netlify/functions/lib/logger.js`)

The existing logger gates `debug`/`info`/`warn` behind `DEBUG=true` and only `error` always fires. This spec adds a `metric` level that always emits like `error` but uses `console.log` (not `console.error`) so it doesn't pollute the error stream:

```js
// Added to emit():
if (level === 'metric') { console.log(line); return }

// Added to createLogger():
metric: (op, ctx = {}) => emit('metric', rid, op, ctx),
```

`metric` is used exclusively for operational measurements (token counts, latency, cost). It is not a severity level — it is a signal type. Only `traceMiddleware` calls `log.metric()`; all other code continues to use `debug`/`info`/`warn`/`error`.

`netlify/functions/lib/logger.js` is added to the Files Changed list.

---

### 2. `cacheMiddleware`

**Anthropic only.** When `ctx.provider === 'anthropic'` and `ctx.cacheSystem === true`:

```js
ctx.systemBlocks = [
  { type: 'text', text: ctx.system, cache_control: { type: 'ephemeral' } }
]
```

`ctx.system` is NOT mutated. The Anthropic provider reads `ctx.systemBlocks` when present; all other providers read `ctx.system` (the original string) and never see `systemBlocks`.

If `cacheSystem` is `false` or absent — even on Anthropic — `ctx.systemBlocks` is left unset (remains `undefined`). The Anthropic provider falls back to `ctx.system` as a plain string in that case.

**For Gemini, OpenAI, Groq:** This middleware is a no-op regardless of `cacheSystem` value. Gemini and OpenAI cache automatically on identical content prefixes above their token thresholds (~1024 tokens) — no markup needed. Groq does not support caching. Callers may freely set `cacheSystem: true` without knowing the active provider; it has zero effect outside Anthropic.

---

### 3. `callMiddleware`

Selects the provider function from `PROVIDERS` map, resolves the API key via `withKeyRotation()`, calls the provider, and sets `ctx.text` and `ctx.rawUsage`.

`ctx.systemBlocks` is `undefined` by default (not set at pipeline entry — only `cacheMiddleware` sets it, and only for Anthropic). `callMiddleware` passes a provider-specific argument object, **not the full ctx**:

- **Anthropic:** `{ messages, system, systemBlocks, search, tokens, schema, apiKey, model, rid }` — receives `systemBlocks` (may be undefined; provider checks `if (systemBlocks)` before using it)
- **Gemini, OpenAI, Groq:** `{ messages, system, search, tokens, schema, apiKey, model, rid }` — `systemBlocks` is NOT passed; these providers have no awareness of it

`search` is passed to all providers unchanged — existing web-search behaviour is fully preserved. `schema` and `search` are mutually exclusive in practice (search mode returns prose, not JSON), but the spec does not enforce this; providers that don't support search ignore the flag.

This makes the boundary explicit in code, not just in documentation. A future provider cannot accidentally receive `systemBlocks` unless `callMiddleware` explicitly adds it to that provider's argument object.

Each provider returns:

```js
{ text: string, usage: { inputTokens: number, outputTokens: number, cacheHit: boolean } }
```

`callMiddleware` maps `usage` → `ctx.rawUsage`. Key rotation and provider selection remain here — they are concerns of the call step, not of the pipeline runner.

---

### 4. `schemaMiddleware`

**Active only when `ctx.schema` is set.** No-op otherwise (`ctx.parsed = null`).

When schema is present:
1. Attempt `JSON.parse(ctx.text.trim())`
2. If that fails, attempt extraction via `ctx.text.match(/\[[\s\S]*\]/)` or `/\{[\s\S]*\}/` (JSON embedded in prose)
3. Run `validateShape(parsed, ctx.schema)`
4. On success: `ctx.parsed = parsed`
5. On any failure: throw `new SchemaValidationError(detail)`

`SchemaValidationError` is a named class extending `Error` with a `detail` field describing the mismatch. It propagates up through `runPipeline` → `routeAI()` to the caller. `routeAI()` does **not** catch it — error handling is the caller's responsibility (see Error Handling section).

---

## `validateShape()` — Schema Format

A lightweight structural validator. No external dependencies. Schema is a plain JS **ShapeDescriptor**:

```js
// Primitive type string: 'string' | 'number' | 'boolean'
// Array of objects: { type: 'array', items: ShapeDescriptor }
// Object:          { type: 'object', props: { key: ShapeDescriptor } }
//                  OR a plain { key: 'string' | 'number' | 'boolean' } shorthand
```

**Examples:**

```js
// Array of scoring results
{ type: 'array', items: { idx: 'number', matchScore: 'number', reason: 'string' } }

// Single object
{ type: 'object', props: { score: 'number', feedback: 'string' } }

// Shorthand (equivalent to type:'object' with props)
{ score: 'number', feedback: 'string' }
```

**Validation rules:**
- All keys in the ShapeDescriptor must be present in the parsed object (required by default)
- Extra keys in the parsed object are allowed (non-strict)
- Type check uses `typeof` — no coercion
- For `type: 'array'`: checks `Array.isArray()`, then validates each element against `items`
- Nested objects are validated recursively
- `null` values fail type checks (a `null` field does not satisfy `'string'`)

`validateShape()` is exported from `ai-pipeline.js` for direct unit testing.

---

## Provider Changes

Each provider sheds cache markup logic (moved to `cacheMiddleware`) and returns `usage` alongside `text`.

### Gemini (`providers/gemini.js`)

- When `schema` is passed: adds `responseSchema` to `generationConfig` alongside the existing `responseMimeType: 'application/json'`. Both fields are already set for non-search mode — `responseSchema` is additive. No model-conditional special-casing needed; `responseSchema` is supported on all current Gemini models including `gemini-2.5-flash-lite` (only `thinkingConfig` is restricted on that model per CLAUDE.md).
- `cacheSystem` / `systemBlocks` are ignored — Gemini receives `ctx.system` as a string always.
- Reads `data.usageMetadata.promptTokenCount` and `candidatesTokenCount`.
- **MAX_TOKENS retry branch:** The existing `callGemini` retries on `MAX_TOKENS` with increased token budget. The retry path must also return `{ text, usage: { inputTokens, outputTokens, cacheHit: false } }` — specifically, `inputTokens` and `outputTokens` from the *retry* response's `usageMetadata`. If the retry response lacks `usageMetadata`, default to `{ inputTokens: 0, outputTokens: 0, cacheHit: false }`. The first attempt's usage is discarded when a retry succeeds — only the final successful response's usage is reported.
- Returns `{ text, usage: { inputTokens, outputTokens, cacheHit: false } }`.

### Anthropic (`providers/anthropic.js`)

- When `systemBlocks` is present in args (set by `cacheMiddleware`): passes `body.system = systemBlocks`. When absent: passes `body.system = system` as a string (existing behaviour).
- JSON mode: when `schema` is passed, adds `response_format` (note: Anthropic does not have a native `json_schema` response format as of 2025; JSON mode is achieved via prompt instruction. The system prompt already requests JSON. The spec does not add `response_format` to Anthropic — schema enforcement is handled entirely by `schemaMiddleware` after the fact).
- Reads `data.usage.input_tokens`, `output_tokens`, `cache_read_input_tokens`.
- `cacheHit = (data.usage.cache_read_input_tokens ?? 0) > 0`.
- Returns `{ text, usage: { inputTokens, outputTokens, cacheHit } }`.

### OpenAI (`providers/openai.js`)

- When `schema` is passed: adds `response_format: { type: 'json_object' }`. (Native `json_schema` enforcement with `strict` mode has schema restrictions that would require transforming the ShapeDescriptor — not worth the complexity; `json_object` + `schemaMiddleware` validation gives equivalent safety.)
- Reads `data.usage.prompt_tokens` and `completion_tokens`.
- Returns `{ text, usage: { inputTokens, outputTokens, cacheHit: false } }`.

### Groq (`providers/groq.js`)

- When `schema` is passed: adds `response_format: { type: 'json_object' }`.
- Caching not supported — `systemBlocks` is ignored.
- Reads `data.usage.prompt_tokens` and `completion_tokens`.
- Returns `{ text, usage: { inputTokens, outputTokens, cacheHit: false } }`.

---

## `routeAI()` — New Implementation

`ai-router.js` becomes a thin composer:

```js
const DEFAULT_MODELS = {
  gemini:    'gemini-2.0-flash',
  anthropic: 'claude-sonnet-4-20250514',
  openai:    'gpt-4o-mini',
  groq:      'llama-3.3-70b-versatile',
}

async function routeAI({ messages, system, schema, cacheSystem, search, tokens = 2000, rid = 'no-rid', op }) {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase()
  if (!PROVIDERS[provider]) throw new Error(`Unknown AI_PROVIDER "${provider}"`)

  const ctx = {
    messages, system, schema, cacheSystem, search, tokens, rid, op,
    provider,
    model: process.env.AI_MODEL || DEFAULT_MODELS[provider],
  }

  await pipeline(ctx)  // pipeline = buildPipeline([traceMiddleware, cacheMiddleware, callMiddleware, schemaMiddleware])
  return { text: ctx.text, parsed: ctx.parsed ?? null, usage: ctx.usage }
}
```

The `pipeline` is built once at module load time via `buildPipeline(...)` and reused across invocations.

---

## Error Handling Contract

`SchemaValidationError` propagates from `schemaMiddleware` → `routeAI()` → caller. `routeAI()` does not catch it.

**Caller responsibilities:**

- **`scoreJobs()` in `job-search-core.js`:** Wraps `routeAI()` in a try/catch. On `SchemaValidationError` (or any error): logs the error, falls back to a map of `{ matchScore: 70, reason: '' }` for all jobs (existing fallback behaviour, now explicit rather than silent). This is acceptable for job scoring — a degraded match score is better than a failed search.

- **`ai-bg-background.js`:** Already wraps AI calls in try/catch and sets `bg_jobs.status = 'error'` with the error message. `SchemaValidationError` flows into this existing error path — no special handling needed.

- **Future AI job apply callers:** Must NOT swallow `SchemaValidationError`. For job apply, a schema failure means the AI could not produce a reliable structured answer — the correct response is to surface the error to the user and not submit the application.

---

## Updated Callers

### `scoreJobs()` in `job-search-core.js`

**Prompt restructure** — resume moves to `system` (stable, cached); jobs stay in user message (variable):

```js
const { parsed } = await routeAI({
  system: `You are a resume-job matcher.\n\nCandidate resume:\n${resumeText.slice(0, 1500)}\n\nTarget roles: ${targetRoles}`,
  messages: [{
    role: 'user',
    content: `Score each job 0-100 for fit. Return ONLY a JSON array:\n[{"idx":0,"matchScore":85,"reason":"..."}]\n\nJobs:\n${JSON.stringify(jobSummaries)}`
  }],
  schema: { type: 'array', items: { idx: 'number', matchScore: 'number', reason: 'string' } },
  cacheSystem: true,
  tokens: 4000,
  rid,
  op: 'scoreJobs',
})

// parsed is the validated array, or null if SchemaValidationError was thrown and caught
const scores = (parsed || []).reduce((map, item) => {
  map[item.idx] = { matchScore: item.matchScore || 70, reason: item.reason || '' }
  return map
}, {})
```

The 4-tier `parseJSON()` fallback block is removed entirely.

### `ai-bg-background.js`

Passes `cacheSystem: true`, a schema matching the ATS scan response shape, and `op: 'atsScan'`. Existing try/catch error handling is unchanged.

### All other existing callers

Pass nothing new. Receive `{ text, parsed: null, usage }`. Existing destructuring of `{ text }` continues to work.

---

## `routeAI()` Return Value

```js
// Before
{ text: string }

// After (additive — existing destructuring unchanged)
{
  text:   string,                   // always present
  parsed: object | array | null,    // non-null only when schema was passed and validated
  usage:  {
    provider:     string,
    model:        string,
    inputTokens:  number,
    outputTokens: number,
    latencyMs:    number,
    cacheHit:     boolean,
  }
}
```

---

## Future Extension Points

When AI job apply is implemented, the pipeline gains middleware without touching existing code:

```
traceMiddleware → cacheMiddleware → retryMiddleware → callMiddleware → schemaMiddleware → auditMiddleware
```

- **`retryMiddleware`** — if `schemaMiddleware` throws `SchemaValidationError`, re-prompts with stricter instructions and retries once before propagating
- **`auditMiddleware`** — writes a permanent record of every AI job apply decision to a dedicated audit table
- **`humanCheckpointMiddleware`** — pauses execution and requires explicit user confirmation before submitting to a real employer

---

## Files Changed

| File | Change |
|---|---|
| `netlify/functions/lib/ai-pipeline.js` | **New** — pipeline runner (`buildPipeline`), 4 middleware, `SchemaValidationError`, `validateShape()` |
| `netlify/functions/lib/logger.js` | Adds `metric` level — always emits via `console.log`, not DEBUG-gated |
| `netlify/functions/ai-router.js` | Refactored — thin composer, `DEFAULT_MODELS`, builds pipeline at module load |
| `netlify/functions/providers/gemini.js` | Returns `usage`; adds `responseSchema` support; retry branch returns full `{ text, usage }` |
| `netlify/functions/providers/anthropic.js` | Returns `usage` + `cacheHit`; reads `systemBlocks` when present |
| `netlify/functions/providers/openai.js` | Returns `usage`; adds `json_object` response format when schema |
| `netlify/functions/providers/groq.js` | Returns `usage`; adds `json_object` response format when schema |
| `netlify/functions/lib/job-search-core.js` | `scoreJobs()` restructured prompt, uses `parsed`, removes JSON fallback |
| `netlify/functions/ai-bg-background.js` | Passes `cacheSystem`, `schema`, `op` |

---

## Testing

### Strategy — avoiding the CJS mock limitation

`ai-pipeline.js` exports `buildPipeline(middlewares)`. Tests import this directly and compose pipelines with fake/stub middleware — no `vi.mock()` of third-party packages needed.

```js
// Example: test schemaMiddleware in isolation
import { schemaMiddleware, SchemaValidationError } from '../lib/ai-pipeline.js'
const ctx = { text: '[{"idx":0,"matchScore":85,"reason":"good"}]', schema: { type: 'array', items: { idx: 'number', matchScore: 'number', reason: 'string' } } }
await schemaMiddleware(ctx, async () => {})
assert.deepEqual(ctx.parsed[0].matchScore, 85)
```

### Test cases

**`validateShape()`**
- Valid flat object shape — passes
- Valid array shape — passes
- Missing required key — throws with key name in message
- Wrong type (string where number expected) — throws
- Nested object — validates recursively
- Extra keys in parsed object — passes (non-strict)
- `null` value for required field — throws

**`logger.js` — `metric` level**
- `log.metric()` emits when `DEBUG=false` (unlike `info`/`debug`/`warn`)
- `log.metric()` writes to `console.log`, not `console.error`
- Existing `debug`/`info`/`warn`/`error` behaviour unchanged

**`traceMiddleware`**
- Sets `ctx.usage` with correct fields after `next()` completes
- Calls `log.metric('ai.usage', ...)` — emits regardless of `DEBUG` env var
- `latencyMs` is a positive number

**Gemini provider — MAX_TOKENS retry**
- When retry succeeds, returned `usage` reflects retry response's token counts
- When retry response lacks `usageMetadata`, `usage` defaults to `{ inputTokens: 0, outputTokens: 0, cacheHit: false }`

**`cacheMiddleware`**
- Anthropic + `cacheSystem: true` → sets `ctx.systemBlocks`, does NOT mutate `ctx.system`
- Anthropic + `cacheSystem: false` → `ctx.systemBlocks` is undefined
- Non-Anthropic (any value of `cacheSystem`) → `ctx.systemBlocks` is undefined

**`callMiddleware`**
- Sets `ctx.text` and `ctx.rawUsage` from provider return value
- Calls `withKeyRotation` with the correct env var name for the provider
- Anthropic call: provider function receives `systemBlocks` in its argument object
- Gemini/OpenAI/Groq call: provider function's argument object does NOT contain `systemBlocks`

**`schemaMiddleware`**
- Valid JSON matching schema → `ctx.parsed` set correctly
- Valid JSON with extra fields → passes (non-strict)
- JSON embedded in prose → extracted and parsed
- Parse failure → throws `SchemaValidationError`
- Validation failure → throws `SchemaValidationError` with detail
- No schema passed → `ctx.parsed = null`, no throw

**`routeAI()` integration (mocked provider via `buildPipeline`)**
- Full pipeline executes in correct order (trace → cache → call → schema)
- Return value includes `text`, `parsed`, `usage`
- Existing callers destructuring only `{ text }` receive correct value

**Regression**
- All existing tests in `netlify/functions/__tests__/` pass without modification
- `jobs-search.test.js` — `scoreJobs()` still returns correct match scores
