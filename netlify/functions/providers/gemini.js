// Provider: Google Gemini
// Models: gemini-2.5-flash, gemini-2.5-flash-lite, gemini-2.0-flash, etc.
// Docs: https://ai.google.dev/api/generate-content

const { createLogger } = require('../lib/logger')

async function callGeminiOnce({ messages, system, search, tokens, apiKey, rid = 'no-rid' }) {
  const log = createLogger(rid)
  const model = process.env.AI_MODEL || 'gemini-2.0-flash'
  const key = apiKey || process.env.GEMINI_KEY

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const responseMimeType = search ? 'text/plain' : 'application/json'
  const generationConfig = { maxOutputTokens: tokens, responseMimeType }

  // Note: schema is not passed as responseSchema — schemaMiddleware handles validation downstream.
  // Gemini's responseSchema requires OpenAPI format (uppercase types), not validateShape descriptors.
  if (!search && model.startsWith('gemini-2.5') && !model.includes('lite')) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 }
  }

  const body = { contents, generationConfig }
  if (system) body.systemInstruction = { parts: [{ text: system }] }
  if (search) body.tools = [{ googleSearch: {} }]

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  if (!response.ok) {
    log.error('callGemini', { error: data.error?.message, status: response.status })
    throw new Error(data.error?.message || `Gemini error ${response.status}`)
  }

  const finishReason = data.candidates?.[0]?.finishReason
  const parts = data.candidates?.[0]?.content?.parts || []
  const text = parts.filter((p) => !p.thought).map((p) => p.text || '').join('\n').trim()
  const meta = data.usageMetadata || {}

  log.info('callGemini', { finishReason, textLen: text.length, tokens })

  return {
    text,
    finishReason,
    usage: {
      inputTokens:  meta.promptTokenCount     ?? 0,
      outputTokens: meta.candidatesTokenCount ?? 0,
      cacheHit:     false,
    },
  }
}

async function callGemini(opts) {
  const log = createLogger(opts.rid || 'no-rid')
  const { text, finishReason, usage } = await callGeminiOnce(opts)

  if (finishReason === 'MAX_TOKENS' && opts.tokens < 8000) {
    const retryTokens = Math.min(opts.tokens + 2000, 8000)
    log.warn('callGemini.retry', { attempt: 2, newTokens: retryTokens })
    const retry = await callGeminiOnce({ ...opts, tokens: retryTokens })
    if (retry.text) return { text: retry.text, usage: retry.usage }
  }

  if (!text) {
    throw new Error(`Gemini returned empty response. Finish reason: ${finishReason || 'unknown'}`)
  }

  return { text, usage }
}

module.exports = { callGemini }
