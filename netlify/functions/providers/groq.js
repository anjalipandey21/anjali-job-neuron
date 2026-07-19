// Provider: Groq
// Models: llama-3.3-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768, etc.
// Docs: https://console.groq.com/docs/openai
// Note: Groq uses an OpenAI-compatible API. Free tier with rate limits.
// Note: Groq does not support web search — search requests run as plain completion.
// Note: Groq does not support prompt caching — cacheSystem/systemBlocks are ignored.

const { createLogger } = require('../lib/logger')

async function callGroq({ messages, system, schema, tokens, apiKey, rid = 'no-rid' }) {
  const log = createLogger(rid)
  const key = apiKey || process.env.GROQ_API_KEY
  const body = {
    model: process.env.AI_MODEL || 'llama-3.3-70b-versatile',
    max_tokens: tokens,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages,
    ],
  }

  if (schema) {
    // json_object mode guarantees valid JSON; schemaMiddleware enforces the shape.
    // Caller MUST include the word "json" in the messages or Groq returns 400.
    body.response_format = { type: 'json_object' }
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  if (!response.ok) {
    log.error('callGroq', { error: data.error?.message, status: response.status })
    throw new Error(data.error?.message || `Groq error ${response.status}`)
  }

  const text = data.choices?.[0]?.message?.content || ''
  const usageData = data.usage || {}
  log.info('callGroq', { textLen: text.length })
  return {
    text,
    usage: {
      inputTokens:  usageData.prompt_tokens     ?? 0,
      outputTokens: usageData.completion_tokens ?? 0,
      cacheHit:     false,
    },
  }
}

module.exports = { callGroq }
