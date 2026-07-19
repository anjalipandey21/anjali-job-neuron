import { describe, it, vi, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BottomNav } from '../../components/BottomNav'

describe('BottomNav', () => {
  it('renders null when isMobile is false', () => {
    const { container } = render(
      <BottomNav tab="dashboard" setTab={vi.fn()} isMobile={false} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders 5 tabs when isMobile is true', () => {
    const { getAllByRole } = render(
      <BottomNav tab="dashboard" setTab={vi.fn()} isMobile={true} />
    )
    expect(getAllByRole('button')).toHaveLength(5)
  })

  it('shows badge on jobs tab when todayJobCount > 0', () => {
    const { getByText } = render(
      <BottomNav tab="dashboard" setTab={vi.fn()} isMobile={true} todayJobCount={3} />
    )
    expect(getByText('3')).toBeTruthy()
  })
})
