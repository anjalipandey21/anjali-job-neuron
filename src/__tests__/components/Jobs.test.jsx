import { describe, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { callAIBackground, dbGet } from '../../lib/api'

vi.mock('../../lib/api', () => ({
  dbGet: vi.fn().mockResolvedValue(null),
  dbSet: vi.fn().mockResolvedValue(undefined),
  callAI: vi.fn(),
  callJobsSearch: vi.fn(),
  callAIBackground: vi.fn(),
}))

import { Jobs } from '../../components/Jobs'

const profile = { id: 'p1', name: 'Test User' }

const profileWithResume = {
  resumeText: 'Python developer with 5 years building data pipelines on AWS using SQL, Kafka, and Spark.',
  analyzedResume: { targetRoles: ['Data Engineer'] },
  preferences: {},
}

const profileNoResume = {
  resumeText: '',
  analyzedResume: null,
  preferences: {},
}

const job = {
  id: 'j1',
  title: 'Data Engineer',
  company: 'Databricks',
  location: 'Remote',
  description: 'We are looking for a Data Engineer to build scalable pipelines using Python, Airflow, dbt, Spark, and Delta Lake on AWS. You will work with petabyte-scale data and own reliability.',
  matchScore: 85,
  highlights: [],
  status: 'new',
}

const tailorFixture = {
  overallMatch: 72,
  matchLabel: 'Moderate',
  sections: [
    { name: 'Skills', score: 85, status: 'strong', detail: 'Python, SQL, AWS all present' },
    { name: 'Experience', score: 55, status: 'weak', detail: 'Missing Airflow and dbt references' },
  ],
  rewrites: [
    {
      section: 'Experience',
      original: 'Built data pipelines using Python',
      suggested: 'Designed ETL pipelines in Python + Airflow processing 50M+ daily events',
      reason: 'Adds tooling match and scale metric',
    },
  ],
  missingKeywords: ['Airflow', 'dbt'],
  presentKeywords: ['Python', 'SQL', 'AWS'],
}

describe('Jobs smoke test', () => {
  it('renders without crashing', () => {
    render(<Jobs profile={profile} profileData={{}} />)
  })
})

describe('TailorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbGet
      .mockResolvedValueOnce([job])  // pool
      .mockResolvedValueOnce([])     // mutations
      .mockResolvedValueOnce([])     // applied URLs
      .mockResolvedValue(null)       // all other dbGet calls
  })

  it('shows loading state while AI call is pending', async () => {
    callAIBackground.mockReturnValue(new Promise(() => {})) // never resolves
    render(<Jobs profile={profile} profileData={profileWithResume} />)
    const btn = await screen.findByRole('button', { name: /tailor resume/i })
    fireEvent.click(btn)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders gap analysis, rewrites, and keywords on success', async () => {
    callAIBackground.mockResolvedValue(JSON.stringify(tailorFixture))
    render(<Jobs profile={profile} profileData={profileWithResume} />)
    const btn = await screen.findByRole('button', { name: /tailor resume/i })
    fireEvent.click(btn)
    await waitFor(() => expect(screen.getByText('Gap Analysis')).toBeInTheDocument())
    expect(screen.getByText('Rewrite Suggestions')).toBeInTheDocument()
    expect(screen.getByText('Keywords')).toBeInTheDocument()
    expect(screen.getByText('Skills')).toBeInTheDocument()
    expect(screen.getByText('Airflow')).toBeInTheDocument()
    expect(screen.getByText('Python')).toBeInTheDocument()
  })

  it('shows error message and Try again button on failure', async () => {
    callAIBackground.mockRejectedValue(new Error('Network error'))
    render(<Jobs profile={profile} profileData={profileWithResume} />)
    const btn = await screen.findByRole('button', { name: /tailor resume/i })
    fireEvent.click(btn)
    await waitFor(() => expect(screen.getByText(/try again/i)).toBeInTheDocument())
    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('disables Tailor resume button when profile has no resume text', async () => {
    render(<Jobs profile={profile} profileData={profileNoResume} />)
    const btn = await screen.findByRole('button', { name: /tailor resume/i })
    expect(btn).toBeDisabled()
  })
})
