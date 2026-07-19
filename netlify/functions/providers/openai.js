// Provider: OpenAI (ChatGPT)
// Models: gpt-4o, gpt-4o-mini, o3-mini, etc.
// Docs: https://platform.openai.com/docs/api-reference/chat

const { createLogger } = require('../lib/logger')

async function callOpenAI({ messages, system, search, schema, tokens, apiKey, rid = 'no-rid' }) {
  const log = createLogger(rid)
  const key = apiKey || process.env.OPENAI_API_KEY
  const body = {
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    max_tokens: tokens,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages,
    ],
  }

  if (search) {
    body.tools = [{ type: 'web_search_preview' }]
    body.tool_choice = 'auto'
  } else if (schema) {
    // json_object mode guarantees valid JSON; schemaMiddleware enforces the shape.
    // Caller MUST include the word "json" in the messages or OpenAI returns 400.
    body.response_format = { type: 'json_object' }
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  if (!response.ok) {
    log.error('callOpenAI', { error: data.error?.message, status: response.status })
    throw new Error(data.error?.message || `OpenAI error ${response.status}`)
  }

  const text = data.choices?.[0]?.message?.content || ''
  const usageData = data.usage || {}
  log.info('callOpenAI', { textLen: text.length })
  return {
    text,
    usage: {
      inputTokens:  usageData.prompt_tokens     ?? 0,
      outputTokens: usageData.completion_tokens ?? 0,
      cacheHit:     false,
    },
  }
}

module.exports = { callOpenAI }
