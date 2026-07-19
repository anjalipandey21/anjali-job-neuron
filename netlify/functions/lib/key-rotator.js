// Key Rotator — round-robin API key selection with automatic failover on rate limits.
//
// Usage:
//   Set comma-separated keys in env vars: GEMINI_KEY=key1,key2,key3
//   const { withKeyRotation } = require('./lib/key-rotator')
//   const result = await withKeyRotation('GEMINI_KEY', async (key) => callProvider(key))
//
// Behaviour:
//   1. Parses comma-separated keys from the named env var
//   2. Starts from a round-robin index (distributes load even without errors)
//   3. On rate-limit (429) or quota error, advances to the next key and retries
//   4. If all keys are exhausted, throws the last error

'use strict'

// Per-env-var round-robin counters (persist across requests in the same Lambda instance)
const counters = {}

function parseKeys(envVarName) {
  const raw = process.env[envVarName] || ''
  return raw.split(',').map((k) => k.trim()).filter(Boolean)
}

function isRateLimitError(err) {
  const msg = (err.message || '').toLowerCase()
  return (
    err.status === 429 ||
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('resource exhausted') ||
    msg.includes('too many requests')
  )
}

// Calls `fn(apiKey)` with round-robin key selection and retry on rate limit.
// `fn` receives a single API key string and should throw on failure.
async function withKeyRotation(envVarName, fn, log) {
  const keys = parseKeys(envVarName)
  if (keys.length === 0) {
    throw new Error(`No API keys found in ${envVarName}`)
  }

  // Single key — skip rotation overhead
  if (keys.length === 1) return fn(keys[0])

  // Round-robin starting index
  if (counters[envVarName] === undefined) counters[envVarName] = 0
  const startIdx = counters[envVarName] % keys.length
  counters[envVarName]++

  let lastError
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (startIdx + attempt) % keys.length
    const key = keys[idx]
    try {
      return await fn(key)
    } catch (err) {
      lastError = err
      if (isRateLimitError(err) && attempt < keys.length - 1) {
        if (log) log.warn('key-rotator', {
          envVar: envVarName,
          attempt: attempt + 1,
          total: keys.length,
          message: `Rate limited on key ${idx + 1}/${keys.length}, trying next`,
        })
        continue
      }
      throw err
    }
  }
  throw lastError
}

module.exports = { withKeyRotation, parseKeys, isRateLimitError }
