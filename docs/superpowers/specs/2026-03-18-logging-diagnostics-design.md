# Logging & Diagnostics — Design Spec

**Date:** 2026-03-18
**Status:** Approved
**Scope:** Local dev first; designed to expand to production later

---

## Problem

Debugging multi-step operations in Job Neuron is difficult because:
- Log statements are unstructured strings scattered across 13 function files
- No correlation between a frontend API call and its backend execution
- No way to follow a single operation (e.g. job search → AI scoring → save) through the logs
- Background job `jobId` is not echoed in server logs, making polling hard to trace

---

## Goals

1. Every log line is a structured JSON object
2. A `rid` (request ID) ties the frontend call to every backend log line it produces
3. A debug toggle (env var + UI) controls verbosity — `error` always fires regardless
4. Minimal complexity, zero new npm dependencies

---

## Architecture

### Two logger modules

#### `src/lib/logger.js` (frontend, ESM)

- Singleton `logger` object with methods: `debug`, `info`, `warn`, `error`
- `isDebug()` checks `localStorage.jh_debug === 'true'` first, falls back to `import.meta.env.VITE_DEBUG === 'true'`
- All levels except `error` are silenced when debug is off
- `error()` always calls `console.error` regardless of flag (preserves CLAUDE.md constraint)
- `logger.withRid(rid)` returns a bound copy with `rid` pre-filled on every call
- Output per level (respects CLAUDE.md's "no console.log in frontend" rule):
  - `debug` → `console.debug(JSON.stringify(...))`
  - `info` → `console.info(JSON.stringify(...))`
  - `warn` → `console.warn(JSON.stringify(...))`
  - `error` → `console.error(JSON.stringify(...))`
- `console.debug/info/warn` are acceptable here because they only emit when the user has explicitly enabled `jh_debug` — they are intentional developer output, not production noise

#### `netlify/functions/logger.js` (backend, CJS)

- Factory: `createLogger(rid)` → returns `{ debug, info, warn, error }` with `rid` baked in
- `isDebug = process.env.DEBUG === 'true'`
- Same emit rules: all levels silent when debug off except `error`
- Output: `console.log(JSON.stringify({ level, ts, rid, op, ...ctx }))` — backend has no console.log restriction

### Log line format

```json
{ "level": "info", "ts": "2026-03-18T10:23:45.123Z", "rid": "a3f9b1", "op": "callAI", "provider": "gemini", "tokens": 2000 }
```

| Field | Type | Notes |
|---|---|---|
| `level` | string | `debug` / `info` / `warn` / `error` |
| `ts` | string | ISO 8601 timestamp |
| `rid` | string | 6-char alphanumeric request ID |
| `op` | string | Operation name — camelCase, matches function/call name |
| `...ctx` | any | Arbitrary context relevant to that step |

---

## Request ID Propagation

### Generation

Each frontend API call generates a `rid` at call start:

```js
const rid = Math.random().toString(36).slice(2, 8)
```

Applies to all API call functions in `src/lib/api.js`:
- `callAI`
- `callJobsSearch`
- `callSemanticAnalyze`
- `dbGet`, `dbSet`, `dbDelete`, `dbList`
- `callAIBackground`
- `pollAIStatus` (via `pollForResult` — see below)
- `adminCall` (see Admin scope note below)

### Transport

Sent as HTTP header:
```
X-Request-ID: a3f9b1
```

### Backend extraction

Every Netlify function handler reads:
```js
const rid = event.headers['x-request-id'] || 'no-rid'
const log = createLogger(rid)
```

The `log` instance is passed down into sub-calls so the same `rid` appears at every level.

### `routeAI` signature change

`routeAI` in `ai-router.js` must accept `rid` as part of its options object:

```js
// Before
routeAI({ messages, system, search, tokens })

// After
routeAI({ messages, system, search, tokens, rid })
```

Both callers must be updated:
- `ai.js` — passes `rid` extracted from request headers
- `ai-bg-background.js` — passes `rid` extracted from request headers

All provider functions (`gemini.js`, `anthropic.js`, `openai.js`, `groq.js`) receive `rid` via the options object passed through `routeAI`.

### `pollForResult` threading

`pollForResult()` in `api.js` is the internal helper that drives all polling loops. Its signature must be extended to accept `rid` as the 4th positional argument:

```js
// Before
async function pollForResult(jobId, token, onStatus, expectJobs = false)

// After
async function pollForResult(jobId, token, onStatus, rid, expectJobs = false)
```

`rid` is forwarded as `X-Request-ID` on every poll fetch call, so each poll of `ai-status.js` carries the same `rid` as the original `callAIBackground` or `callJobsSearch` trigger. Both callers must pass their `rid` in the 4th position.

### `rid` vs `jobId` in background functions

`callAIBackground` already generates a `jobId` via `uid()` (8 chars) — used as the polling key. The `rid` (6 chars) is a separate concern: it identifies the HTTP request chain, not the background job lifecycle. Both are logged together in `ai-bg-background.js`:

```json
{ "op": "aiBgBackground", "rid": "a3f9b1", "jobId": "abc12345", "userId": "..." }
```

This lets you correlate: frontend trigger call (`rid`) ↔ background job execution (`jobId`).

### Coverage

| Frontend call | Backend chain | All logged with same `rid` |
|---|---|---|
| `callAI()` | `ai.js → ai-router.js → providers/*.js` | Yes |
| `callJobsSearch()` | `jobs-search.js` | Yes (JSearch fetch + AI scoring) |
| `callSemanticAnalyze()` | `semantic-analyze.js` | Yes |
| `dbGet/Set/Delete/List()` | `db.js` | Yes (`key` for get/set/delete; `prefix` for list) |
| `callAIBackground()` | `ai-bg-background.js → ai-router.js → providers/*.js` | Yes (also logged with `jobId`) |
| `pollAIStatus()` via `pollForResult()` | `ai-status.js` | Yes |
| `adminCall()` | `admin.js` | Yes (see Admin scope note) |

### Admin scope note

`admin.js` and `adminCall()` are included in the implementation — the `rid` header and logger are wired in consistently with all other functions. Admin requests are low-traffic but having structured logs there avoids a confusing gap in coverage.

---

## Debug Toggle

### Backend

`DEBUG=true` in `.env` — set once, applies to all local function invocations via `netlify dev`.

### Frontend

Two-layer priority:
1. `localStorage.jh_debug` — set by the Settings UI toggle; takes precedence
2. `import.meta.env.VITE_DEBUG` — set in `.env`; the default when no UI override exists

### Settings UI

A **separate "Developer tools" card** added below the existing preferences card in `Settings.jsx`. It does **not** participate in the `form` state or the "Save preferences" button flow — it writes `localStorage.jh_debug` directly on toggle and takes effect immediately (no reload needed).

```
┌─ Developer tools ─────────────────────────────────┐
│  Debug logging                          [OFF / ON] │
│  Logs structured JSON to the browser              │
│  console and Netlify function logs.               │
└───────────────────────────────────────────────────┘
```

- Reads initial state from `localStorage.jh_debug` (falls back to `VITE_DEBUG`)
- Visible to all users for their own session; no admin restriction
- Kept visually separate from the preferences save flow to make behaviour obvious

---

## Key Log Points

### Frontend (`src/lib/api.js`)

| Op | Level | Context |
|---|---|---|
| `callAI` start | `debug` | `{ op, rid, tokens }` |
| `callAI` response | `debug` | `{ op, rid, textLen }` |
| `callAI` error | `error` | `{ op, rid, error }` |
| `dbGet/Set/Delete` start | `debug` | `{ op, rid, key }` |
| `dbGet/Set/Delete` error | `error` | `{ op, rid, key, error }` |
| `dbList` start | `debug` | `{ op, rid, prefix }` |
| `dbList` error | `error` | `{ op, rid, prefix, error }` |
| `callJobsSearch` start | `debug` | `{ op, rid, query }` |
| `callSemanticAnalyze` start | `debug` | `{ op, rid }` |
| `callAIBackground` start | `debug` | `{ op, rid, action }` |
| `pollForResult` each poll | `debug` | `{ op, rid, jobId, status }` |

### Backend (`netlify/functions/`)

| File | Op | Level | Context |
|---|---|---|---|
| `ai.js` | handler received | `info` | `{ op, rid, provider }` |
| `ai.js` | handler error | `error` | `{ op, rid, error }` |
| `ai-router.js` | routing decision | `debug` | `{ op, rid, provider, model }` |
| `providers/gemini.js` | response | `info` | `{ op, rid, finishReason, textLen, tokens }` |
| `providers/gemini.js` | MAX_TOKENS retry | `warn` | `{ op, rid, attempt, newTokens }` |
| `providers/gemini.js` | error | `error` | `{ op, rid, error, status }` |
| `providers/anthropic.js` | response | `info` | `{ op, rid, textLen }` |
| `providers/anthropic.js` | error | `error` | `{ op, rid, error }` |
| `providers/openai.js` | response | `info` | `{ op, rid, textLen }` |
| `providers/openai.js` | error | `error` | `{ op, rid, error }` |
| `providers/groq.js` | response | `info` | `{ op, rid, textLen }` |
| `providers/groq.js` | error | `error` | `{ op, rid, error }` |
| `jobs-search.js` | fetch complete | `info` | `{ op, rid, rawCount }` |
| `jobs-search.js` | after filters | `info` | `{ op, rid, filteredCount }` |
| `jobs-search.js` | scoring done | `info` | `{ op, rid, scoredCount }` |
| `jobs-search.js` | error | `error` | `{ op, rid, error }` |
| `db.js` | get/set/delete | `debug` | `{ op, rid, action, key }` |
| `db.js` | list | `debug` | `{ op, rid, action, prefix }` |
| `db.js` | error | `error` | `{ op, rid, error }` |
| `semantic-analyze.js` | complete | `info` | `{ op, rid, matchCount }` |
| `semantic-analyze.js` | error | `error` | `{ op, rid, error }` |
| `ai-bg-background.js` | invoked | `info` | `{ op, rid, jobId, userId }` |
| `ai-bg-background.js` | complete | `info` | `{ op, rid, jobId }` |
| `ai-bg-background.js` | error | `error` | `{ op, rid, jobId, error }` |
| `ai-status.js` | poll result | `debug` | `{ op, rid, jobId, status }` |
| `admin.js` | handler received | `info` | `{ op, rid, action }` |
| `admin.js` | error | `error` | `{ op, rid, error }` |

---

## What Changes

| File | Change |
|---|---|
| `src/lib/logger.js` | **New** — frontend logger singleton |
| `netlify/functions/logger.js` | **New** — backend logger factory |
| `src/lib/api.js` | Add `rid` generation + `X-Request-ID` header to all API calls; thread `rid` into `pollForResult`; replace bare `console.error` with `logger.error` |
| `netlify/functions/ai.js` | Extract `rid` from headers; pass to `routeAI`; use `createLogger(rid)` |
| `netlify/functions/ai-router.js` | Accept `rid` in options object (`{ messages, system, search, tokens, rid }`); forward to provider; use `createLogger(rid)` |
| `netlify/functions/providers/gemini.js` | Accept `rid` via options; replace `console.log/error` with logger calls |
| `netlify/functions/providers/anthropic.js` | Accept `rid` via options; replace `console.log/error` with logger calls |
| `netlify/functions/providers/openai.js` | Accept `rid` via options; replace `console.log/error` with logger calls |
| `netlify/functions/providers/groq.js` | Accept `rid` via options; replace `console.log/error` with logger calls |
| `netlify/functions/jobs-search.js` | Extract `rid` from headers; use `createLogger(rid)`; replace `console.log/error`; pass `rid` as parameter to `scoreJobs(jobs, resume, rid)` so the `routeAI` call inside it forwards `rid` |
| `netlify/functions/db.js` | Extract `rid` from headers; use `createLogger(rid)`; replace `console.error` |
| `netlify/functions/semantic-analyze.js` | Extract `rid` from headers; use `createLogger(rid)`; replace `console.error` |
| `netlify/functions/admin.js` | Extract `rid` from headers; use `createLogger(rid)`; replace `console.error` |
| `netlify/functions/ai-bg-background.js` | Extract `rid` from headers; pass to `routeAI`; use `createLogger(rid)` |
| `netlify/functions/ai-status.js` | Extract `rid` from headers; use `createLogger(rid)`; add poll result log |
| `src/components/Settings.jsx` | Add "Developer tools" card with debug logging toggle (separate from save flow) |
| `.env.example` | Add `DEBUG=false` and `VITE_DEBUG=false` entries |

---

## Out of Scope

- Remote log shipping (e.g. Datadog, Logtail) — not needed for local dev
- In-app log viewer / circular buffer — natural future upgrade (Option C from design)
- Log rotation or file output — Netlify dev already captures stdout
- Admin-only debug access — any user can toggle for their own session

---

## Post-Implementation

Run the `simplify` skill after implementation to review for reuse, quality, and efficiency.
