# Design Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 UI issues identified in the 2026-03-23 design review — 2 critical layout bugs and 5 warnings across Applications, Settings, Resume, and Dashboard.

**Architecture:** All changes are isolated inline-style edits within existing component files. No new files, no new dependencies. Fix 1 adds a small `overflowMenuApp` state and a conditional render branch inside `Applications.jsx`. Fix 2 restructures the JSX wrapper hierarchy in `Settings.jsx`. Remaining fixes are one-liners.

**Tech Stack:** React 18, Vite, inline styles, Vitest + React Testing Library. Run tests with `npm test`. No TypeScript.

---

## File Map

| File | What changes |
|---|---|
| `src/components/Applications.jsx` | Fix 1 (overflow menu), Fix 4 (aria-label on select) |
| `src/components/Settings.jsx` | Fix 2 (banner full-width restructure), Fix 3 (remove hex fallbacks) |
| `src/components/Resume.jsx` | Fix 5 (aria-label on both file inputs), Fix 6 (conditional period separator) |
| `src/components/Dashboard.jsx` | Fix 7 (heading overflow ellipsis) |
| `src/__tests__/Applications.test.jsx` | New tests for overflow menu and aria-label |
| `src/__tests__/Settings.test.jsx` | New test for banner render outside maxWidth |
| `src/__tests__/Resume.test.jsx` | New tests for aria-labels and missing period |
| `src/__tests__/Dashboard.test.jsx` | New test for heading overflow style |

---

## Task 1: Applications — mobile overflow menu (Fix 1 + Fix 4)

**Files:**
- Modify: `src/components/Applications.jsx:247-390`
- Modify: `src/__tests__/Applications.test.jsx`

The card currently renders a right-side column with `flexShrink: 0` containing a `<select>` and 5 buttons. On mobile this overflows. Replace it with a `•••` button that opens an absolute-positioned dropdown, with a fixed backdrop to close on outside click.

### Existing test setup (do not change):
```js
// src/__tests__/Applications.test.jsx already mocks dbGet/dbSet and renders
// Applications with profile = { id: 'p1', name: 'Test User' }
// mockApp has jobId: 'j1', jobTitle: 'Software Engineer', company: 'Stripe', etc.
```

- [ ] **Step 1: Write failing tests for overflow menu**

Add to `src/__tests__/Applications.test.jsx`:

```js
describe('mobile overflow menu', () => {
  beforeEach(() => {
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose src/__tests__/Applications.test.jsx
```
Expected: new tests FAIL (overflow menu not yet implemented).

- [ ] **Step 3: Add `overflowMenuApp` state to Applications**

In `src/components/Applications.jsx`, find the state block at line ~253 and add one line:

```js
export function Applications({ profile, isMobile = false }) {
  const [apps, setApps] = useState([])
  const [editingNotes, setEditingNotes] = useState(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [taskModalApp, setTaskModalApp] = useState(null)
  const [activityModalApp, setActivityModalApp] = useState(null)
  const [hoveredApp, setHoveredApp] = useState(null)
  const [overflowMenuApp, setOverflowMenuApp] = useState(null)   // ← add this
```

- [ ] **Step 4: Add `position: 'relative'` to the card container**

Find the card `<div>` (line ~333) that has `...C.card, borderLeft, transform, boxShadow`. Add `position: 'relative'`:

```js
style={{
  ...C.card, marginBottom: 8,
  position: 'relative',                                          // ← add this
  borderLeft: `3px solid ${STATUS_BORDER[a.status] || 'var(--border)'}`,
  transform: hoveredApp === a.jobId ? 'translateY(-2px)' : 'translateY(0)',
  boxShadow: hoveredApp === a.jobId ? 'var(--shadow-md)' : 'var(--shadow-sm)',
  transition: 'transform 0.15s, box-shadow 0.15s',
}}
```

- [ ] **Step 5: Replace the action column with conditional mobile/desktop render**

Find the existing actions column div (line ~368, the one with `flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0`). Replace it and everything inside with:

```jsx
{isMobile ? (
  <div style={{ position: 'relative', flexShrink: 0 }}>
    <button
      onClick={() => setOverflowMenuApp(overflowMenuApp === a.jobId ? null : a.jobId)}
      style={{ ...btn(), fontSize: 13, padding: '4px 10px', fontWeight: 700, letterSpacing: 2 }}
    >•••</button>
    {overflowMenuApp === a.jobId && (
      <div style={{
        position: 'absolute', right: 0, top: '100%', zIndex: 10,
        minWidth: 180, background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: 8,
        boxShadow: 'var(--shadow-md)', padding: 8,
      }}>
        <select
          aria-label="Application status"
          value={a.status}
          onChange={(e) => { updateStatus(a.jobId, e.target.value); setOverflowMenuApp(null) }}
          style={{ ...C.input, width: '100%', fontSize: 12, padding: '5px 8px', marginBottom: 6 }}
        >
          {['applied', 'interview', 'offer', 'rejected'].map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        {[
          { label: 'Tasks', onClick: () => { setTaskModalApp(a); setOverflowMenuApp(null) } },
          { label: 'Activity', onClick: () => { setActivityModalApp(a); setOverflowMenuApp(null) } },
          { label: 'Notes', onClick: () => { setNotesDraft(a.notes || ''); setEditingNotes(a.jobId); setOverflowMenuApp(null) } },
          ...(a.url ? [{ label: 'View ↗', href: a.url }] : []),
          { label: 'Remove', onClick: () => { remove(a.jobId); setOverflowMenuApp(null) }, danger: true },
        ].map((item) => item.href
          ? <a key={item.label} href={item.href} target="_blank" rel="noreferrer"
              style={{ ...btn(), display: 'block', width: '100%', textAlign: 'left', fontSize: 12, padding: '5px 8px', marginBottom: 3, textDecoration: 'none' }}
            >{item.label}</a>
          : <button key={item.label} onClick={item.onClick}
              style={{ ...btn(), display: 'block', width: '100%', textAlign: 'left', fontSize: 12, padding: '5px 8px', marginBottom: 3,
                       ...(item.danger ? { color: 'var(--text-error)' } : {}) }}
            >{item.label}</button>
        )}
      </div>
    )}
  </div>
) : (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
    <select
      aria-label="Application status"
      value={a.status}
      onChange={(e) => updateStatus(a.jobId, e.target.value)}
      style={{ ...C.input, width: 'auto', fontSize: 12, padding: '5px 8px' }}
    >
      {['applied', 'interview', 'offer', 'rejected'].map((s) => (
        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
      ))}
    </select>
    <div style={{ display: 'flex', gap: 4 }}>
      <button onClick={() => setTaskModalApp(a)} style={{ ...btn(), fontSize: 11, padding: '4px 8px' }}>Tasks</button>
      <button onClick={() => setActivityModalApp(a)} style={{ ...btn(), fontSize: 11, padding: '4px 8px' }}>Activity</button>
      <button onClick={() => { setNotesDraft(a.notes || ''); setEditingNotes(a.jobId) }} style={{ ...btn(), fontSize: 11, padding: '4px 8px' }}>Notes</button>
      {a.url && <a href={a.url} target="_blank" rel="noreferrer" style={{ ...btn(), fontSize: 11, padding: '4px 8px', textDecoration: 'none' }}>View ↗</a>}
      <button onClick={() => remove(a.jobId)} style={{ ...btn(), fontSize: 11, padding: '4px 8px', color: 'var(--text-error)' }}>Remove</button>
    </div>
  </div>
)}
```

- [ ] **Step 6: Add the backdrop**

Find the closing `</div>` of the `apps.length === 0 ? ... : (...)` block (just before the `{taskModalApp && ...}` modal renders, around line ~385). Add the backdrop immediately before the modals:

```jsx
{overflowMenuApp && (
  <div
    data-testid="overflow-backdrop"
    onClick={() => setOverflowMenuApp(null)}
    style={{ position: 'fixed', inset: 0, zIndex: 9 }}
  />
)}
{taskModalApp && <TaskModal ... />}
```

- [ ] **Step 7: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose src/__tests__/Applications.test.jsx
```
Expected: all tests PASS including the new overflow menu tests.

- [ ] **Step 8: Commit**

```bash
git add src/components/Applications.jsx src/__tests__/Applications.test.jsx
git commit -m "fix: mobile overflow menu for Applications card + aria-label on status select"
```

---

## Task 2: Settings — banner full width (Fix 2 + Fix 3)

**Files:**
- Modify: `src/components/Settings.jsx:22-30`
- Modify: `src/__tests__/Settings.test.jsx`

- [ ] **Step 1: Write failing test for banner width**

Add to `src/__tests__/Settings.test.jsx`:

```js
it('renders hero banner outside the maxWidth container', () => {
  const { container } = render(
    <Settings profile={mockProfile} profileData={mockProfileData} onUpdate={vi.fn()} onSwitch={vi.fn()} onLogout={vi.fn()} isMobile={false} />
  )
  // The outer root div should have no maxWidth style
  const root = container.firstChild
  expect(root.style.maxWidth).toBe('')
  // The banner should be the first child of root (before the constrained wrapper)
  const banner = root.firstChild
  expect(banner.textContent).toContain('Settings')
  // The constrained wrapper (second child of root) should have maxWidth 560px
  const constrained = root.children[1]
  expect(constrained.style.maxWidth).toBe('560px')
})
```

Look at the existing test file to find `mockProfile` and `mockProfileData` — use the same variable names already defined there.

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --reporter=verbose src/__tests__/Settings.test.jsx
```
Expected: new test FAILS.

- [ ] **Step 3: Restructure Settings JSX**

In `src/components/Settings.jsx`, find the `return (` (line ~23). The current structure is:

```jsx
return (
  <div style={{ maxWidth: isMobile ? undefined : 560 }}>
    {/* Hero banner */}
    <div style={{ background: 'linear-gradient(...)', ..., marginBottom: '2rem' }}>
      ...
    </div>
    <div style={{ padding: ... }}>
      ...
    </div>
  </div>
)
```

Change to:

```jsx
return (
  <div>
    {/* Hero banner — full width, no maxWidth constraint */}
    <div style={{ background: 'linear-gradient(135deg, #6c6f85 0%, #4c4f69 100%)', padding: '24px 28px 20px', color: 'white', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: -30, top: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 60, bottom: -40, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
      <div style={{ fontSize: 20, fontWeight: 700, position: 'relative' }}>Settings</div>
    </div>
    {/* Constrained content */}
    <div style={{ maxWidth: isMobile ? undefined : 560, padding: isMobile ? '1.5rem 0.75rem 2rem' : '2rem 2rem 2rem' }}>
      ... (all existing card content unchanged)
    </div>
  </div>
)
```

Note: `marginBottom: '2rem'` is removed from the banner div — spacing is now handled by `paddingTop` on the content wrapper.

- [ ] **Step 4: Fix hex fallbacks (Fix 3)**

In the same file, grep for `var(--text-muted,` and replace all 3 instances:
- `var(--text-muted, #666)` → `var(--text-muted)`
- `var(--text-muted, #888)` → `var(--text-muted)`

```bash
grep -n "text-muted," src/components/Settings.jsx
```
Confirm 3 matches at approximately lines 85, 100, 114, then edit each.

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose src/__tests__/Settings.test.jsx
```
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/Settings.jsx src/__tests__/Settings.test.jsx
git commit -m "fix: Settings banner full width + remove hex fallbacks from text-muted"
```

---

## Task 3: Resume — aria-labels + trailing separator (Fix 5 + Fix 6)

**Files:**
- Modify: `src/components/Resume.jsx:149,159,210`
- Modify: `src/__tests__/Resume.test.jsx`

- [ ] **Step 1: Write failing tests**

Add to `src/__tests__/Resume.test.jsx`. First check the existing test setup to find how the component is rendered and what mock data exists, then add:

```js
it('file inputs have aria-label "Upload resume file"', () => {
  render(<Resume profile={mockProfile} profileData={null} onUpdate={vi.fn()} />)
  const inputs = document.querySelectorAll('input[type="file"]')
  inputs.forEach((input) => {
    expect(input).toHaveAttribute('aria-label', 'Upload resume file')
  })
})

it('experience entry without period renders without trailing separator', () => {
  const profileData = {
    analyzedResume: {
      summary: '',
      skills: [],
      experience: [{ title: 'Engineer', company: 'Acme', period: '' }],
      education: [],
    }
  }
  render(<Resume profile={mockProfile} profileData={profileData} onUpdate={vi.fn()} />)
  // Should show "Acme" but not "Acme · "
  expect(screen.getByText('Acme')).toBeInTheDocument()
  expect(screen.queryByText(/Acme\s*·/)).not.toBeInTheDocument()
})

it('experience entry with period renders separator', () => {
  const profileData = {
    analyzedResume: {
      summary: '',
      skills: [],
      experience: [{ title: 'Engineer', company: 'Acme', period: '2020–2023' }],
      education: [],
    }
  }
  render(<Resume profile={mockProfile} profileData={profileData} onUpdate={vi.fn()} />)
  expect(screen.getByText(/Acme · 2020–2023/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose src/__tests__/Resume.test.jsx
```
Expected: new tests FAIL.

- [ ] **Step 3: Add aria-label to both file inputs**

Find `<input ref={fileRef} type="file"` — it appears twice. Add `aria-label="Upload resume file"` to both:

```jsx
<input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.md" aria-label="Upload resume file" style={{ display: 'none' }} onChange={handleFile} />
```

Verify with:
```bash
grep -n 'type="file"' src/components/Resume.jsx
```
There should be exactly 2 results — patch both.

- [ ] **Step 4: Fix experience trailing separator**

Find the experience map (line ~210):
```jsx
{e.company} · {e.period}
```
Change to:
```jsx
{e.company}{e.period ? ` · ${e.period}` : ''}
```

Find the education map (a few lines below) and check if it renders `{e.institution}` concatenated with a period field. Apply the same guard if so:
```jsx
{e.institution}{e.period ? ` · ${e.period}` : ''}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose src/__tests__/Resume.test.jsx
```
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/Resume.jsx src/__tests__/Resume.test.jsx
git commit -m "fix: aria-labels on file inputs + conditional period separator in resume"
```

---

## Task 4: Dashboard — heading ellipsis (Fix 7)

**Files:**
- Modify: `src/components/Dashboard.jsx:148`
- Modify: `src/__tests__/Dashboard.test.jsx`

- [ ] **Step 1: Write failing test**

Add to `src/__tests__/Dashboard.test.jsx`. Check the existing test setup for how Dashboard is rendered, then add:

```js
it('"Recent applications" heading has overflow ellipsis styles', () => {
  render(<Dashboard profile={mockProfile} profileData={mockProfileData} onNavigate={vi.fn()} isMobile={true} />)
  const heading = screen.getByText('Recent applications')
  expect(heading).toHaveStyle({ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --reporter=verbose src/__tests__/Dashboard.test.jsx
```
Expected: new test FAILS.

- [ ] **Step 3: Add overflow styles to heading**

In `src/components/Dashboard.jsx` at line ~148, change:

```jsx
// Before
<p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 500 }}>Recent applications</p>

// After
<p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Recent applications</p>
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose src/__tests__/Dashboard.test.jsx
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Dashboard.jsx src/__tests__/Dashboard.test.jsx
git commit -m "fix: overflow ellipsis on Recent applications heading at narrow viewports"
```

---

## Task 5: Full test suite + verification

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```
Expected: all tests pass. If any pre-existing tests fail, investigate before continuing — do not suppress failures.

- [ ] **Step 2: Visual spot-check via Playwright**

Run `/design-review` to confirm the 2 critical issues are resolved. The report should show no critical findings for Applications 375px or Settings 1200px banner.

- [ ] **Step 3: Final commit if any stragglers**

If the test run surfaced any trivial fixes (e.g., a test import update), commit them:

```bash
git add -p   # review each change before staging
git commit -m "fix: address test suite issues from design review fixes"
```
