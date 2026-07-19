import { describe, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../lib/api', () => ({
  dbGet: vi.fn().mockResolvedValue(null),
}))

import { Dashboard } from '../../components/Dashboard'

const profile = { id: 'p1', name: 'Test User' }

describe('Dashboard smoke test', () => {
  it('renders without crashing', () => {
    render(<Dashboard profile={profile} profileData={{}} setTab={vi.fn()} isMobile={false} isTablet={false} />)
  })
})

describe('Dashboard heading styles', () => {
  it('"Recent applications" heading is rendered', () => {
    render(<Dashboard profile={profile} profileData={{}} setTab={vi.fn()} />)
    expect(screen.getByText('Recent applications')).toBeTruthy()
  })
})
