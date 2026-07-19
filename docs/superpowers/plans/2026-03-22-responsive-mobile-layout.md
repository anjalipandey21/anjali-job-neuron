# Responsive Mobile Layout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two-breakpoint responsive layout to Job Neuron — 64px icon rail on tablet (481–768px), bottom tab bar on phone (≤480px) — without changing the desktop experience.

**Architecture:** A `useBreakpoint()` hook in `src/lib/hooks.js` reads `window.matchMedia` and returns `{ isMobile, isTablet }`. `MainApp` calls the hook once and passes these booleans as props down to all components that need layout changes. All layout switches are inline style conditionals; the only real CSS additions are the `sheetIn` keyframe, bottom nav background vars, and `[data-bottom-nav]` rule in `GlobalStyles`.

**Tech Stack:** React 18 (hooks), `window.matchMedia` API, Vitest + React Testing Library for tests.

---

## File Map

| File | Role |
|---|---|
| `src/lib/hooks.js` | New — `useBreakpoint()` hook |
| `src/lib/styles.jsx` | Add CSS vars, keyframe, `[data-bottom-nav]` rule to `GlobalStyles` |
| `src/components/Sidebar.jsx` | Icon rail (tablet), hidden (phone), new exported `BottomNav` component |
| `src/components/MainApp.jsx` | Call hook, pass props, render `BottomNav`, pad `<main>` on phone |
| `src/components/Dashboard.jsx` | Metric grid 4→2 col, hero padding reduction |
| `src/components/Resume.jsx` | ATS score grid 2→1 col on phone |
| `src/components/Settings.jsx` | Full-bleed on phone, reduce padding, Admin button on mobile/tablet |
| `src/components/Jobs.jsx` | Pass `isMobile` to all three modals; bottom sheet on phone |
| `src/components/Applications.jsx` | Pass `isMobile` to `TaskModal`; bottom sheet + status cell truncation |
| `src/__tests__/Sidebar.test.jsx` | Update smoke test + add `BottomNav` smoke test |
| `src/__tests__/Dashboard.test.jsx` | Pass new props |
| `src/__tests__/Settings.test.jsx` | Pass new props |
| `src/__tests__/TaskModal.test.jsx` | Pass new `isMobile` prop |

---

## Task 1: useBreakpoint Hook

**Files:**
- Create: `src/lib/hooks.js`

- [ ] **Step 1: Create `src/lib/hooks.js` with the hook**

```js
import { useState, useEffect } from 'react'

export function useBreakpoint() {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 480px)').matches
  )
  const [isTablet, setIsTablet] = useState(
    () => window.matchMedia('(min-width: 481px) and (max-width: 768px)').matches
  )

  useEffect(() => {
    const mqMobile = window.matchMedia('(max-width: 480px)')
    const mqTablet = window.matchMedia('(min-width: 481px) and (max-width: 768px)')
    const onMobile = (e) => setIsMobile(e.matches)
    const onTablet = (e) => setIsTablet(e.matches)
    mqMobile.addEventListener('change', onMobile)
    mqTablet.addEventListener('change', onTablet)
    return () => {
      mqMobile.removeEventListener('change', onMobile)
      mqTablet.removeEventListener('change', onTablet)
    }
  }, [])

  return { isMobile, isTablet }
}
```

- [ ] **Step 2: Run tests to confirm nothing broken**

```bash
npm test
```
Expected: all existing tests pass (hook is not used anywhere yet)

- [ ] **Step 3: Commit**

```bash
git add src/lib/hooks.js
git commit -m "feat: add useBreakpoint hook for responsive layout"
```

---

## Task 2: GlobalStyles CSS Additions

**Files:**
- Modify: `src/lib/styles.jsx`

- [ ] **Step 1: Add `--bg-bottom-nav` CSS custom properties to both themes**

In `GlobalStyles`, inside the `:root { ... }` block, add after the last existing variable:
```css
--bg-bottom-nav: rgba(230, 233, 239, 0.88);
```

Inside the `[data-theme="dark"] { ... }` block, add after the last existing variable:
```css
--bg-bottom-nav: rgba(24, 24, 37, 0.88);
```

- [ ] **Step 2: Add `sheetIn` keyframe and `[data-bottom-nav]` rule**

After the existing `@keyframes modalIn { ... }` block, add:
```css
@keyframes sheetIn {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
[data-bottom-nav] {
  background: var(--bg-bottom-nav);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding-bottom: env(safe-area-inset-bottom);
}
```

- [ ] **Step 3: Run tests**

```bash
npm test
```
Expected: all tests pass (CSS-only change)

- [ ] **Step 4: Commit**

```bash
git add src/lib/styles.jsx
git commit -m "feat: add bottom-nav CSS vars and sheetIn keyframe to GlobalStyles"
```

---

## Task 3: Sidebar Icon Rail + BottomNav Component

**Files:**
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/__tests__/Sidebar.test.jsx`

- [ ] **Step 1: Add `isMobile` and `isTablet` to `Sidebar` props and implement icon rail**

Update the `Sidebar` function signature:
```js
export function Sidebar({ tab, setTab, profile, onSwitch, onLogout, userEmail, isAdmin, onOpenAdmin, todayJobCount = 0, openAppCount = 0, isMobile = false, isTablet = false }) {
```

On the `<aside>` element, change the `width` and hide footer when in tablet mode:
```js
<aside style={{
  width: isTablet ? 64 : 240,
  background: 'var(--bg-sidebar)',
  borderRight: '0.5px solid var(--border-light)',
  display: isMobile ? 'none' : 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  transition: 'width 0.2s',
}}>
```

In the brand header, hide text when `isTablet`:
```js
{/* Brand */}
<div style={{ padding: isTablet ? '14px 0' : '16px 14px 12px', borderBottom: '0.5px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: isTablet ? 'center' : 'flex-start', gap: 10 }}>
  <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #8839ef, #7c3aed)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(136,57,239,0.35)', flexShrink: 0 }}>
    <svg width="18" height="18" viewBox="0 0 18 18" fill="white">
      <circle cx="9" cy="6.5" r="3.5"/>
      <path d="M2 16c0-3.5 3.1-5.5 7-5.5s7 2 7 5.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    </svg>
  </div>
  {!isTablet && (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>Job Neuron</div>
      <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 1 }}>AI Job Search</div>
    </div>
  )}
</div>
```

Update each nav button to hide labels and show dot badges on tablet:
```js
<button key={n.id} onClick={() => setTab(n.id)} style={{
  display: 'flex',
  alignItems: 'center',
  justifyContent: isTablet ? 'center' : 'flex-start',
  gap: 10,
  width: '100%',
  padding: isTablet ? '10px 0' : '9px 10px',
  borderRadius: 8, border: 'none', cursor: 'pointer',
  fontSize: 13, textAlign: 'left', fontFamily: 'inherit',
  position: 'relative',
  background: isActive ? 'var(--bg-card)' : 'transparent',
  color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
  fontWeight: isActive ? 600 : 400,
  boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
  marginBottom: 2,
  transition: 'background 0.12s',
}}>
  {isActive && (
    <div style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, background: 'var(--btn-primary-bg)', borderRadius: 2 }} />
  )}
  <span style={{ flexShrink: 0, display: 'flex', color: isActive ? 'var(--btn-primary-bg)' : 'currentColor', position: 'relative' }}>
    {n.icon}
    {isTablet && count > 0 && (
      <span style={{ position: 'absolute', top: -4, right: -4, width: 7, height: 7, borderRadius: '50%', background: 'var(--btn-primary-bg)' }} />
    )}
  </span>
  {!isTablet && n.label}
  {!isTablet && count > 0 && (
    <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: 'var(--badge-cust-bg)', color: 'var(--badge-cust-text)' }}>
      {count}
    </span>
  )}
</button>
```

Hide the section labels on tablet:
```js
{!isTablet && <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-light)', textTransform: 'uppercase', padding: '14px 8px 6px' }}>Main</div>}
```
(Apply same to "Account" label)

Hide the footer entirely on tablet:
```js
{!isTablet && (
  <div style={{ padding: '10px 8px', borderTop: '0.5px solid var(--border-light)' }}>
    {/* ... existing footer content ... */}
  </div>
)}
```

- [ ] **Step 2: Add the `BottomNav` exported component at the bottom of `Sidebar.jsx`**

```js
export function BottomNav({ tab, setTab, todayJobCount = 0, openAppCount = 0, isMobile = false }) {
  if (!isMobile) return null
  return (
    <nav
      data-bottom-nav
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 64, zIndex: 100,
        display: 'flex',
        borderTop: '0.5px solid var(--border-light)',
      }}
    >
      {NAV.map((n) => {
        const isActive = tab === n.id
        const count = n.id === 'jobs' ? todayJobCount : n.id === 'applications' ? openAppCount : 0
        return (
          <button
            key={n.id}
            onClick={() => setTab(n.id)}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 2, background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', padding: '4px 0',
              color: isActive ? 'var(--btn-primary-bg)' : 'var(--text-muted)',
              borderTop: isActive ? '2px solid var(--btn-primary-bg)' : '2px solid transparent',
              position: 'relative',
            }}
          >
            <span style={{ display: 'flex', fontSize: 16, position: 'relative' }}>
              {n.icon}
              {count > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -6,
                  fontSize: 9, fontWeight: 600, padding: '0 3px', borderRadius: 8,
                  background: 'var(--badge-cust-bg)', color: 'var(--badge-cust-text)', minWidth: 14, textAlign: 'center',
                }}>{count}</span>
              )}
            </span>
            <span style={{ fontSize: 9, fontWeight: isActive ? 600 : 400 }}>{n.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 3: Update `src/__tests__/Sidebar.test.jsx`**

```js
import { describe, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Sidebar, BottomNav } from '../components/Sidebar'

const profile = { id: 'p1', name: 'Test User', email: 'test@example.com' }
const baseProps = {
  tab: 'dashboard', setTab: vi.fn(), profile,
  onSwitch: vi.fn(), onLogout: vi.fn(), userEmail: 'test@example.com',
  isAdmin: false, onOpenAdmin: vi.fn(),
}

describe('Sidebar', () => {
  it('renders full sidebar on desktop', () => {
    render(<Sidebar {...baseProps} />)
  })

  it('renders icon rail on tablet (no labels visible)', () => {
    const { queryByText } = render(<Sidebar {...baseProps} isTablet />)
    expect(queryByText('Dashboard')).toBeNull()
  })

  it('is hidden on mobile', () => {
    const { container } = render(<Sidebar {...baseProps} isMobile />)
    const aside = container.querySelector('aside')
    expect(aside.style.display).toBe('none')
  })
})

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
```

- [ ] **Step 4: Run tests and fix any failures**

```bash
npm test -- --reporter=verbose 2>&1 | head -60
```
Expected: all tests pass including the new `BottomNav` tests

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.jsx src/__tests__/Sidebar.test.jsx
git commit -m "feat: add Sidebar icon rail (tablet) and BottomNav (phone)"
```

---

## Task 4: MainApp Wiring

**Files:**
- Modify: `src/components/MainApp.jsx`

- [ ] **Step 1: Add imports**

At the top of `MainApp.jsx`, add these two imports alongside the existing ones:
```js
import { useBreakpoint } from '../lib/hooks'
import { BottomNav } from './Sidebar'
```

- [ ] **Step 2: Call `useBreakpoint` inside the component**

After the existing `useState` and `useEffect` hooks, add:
```js
const { isMobile, isTablet } = useBreakpoint()
```

- [ ] **Step 3: Update the return JSX**

Replace the existing `return (...)` with:
```jsx
return (
  <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
    <Sidebar
      tab={tab} setTab={setTab} profile={profile} onSwitch={onSwitch}
      onLogout={onLogout} userEmail={userEmail} isAdmin={isAdmin}
      onOpenAdmin={onOpenAdmin} todayJobCount={todayJobCount}
      openAppCount={openAppCount} isMobile={isMobile} isTablet={isTablet}
    />
    <main style={{ flex: 1, overflow: 'auto', paddingBottom: isMobile ? 64 : 0 }}>
      {tab === 'dashboard'    && <Dashboard    profile={profile} profileData={profileData} setTab={setTab} isMobile={isMobile} isTablet={isTablet} />}
      {tab === 'resume'       && <Resume        profile={profile} profileData={profileData} onUpdate={updateProfile} isMobile={isMobile} />}
      {tab === 'jobs'         && <Jobs          profile={profile} profileData={profileData} isMobile={isMobile} />}
      {tab === 'applications' && <Applications  profile={profile} isMobile={isMobile} />}
      {tab === 'settings'     && <Settings      profile={profile} profileData={profileData} onUpdate={updateProfile} onSwitch={onSwitch} onLogout={onLogout} isMobile={isMobile} isTablet={isTablet} isAdmin={isAdmin} onOpenAdmin={onOpenAdmin} />}
    </main>
    <BottomNav tab={tab} setTab={setTab} todayJobCount={todayJobCount} openAppCount={openAppCount} isMobile={isMobile} />
  </div>
)
```

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: all tests pass (new props are optional/defaulted, no logic changes)

- [ ] **Step 5: Commit**

```bash
git add src/components/MainApp.jsx
git commit -m "feat: wire useBreakpoint into MainApp, pass isMobile/isTablet to all views"
```

---

## Task 5: Dashboard Responsive Layout

**Files:**
- Modify: `src/components/Dashboard.jsx`
- Modify: `src/__tests__/Dashboard.test.jsx`

- [ ] **Step 1: Add `isMobile` and `isTablet` to the `Dashboard` signature**

```js
export function Dashboard({ profile, profileData, setTab, isMobile = false, isTablet = false }) {
```

- [ ] **Step 2: Make the hero banner padding responsive**

Find the hero banner `<div>` (currently `padding: '24px 28px 20px'`) and update:
```js
padding: isMobile ? '12px 16px 10px' : isTablet ? '18px 20px 14px' : '24px 28px 20px',
```

- [ ] **Step 3: Make the metric card grid responsive**

Find the outer padding wrapper (currently `padding: '0 2rem'`) and update:
```js
padding: isMobile ? '0 0.75rem' : '0 2rem',
```

Find `gridTemplateColumns: 'repeat(4, minmax(0, 1fr))'` and update:
```js
gridTemplateColumns: (isMobile || isTablet) ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
```

- [ ] **Step 4: Update the Dashboard smoke test to pass new props**

```js
describe('Dashboard smoke test', () => {
  it('renders without crashing', () => {
    render(<Dashboard profile={profile} profileData={{}} setTab={vi.fn()} isMobile={false} isTablet={false} />)
  })
})
```

- [ ] **Step 5: Run tests**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/Dashboard.jsx src/__tests__/Dashboard.test.jsx
git commit -m "feat: responsive Dashboard — 2-col metric grid on tablet/phone"
```

---

## Task 6: Resume ATS Grid Reflow

**Files:**
- Modify: `src/components/Resume.jsx`
- Modify: `src/__tests__/Resume.test.jsx`

- [ ] **Step 1: Add `isMobile` to the `Resume` signature**

Find `export function Resume({` and add `isMobile = false`:
```js
export function Resume({ profile, profileData, onUpdate, isMobile = false }) {
```

- [ ] **Step 2: Find and update the ATS score grid**

Search in `Resume.jsx` for the ATS score section. It renders 8 category score rows in a grid. Find `gridTemplateColumns` and change from 2-col to 1-col on phone:

```js
gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
```

- [ ] **Step 3: Update the Resume smoke test**

Open `src/__tests__/Resume.test.jsx` and add `isMobile={false}` to the `<Resume>` render call (check existing prop usage to match the mock setup).

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/Resume.jsx src/__tests__/Resume.test.jsx
git commit -m "feat: responsive Resume — ATS grid 2-col → 1-col on phone"
```

---

## Task 7: Settings Responsive + Admin Button

**Files:**
- Modify: `src/components/Settings.jsx`
- Modify: `src/__tests__/Settings.test.jsx`

- [ ] **Step 1: Add new props to the `Settings` signature**

```js
export function Settings({ profile, profileData, onUpdate, onSwitch, onLogout, isMobile = false, isTablet = false, isAdmin = false, onOpenAdmin }) {
```

- [ ] **Step 2: Make the page max-width responsive**

Find the outermost wrapper `<div>` in Settings. It currently has `maxWidth: 560px`. Change to:
```js
maxWidth: isMobile ? undefined : 560,
```
(Also reduce horizontal padding on phone: `padding: isMobile ? '0 0.75rem' : undefined` if there's a padding wrapper.)

- [ ] **Step 3: Add the Admin button in the profile card**

The profile card already has "Switch profile" and "Sign out" buttons (lines 39–41). After those buttons, add:
```jsx
{(isTablet || isMobile) && isAdmin && (
  <button
    onClick={onOpenAdmin}
    style={{ ...btn(), marginTop: 6, color: 'var(--text-warning)', borderColor: 'var(--border-warning)' }}
  >
    Admin panel
  </button>
)}
```

- [ ] **Step 4: Update the Settings smoke test**

```js
describe('Settings smoke test', () => {
  it('renders without crashing', () => {
    render(
      <Settings
        profile={profile}
        profileData={{ preferences: { locations: 'Remote', roles: '' } }}
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
        profileData={{ preferences: { locations: 'Remote', roles: '' } }}
        onUpdate={vi.fn()} onSwitch={vi.fn()} onLogout={vi.fn()}
        isMobile={true} isTablet={false} isAdmin={true} onOpenAdmin={vi.fn()}
      />
    )
    expect(getByText('Admin panel')).toBeTruthy()
  })
})
```

- [ ] **Step 5: Run tests**

```bash
npm test
```
Expected: all tests pass including the new admin button test

- [ ] **Step 6: Commit**

```bash
git add src/components/Settings.jsx src/__tests__/Settings.test.jsx
git commit -m "feat: responsive Settings — full-bleed on phone, admin button on mobile/tablet"
```

---

## Task 8: Jobs Modals — Bottom Sheet on Phone

**Files:**
- Modify: `src/components/Jobs.jsx`

The three modals (`CustomizeModal`, `ApplyModal`, `TailorModal`) each have the same overlay+box structure. Each outer `<div>` is the overlay at `zIndex: 200`, and the inner `<div>` is the floating card.

- [ ] **Step 1: Add `isMobile` prop to `Jobs` and the three modal components**

Update `Jobs` function signature:
```js
export function Jobs({ profile, profileData, isMobile = false }) {
```

Update `CustomizeModal` signature:
```js
function CustomizeModal({ job, profileData, onSave, onClose, isMobile = false }) {
```

Update `ApplyModal` signature:
```js
function ApplyModal({ job, onConfirm, onClose, isMobile = false }) {
```

Update `TailorModal` signature:
```js
function TailorModal({ job, profileData, onSave, onClose, isMobile = false }) {
```

- [ ] **Step 2: Pass `isMobile` from `Jobs` to each modal at call site**

Find the three modal renders near the bottom of `Jobs.jsx` (lines ~645–650) and add `isMobile={isMobile}` to each:
```jsx
{customizeJob && profileData && <CustomizeModal ... isMobile={isMobile} />}
{applyJob && <ApplyModal ... isMobile={isMobile} />}
{tailorJob && <TailorModal ... isMobile={isMobile} />}
```

- [ ] **Step 3: Add bottom sheet helper style**

Add a helper at the top of `Jobs.jsx` (after imports):
```js
const sheetContainer = (isMobile) => isMobile
  ? {
      position: 'fixed', bottom: 0, left: 0, right: 0,
      maxHeight: '90vh', overflow: 'auto',
      borderRadius: '16px 16px 0 0',
      zIndex: 1001,
      animation: 'sheetIn 0.28s cubic-bezier(0.32, 0.72, 0, 1) both',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }
  : {}

const dragHandle = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
    <div style={{ width: 32, height: 4, borderRadius: 2, background: 'var(--border)' }} />
  </div>
)
```

- [ ] **Step 4: Update `CustomizeModal` container**

The inner modal `<div>` (currently `{ ...C.card, maxWidth: 660, ... }`) becomes:
```jsx
<div style={isMobile
  ? { background: 'var(--bg-card)', width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', ...sheetContainer(isMobile) }
  : { ...C.card, maxWidth: 660, width: '100%', maxHeight: '85vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }
}>
  {isMobile && dragHandle()}
  {/* existing content unchanged */}
```

Apply the same pattern to `ApplyModal` and `TailorModal`.

- [ ] **Step 5: Run tests**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/Jobs.jsx
git commit -m "feat: Jobs modals render as bottom sheet on phone"
```

---

## Task 9: Applications Modal + Status Grid

**Files:**
- Modify: `src/components/Applications.jsx`
- Modify: `src/__tests__/TaskModal.test.jsx`

- [ ] **Step 1: Add `isMobile` to `Applications` and `TaskModal`**

Update `Applications` signature:
```js
export function Applications({ profile, isMobile = false }) {
```

Update `TaskModal` signature (found near top of file):
```js
function TaskModal({ app, profileId, onClose, isMobile = false }) {
```

- [ ] **Step 2: Pass `isMobile` from `Applications` to `TaskModal` at call site**

Find the `<TaskModal>` render near the bottom of `Applications.jsx` and add `isMobile={isMobile}`:
```jsx
{taskApp && <TaskModal app={taskApp} profileId={profile.id} onClose={() => setTaskApp(null)} isMobile={isMobile} />}
```

- [ ] **Step 3: Make `TaskModal` a bottom sheet on phone**

Add the same `sheetContainer` / `dragHandle` helpers at the top of `Applications.jsx` (after imports):
```js
const sheetContainer = (isMobile) => isMobile
  ? {
      position: 'fixed', bottom: 0, left: 0, right: 0,
      maxHeight: '90vh', overflow: 'auto',
      borderRadius: '16px 16px 0 0',
      zIndex: 1001,
      animation: 'sheetIn 0.28s cubic-bezier(0.32, 0.72, 0, 1) both',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }
  : {}

const dragHandle = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
    <div style={{ width: 32, height: 4, borderRadius: 2, background: 'var(--border)' }} />
  </div>
)
```

In `TaskModal`, the inner `<div>` (currently `{ background: 'var(--bg-card)', borderRadius: 12, width: '100%', maxWidth: 500, ... }`) becomes:
```jsx
<div style={isMobile
  ? { background: 'var(--bg-card)', width: '100%', display: 'flex', flexDirection: 'column', maxHeight: '90vh', ...sheetContainer(isMobile) }
  : { background: 'var(--bg-card)', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)', animation: 'modalIn 0.18s ease' }
}>
  {isMobile && dragHandle()}
  {/* existing header + content unchanged */}
```

- [ ] **Step 4: Make the status counts grid responsive**

Find line ~292: `gridTemplateColumns: 'repeat(4, minmax(0, 1fr))'` inside the `<div style={{ padding: '2rem' }}>` block. Update:
```js
gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
```

Also add `padding: isMobile ? '0.75rem' : '2rem'` to the outer padding wrapper (line ~291).

- [ ] **Step 5: Add text truncation to status labels**

Each status cell (the `.map((s) => ...)` items at line ~293) has a label `<p>` with `{s.label}`. Add truncation styles so labels don't overflow on phone:
```jsx
<p style={{ margin: '0 0 4px', fontSize: 12, color: s.c, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</p>
```

- [ ] **Step 6: Update `TaskModal.test.jsx` to pass `isMobile`**

Open `src/__tests__/TaskModal.test.jsx`. Find the `<TaskModal>` render call and add `isMobile={false}`. Note: `Resume`, `Dashboard`, and other components receive `isMobile` as a plain prop — they do not call `useBreakpoint` themselves, so no `matchMedia` mock is needed in their test files.

- [ ] **Step 7: Run tests**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add src/components/Applications.jsx src/__tests__/TaskModal.test.jsx
git commit -m "feat: Applications TaskModal bottom sheet on phone, status grid 4→2 col"
```

---

## Task 10: Final Verification + ROADMAP Update

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```
Expected: all 140+ tests pass, no regressions

- [ ] **Step 2: Update ROADMAP.md**

Move "Mobile layout" from Low Priority / Nice-to-Have backlog into the ✅ Implemented section. Add it to the Premium App Suite entry or as its own bullet:

```markdown
- **Responsive layout** — two-breakpoint responsive design: 64px icon rail on tablet (481–768px); bottom tab bar on phone (≤480px); bottom-sheet modals; content grid reflow on all pages
```

Remove the old line from Low Priority:
```markdown
- **Mobile layout** — responsive improvements for small screens (current layout is desktop-first)
```

- [ ] **Step 3: Final commit**

```bash
git add ROADMAP.md
git commit -m "docs: mark responsive mobile layout as implemented in ROADMAP"
```
