import { describe, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../lib/api', () => ({
  callAI: vi.fn(),
  callAIBackground: vi.fn(),
  callSemanticAnalyze: vi.fn(),
}))

import { Resume } from '../../components/Resume'

const mockProfile = { id: 'p1', name: 'Test User' }

describe('Resume smoke test', () => {
  it('renders without crashing', () => {
    render(<Resume profile={mockProfile} profileData={{}} onUpdate={vi.fn()} isMobile={false} />)
  })
})

describe('Resume a11y and formatting', () => {
  it('file inputs have aria-label "Upload resume file"', () => {
    // Empty state should show 1 file input
    const { unmount } = render(<Resume profile={mockProfile} profileData={{}} onUpdate={vi.fn()} />)
    let inputs = document.querySelectorAll('input[type="file"]')
    expect(inputs.length).toBe(1)
    inputs.forEach((input) => {
      expect(input).toHaveAttribute('aria-label', 'Upload resume file')
    })
    unmount()

    // With resume text, should show 1 file input in the has-resume branch
    render(<Resume profile={mockProfile} profileData={{ resumeText: 'Some resume text here' }} onUpdate={vi.fn()} />)
    inputs = document.querySelectorAll('input[type="file"]')
    expect(inputs.length).toBe(1)
    inputs.forEach((input) => {
      expect(input).toHaveAttribute('aria-label', 'Upload resume file')
    })
  })

  it('experience entry without period renders without trailing separator', () => {
    const profileData = {
      analyzedResume: {
        summary: '',
        skills: [],
        experience: [{ title: 'Engineer', company: 'Acme', period: '' }],
        education: [],
      },
    }
    render(<Resume profile={mockProfile} profileData={profileData} onUpdate={vi.fn()} />)
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.queryByText(/Acme\s*·/)).not.toBeInTheDocument()
  })

  it('experience entry with period renders separator', () => {
    const profileData = {
      analyzedResume: {
        summary: '',
        skills: [],
        experience: [{ title: 'Engineer', company: 'Acme', period: '2020–2023' }],
        education: [],
      },
    }
    render(<Resume profile={mockProfile} profileData={profileData} onUpdate={vi.fn()} />)
    expect(screen.getByText(/Acme · 2020–2023/)).toBeInTheDocument()
  })
})
