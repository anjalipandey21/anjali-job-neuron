// Netlify Function: /.netlify/functions/ai
// Secure AI proxy — routes to the configured provider via ai-router.js.
// Switch providers by changing AI_PROVIDER in Netlify environment variables.
// API keys never reach the browser.

const { routeAI } = require('./ai-router')
const { createLogger } = require('./lib/logger')

exports.handler = async (event, context) => {
  // ── Auth ──────────────────────────────────────────────────────────────────────
  const { user } = context.clientContext || {}
  if (!user) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized — please sign in.' }),
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  // ── Parse body ────────────────────────────────────────────────────────────────
  let payload
  try {
    payload = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const { messages, system, search, tokens = 2000 } = payload
  const rid = event.headers['x-request-id'] || 'no-rid'
  const log = createLogger(rid)

  log.info('ai.handler', { provider: process.env.AI_PROVIDER || 'gemini' })

  // ── Route to provider ─────────────────────────────────────────────────────────
  try {
    const { text } = await routeAI({ messages, system, search, tokens, rid })
    log.debug('ai.done', { textLen: (text || '').length })
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }
  } catch (err) {
    log.error('ai.handler', { error: err.message })
    return {
      statusCode: 502,
      body: JSON.stringify({ error: err.message }),
    }
  }
}
