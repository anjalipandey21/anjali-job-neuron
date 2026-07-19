const {
  isStaffingAgency,
  hasGoodDescription,
  isReputableSource,
  deduplicateSimilar,
  applyQualityFilters,
  isWithinDateWindow,  // replaces is60DaysOld
} = require('../jobs-search')

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeJob = (overrides = {}) => ({
  serpApiJobId: 'serpapi_job_1',
  title: 'Software Engineer',
  company: 'Acme Corp',
  description: 'A'.repeat(300),
  url: 'https://acme.com/jobs/1',
  links: [{ title: 'Acme Careers', link: 'https://acme.com/jobs/1' }],
  postedAt: new Date().toISOString(),
  sourcePlatform: 'Acme Careers',
  companyLogo: '',
  highlights: [],
  benefits: { healthInsurance: false, paidTimeOff: false, dental: false },
  jobType: 'Full-time',
  ...overrides,
})

// ── isStaffingAgency ──────────────────────────────────────────────────────────
describe('isStaffingAgency', () => {
  it('flags a known staffing agency by name', () => {
    expect(isStaffingAgency(makeJob({ company: 'Randstad Solutions' }))).toBe(true)
  })
  it('flags Robert Half', () => {
    expect(isStaffingAgency(makeJob({ company: 'Robert Half International' }))).toBe(true)
  })
  it('flags staffing keyword in first 200 chars of description', () => {
    const description = 'We are a staffing company placing candidates. ' + 'A'.repeat(300)
    expect(isStaffingAgency(makeJob({ description }))).toBe(true)
  })
  it('passes a legitimate direct employer', () => {
    expect(isStaffingAgency(makeJob({ company: 'Google LLC' }))).toBe(false)
  })
  it('passes when staffing word appears only after 200 chars', () => {
    const description = 'A'.repeat(201) + ' staffing company'
    expect(isStaffingAgency(makeJob({ company: 'Acme Corp', description }))).toBe(false)
  })
})

// ── hasGoodDescription ────────────────────────────────────────────────────────
describe('hasGoodDescription', () => {
  it('passes descriptions with 200+ characters', () => {
    expect(hasGoodDescription(makeJob({ description: 'A'.repeat(200) }))).toBe(true)
  })
  it('fails descriptions shorter than 200 characters', () => {
    expect(hasGoodDescription(makeJob({ description: 'Short desc' }))).toBe(false)
  })
  it('fails missing description', () => {
    expect(hasGoodDescription(makeJob({ description: '' }))).toBe(false)
  })
  it('fails undefined description', () => {
    expect(hasGoodDescription(makeJob({ description: undefined }))).toBe(false)
  })
})

// ── isReputableSource ─────────────────────────────────────────────────────────
describe('isReputableSource', () => {
  it('identifies a LinkedIn url as reputable', () => {
    expect(isReputableSource(makeJob({ url: 'https://linkedin.com/jobs/12345', links: [] }))).toBe(true)
  })
  it('identifies a Greenhouse link in links array as reputable', () => {
    expect(isReputableSource(makeJob({
      url: 'https://example.com',
      links: [{ title: 'Greenhouse', link: 'https://boards.greenhouse.io/acme/jobs/1' }],
    }))).toBe(true)
  })
  it('identifies amazon.jobs in links as reputable', () => {
    expect(isReputableSource(makeJob({
      url: 'https://example.com',
      links: [{ title: 'Amazon', link: 'https://amazon.jobs/en/jobs/123' }],
    }))).toBe(true)
  })
  it('returns false for an unknown source', () => {
    expect(isReputableSource(makeJob({
      url: 'https://unknownsite.com/apply',
      links: [{ title: 'Unknown', link: 'https://unknownsite.com/apply' }],
    }))).toBe(false)
  })
})

// ── deduplicateSimilar ────────────────────────────────────────────────────────
describe('deduplicateSimilar', () => {
  it('removes duplicate titles at the same company', () => {
    const jobs = [
      makeJob({ title: 'Senior Software Engineer', company: 'Acme' }),
      makeJob({ title: 'Software Engineer', company: 'Acme' }),
    ]
    expect(deduplicateSimilar(jobs)).toHaveLength(1)
  })
  it('keeps distinct roles at the same company', () => {
    const jobs = [
      makeJob({ title: 'Software Engineer', company: 'Acme' }),
      makeJob({ title: 'Data Engineer', company: 'Acme' }),
    ]
    expect(deduplicateSimilar(jobs)).toHaveLength(2)
  })
  it('keeps same title at different companies', () => {
    const jobs = [
      makeJob({ title: 'Software Engineer', company: 'Acme' }),
      makeJob({ title: 'Software Engineer', company: 'Betacorp' }),
    ]
    expect(deduplicateSimilar(jobs)).toHaveLength(2)
  })
  it('strips lead and principal prefixes when comparing', () => {
    const jobs = [
      makeJob({ title: 'Lead Software Engineer', company: 'Acme' }),
      makeJob({ title: 'Principal Software Engineer', company: 'Acme' }),
    ]
    expect(deduplicateSimilar(jobs)).toHaveLength(1)
  })
})

// ── applyQualityFilters ───────────────────────────────────────────────────────
describe('applyQualityFilters', () => {
  it('removes staffing agency jobs', () => {
    const jobs = [
      makeJob({ company: 'Randstad' }),
      makeJob({ company: 'Google' }),
    ]
    const result = applyQualityFilters(jobs)
    expect(result).toHaveLength(1)
    expect(result[0].company).toBe('Google')
  })
  it('removes jobs with short descriptions', () => {
    const jobs = [
      makeJob({ description: 'Too short' }),
      makeJob({ company: 'Acme' }),
    ]
    expect(applyQualityFilters(jobs)).toHaveLength(1)
  })
  it('sorts reputable sources before unknown sources', () => {
    const jobs = [
      makeJob({ company: 'Unknown Co', url: 'https://unknownco.com/apply', links: [] }),
      makeJob({ company: 'Acme', url: 'https://boards.greenhouse.io/acme/1', links: [] }),
    ]
    const result = applyQualityFilters(jobs)
    expect(result[0].company).toBe('Acme')
  })
})

// ── isWithinDateWindow ────────────────────────────────────────────────────────
describe('isWithinDateWindow', () => {
  it('returns true for a job posted today (30-day window)', () => {
    expect(isWithinDateWindow(new Date().toISOString(), 30)).toBe(true)
  })
  it('returns true for a job posted 29 days ago (30-day window)', () => {
    const d = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)
    expect(isWithinDateWindow(d.toISOString(), 30)).toBe(true)
  })
  it('returns false for a job posted 31 days ago (30-day window)', () => {
    const d = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    expect(isWithinDateWindow(d.toISOString(), 30)).toBe(false)
  })
  it('returns true for a job posted 59 days ago (60-day window)', () => {
    const d = new Date(Date.now() - 59 * 24 * 60 * 60 * 1000)
    expect(isWithinDateWindow(d.toISOString(), 60)).toBe(true)
  })
  it('returns false for a job posted 61 days ago (60-day window)', () => {
    const d = new Date(Date.now() - 61 * 24 * 60 * 60 * 1000)
    expect(isWithinDateWindow(d.toISOString(), 60)).toBe(false)
  })
  it('returns false for a missing date', () => {
    expect(isWithinDateWindow(null, 30)).toBe(false)
    expect(isWithinDateWindow(undefined, 30)).toBe(false)
  })
})
