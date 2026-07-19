import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge, GlobalStyles } from '../../lib/styles'

describe('styles', () => {
  it('Badge renders with known status', () => {
    render(<Badge status="applied" />)
    expect(screen.getByText('applied')).toBeInTheDocument()
  })

  it('Badge renders unknown status without crashing', () => {
    render(<Badge status="unknown" />)
    expect(screen.getByText('unknown')).toBeInTheDocument()
  })

  it('GlobalStyles renders without crashing', () => {
    render(<GlobalStyles />)
  })
})
