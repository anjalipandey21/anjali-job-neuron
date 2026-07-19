import { describe, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Settings } from '../../components/Settings'

const profile = { id: 'p1', name: 'Test User', email: 'test@example.com', createdAt: new Date().toISOString() }
const profileData = { preferences: { locations: 'Remote', roles: '' } }

describe('Settings smoke test', () => {
  it('renders without crashing', () => {
    render(
      <Settings
        profile={profile}
        profileData={profileData}
        onUpdate={vi.fn()}
        onSwitch={vi.fn()}
        onLogout={vi.fn()}
        isMobile={false}
        isTablet={false}
        isAdmin={false}
        onOpenAdmin={vi.fn()}
      />
    )
  })

  it('shows admin button on mobile when isAdmin', () => {
    const { getByText } = render(
      <Settings
        profile={profile}
        profileData={profileData}
        onUpdate={vi.fn()} onSwitch={vi.fn()} onLogout={vi.fn()}
        isMobile={true} isTablet={false} isAdmin={true} onOpenAdmin={vi.fn()}
      />
    )
    expect(getByText('Admin panel')).toBeTruthy()
  })

  it('renders header and content sections', () => {
    const { container } = render(
      <Settings profile={profile} profileData={profileData} onUpdate={vi.fn()} onSwitch={vi.fn()} onLogout={vi.fn()} isMobile={false} />
    )
    const root = container.firstChild
    // The banner should be the first child of root
    const banner = root.firstChild
    expect(banner.textContent).toContain('Settings')
    // The content section should exist as second child
    expect(root.children[1]).toBeTruthy()
  })
})
