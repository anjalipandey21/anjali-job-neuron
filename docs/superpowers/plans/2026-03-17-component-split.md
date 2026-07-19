# Component Split Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `src/JobHunterApp.jsx` (1,300 lines, 14 components) into focused files under `src/components/` and `src/lib/styles.js`, with a matching test file per component.

**Architecture:** Extract each component into its own file with named exports. `JobHunterApp.jsx` becomes a ~20-line root shell that keeps the theme-restore side effect and default export. Each task creates the new file, adds a smoke test, updates `JobHunterApp.jsx` to import instead of define, then commits — leaving the repo green at every step.

**Tech Stack:** Vite + React (ESM), Vitest + React Testing Library, inline styles only, no TypeScript.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/lib/styles.js` | `C`, `btn`, `STATUS_STYLES`, `Badge`, `GlobalStyles` |
| Create | `src/components/Sidebar.jsx` | `NAV`, `Sidebar` |
| Create | `src/components/Dashboard.jsx` | `Dashboard` |
| Create | `src/components/Settings.jsx` | `Settings` |
| Create | `src/components/ProfileSelect.jsx` | `ProfileSelect` |
| Create | `src/components/Resume.jsx` | `loadPdfJs` (private), `extractPdfText` (private), `Resume` |
| Create | `src/components/Jobs.jsx` | `CustomizeModal`, `ApplyModal`, `JobCard`, `Jobs` |
| Create | `src/components/Applications.jsx` | `TaskModal`, `Applications` |
| Create | `src/components/MainApp.jsx` | `MainApp` |
| Modify | `src/JobHunterApp.jsx` | Thin shell: theme-restore + default export only |
| Create | `src/__tests__/styles.test.jsx` | Smoke tests for `Badge` + `GlobalStyles` |
| Create | `src/__tests__/Sidebar.test.jsx` | Smoke test |
| Create | `src/__tests__/Dashboard.test.jsx` | Smoke test |
| Create | `src/__tests__/Settings.test.jsx` | Smoke test |
| Create | `src/__tests__/Resume.test.jsx` | Smoke test |
| Create | `src/__tests__/Jobs.test.jsx` | Smoke test |
| Create | `src/__tests__/Applications.test.jsx` | Smoke test |
| No change | `src/__tests__/ProfileSelect.test.jsx` | Imports `../JobHunterApp` — still valid after split |
| No change | `src/__tests__/TaskModal.test.jsx` | Imports `../JobHunterApp` — still valid after split |

---

## Shared test boilerplate

Every new smoke test file follows this pattern — adapt per component:

```jsx
import { describe, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('../lib/api', () => ({
  dbGet: vi.fn().mockResolvedValue(null),
  dbSet: vi.fn().mockResolvedValue(undefined),
  callAI: vi.fn(),
  callAIBackground: vi.fn(),
  callJobsSearch: vi.fn(),
}))

import { ComponentName } from '../components/ComponentName'

describe('ComponentName smoke test', () => {
  it('renders without crashing', () => {
    render(<ComponentName {/* minimal required props */} />)
  })
})
```

Run all tests with: `npm test`
Expected passing baseline: **62 tests** across 5 suites.

---

## Task 1: Create `src/lib/styles.js`

**Files:**
- Create: `src/lib/styles.js`
- Create: `src/__tests__/styles.test.jsx`
- Modify: `src/JobHunterApp.jsx` (remove local definitions, add import)

- [ ] **Step 1.1: Create `src/lib/styles.js`**

  Copy lines 41–141 of `src/JobHunterApp.jsx` (GlobalStyles, C, btn, STATUS_STYLES, Badge) into a new file with named exports. Add the React import.

  ```js
  import { } from 'react'  // GlobalStyles and Badge use JSX

  export const GlobalStyles = () => (
    <style>{/* ...full CSS variable block, unchanged... */}</style>
  )

  export const C = {
    card: { background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '1.25rem' },
    metricCard: { background: 'var(--bg-metric)', borderRadius: 8, padding: '1rem' },
    input: {
      padding: '8px 12px', border: '1px solid var(--input-border)', borderRadius: 8,
      background: 'var(--input-bg)', color: 'var(--text-main)', fontFamily: 'inherit',
      fontSize: 14, width: '100%', boxSizing: 'border-box', outline: 'none',
    },
  }

  export const btn = (variant = 'ghost') => ({
    padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5,
    transition: 'opacity 0.15s',
    ...(variant === 'primary'
      ? { background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none' }
      : { background: 'transparent', color: 'var(--text-main)', border: '0.5px solid var(--border)' }),
  })

  export const STATUS_STYLES = {
    new:        { background: 'var(--badge-new-bg)',  color: 'var(--badge-new-text)' },
    viewed:     { background: 'var(--badge-viewed-bg)', color: 'var(--badge-viewed-text)' },
    customized: { background: 'var(--badge-cust-bg)', color: 'var(--badge-cust-text)' },
    applied:    { background: 'var(--badge-app-bg)',  color: 'var(--badge-app-text)' },
    interview:  { background: 'var(--badge-int-bg)',  color: 'var(--badge-int-text)' },
    offer:      { background: 'var(--badge-off-bg)',  color: 'var(--badge-off-text)' },
    rejected:   { background: 'var(--badge-rej-bg)',  color: 'var(--badge-rej-text)' },
  }

  export const Badge = ({ status }) => {
    const s = STATUS_STYLES[status] || STATUS_STYLES.new
    return (
      <span style={{ ...s, fontSize: 11, padding: '2px 7px', borderRadius: 6, fontWeight: 500, whiteSpace: 'nowrap' }}>
        {status}
      </span>
    )
  }
  ```

  > **Important:** The `import { } from 'react'` line should actually be `import React from 'react'` or use the JSX transform. Since this project uses Vite with the React JSX transform, you do NOT need to import React explicitly — the JSX transform handles it. So the file needs no React import at all unless you use a React API directly. Just start with the exports.

- [ ] **Step 1.2: Write the smoke test**

  Create `src/__tests__/styles.test.jsx`:

  ```js
  import { describe, it, expect } from 'vitest'
  import { render, screen } from '@testing-library/react'
  import { Badge, GlobalStyles, C, btn, STATUS_STYLES } from '../lib/styles'

  describe('styles', () => {
    it('Badge renders with known status', () => {
      render(<Badge status="applied" />)
      expect(screen.getByText('applied')).toBeInTheDocument()
    })

    it('Badge renders all status variants without crashing', () => {
      Object.keys(STATUS_STYLES).forEach((status) => {
        const { unmount } = render(<Badge status={status} />)
        unmount()
      })
    })

    it('GlobalStyles renders without crashing', () => {
      render(<GlobalStyles />)
      // jsdom cannot compute CSS variables, just assert no throw
    })

    it('C, btn, STATUS_STYLES are plain objects / functions', () => {
      expect(typeof C).toBe('object')
      expect(typeof btn).toBe('function')
      expect(typeof STATUS_STYLES).toBe('object')
      expect(btn('primary')).toHaveProperty('background')
      expect(btn('ghost')).toHaveProperty('border')
    })
  })
  ```

- [ ] **Step 1.3: Run test to verify it passes**

  ```bash
  npm test
  ```

  Expected: all previous 62 tests pass + 4 new styles tests = **66 tests passing**.

- [ ] **Step 1.4: Update `src/JobHunterApp.jsx` to import from styles**

  At the top of `src/JobHunterApp.jsx`, add:
  ```js
  import { GlobalStyles, C, btn, STATUS_STYLES, Badge } from './lib/styles'
  ```

  Delete lines 41–141 (the `GlobalStyles`, `C`, `btn`, `STATUS_STYLES`, `Badge` definitions).

- [ ] **Step 1.5: Run all tests to confirm still green**

  ```bash
  npm test
  ```
  Expected: **66 tests passing**, 0 failures.

- [ ] **Step 1.6: Commit**

  ```bash
  git add src/lib/styles.js src/__tests__/styles.test.jsx src/JobHunterApp.jsx
  git commit -m "refactor: extract design tokens and Badge to src/lib/styles.js"
  ```

---

## Task 2: Extract `Sidebar`

**Files:**
- Create: `src/components/Sidebar.jsx`
- Create: `src/__tests__/Sidebar.test.jsx`
- Modify: `src/JobHunterApp.jsx`

- [ ] **Step 2.1: Create `src/components/Sidebar.jsx`**

  Copy lines 143–208 (NAV constant + Sidebar function) from `src/JobHunterApp.jsx`. Add imports at top:

  ```jsx
  import { C, btn } from '../lib/styles'

  export const NAV = [
    { id: 'dashboard',    label: 'Dashboard' },
    { id: 'resume',       label: 'Resume' },
    { id: 'jobs',         label: 'Find Jobs' },
    { id: 'applications', label: 'Applications' },
    { id: 'settings',     label: 'Settings' },
  ]

  export function Sidebar({ tab, setTab, profile, onSwitch, onLogout, userEmail, isAdmin, onOpenAdmin }) {
    // ...paste body unchanged...
  }
  ```

- [ ] **Step 2.2: Write the smoke test**

  Create `src/__tests__/Sidebar.test.jsx`:

  ```jsx
  import { describe, it, vi } from 'vitest'
  import { render } from '@testing-library/react'
  import { Sidebar } from '../components/Sidebar'

  const profile = { id: 'p1', name: 'Test User', email: 'test@example.com' }

  describe('Sidebar smoke test', () => {
    it('renders without crashing', () => {
      render(
        <Sidebar
          tab="dashboard"
          setTab={vi.fn()}
          profile={profile}
          onSwitch={vi.fn()}
          onLogout={vi.fn()}
          userEmail="test@example.com"
          isAdmin={false}
          onOpenAdmin={vi.fn()}
        />
      )
    })
  })
  ```

- [ ] **Step 2.3: Run tests**

  ```bash
  npm test
  ```
  Expected: **67 tests passing**.

- [ ] **Step 2.4: Update `src/JobHunterApp.jsx`**

  Add import:
  ```js
  import { Sidebar } from './components/Sidebar'
  ```

  Delete the `NAV` constant and `Sidebar` function from `JobHunterApp.jsx`.

- [ ] **Step 2.5: Run all tests**

  ```bash
  npm test
  ```
  Expected: **67 tests passing**, 0 failures.

- [ ] **Step 2.6: Commit**

  ```bash
  git add src/components/Sidebar.jsx src/__tests__/Sidebar.test.jsx src/JobHunterApp.jsx
  git commit -m "refactor: extract Sidebar to src/components/Sidebar.jsx"
  ```

---

## Task 3: Extract `Dashboard`

**Files:**
- Create: `src/components/Dashboard.jsx`
- Create: `src/__tests__/Dashboard.test.jsx`
- Modify: `src/JobHunterApp.jsx`

- [ ] **Step 3.1: Create `src/components/Dashboard.jsx`**

  Copy lines 209–357 from `src/JobHunterApp.jsx`. Add imports:

  ```jsx
  import { useState, useEffect } from 'react'
  import { dbGet } from '../lib/api'
  import { todayStr, fmtDate } from '../lib/helpers'
  import { C, btn, Badge } from '../lib/styles'

  export function Dashboard({ profile, profileData, setTab }) {
    // ...paste body unchanged...
  }
  ```

- [ ] **Step 3.2: Write the smoke test**

  Create `src/__tests__/Dashboard.test.jsx`:

  ```jsx
  import { describe, it, vi, beforeEach } from 'vitest'
  import { render } from '@testing-library/react'

  vi.mock('../lib/api', () => ({
    dbGet: vi.fn().mockResolvedValue(null),
  }))

  import { Dashboard } from '../components/Dashboard'

  const profile = { id: 'p1', name: 'Test User' }

  describe('Dashboard smoke test', () => {
    it('renders without crashing', () => {
      render(<Dashboard profile={profile} profileData={{}} setTab={vi.fn()} />)
    })
  })
  ```

- [ ] **Step 3.3: Run tests**

  ```bash
  npm test
  ```
  Expected: **68 tests passing**.

- [ ] **Step 3.4: Update `src/JobHunterApp.jsx`**

  Add import:
  ```js
  import { Dashboard } from './components/Dashboard'
  ```

  Delete the `Dashboard` function from `JobHunterApp.jsx`.

- [ ] **Step 3.5: Run all tests**

  ```bash
  npm test
  ```
  Expected: **68 tests passing**, 0 failures.

- [ ] **Step 3.6: Commit**

  ```bash
  git add src/components/Dashboard.jsx src/__tests__/Dashboard.test.jsx src/JobHunterApp.jsx
  git commit -m "refactor: extract Dashboard to src/components/Dashboard.jsx"
  ```

---

## Task 4: Extract `Settings`

**Files:**
- Create: `src/components/Settings.jsx`
- Create: `src/__tests__/Settings.test.jsx`
- Modify: `src/JobHunterApp.jsx`

- [ ] **Step 4.1: Create `src/components/Settings.jsx`**

  Copy the `Settings` function from `src/JobHunterApp.jsx` (starts around line 1033). Add imports:

  ```jsx
  import { useState, useEffect } from 'react'
  import { C, btn } from '../lib/styles'
  import { fmtDate } from '../lib/helpers'

  export function Settings({ profile, profileData, onUpdate, onSwitch, onLogout }) {
    // ...paste body unchanged...
  }
  ```

- [ ] **Step 4.2: Write the smoke test**

  Create `src/__tests__/Settings.test.jsx`:

  ```jsx
  import { describe, it, vi } from 'vitest'
  import { render } from '@testing-library/react'
  import { Settings } from '../components/Settings'

  const profile = { id: 'p1', name: 'Test User', email: 'test@example.com', createdAt: new Date().toISOString() }

  describe('Settings smoke test', () => {
    it('renders without crashing', () => {
      render(
        <Settings
          profile={profile}
          profileData={{ preferences: { locations: 'Remote', roles: '' } }}
          onUpdate={vi.fn()}
          onSwitch={vi.fn()}
          onLogout={vi.fn()}
        />
      )
    })
  })
  ```

- [ ] **Step 4.3: Run tests**

  ```bash
  npm test
  ```
  Expected: **69 tests passing**.

- [ ] **Step 4.4: Update `src/JobHunterApp.jsx`**

  Add import:
  ```js
  import { Settings } from './components/Settings'
  ```

  Delete the `Settings` function from `JobHunterApp.jsx`.

- [ ] **Step 4.5: Run all tests**

  ```bash
  npm test
  ```
  Expected: **69 tests passing**, 0 failures.

- [ ] **Step 4.6: Commit**

  ```bash
  git add src/components/Settings.jsx src/__tests__/Settings.test.jsx src/JobHunterApp.jsx
  git commit -m "refactor: extract Settings to src/components/Settings.jsx"
  ```

---

## Task 5: Extract `ProfileSelect`

**Files:**
- Create: `src/components/ProfileSelect.jsx`
- Modify: `src/JobHunterApp.jsx`
- No change to `src/__tests__/ProfileSelect.test.jsx` (it imports `../JobHunterApp` and stays that way)

- [ ] **Step 5.1: Create `src/components/ProfileSelect.jsx`**

  Copy the `ProfileSelect` function from `src/JobHunterApp.jsx` (starts around line 1092). Add imports:

  ```jsx
  import { useState, useEffect } from 'react'
  import { dbGet, dbSet } from '../lib/api'
  import { uid } from '../lib/helpers'
  import { C, btn } from '../lib/styles'

  export function ProfileSelect({ onSelect, onLogout, user, forcePicker = false }) {
    // ...paste body unchanged...
  }
  ```

- [ ] **Step 5.2: Update `src/JobHunterApp.jsx`**

  Add import:
  ```js
  import { ProfileSelect } from './components/ProfileSelect'
  ```

  Delete the `ProfileSelect` function from `JobHunterApp.jsx`.

- [ ] **Step 5.3: Run all tests** (no new test file needed — `ProfileSelect.test.jsx` covers it via `JobHunterApp`)

  ```bash
  npm test
  ```
  Expected: **69 tests passing**, 0 failures. The existing `ProfileSelect.test.jsx` imports `../JobHunterApp` which now delegates to `./components/ProfileSelect` — still fully exercised.

- [ ] **Step 5.4: Commit**

  ```bash
  git add src/components/ProfileSelect.jsx src/JobHunterApp.jsx
  git commit -m "refactor: extract ProfileSelect to src/components/ProfileSelect.jsx"
  ```

---

## Task 6: Extract `Resume`

**Files:**
- Create: `src/components/Resume.jsx`
- Create: `src/__tests__/Resume.test.jsx`
- Modify: `src/JobHunterApp.jsx`

- [ ] **Step 6.1: Create `src/components/Resume.jsx`**

  Copy lines 13–39 (`loadPdfJs`, `extractPdfText`) and the `Resume` function from `src/JobHunterApp.jsx` (starts around line 360). These helpers are private (not exported). Add imports:

  ```jsx
  import { useState, useEffect, useRef } from 'react'
  import * as mammoth from 'mammoth'
  import { callAI, callAIBackground } from '../lib/api'
  import { parseJSON } from '../lib/helpers'
  import { C, btn } from '../lib/styles'

  // private helpers (not exported)
  function loadPdfJs() { /* ...paste unchanged... */ }
  async function extractPdfText(file) { /* ...paste unchanged... */ }

  export function Resume({ profile, profileData, onUpdate }) {
    // ...paste body unchanged...
  }
  ```

- [ ] **Step 6.2: Write the smoke test**

  Create `src/__tests__/Resume.test.jsx`:

  ```jsx
  import { describe, it, vi } from 'vitest'
  import { render } from '@testing-library/react'

  vi.mock('../lib/api', () => ({
    callAI: vi.fn(),
    callAIBackground: vi.fn(),
  }))

  import { Resume } from '../components/Resume'

  const profile = { id: 'p1', name: 'Test User' }

  describe('Resume smoke test', () => {
    it('renders without crashing', () => {
      render(<Resume profile={profile} profileData={{}} onUpdate={vi.fn()} />)
    })
  })
  ```

- [ ] **Step 6.3: Run tests**

  ```bash
  npm test
  ```
  Expected: **70 tests passing**.

- [ ] **Step 6.4: Update `src/JobHunterApp.jsx`**

  Add import:
  ```js
  import { Resume } from './components/Resume'
  ```

  Delete `loadPdfJs`, `extractPdfText`, and the `Resume` function from `JobHunterApp.jsx`. Also remove `import * as mammoth from 'mammoth'` from the top of `JobHunterApp.jsx` (it moves to `Resume.jsx`).

- [ ] **Step 6.5: Run all tests**

  ```bash
  npm test
  ```
  Expected: **70 tests passing**, 0 failures.

- [ ] **Step 6.6: Commit**

  ```bash
  git add src/components/Resume.jsx src/__tests__/Resume.test.jsx src/JobHunterApp.jsx
  git commit -m "refactor: extract Resume to src/components/Resume.jsx"
  ```

---

## Task 7: Extract `Jobs`

**Files:**
- Create: `src/components/Jobs.jsx`
- Create: `src/__tests__/Jobs.test.jsx`
- Modify: `src/JobHunterApp.jsx`

- [ ] **Step 7.1: Create `src/components/Jobs.jsx`**

  Copy `CustomizeModal`, `ApplyModal`, `JobCard`, and `Jobs` from `src/JobHunterApp.jsx` (lines 614–864). Only `Jobs` needs to be exported. Lines 865–867 (`TASK_PRESETS`) belong to `Applications.jsx` — do not include them here. Add imports:

  ```jsx
  import { useState, useEffect } from 'react'
  import { callAI, callJobsSearch, dbGet, dbSet } from '../lib/api'
  import { todayStr, uid, parseJSON } from '../lib/helpers'
  import { C, btn, Badge, STATUS_STYLES } from '../lib/styles'

  // private to this module
  function CustomizeModal({ ... }) { /* ...paste unchanged... */ }
  function ApplyModal({ ... }) { /* ...paste unchanged... */ }
  function JobCard({ ... }) { /* ...paste unchanged... */ }

  export function Jobs({ profile, profileData }) {
    // ...paste body unchanged...
  }
  ```

- [ ] **Step 7.2: Write the smoke test**

  Create `src/__tests__/Jobs.test.jsx`:

  ```jsx
  import { describe, it, vi, beforeEach } from 'vitest'
  import { render } from '@testing-library/react'

  vi.mock('../lib/api', () => ({
    dbGet: vi.fn().mockResolvedValue(null),
    dbSet: vi.fn().mockResolvedValue(undefined),
    callAI: vi.fn(),
    callJobsSearch: vi.fn(),
  }))

  import { Jobs } from '../components/Jobs'

  const profile = { id: 'p1', name: 'Test User' }

  describe('Jobs smoke test', () => {
    it('renders without crashing', () => {
      render(<Jobs profile={profile} profileData={{}} />)
    })
  })
  ```

- [ ] **Step 7.3: Run tests**

  ```bash
  npm test
  ```
  Expected: **71 tests passing**.

- [ ] **Step 7.4: Update `src/JobHunterApp.jsx`**

  Add import:
  ```js
  import { Jobs } from './components/Jobs'
  ```

  Delete `CustomizeModal`, `ApplyModal`, `JobCard`, and `Jobs` from `JobHunterApp.jsx`.

- [ ] **Step 7.5: Run all tests**

  ```bash
  npm test
  ```
  Expected: **71 tests passing**, 0 failures.

- [ ] **Step 7.6: Commit**

  ```bash
  git add src/components/Jobs.jsx src/__tests__/Jobs.test.jsx src/JobHunterApp.jsx
  git commit -m "refactor: extract Jobs (+ JobCard, CustomizeModal, ApplyModal) to src/components/Jobs.jsx"
  ```

---

## Task 8: Extract `Applications`

**Files:**
- Create: `src/components/Applications.jsx`
- Create: `src/__tests__/Applications.test.jsx`
- Modify: `src/JobHunterApp.jsx`
- No change to `src/__tests__/TaskModal.test.jsx` (it imports `../JobHunterApp` — stays that way)

- [ ] **Step 8.1: Create `src/components/Applications.jsx`**

  Copy `TASK_PRESETS` (line 867), `TaskModal` (lines 869–955), and `Applications` (lines 957–1030) from `src/JobHunterApp.jsx`. `TASK_PRESETS` is used inside `TaskModal` and must travel with it. Only `Applications` is exported. Add imports:

  ```jsx
  import { useState, useEffect } from 'react'
  import { dbGet, dbSet } from '../lib/api'
  import { todayStr, fmtDate } from '../lib/helpers'
  import { C, btn, Badge, STATUS_STYLES } from '../lib/styles'

  // private to this module
  function TaskModal({ ... }) { /* ...paste unchanged... */ }

  export function Applications({ profile }) {
    // ...paste body unchanged...
  }
  ```

- [ ] **Step 8.2: Write the smoke test**

  Create `src/__tests__/Applications.test.jsx`:

  ```jsx
  import { describe, it, vi } from 'vitest'
  import { render } from '@testing-library/react'

  vi.mock('../lib/api', () => ({
    dbGet: vi.fn().mockResolvedValue(null),
    dbSet: vi.fn().mockResolvedValue(undefined),
  }))

  import { Applications } from '../components/Applications'

  const profile = { id: 'p1', name: 'Test User' }

  describe('Applications smoke test', () => {
    it('renders without crashing', () => {
      render(<Applications profile={profile} />)
    })
  })
  ```

- [ ] **Step 8.3: Run tests**

  ```bash
  npm test
  ```
  Expected: **72 tests passing**.

- [ ] **Step 8.4: Update `src/JobHunterApp.jsx`**

  Add import:
  ```js
  import { Applications } from './components/Applications'
  ```

  Delete `TaskModal` and `Applications` from `JobHunterApp.jsx`.

- [ ] **Step 8.5: Run all tests**

  ```bash
  npm test
  ```
  Expected: **72 tests passing**, 0 failures. The existing `TaskModal.test.jsx` still imports `../JobHunterApp` and exercises `TaskModal` indirectly — verify it still passes.

- [ ] **Step 8.6: Commit**

  ```bash
  git add src/components/Applications.jsx src/__tests__/Applications.test.jsx src/JobHunterApp.jsx
  git commit -m "refactor: extract Applications (+ TaskModal) to src/components/Applications.jsx"
  ```

---

## Task 9: Extract `MainApp` and complete the thin shell

**Files:**
- Create: `src/components/MainApp.jsx`
- Modify: `src/JobHunterApp.jsx` (becomes the final thin shell)

- [ ] **Step 9.1: Create `src/components/MainApp.jsx`**

  Copy the `MainApp` function from `src/JobHunterApp.jsx` (starts around line 1203). Add imports for every page component:

  ```jsx
  import { useState, useEffect } from 'react'
  import { dbGet, dbSet } from '../lib/api'
  import { Sidebar } from './Sidebar'
  import { Dashboard } from './Dashboard'
  import { Resume } from './Resume'
  import { Jobs } from './Jobs'
  import { Applications } from './Applications'
  import { Settings } from './Settings'

  export function MainApp({ profile, onSwitch, onLogout, userEmail, isAdmin, onOpenAdmin }) {
    // ...paste body unchanged...
  }
  ```

- [ ] **Step 9.2: Thin out `src/JobHunterApp.jsx`**

  After this step `JobHunterApp.jsx` should contain only:
  1. The theme-restore side-effect block (lines 6–11)
  2. Imports for `GlobalStyles`, `ProfileSelect`, `MainApp`
  3. The `JobHunterApp` default export function (~20 lines)

  Final shape:

  ```jsx
  import { useState } from 'react'
  import { GlobalStyles } from './lib/styles'
  import { ProfileSelect } from './components/ProfileSelect'
  import { MainApp } from './components/MainApp'

  // Restore theme early to prevent flash
  if (typeof window !== 'undefined') {
    try {
      if (localStorage.getItem('jh_theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
    } catch (e) {}
  }

  export default function JobHunterApp({ user, onLogout, isAdmin, onOpenAdmin }) {
    const saved = (() => {
      try { return JSON.parse(sessionStorage.getItem('jh_active_profile')) } catch { return null }
    })()
    const [view, setView] = useState(saved ? 'app' : 'profiles')
    const [activeProfile, setActiveProfile] = useState(saved)
    const [switching, setSwitching] = useState(false)
    const userEmail = user?.email || ''

    const handleSelect = (p) => {
      setActiveProfile(p)
      setView('app')
      setSwitching(false)
      try { sessionStorage.setItem('jh_active_profile', JSON.stringify(p)) } catch {}
    }

    const handleSwitch = () => {
      setSwitching(true)
      setActiveProfile(null)
      setView('profiles')
      sessionStorage.removeItem('jh_active_profile')
    }

    return (
      <>
        <GlobalStyles />
        {view === 'profiles'
          ? <ProfileSelect onSelect={handleSelect} onLogout={onLogout} user={user} forcePicker={switching} />
          : <MainApp profile={activeProfile} onSwitch={handleSwitch} onLogout={onLogout} userEmail={userEmail} isAdmin={isAdmin} onOpenAdmin={onOpenAdmin} />}
      </>
    )
  }
  ```

  Also remove from `JobHunterApp.jsx`:
  - `import { dbGet, dbSet, callAI, callAIBackground, callJobsSearch } from './lib/api'` (no longer needed at root)
  - `import { uid, todayStr, fmtDate, parseJSON } from './lib/helpers'` (no longer needed at root)

- [ ] **Step 9.3: Run all tests**

  ```bash
  npm test
  ```
  Expected: **72 tests passing**, 0 failures.

  Verify specifically that `ProfileSelect.test.jsx` (4 tests) and `TaskModal.test.jsx` (13 tests) still pass — they both import `../JobHunterApp` which now renders through the new component files.

- [ ] **Step 9.4: Commit**

  ```bash
  git add src/components/MainApp.jsx src/JobHunterApp.jsx
  git commit -m "refactor: extract MainApp, complete JobHunterApp thin shell"
  ```

---

## Task 10: Final verification

- [ ] **Step 10.1: Check line count of `JobHunterApp.jsx`**

  ```bash
  wc -l src/JobHunterApp.jsx
  ```
  Expected: ~30 lines.

- [ ] **Step 10.2: Run full test suite one final time**

  ```bash
  npm test
  ```
  Expected: **72 tests passing** (62 original + 10 new smoke tests), 0 failures.

- [ ] **Step 10.3: Start dev server and do a manual smoke check**

  ```bash
  npm run dev
  ```

  Open the app and verify:
  - Profile picker renders
  - Selecting a profile loads the dashboard
  - Navigating to Resume, Jobs, Applications, Settings all render

- [ ] **Step 10.4: Final commit**

  ```bash
  git add -A
  git commit -m "refactor: component split complete — 1300-line JobHunterApp split into 9 focused files"
  ```

---

## Troubleshooting

**"X is not exported from ../components/Y"** — Check that the function declaration has `export` in the new file. Private helpers (loadPdfJs, extractPdfText, TaskModal, CustomizeModal, ApplyModal, JobCard) must NOT have `export`.

**Existing tests fail after extraction** — The two tests that use `../JobHunterApp` (`ProfileSelect.test.jsx`, `TaskModal.test.jsx`) depend on the full component tree rendering. If they fail, check that `MainApp.jsx` correctly imports all page components and that `JobHunterApp.jsx` still renders `<MainApp>` in the `'app'` view state.

**"Cannot find module '../lib/api'"** — All component files are one level deeper than `src/`, so they use `../lib/api`, `../lib/helpers`, `../lib/styles`. `JobHunterApp.jsx` lives at the `src/` root and uses `./lib/...`.
