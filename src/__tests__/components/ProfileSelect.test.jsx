import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Mock API ──────────────────────────────────────────────────────────────────
vi.mock('../../lib/api', () => ({
  dbGet: vi.fn(),
  dbSet: vi.fn().mockResolvedValue(undefined),
}))

import { dbGet, dbSet } from '../../lib/api'

// Import after mocks are set up
beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear() // prevent profile restore from interfering with tests
})

// Because ProfileSelect is not directly exported, we test it through the
// full JobHunterApp default export which renders ProfileSelect when no profile
// is active. We isolate its behaviour here by providing a minimal user prop.

import JobHunterApp from '../../JobHunterApp'

const mockUser = {
  email: 'test@example.com',
  user_metadata: { full_name: 'Test User' },
}

describe('ProfileSelect — first-time user (no profiles)', () => {
  beforeEach(() => {
    dbGet.mockResolvedValue(null) // no profiles stored
  })

  it('auto-opens create form with Identity details pre-filled', async () => {
    render(<JobHunterApp user={mockUser} onLogout={vi.fn()} isAdmin={false} onOpenAdmin={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Full name/i)).toHaveValue('Test User')
    })
    expect(screen.getByPlaceholderText(/Email/i)).toHaveValue('test@example.com')
  })

  it('shows Create profile button', async () => {
    render(<JobHunterApp user={mockUser} onLogout={vi.fn()} isAdmin={false} onOpenAdmin={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create profile/i })).toBeInTheDocument()
    })
  })
})

describe('ProfileSelect — single existing profile', () => {
  const existingProfile = { id: 'p1', name: 'Test User', email: 'test@example.com', createdAt: new Date().toISOString() }

  beforeEach(() => {
    dbGet.mockImplementation((key) => {
      if (key === 'jh_profiles') return Promise.resolve([existingProfile])
      if (key === 'jh_p_p1') return Promise.resolve({ ...existingProfile, resumeText: '' })
      return Promise.resolve(null)
    })
  })

  it('auto-selects the only profile and skips the picker', async () => {
    render(<JobHunterApp user={mockUser} onLogout={vi.fn()} isAdmin={false} onOpenAdmin={vi.fn()} />)
    // Should jump straight to the dashboard, not show the profile picker
    await waitFor(() => {
      expect(screen.queryByText(/Select a profile/i)).not.toBeInTheDocument()
    })
  })
})

describe('ProfileSelect — duplicate guard', () => {
  const existingProfile = { id: 'p1', name: 'Test User', email: 'test@example.com', createdAt: new Date().toISOString() }
  const otherProfile   = { id: 'p2', name: 'Other User', email: 'other@example.com', createdAt: new Date().toISOString() }

  beforeEach(() => {
    // Two profiles → no auto-select, shows the picker
    dbGet.mockImplementation((key) => {
      if (key === 'jh_profiles') return Promise.resolve([existingProfile, otherProfile])
      return Promise.resolve(null)
    })
  })

  it('does not duplicate a profile with the same name and email', async () => {
    const user = userEvent.setup()
    render(<JobHunterApp user={mockUser} onLogout={vi.fn()} isAdmin={false} onOpenAdmin={vi.fn()} />)

    // Wait for profile list to load
    await waitFor(() => screen.getByText('Other User'))

    // Open the create form
    await user.click(screen.getByRole('button', { name: /create new profile/i }))

    // Fill in details matching an existing profile
    await user.type(screen.getByPlaceholderText(/Full name/i), 'Test User')
    await user.type(screen.getByPlaceholderText(/Email address/i), 'test@example.com')

    // Click create — duplicate guard should fire, no dbSet call
    await user.click(screen.getByRole('button', { name: /create profile/i }))

    expect(dbSet).not.toHaveBeenCalled()
  })
})
