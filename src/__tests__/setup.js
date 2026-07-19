import '@testing-library/jest-dom'
import { beforeEach } from 'vitest'

// Clear URL hash between tests so hash-based routing doesn't leak state
beforeEach(() => { window.location.hash = '' })
