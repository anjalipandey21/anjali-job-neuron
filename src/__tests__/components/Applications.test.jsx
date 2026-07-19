import { describe, it, vi, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../lib/api', () => ({
  dbGet: vi.fn(),
  dbSet: vi.fn().mockResolvedValue(undefined),
  dbDelete: vi.fn().mockResolvedValue(undefined),
}))

import { dbGet, dbSet } from '../../lib/api'
import { Applications } from '../../components/Applications'

const profile = { id: 'p1', name: 'Test User' }

const mockApp = {
  jobId: 'j1',
  jobTitle: 'Software Engineer',
  company: 'Stripe',
  location: 'Remote',
  url: 'https://stripe.com/jobs/1',
  status: 'applied',
  appliedAt: '2026-03-17',
  notes: '',
}

// Helper: render Applications with one app, then open ActivityModal.
// Sets up dbGet via mockImplementation before calling — caller provides activityEntries.
async function openActivityModal(user, activityEntries = null) {
  dbGet.mockImplementation((key) => {
    if (key === 'jh_apps_p1') return Promise.resolve([mockApp])
    if (key === 'jh_activity_p1_j1') return Promise.resolve(activityEntries)
    return Promise.resolve(null)
  })
  render(<Applications profile={profile} />)
  const activityBtn = await screen.findByRole('button', { name: 'Activity' })
  await user.click(activityBtn)
}

describe('Applications smoke test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbGet.mockResolvedValue(null)
  })

  it('renders without crashing', () => {
    render(<Applications profile={profile} />)
  })
})

describe('ActivityModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbSet.mockResolvedValue(undefined)
  })

  it('shows empty state when there are no activity entries', async () => {
    const user = userEvent.setup()
    await openActivityModal(user, null)
    expect(await screen.findByText('No activity logged yet.')).toBeInTheDocument()
  })

  it('adds a new entry and calls dbSet with the activity key', async () => {
    const user = userEvent.setup()
    await openActivityModal(user, [])

    await screen.findByText('No activity logged yet.')

    // Default type is ACTIVITY_TYPES[0] = 'Phone call'
    await user.click(screen.getByRole('button', { name: /Log/i }))

    await waitFor(() => {
      expect(dbSet).toHaveBeenCalledWith(
        'jh_activity_p1_j1',
        expect.arrayContaining([
          expect.objectContaining({ type: 'Phone call' }),
        ])
      )
    })
  })

  it('deletes an entry and calls dbSet without that entry', async () => {
    const user = userEvent.setup()
    const existingEntry = {
      id: 'e1',
      type: 'Phone call',
      note: 'test note',
      createdAt: '2026-03-19T10:00:00.000Z',
    }
    await openActivityModal(user, [existingEntry])

    await screen.findByText('Phone call', { selector: 'span' })

    // The modal has two ✕ buttons: header close (first in DOM) and entry delete (last).
    const deleteBtns = screen.getAllByRole('button', { name: '✕' })
    await user.click(deleteBtns[deleteBtns.length - 1])

    await waitFor(() => {
      expect(dbSet).toHaveBeenCalledWith(
        'jh_activity_p1_j1',
        expect.not.arrayContaining([expect.objectContaining({ id: 'e1' })])
      )
    })
  })
})

describe('mobile overflow menu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbGet.mockResolvedValue([mockApp])
  })

  it('shows ••• button on mobile instead of action buttons', async () => {
    render(<Applications profile={profile} isMobile={true} />)
    await waitFor(() => expect(screen.getByText('Software Engineer')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: '•••' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Tasks/ })).not.toBeInTheDocument()
  })

  it('opens dropdown with action buttons when ••• is clicked', async () => {
    const user = userEvent.setup()
    render(<Applications profile={profile} isMobile={true} />)
    await waitFor(() => screen.getByText('Software Engineer'))
    await user.click(screen.getByRole('button', { name: '•••' }))
    expect(screen.getByRole('button', { name: /Tasks/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Activity/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Notes/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Remove/ })).toBeInTheDocument()
  })

  it('closes dropdown when backdrop is clicked', async () => {
    const user = userEvent.setup()
    render(<Applications profile={profile} isMobile={true} />)
    await waitFor(() => screen.getByText('Software Engineer'))
    await user.click(screen.getByRole('button', { name: '•••' }))
    expect(screen.getByRole('button', { name: /Tasks/ })).toBeInTheDocument()
    // click the backdrop (first element with fixed position backdrop role)
    await user.click(screen.getByTestId('overflow-backdrop'))
    expect(screen.queryByRole('button', { name: /Tasks/ })).not.toBeInTheDocument()
  })

  it('status select in mobile dropdown has aria-label', async () => {
    const user = userEvent.setup()
    render(<Applications profile={profile} isMobile={true} />)
    await waitFor(() => screen.getByText('Software Engineer'))
    await user.click(screen.getByRole('button', { name: '•••' }))
    expect(screen.getByRole('combobox', { name: 'Application status' })).toBeInTheDocument()
  })

  it('shows action column (not ••• button) on desktop', async () => {
    render(<Applications profile={profile} isMobile={false} />)
    await waitFor(() => screen.getByText('Software Engineer'))
    expect(screen.queryByRole('button', { name: '•••' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tasks/ })).toBeInTheDocument()
  })

  it('desktop status select has aria-label', async () => {
    render(<Applications profile={profile} isMobile={false} />)
    await waitFor(() => screen.getByText('Software Engineer'))
    expect(screen.getByRole('combobox', { name: 'Application status' })).toBeInTheDocument()
  })
})

describe('Applications auto-log', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbSet.mockResolvedValue(undefined)
  })

  it('auto-logs a Status change entry when status dropdown changes', async () => {
    const user = userEvent.setup()
    // updateStatus calls dbGet for jh_applied_urls_p1 (moving away from 'applied')
    // and then for jh_activity_p1_j1 (auto-log). mockImplementation handles both.
    dbGet.mockImplementation((key) => {
      if (key === 'jh_apps_p1') return Promise.resolve([mockApp])
      return Promise.resolve([])  // safe for jh_applied_urls_p1 and jh_activity_p1_j1
    })

    render(<Applications profile={profile} />)

    const statusSelect = await screen.findByRole('combobox')
    await user.selectOptions(statusSelect, 'interview')

    await waitFor(() => {
      // Find the dbSet call for the activity key specifically
      const activityCall = dbSet.mock.calls.find(
        ([key]) => key === 'jh_activity_p1_j1'
      )
      expect(activityCall).toBeDefined()
      expect(activityCall[1]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'Status change', note: 'applied → interview' }),
        ])
      )
    })
  })
})
