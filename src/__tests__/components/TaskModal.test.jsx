import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../lib/api', () => ({
  dbGet: vi.fn(),
  dbSet: vi.fn().mockResolvedValue(undefined),
  callAI: vi.fn(),
  callAIBackground: vi.fn(),
  callJobsSearch: vi.fn(),
}))

import { dbGet, dbSet } from '../../lib/api'

// TaskModal is not exported, so we render it via a thin wrapper that mimics
// Applications opening the modal for a specific app entry.
// Instead, we test the modal indirectly through Applications.
import Applications from '../../JobHunterApp'

// We need to render the Applications component in isolation.
// Since it's not exported, import the whole module and access via the app flow.
// For focused TaskModal tests we create a tiny inline wrapper.

// ── Inline TaskModal harness ──────────────────────────────────────────────────
// We extract TaskModal behaviour by rendering Applications with a fake app and
// clicking "Tasks" to open the modal.

// Import the default export to get access to the whole app
import JobHunterApp from '../../JobHunterApp'

const mockUser = { email: 'test@example.com', user_metadata: { full_name: 'Test' } }
const profile = { id: 'p1', name: 'Test', email: 'test@example.com', createdAt: new Date().toISOString() }
const profileData = { ...profile, resumeText: '', analyzedResume: null, preferences: { locations: '', roles: '' } }

const mockApp = {
  jobId: 'job1',
  jobTitle: 'Software Engineer',
  company: 'Acme',
  location: 'Remote',
  url: 'https://acme.com/jobs/1',
  status: 'applied',
  appliedAt: new Date().toISOString(),
  notes: '',
}

function setupMocks(tasks = []) {
  dbGet.mockImplementation((key) => {
    if (key === 'jh_profiles') return Promise.resolve([profile])
    if (key === 'jh_p_p1') return Promise.resolve(profileData)
    if (key === 'jh_apps_p1') return Promise.resolve([mockApp])
    if (key === `jh_tasks_p1_job1`) return Promise.resolve(tasks)
    if (key.startsWith('jh_jobs_')) return Promise.resolve([])
    if (key.startsWith('jh_tasks_')) return Promise.resolve([])
    return Promise.resolve(null)
  })
}

async function openTaskModal() {
  const user = userEvent.setup()
  render(<JobHunterApp user={mockUser} onLogout={vi.fn()} isAdmin={false} onOpenAdmin={vi.fn()} />)

  // Wait for auto-select and dashboard to load
  await waitFor(() => screen.getByText(/Overview/i)) // dashboard hero banner

  // Navigate to Applications tab (sidebar nav — may have badge count appended)
  await user.click(screen.getByRole('button', { name: /Applications/ }))
  await waitFor(() => screen.getByText('Software Engineer'))

  // Open task modal (Tasks button on the application card)
  await user.click(screen.getAllByRole('button', { name: /tasks/i })[0])
  // Confirm modal opened by looking for the modal heading
  await waitFor(() => screen.getByRole('heading', { name: 'Tasks' }))

  return user
}

describe('TaskModal — empty state', () => {
  beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); setupMocks([]) })

  it('shows "No tasks yet" when there are no tasks', async () => {
    await openTaskModal()
    await waitFor(() => expect(screen.getByText(/No tasks yet/i)).toBeInTheDocument())
  })

  it('shows quick-add preset buttons', async () => {
    await openTaskModal()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Prepare for interview/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Follow up/i })).toBeInTheDocument()
    })
  })
})

describe('TaskModal — adding a task', () => {
  beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); setupMocks([]) })

  it('adds a task via the form', async () => {
    const user = await openTaskModal()

    await user.click(screen.getByRole('button', { name: /\+ Add task/i }))
    await user.type(screen.getByPlaceholderText(/Task title/i), 'Research the company')
    await user.click(screen.getByRole('button', { name: /Add task/i }))

    expect(dbSet).toHaveBeenCalledWith(
      'jh_tasks_p1_job1',
      expect.arrayContaining([expect.objectContaining({ title: 'Research the company' })])
    )
  })

  it('adds a preset task with one click', async () => {
    const user = await openTaskModal()

    await waitFor(() => screen.getByRole('button', { name: /Prepare for interview/i }))
    await user.click(screen.getByRole('button', { name: /Prepare for interview/i }))

    expect(dbSet).toHaveBeenCalledWith(
      'jh_tasks_p1_job1',
      expect.arrayContaining([expect.objectContaining({ title: 'Prepare for interview' })])
    )
  })
})

describe('TaskModal — existing tasks', () => {
  const existingTask = {
    id: 't1',
    title: 'Send thank you email',
    dueDate: '2099-12-31',
    completed: false,
    notes: '',
    createdAt: new Date().toISOString(),
  }
  const overdueTask = {
    id: 't2',
    title: 'Follow up with recruiter',
    dueDate: '2020-01-01',
    completed: false,
    notes: '',
    createdAt: new Date().toISOString(),
  }

  beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); setupMocks([existingTask, overdueTask]) })

  it('displays existing tasks', async () => {
    await openTaskModal()
    await waitFor(() => expect(screen.getByText('Send thank you email')).toBeInTheDocument())
    expect(screen.getByText('Follow up with recruiter')).toBeInTheDocument()
  })

  it('shows overdue badge for past-due tasks', async () => {
    await openTaskModal()
    await waitFor(() => expect(screen.getByText('overdue')).toBeInTheDocument())
  })

  it('marks a task complete via checkbox', async () => {
    const user = await openTaskModal()
    await waitFor(() => screen.getByText('Send thank you email'))

    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[0])

    expect(dbSet).toHaveBeenCalledWith(
      'jh_tasks_p1_job1',
      expect.arrayContaining([expect.objectContaining({ id: 't1', completed: true })])
    )
  })
})
