import { vi, describe, it, expect, beforeEach } from 'vitest'
const { isLinkAlive, validateJobLinks } = await import('../lib/expiry-checker.js')

const makeJob = (url) => ({ url, title: 'Engineer', company: 'Co' })

// Helper: build a mock fetch response with optional body text and content-type
function mockResponse({ status = 200, ok = true, contentType = 'text/html', body = '' } = {}) {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(body)
  let done = false
  const reader = {
    read: vi.fn(async () => {
      if (done) return { done: true, value: undefined }
      done = true
      return { done: false, value: bytes }
    }),
    cancel: vi.fn(async () => {}),
  }
  return {
    ok,
    status,
    headers: { get: (h) => h === 'content-type' ? contentType : null },
    body: { getReader: () => reader },
  }
}

describe('isLinkAlive', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('returns true for HTTP 200 with clean body', async () => {
    global.fetch.mockResolvedValue(mockResponse({ status: 200, body: 'Apply now!' }))
    expect(await isLinkAlive('https://example.com')).toBe(true)
  })

  it('returns true for HTTP 301 redirect', async () => {
    global.fetch.mockResolvedValue(mockResponse({ status: 301, body: '' }))
    expect(await isLinkAlive('https://example.com')).toBe(true)
  })

  it('returns false for HTTP 404', async () => {
    global.fetch.mockResolvedValue(mockResponse({ ok: false, status: 404, body: '' }))
    expect(await isLinkAlive('https://example.com')).toBe(false)
  })

  it('returns false for HTTP 410 (Gone)', async () => {
    global.fetch.mockResolvedValue(mockResponse({ ok: false, status: 410, body: '' }))
    expect(await isLinkAlive('https://example.com')).toBe(false)
  })

  it('returns null for HTTP 403 (ambiguous)', async () => {
    global.fetch.mockResolvedValue(mockResponse({ ok: false, status: 403, body: '' }))
    expect(await isLinkAlive('https://example.com')).toBeNull()
  })

  it('returns null for HTTP 429 (ambiguous)', async () => {
    global.fetch.mockResolvedValue(mockResponse({ ok: false, status: 429, body: '' }))
    expect(await isLinkAlive('https://example.com')).toBeNull()
  })

  it('returns null on network error', async () => {
    global.fetch.mockRejectedValue(new Error('network error'))
    expect(await isLinkAlive('https://example.com')).toBeNull()
  })

  it('returns null on timeout (AbortError)', async () => {
    global.fetch.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    expect(await isLinkAlive('https://example.com')).toBeNull()
  })

  it('returns null for non-text content-type (binary)', async () => {
    global.fetch.mockResolvedValue(mockResponse({ status: 200, contentType: 'application/pdf', body: '' }))
    expect(await isLinkAlive('https://example.com')).toBeNull()
  })

  it('returns false when body contains "no longer accepting applications"', async () => {
    global.fetch.mockResolvedValue(mockResponse({
      status: 200,
      body: '<html><body>We are no longer accepting applications for this role.</body></html>',
    }))
    expect(await isLinkAlive('https://example.com')).toBe(false)
  })

  it('returns false when body contains "this position has been filled"', async () => {
    global.fetch.mockResolvedValue(mockResponse({
      status: 200,
      body: '<h1>This position has been filled.</h1>',
    }))
    expect(await isLinkAlive('https://example.com')).toBe(false)
  })

  it('returns false when body contains "job is no longer available"', async () => {
    global.fetch.mockResolvedValue(mockResponse({
      status: 200,
      body: 'Sorry, this job is no longer available.',
    }))
    expect(await isLinkAlive('https://example.com')).toBe(false)
  })

  it('returns false when body contains "posting has expired"', async () => {
    global.fetch.mockResolvedValue(mockResponse({
      status: 200,
      body: 'Notice: this posting has expired and is no longer active.',
    }))
    expect(await isLinkAlive('https://example.com')).toBe(false)
  })

  it('returns false when body contains "this job has been closed"', async () => {
    global.fetch.mockResolvedValue(mockResponse({
      status: 200,
      body: '<div class="status">This job has been closed.</div>',
    }))
    expect(await isLinkAlive('https://example.com')).toBe(false)
  })

  it('returns false when body contains "position is no longer open"', async () => {
    global.fetch.mockResolvedValue(mockResponse({
      status: 200,
      body: 'We regret to inform you that this position is no longer open.',
    }))
    expect(await isLinkAlive('https://example.com')).toBe(false)
  })

  it('returns true when body mentions "no longer" in an unrelated context', async () => {
    // Short phrase "no longer available" alone is NOT in the phrase list — full phrases only
    global.fetch.mockResolvedValue(mockResponse({
      status: 200,
      body: 'The old process is no longer in use. Apply now!',
    }))
    expect(await isLinkAlive('https://example.com')).toBe(true)
  })
})

describe('validateJobLinks', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('removes jobs with dead links (404)', async () => {
    global.fetch.mockResolvedValue(mockResponse({ ok: false, status: 404 }))
    const jobs = [makeJob('https://dead.com'), makeJob('https://also-dead.com')]
    expect(await validateJobLinks(jobs)).toHaveLength(0)
  })

  it('keeps jobs with alive links', async () => {
    global.fetch.mockResolvedValue(mockResponse({ status: 200, body: 'Apply here' }))
    const jobs = [makeJob('https://alive.com')]
    expect(await validateJobLinks(jobs)).toHaveLength(1)
  })

  it('keeps jobs with ambiguous links (403)', async () => {
    global.fetch.mockResolvedValue(mockResponse({ ok: false, status: 403 }))
    const jobs = [makeJob('https://blocked.com')]
    expect(await validateJobLinks(jobs)).toHaveLength(1)
  })

  it('keeps jobs with no url (cannot check)', async () => {
    const jobs = [{ title: 'No URL job', company: 'Co', url: '' }]
    expect(await validateJobLinks(jobs)).toHaveLength(1)
  })

  it('removes jobs whose body signals a closed listing', async () => {
    global.fetch.mockResolvedValue(mockResponse({
      status: 200,
      body: 'This job has been closed.',
    }))
    const jobs = [makeJob('https://closed.com')]
    expect(await validateJobLinks(jobs)).toHaveLength(0)
  })
})
