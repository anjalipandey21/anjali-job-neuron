import { describe, it, vi, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TopNav } from '../../components/TopNav'

const baseProps = {
  tab: 'dashboard',
  setTab: vi.fn(),
  profile: { id: 'p1', name: 'Test User' },
  onSwitch: vi.fn(),
  onLogout: vi.fn(),
  userEmail: 'test@example.com',
  isAdmin: false,
  onOpenAdmin: vi.fn(),
  todayJobCount: 0,
  openAppCount: 0,
}

describe('TopNav', () => {
  it('renders logo and all nav links', () => {
    render(<TopNav {...baseProps} />)
    expect(screen.getByText('Job Neuron')).toBeTruthy()
    expect(screen.getByText('Dashboard')).toBeTruthy()
    expect(screen.getByText('Resume')).toBeTruthy()
    expect(screen.getByText('Jobs')).toBeTruthy()
    expect(screen.getByText('Applications')).toBeTruthy()
    expect(screen.getByText('Settings')).toBeTruthy()
  })

  it('calls setTab when a nav link is clicked', () => {
    const setTab = vi.fn()
    render(<TopNav {...baseProps} setTab={setTab} />)
    fireEvent.click(screen.getByText('Resume'))
    expect(setTab).toHaveBeenCalledWith('resume')
  })

  it('highlights the active tab', () => {
    const { container } = render(<TopNav {...baseProps} tab="jobs" />)
    const activeLink = container.querySelector('[data-active]')
    expect(activeLink).toBeTruthy()
    expect(activeLink.textContent).toContain('Jobs')
  })

  it('shows badge count on jobs tab when > 0', () => {
    render(<TopNav {...baseProps} todayJobCount={5} />)
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('shows admin panel option in dropdown when isAdmin', () => {
    render(<TopNav {...baseProps} isAdmin={true} />)
    // Must open the dropdown first — it only renders when dropdownOpen === true
    fireEvent.click(screen.getByRole('button', { name: /Test User/i }))
    expect(screen.getByText('Admin panel')).toBeTruthy()
  })

  it('renders bug report link inside dropdown', () => {
    render(<TopNav {...baseProps} />)
    // Open the dropdown
    fireEvent.click(screen.getByRole('button', { name: /Test User/i }))
    expect(screen.getByText('Report a bug')).toBeTruthy()
  })
})
