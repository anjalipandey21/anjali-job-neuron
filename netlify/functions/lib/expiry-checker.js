'use strict'

const decoder = new TextDecoder()

const DEAD_PHRASES = [
  'no longer accepting applications',
  'this position has been filled',
  'job is no longer available',
  'posting has expired',
  'this job has been closed',
  'position is no longer open',
]

// Reads up to maxBytes from a fetch response body stream, returns decoded string.
// Returns null if content-type is not text or on read error.
async function readBodyPrefix(res, maxBytes = 8192) {
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('text/') && !ct.includes('application/xhtml')) return null
  try {
    const reader = res.body.getReader()
    const chunks = []
    let total = 0
    while (total < maxBytes) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      total += value.length
    }
    await reader.cancel()
    const combined = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length }
    return decoder.decode(combined)
  } catch {
    return null
  }
}

// Returns true (alive), false (definitively dead), or null (ambiguous/error).
async function isLinkAlive(url, timeoutMs = 2000) {
  if (!url) return null
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, { method: 'GET', signal: controller.signal, redirect: 'follow' })
    clearTimeout(timer)
    if (res.status === 404 || res.status === 410) return false
    if (res.status < 200 || res.status >= 400) return null
    const text = await readBodyPrefix(res)
    if (text === null) return null
    const lower = text.toLowerCase()
    if (DEAD_PHRASES.some((p) => lower.includes(p))) return false
    return true
  } catch {
    return null
  }
}

// Runs isLinkAlive in batches of `concurrency`.
// Returns jobs array with definitively-dead-link jobs removed.
// Jobs with ambiguous results (null) or no URL are kept.
async function validateJobLinks(jobs, concurrency = 10) {
  const results = []
  for (let i = 0; i < jobs.length; i += concurrency) {
    const batch = jobs.slice(i, i + concurrency)
    const checks = await Promise.all(batch.map((j) => isLinkAlive(j.url)))
    for (let k = 0; k < batch.length; k++) {
      if (checks[k] !== false) results.push(batch[k])
    }
  }
  return results
}

module.exports = { isLinkAlive, validateJobLinks }
