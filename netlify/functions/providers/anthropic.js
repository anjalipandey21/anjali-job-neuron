// Provider: Anthropic (Claude)
// Models: claude-sonnet-4-20250514, claude-haiku-4-5-20251001, etc.
// Docs: https://docs.anthropic.com/en/api/messages

const { createLogger } = require('../lib/logger')

async function callAnthropic({ messages, system, systemBlocks, search, tokens, apiKey, rid = 'no-rid' }) {
  const log = createLogger(rid)
  const key = apiKey || process.env.ANTHROPIC_API_KEY
  const body = {
    model: process.env.AI_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: tokens,
    messages,
  }

  // systemBlocks (set by cacheMiddleware) takes precedence over plain system string
  if (systemBlocks) {
    body.system = systemBlocks
  } else if (system) {
    body.system = system
  }

  if (search) body.tools = [{ type: 'web_search_20250305', name: 'web_search' }]

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  if (!response.ok) {
    log.error('callAnthropic', { error: data.error?.message, status: response.status })
    throw new Error(data.error?.message || `Anthropic error ${response.status}`)
  }

  const text = (data.content || []).map((b) => b.text || '').filter(Boolean).join('\n')
  const usageData = data.usage || {}
  const cacheHit = (usageData.cache_read_input_tokens ?? 0) > 0

  log.info('callAnthropic', { textLen: text.length, cacheHit })
  return {
    text,
    usage: {
      inputTokens:  usageData.input_tokens  ?? 0,
      outputTokens: usageData.output_tokens ?? 0,
      cacheHit,
    },
  }
}

module.exports = { callAnthropic }
