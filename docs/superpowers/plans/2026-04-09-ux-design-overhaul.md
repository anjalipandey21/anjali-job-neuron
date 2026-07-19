# UX & Design Overhaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Transform Job Neuron from inline-styled dark-space theme to a polished, professional dark UI using CSS Modules — replacing sidebar with top nav, removing galaxy backgrounds, and adding hover/focus/loading states.

**Architecture:** CSS Modules (`.module.css`) for scoped styles, global `tokens.css` for design tokens, `animations.css` for keyframes. Incremental migration — inline styles and CSS Modules coexist during transition. No new dependencies.

**Tech Stack:** React (existing), Vite CSS Modules (built-in), CSS custom properties

**Spec:** `docs/superpowers/specs/2026-04-09-ux-design-overhaul-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|----------------|
| `src/styles/tokens.css` | All CSS custom properties (design tokens) — authoritative source |
| `src/styles/animations.css` | All `@keyframes` animations |
| `src/components/TopNav.jsx` | Desktop top navigation bar + profile dropdown |
| `src/components/TopNav.module.css` | TopNav styles with hover/focus states |
| `src/components/BottomNav.jsx` | Mobile bottom tab bar (extracted from Sidebar) |
| `src/components/BottomNav.module.css` | BottomNav styles |
| `src/App.module.css` | Login page + splash styles |
| `src/components/ProfileSelect.module.css` | Profile select page styles |
| `src/components/Dashboard.module.css` | Dashboard layout + metric cards |
| `src/components/Resume.module.css` | Resume page styles |
| `src/components/Jobs.module.css` | Jobs page + job card styles |
| `src/components/Applications.module.css` | Applications pipeline + card styles |
| `src/components/Settings.module.css` | Settings form styles |
| `src/components/MainApp.module.css` | Main app layout (replaces sidebar flex layout) |
| `src/__tests__/TopNav.test.jsx` | TopNav component tests |
| `src/__tests__/BottomNav.test.jsx` | BottomNav component tests |

### Modified Files
| File | Changes |
|------|---------|
| `src/main.jsx` | Import `tokens.css` and `animations.css` |
| `src/lib/styles.jsx` | Remove `GALAXY_IMAGE_URL`, `body` background-image rule; eventually remove `C`, `btn()` |
| `src/App.jsx` | Replace inline styles with CSS Module classes; remove stars/glow |
| `src/components/MainApp.jsx` | Replace `<Sidebar>` with `<TopNav>`; remove sidebar width logic; remove galaxy overlays |
| `src/components/Dashboard.jsx` | Replace inline styles; new metric card layout; remove `GALAXY_IMAGE_URL` import |
| `src/components/Resume.jsx` | Replace inline styles; section cards; skill pills; remove `GALAXY_IMAGE_URL` import |
| `src/components/Jobs.jsx` | Replace inline styles; company logos; hover fix; empty state; remove `GALAXY_IMAGE_URL` import |
| `src/components/Applications.jsx` | Replace inline styles; pipeline colors; remove `GALAXY_IMAGE_URL` import |
| `src/components/Settings.jsx` | Replace inline styles; section cards; toggle switches; remove `GALAXY_IMAGE_URL` import |
| `src/components/ProfileSelect.jsx` | Replace inline styles; hover cards |

### Deleted Files
| File | When |
|------|------|
| `src/components/Sidebar.jsx` | Task 5 (after TopNav + BottomNav are working) |
| `src/__tests__/Sidebar.test.jsx` | Task 5 (replaced by TopNav/BottomNav tests) |

---

## Task 1: Style Infrastructure

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/animations.css`
- Modify: `src/main.jsx`
- Modify: `src/lib/styles.jsx`

- [x] **Step 1: Create `src/styles/` directory**

```bash
mkdir -p src/styles
```

- [x] **Step 2: Create `src/styles/tokens.css`**

Copy all `:root` CSS custom properties from `src/lib/styles.jsx` `GlobalStyles` into this file. Add the new design tokens from the spec (surfaces, typography scale, spacing scale, radius scale, transitions, nav height). This is the authoritative token source going forward.

```css
:root {
  /* ── Backgrounds (existing) ── */
  --bg-page: #06060f;
  --bg-sidebar: #0a0a18;
  --bg-content: #0f1020;
  --bg-card: rgba(255,255,255,0.05);
  --bg-card-hover: rgba(255,255,255,0.08);
  --bg-metric: rgba(255,255,255,0.07);
  --input-bg: rgba(255,255,255,0.06);
  --bg-bottom-nav: rgba(6,6,15,0.88);

  /* ── Borders (existing) ── */
  --border: rgba(255,255,255,0.09);
  --border-light: rgba(255,255,255,0.06);
  --input-border: rgba(255,255,255,0.15);

  /* ── Text (existing) ── */
  --text-main: #ffffff;
  --text-muted: rgba(255,255,255,0.65);
  --text-light: rgba(255,255,255,0.4);
  --text-faint: rgba(255,255,255,0.2);

  /* ── Accent — Indigo/Violet (existing) ── */
  --accent: #6366f1;
  --accent-alt: #8b5cf6;
  --accent-fill: rgba(99,102,241,0.15);
  --accent-border: rgba(99,102,241,0.25);
  --accent-text: #a5b4fc;

  /* ── Buttons (existing) ── */
  --btn-primary-bg: linear-gradient(135deg,#6366f1,#8b5cf6);
  --btn-primary-text: #ffffff;

  /* ── Status badges (existing) ── */
  --badge-new-bg: rgba(99,102,241,0.2);    --badge-new-text: #a5b4fc;    --badge-new-border: rgba(99,102,241,0.3);
  --badge-viewed-bg: rgba(255,255,255,0.08); --badge-viewed-text: rgba(255,255,255,0.4); --badge-viewed-border: rgba(255,255,255,0.12);
  --badge-cust-bg: rgba(139,92,246,0.2);   --badge-cust-text: #c4b5fd;   --badge-cust-border: rgba(139,92,246,0.3);
  --badge-app-bg: rgba(34,197,94,0.15);    --badge-app-text: #86efac;    --badge-app-border: rgba(34,197,94,0.25);
  --badge-int-bg: rgba(234,179,8,0.15);    --badge-int-text: #fde047;    --badge-int-border: rgba(234,179,8,0.25);
  --badge-off-bg: rgba(20,184,166,0.15);   --badge-off-text: #5eead4;    --badge-off-border: rgba(20,184,166,0.25);
  --badge-rej-bg: rgba(239,68,68,0.15);    --badge-rej-text: #fca5a5;    --badge-rej-border: rgba(239,68,68,0.25);

  /* ── Shadows (existing) ── */
  --shadow-sm: 0 2px 8px rgba(0,0,0,0.35);
  --shadow-md: 0 8px 24px rgba(0,0,0,0.4);
  --shadow-lg: 0 16px 48px rgba(0,0,0,0.6);
  --modal-overlay: rgba(0,0,0,0.7);

  /* ── Progress (existing) ── */
  --progress-track: rgba(255,255,255,0.1);

  /* ── Contextual (existing) ── */
  --bg-warning: rgba(249,226,175,0.15);
  --bg-error: rgba(243,139,168,0.15);
  --bg-info: rgba(137,180,250,0.15);
  --bg-success: rgba(166,227,161,0.15);
  --text-warning: #f9e2af;
  --text-error: #f38ba8;
  --text-info: #89b4fa;
  --text-success: #a6e3a1;
  --border-warning: rgba(249,226,175,0.25);
  --border-error: rgba(243,139,168,0.25);
  --border-info: rgba(137,180,250,0.25);
  --border-success: rgba(166,227,161,0.25);

  /* ── NEW: Surfaces — layered elevation without blur ── */
  --bg-surface-1: #0c0c1a;
  --bg-surface-2: #111126;
  --bg-surface-3: #16162e;

  /* ── NEW: Page background gradient (replaces galaxy image) ── */
  --bg-page-gradient: linear-gradient(145deg, #06060f 0%, #0a0a1e 50%, #080815 100%);

  /* ── NEW: Typography scale ── */
  --text-xs: 0.75rem;
  --text-sm: 0.8125rem;
  --text-base: 0.875rem;
  --text-md: 1rem;
  --text-lg: 1.25rem;
  --text-xl: 1.5rem;
  --text-2xl: 1.875rem;

  /* ── NEW: Spacing scale (4px base) ── */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;

  /* ── NEW: Border radius scale ── */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* ── NEW: Transitions ── */
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms ease;

  /* ── NEW: Nav height ── */
  --nav-height: 56px;
}

/* ── Reduced Motion ── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* ── Focus visible baseline ── */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

- [x] **Step 3: Create `src/styles/animations.css`**

Move all `@keyframes` from `GlobalStyles` here, plus new animations:

```css
@keyframes modalIn {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes sheetIn {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 12px rgba(99,102,241,0.2); }
  50%       { box-shadow: 0 0 28px rgba(139,92,246,0.5); }
}
@keyframes countUp {
  from { opacity: 0; transform: scale(0.85); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes slideOut {
  to { opacity: 0; transform: translateX(40px) scale(0.95); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes collapseHeight {
  from { max-height: 500px; margin-bottom: 12px; }
  to { max-height: 0; padding-top: 0; padding-bottom: 0; margin-bottom: 0; overflow: hidden; opacity: 0; }
}

/* NEW */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}
```

- [x] **Step 4: Update `src/main.jsx` — import global styles**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/animations.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [x] **Step 5: Update `src/lib/styles.jsx` — remove galaxy background**

**Do NOT remove the `GALAXY_IMAGE_URL` export yet.** Five components (`Dashboard.jsx`, `Applications.jsx`, `Settings.jsx`, `Jobs.jsx`, `Resume.jsx`) still import it. Removing the export now will cause build warnings. Instead, change it to `export const GALAXY_IMAGE_URL = null` — the components import it but never render it (they pass it to `background-image` which ignores `null`). It will be removed entirely in Task 15 once all components are migrated.

Remove `background-image`, `background-size`, `background-position`, `background-attachment` from the `body` rule in `GlobalStyles`. Replace with:

```css
body {
  background: var(--bg-page-gradient);
  color: var(--text-main);
  font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
}
```

Remove `twinkle` keyframe (no longer used — login page stars are being removed). Keep all other keyframes in `GlobalStyles` for now (existing components still reference them via animation names).

Keep `C`, `btn()`, `STATUS_STYLES`, `Badge` exports unchanged — they'll be consumed by unmigrated components during the transition.

- [x] **Step 6: Run tests to verify nothing broke**

```bash
npm test
```

Expected: All 177 tests pass. The only change is visual (galaxy background removed, tokens added).

- [x] **Step 7: Commit**

```bash
git add src/styles/tokens.css src/styles/animations.css src/main.jsx src/lib/styles.jsx
git commit -m "feat: add CSS design tokens and animations infrastructure

Remove galaxy background image. Add tokens.css with full design token
system (surfaces, typography, spacing, radius, transitions). Add
animations.css with all keyframes. Import both globally in main.jsx.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: TopNav Component

**Files:**
- Create: `src/components/TopNav.jsx`
- Create: `src/components/TopNav.module.css`
- Create: `src/__tests__/TopNav.test.jsx`

- [x] **Step 1: Write TopNav test**

Create `src/__tests__/TopNav.test.jsx`:

```jsx
import { describe, it, vi, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TopNav } from '../components/TopNav'

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
    const activeLink = container.querySelector('[data-active="true"]')
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
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/TopNav.test.jsx
```

Expected: FAIL — `TopNav` module not found.

- [x] **Step 3: Create `src/components/TopNav.module.css`**

```css
.nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--nav-height);
  background: var(--bg-surface-1);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 var(--space-6);
  z-index: 100;
  gap: var(--space-2);
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-right: var(--space-8);
  flex-shrink: 0;
}

.brandIcon {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #8839ef, #7c3aed);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(136, 57, 239, 0.35);
}

.brandName {
  font-size: var(--text-md);
  font-weight: 700;
  color: var(--text-main);
}

.links {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex: 1;
}

.link {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: color var(--transition-base), background var(--transition-base);
  white-space: nowrap;
}

.link:hover {
  color: var(--text-main);
  background: var(--bg-surface-2);
}

.link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.linkActive {
  color: var(--text-main);
  font-weight: 600;
}

.linkActive::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: var(--space-3);
  right: var(--space-3);
  height: 2px;
  background: linear-gradient(90deg, var(--accent), var(--accent-alt));
  border-radius: 1px;
}

.badge {
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: var(--badge-cust-bg);
  color: var(--badge-cust-text);
  margin-left: var(--space-1);
}

.right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-left: auto;
}

.profileBtn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-main);
  font-size: var(--text-sm);
  font-family: inherit;
  cursor: pointer;
  transition: background var(--transition-base), border-color var(--transition-base);
}

.profileBtn:hover {
  background: var(--bg-surface-2);
  border-color: var(--accent-border);
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent-alt));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.dropdown {
  position: absolute;
  top: calc(var(--nav-height) - 4px);
  right: var(--space-6);
  background: var(--bg-surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-2) 0;
  min-width: 200px;
  box-shadow: var(--shadow-lg);
  animation: scaleIn 0.15s ease;
  z-index: 200;
}

.dropdownItem {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-4);
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-family: inherit;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
  text-decoration: none;
}

.dropdownItem:hover {
  background: var(--bg-surface-3);
  color: var(--text-main);
}

.dropdownDivider {
  height: 1px;
  background: var(--border);
  margin: var(--space-2) 0;
}

.signOut {
  color: var(--text-error);
}

.signOut:hover {
  background: var(--bg-error);
}

/* Hide on mobile — bottom nav takes over */
@media (max-width: 480px) {
  .nav {
    display: none;
  }
}
```

- [x] **Step 4: Create `src/components/TopNav.jsx`**

```jsx
import { useState, useRef, useEffect } from 'react'
import s from './TopNav.module.css'

const NAV = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'resume', label: 'Resume' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'applications', label: 'Applications' },
  { id: 'settings', label: 'Settings' },
]

export function TopNav({ tab, setTab, profile, onSwitch, onLogout, userEmail, isAdmin, onOpenAdmin, todayJobCount = 0, openAppCount = 0 }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  const getBadge = (id) => {
    if (id === 'jobs' && todayJobCount > 0) return todayJobCount
    if (id === 'applications' && openAppCount > 0) return openAppCount
    return null
  }

  return (
    <nav className={s.nav} aria-label="Main navigation">
      {/* Brand */}
      <div className={s.brand}>
        <div className={s.brandIcon}>
          <svg width="16" height="16" viewBox="0 0 18 18" fill="white">
            <circle cx="9" cy="6.5" r="3.5"/>
            <path d="M2 16c0-3.5 3.1-5.5 7-5.5s7 2 7 5.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          </svg>
        </div>
        <span className={s.brandName}>Job Neuron</span>
      </div>

      {/* Nav links */}
      <div className={s.links}>
        {NAV.map((n) => {
          const isActive = tab === n.id
          const badge = getBadge(n.id)
          return (
            <button
              key={n.id}
              className={`${s.link} ${isActive ? s.linkActive : ''}`}
              data-active={isActive || undefined}
              onClick={() => setTab(n.id)}
            >
              {n.label}
              {badge && <span className={s.badge}>{badge}</span>}
            </button>
          )
        })}
      </div>

      {/* Right section — profile dropdown */}
      <div className={s.right} ref={dropdownRef}>
        <button
          className={s.profileBtn}
          onClick={() => setDropdownOpen((v) => !v)}
        >
          <div className={s.avatar}>
            {(userEmail?.[0] || 'U').toUpperCase()}
          </div>
          <span>{profile?.name || userEmail}</span>
        </button>

        {dropdownOpen && (
          <div className={s.dropdown}>
            <div style={{ padding: '4px 16px 8px', fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
              {userEmail}
            </div>
            <div className={s.dropdownDivider} />
            <button className={s.dropdownItem} onClick={() => { setDropdownOpen(false); onSwitch() }}>
              Switch profile
            </button>
            {isAdmin && (
              <button className={s.dropdownItem} onClick={() => { setDropdownOpen(false); onOpenAdmin() }}>
                Admin panel
              </button>
            )}
            <a
              className={s.dropdownItem}
              href="https://github.com/jadhavnikhil78/jobhunter-ai/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              Report a bug
            </a>
            <div className={s.dropdownDivider} />
            <button className={`${s.dropdownItem} ${s.signOut}`} onClick={() => { setDropdownOpen(false); onLogout() }}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
```

- [x] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/__tests__/TopNav.test.jsx
```

Expected: All 6 TopNav tests PASS.

- [x] **Step 6: Commit**

```bash
git add src/components/TopNav.jsx src/components/TopNav.module.css src/__tests__/TopNav.test.jsx
git commit -m "feat: add TopNav component with profile dropdown

Desktop top navigation bar with nav links, active tab underline,
badge counts, and profile dropdown (switch profile, admin, bug
report, sign out). Hidden on mobile via CSS media query.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: BottomNav Extraction

**Files:**
- Create: `src/components/BottomNav.jsx`
- Create: `src/components/BottomNav.module.css`
- Create: `src/__tests__/BottomNav.test.jsx`

- [x] **Step 1: Write BottomNav test**

Create `src/__tests__/BottomNav.test.jsx`:

```jsx
import { describe, it, vi, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BottomNav } from '../components/BottomNav'

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

- [x] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/BottomNav.test.jsx
```

Expected: FAIL — `BottomNav` module not found at new path.

- [x] **Step 3: Create `src/components/BottomNav.module.css`**

Move the bottom nav styles from inline to CSS Module. Add `[data-bottom-nav]` styling. Include hover and active states.

```css
.nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  z-index: 100;
  display: flex;
  border-top: 0.5px solid var(--border-light);
  background: var(--bg-bottom-nav);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding-bottom: env(safe-area-inset-bottom);
}

.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  padding: 4px 0;
  color: var(--text-muted);
  border-top: 2px solid transparent;
  position: relative;
  transition: color var(--transition-fast);
}

.tabActive {
  color: var(--accent);
  border-top-color: var(--accent);
}

.tabIcon {
  display: flex;
  font-size: 16px;
  position: relative;
}

.tabLabel {
  font-size: 9px;
  font-weight: 400;
}

.tabLabelActive {
  font-weight: 600;
}

.tabBadge {
  position: absolute;
  top: -4px;
  right: -6px;
  font-size: 9px;
  font-weight: 600;
  padding: 0 3px;
  border-radius: var(--radius-full);
  background: var(--badge-cust-bg);
  color: var(--badge-cust-text);
  min-width: 14px;
  text-align: center;
}
```

- [x] **Step 4: Create `src/components/BottomNav.jsx`**

Extract from `Sidebar.jsx` `BottomNav` component. Import `NAV` icons. Use CSS Module classes.

```jsx
import s from './BottomNav.module.css'

const NAV = [
  {
    id: 'dashboard', label: 'Dashboard',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="2" fill="currentColor" opacity="0.9"/><rect x="9" y="1" width="6" height="6" rx="2" fill="currentColor" opacity="0.5"/><rect x="1" y="9" width="6" height="6" rx="2" fill="currentColor" opacity="0.5"/><rect x="9" y="9" width="6" height="6" rx="2" fill="currentColor" opacity="0.5"/></svg>,
  },
  {
    id: 'resume', label: 'Resume',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/><line x1="5" y1="5.5" x2="11" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="5" y1="8.5" x2="11" y2="8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="5" y1="11.5" x2="8" y2="11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  },
  {
    id: 'jobs', label: 'Find Jobs',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4"/><line x1="11" y1="11" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  },
  {
    id: 'applications', label: 'Applications',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M1 5l7 5 7-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  },
  {
    id: 'settings', label: 'Settings',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  },
]

export function BottomNav({ tab, setTab, todayJobCount = 0, openAppCount = 0, isMobile = false }) {
  if (!isMobile) return null

  return (
    <nav className={s.nav} aria-label="Bottom navigation">
      {NAV.map((n) => {
        const isActive = tab === n.id
        const count = n.id === 'jobs' ? todayJobCount : n.id === 'applications' ? openAppCount : 0
        return (
          <button
            key={n.id}
            className={`${s.tab} ${isActive ? s.tabActive : ''}`}
            onClick={() => setTab(n.id)}
          >
            <span className={s.tabIcon}>
              {n.icon}
              {count > 0 && <span className={s.tabBadge}>{count}</span>}
            </span>
            <span className={`${s.tabLabel} ${isActive ? s.tabLabelActive : ''}`}>
              {n.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
```

- [x] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/__tests__/BottomNav.test.jsx
```

Expected: All 3 BottomNav tests PASS.

- [x] **Step 6: Commit**

```bash
git add src/components/BottomNav.jsx src/components/BottomNav.module.css src/__tests__/BottomNav.test.jsx
git commit -m "feat: extract BottomNav to standalone component with CSS Modules

Mobile bottom tab bar extracted from Sidebar.jsx into its own
component with scoped CSS Module styles.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Wire TopNav + BottomNav into MainApp

**Files:**
- Modify: `src/components/MainApp.jsx`
- Create: `src/components/MainApp.module.css`

- [x] **Step 1: Create `src/components/MainApp.module.css`**

```css
.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-page-gradient);
}

.main {
  flex: 1;
  overflow: auto;
  padding-top: var(--nav-height);
}

/* Mobile: no top nav padding (TopNav hidden), add bottom nav space */
@media (max-width: 480px) {
  .main {
    padding-top: 0;
    padding-bottom: 64px;
  }
}
```

- [x] **Step 2: Update `src/components/MainApp.jsx`**

Key changes:
1. Replace `import { Sidebar, BottomNav } from './Sidebar'` with `import { TopNav } from './TopNav'` and `import { BottomNav } from './BottomNav'`
2. Import CSS module: `import s from './MainApp.module.css'`
3. Remove `sidebarCollapsed` state and `localStorage` logic
4. Remove galaxy background overlay divs
5. Replace `<div style={{ display: 'flex', height: '100vh' }}>` layout with `<div className={s.layout}>`
6. Replace `<Sidebar ...>` with `<TopNav ...>`
7. Replace `<main style={{ flex: 1, ... }}>` with `<main className={s.main}>`
8. Add one-time localStorage cleanup: `localStorage.removeItem('jh_sidebar_collapsed')` in an effect
9. Keep `<BottomNav>` usage unchanged (same props)
10. Keep `<WelcomeModal>` unchanged

The `MainApp` function should look like the following. **CRITICAL: preserve all of the hash-routing, popstate, and sessionStorage logic exactly — do not rewrite from scratch:**

```jsx
import { useState, useEffect, useCallback } from 'react'
import { dbGet, dbSet } from '../lib/api'
import { todayStr } from '../lib/helpers'
import { useBreakpoint } from '../lib/hooks'
import { btn, C } from '../lib/styles'  // Keep — WelcomeModal still uses these
import { TopNav } from './TopNav'
import { BottomNav } from './BottomNav'
import { Dashboard } from './Dashboard'
import { Resume } from './Resume'
import { Jobs } from './Jobs'
import { Applications } from './Applications'
import { Settings } from './Settings'
import s from './MainApp.module.css'

const VALID_TABS = ['dashboard', 'resume', 'jobs', 'applications', 'settings']
const tabFromHash = () => {
  const h = window.location.hash.replace('#', '')
  return VALID_TABS.includes(h) ? h : null
}

// WelcomeModal — keep entirely unchanged (still uses inline styles / btn / C)
function WelcomeModal({ onDismiss, onGetStarted }) { /* ... unchanged ... */ }

export function MainApp({ profile, onSwitch, onLogout, userEmail, isAdmin, onOpenAdmin }) {
  const [tab, setTabRaw] = useState(() => tabFromHash() || sessionStorage.getItem('jh_active_tab') || 'dashboard')
  const [profileData, setProfileData] = useState(null)
  const [todayJobCount, setTodayJobCount] = useState(0)
  const [openAppCount, setOpenAppCount] = useState(0)
  const [showWelcome, setShowWelcome] = useState(false)
  // sidebarCollapsed state REMOVED

  // PRESERVE: wrap setTab to push browser history entries
  const setTab = useCallback((t) => {
    setTabRaw((prev) => {
      if (t !== prev) window.history.pushState({ tab: t }, '', `#${t}`)
      return t
    })
  }, [])

  // PRESERVE: listen for browser back/forward
  useEffect(() => {
    const onPopState = (e) => {
      const t = e.state?.tab || tabFromHash()
      if (t && VALID_TABS.includes(t)) setTabRaw(t)
    }
    window.addEventListener('popstate', onPopState)
    if (!tabFromHash()) window.history.replaceState({ tab }, '', `#${tab}`)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // PRESERVE: profile data fetch
  useEffect(() => {
    dbGet(`jh_p_${profile.id}`).then((d) =>
      setProfileData(d || { ...profile, resumeText: '', analyzedResume: null, preferences: { locations: 'United States', roles: '' } })
    )
  }, [profile.id])

  // PRESERVE: counts for badge display
  useEffect(() => {
    ;(async () => {
      const [todayJobs, apps] = await Promise.all([
        dbGet(`jh_jobs_${profile.id}_${todayStr()}`),
        dbGet(`jh_apps_${profile.id}`),
      ])
      setTodayJobCount((todayJobs || []).length)
      setOpenAppCount((apps || []).filter(a => !['rejected', 'offer'].includes(a.status)).length)
    })()
  }, [profile.id])

  // PRESERVE: sessionStorage active tab
  useEffect(() => { sessionStorage.setItem('jh_active_tab', tab) }, [tab])

  // PRESERVE: welcome modal check
  useEffect(() => {
    dbGet(`jh_welcomed_${profile.id}`).then((v) => { if (!v) setShowWelcome(true) })
  }, [profile.id])

  // NEW: one-time sidebar localStorage cleanup
  useEffect(() => { localStorage.removeItem('jh_sidebar_collapsed') }, [])

  const { isMobile, isTablet } = useBreakpoint()

  // PRESERVE: updateProfile helper unchanged
  const updateProfile = async (updater) => {
    return new Promise((resolve) => {
      setProfileData((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        dbSet(`jh_p_${profile.id}`, next).then(resolve).catch((e) => { console.error(e); resolve() })
        return next
      })
    })
  }

  if (!profileData) return (
    <div className={s.layout} style={{ alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading profile…</p>
    </div>
  )

  return (
    <div className={s.layout}>
      <TopNav
        tab={tab} setTab={setTab} profile={profile} onSwitch={onSwitch}
        onLogout={onLogout} userEmail={userEmail} isAdmin={isAdmin}
        onOpenAdmin={onOpenAdmin} todayJobCount={todayJobCount}
        openAppCount={openAppCount}
      />
      <main className={s.main} id="main-content">
        {tab === 'dashboard'    && <Dashboard    profile={profile} profileData={profileData} setTab={setTab} isMobile={isMobile} isTablet={isTablet} />}
        {tab === 'resume'       && <Resume        profile={profile} profileData={profileData} onUpdate={updateProfile} isMobile={isMobile} />}
        {tab === 'jobs'         && <Jobs          profile={profile} profileData={profileData} isMobile={isMobile} />}
        {tab === 'applications' && <Applications  profile={profile} profileData={profileData} isMobile={isMobile} />}
        {tab === 'settings'     && <Settings      profile={profile} profileData={profileData} onUpdate={updateProfile} onSwitch={onSwitch} onLogout={onLogout} isMobile={isMobile} isTablet={isTablet} isAdmin={isAdmin} onOpenAdmin={onOpenAdmin} />}
      </main>
      <BottomNav tab={tab} setTab={setTab} todayJobCount={todayJobCount} openAppCount={openAppCount} isMobile={isMobile} />
      {showWelcome && (
        <WelcomeModal
          onDismiss={() => { setShowWelcome(false); dbSet(`jh_welcomed_${profile.id}`, true) }}
          onGetStarted={() => { setShowWelcome(false); dbSet(`jh_welcomed_${profile.id}`, true); setTab('resume') }}
        />
      )}
    </div>
  )
}
```

- [x] **Step 3: Run all tests**

```bash
npm test
```

Expected: All tests pass. `Sidebar.test.jsx` imports `Sidebar` directly and will still pass since `Sidebar.jsx` still exists. `MainApp` no longer passes `collapsed`/`onToggleCollapse` to Sidebar, but `Sidebar.test.jsx` doesn't render `MainApp` — it renders `Sidebar` directly, so no prop-warning failures. The Sidebar component will be deleted in Task 5.

- [x] **Step 4: Commit**

```bash
git add src/components/MainApp.jsx src/components/MainApp.module.css
git commit -m "feat: replace Sidebar with TopNav in MainApp layout

Wire TopNav (desktop) and BottomNav (mobile) into MainApp. Remove
sidebar width calculations, galaxy overlay divs, and sidebar
collapse state. Add one-time localStorage cleanup for
jh_sidebar_collapsed.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Delete Sidebar + Update Tests

**Files:**
- Delete: `src/components/Sidebar.jsx`
- Delete: `src/__tests__/Sidebar.test.jsx`
- Modify: `src/__tests__/TopNav.test.jsx` (already exists)
- Modify: `src/__tests__/BottomNav.test.jsx` (already exists)

- [x] **Step 1: Verify no other files import from `Sidebar.jsx`**

```bash
grep -r "from.*Sidebar" src/ --include="*.jsx" --include="*.js"
```

Expected: Only `MainApp.jsx` (already updated in Task 4) and `Sidebar.test.jsx`. If any other files import from Sidebar, update them first.

- [x] **Step 2: Delete `src/components/Sidebar.jsx` and `src/__tests__/Sidebar.test.jsx`**

```bash
rm src/components/Sidebar.jsx src/__tests__/Sidebar.test.jsx
```

- [x] **Step 3: Run all tests**

```bash
npm test
```

Expected: All tests pass. TopNav and BottomNav tests cover the navigation functionality that Sidebar tests previously covered.

- [x] **Step 4: Commit**

```bash
git add -u src/components/Sidebar.jsx src/__tests__/Sidebar.test.jsx
git commit -m "refactor: remove Sidebar component

Sidebar replaced by TopNav (desktop) and BottomNav (mobile).
Tests replaced by TopNav.test.jsx and BottomNav.test.jsx.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Login Page Redesign

**Files:**
- Create: `src/App.module.css`
- Modify: `src/App.jsx`

- [x] **Step 1: Create `src/App.module.css`**

```css
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--bg-page-gradient);
  padding: var(--space-5);
}

.loginCard {
  background: var(--bg-surface-2);
  border: 1px solid var(--border);
  border-top: 2px solid var(--accent);
  border-radius: var(--radius-xl);
  padding: var(--space-10) var(--space-8);
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: var(--shadow-lg);
  animation: fadeInUp 0.4s ease;
}

.loginSubtext {
  color: var(--text-muted);
  font-size: var(--text-base);
  margin: var(--space-2) 0 var(--space-8);
  text-align: center;
  line-height: 1.6;
}

.btnPrimary {
  width: 100%;
  padding: 12px 0;
  background: linear-gradient(135deg, var(--accent), var(--accent-alt));
  color: var(--btn-primary-text);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: filter var(--transition-base);
}

.btnPrimary:hover {
  filter: brightness(1.15);
}

.btnPrimary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.btnSecondary {
  width: 100%;
  padding: 12px 0;
  background: transparent;
  color: var(--text-main);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  margin-top: var(--space-2);
  transition: background var(--transition-base), border-color var(--transition-base);
}

.btnSecondary:hover {
  background: var(--bg-surface-3);
  border-color: var(--accent-border);
}

.btnSecondary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.inviteNote {
  color: var(--text-light);
  font-size: var(--text-xs);
  margin-top: var(--space-5);
  text-align: center;
}

.splash {
  color: var(--text-muted);
  font-size: var(--text-sm);
  margin-top: var(--space-3);
}
```

- [x] **Step 2: Update `src/App.jsx`**

Remove twinkling stars array, glow div, and inline `styles` object. Import CSS Module. Replace `LoginScreen` and `Splash` with CSS Module classes. Keep all logic (Identity init, role resolution) unchanged.

Key changes to `LoginScreen`:
- Remove the stars `map` and glow `div`
- Use `s.center` instead of `styles.center`
- Use `s.loginCard` instead of `styles.loginCard`
- Use `s.btnPrimary` / `s.btnSecondary` / `s.inviteNote` / `s.loginSubtext`
- Remove the inline `styles` const at the bottom of the file

- [x] **Step 3: Run tests**

```bash
npm test
```

Expected: All tests pass (no login page tests exist that check styles).

- [x] **Step 4: Commit**

```bash
git add src/App.jsx src/App.module.css
git commit -m "feat: redesign login page with CSS Modules

Remove twinkling stars and glow effects. Add accent border-top
on login card, larger card size, hover states on buttons, and
fadeInUp entry animation. Use CSS Module for all styles.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: ProfileSelect Redesign

**Files:**
- Create: `src/components/ProfileSelect.module.css`
- Modify: `src/components/ProfileSelect.jsx`

- [x] **Step 1: Create `src/components/ProfileSelect.module.css`**

Style profile cards with `--bg-surface-2`, hover → `--bg-surface-3` with border color shift, subtle scale on hover. "Create new profile" card gets dashed border with accent hover. Form inputs get focus rings. All buttons use CSS hover states.

- [x] **Step 2: Update `src/components/ProfileSelect.jsx`**

Replace all inline `style={{}}` objects with CSS Module classes. Remove `hoveredProfile` state (CSS `:hover` handles this). Keep all logic unchanged.

- [x] **Step 3: Run tests**

```bash
npx vitest run src/__tests__/ProfileSelect.test.jsx
```

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add src/components/ProfileSelect.jsx src/components/ProfileSelect.module.css
git commit -m "feat: redesign ProfileSelect with CSS Modules

Profile cards with surface-2 backgrounds, hover scale/border
transitions, dashed create-new card, and focus rings on inputs.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Dashboard Redesign

**Files:**
- Create: `src/components/Dashboard.module.css`
- Modify: `src/components/Dashboard.jsx`

- [x] **Step 1: Create `src/components/Dashboard.module.css`**

Key classes:
- `.page` — padding, max-width, animation `fadeInUp`
- `.metricsGrid` — `display: grid; grid-template-columns: repeat(4, 1fr)` on desktop, `repeat(2, 1fr)` on tablet, `1fr` on mobile
- `.metricCard` — `--bg-surface-2`, no backdrop-filter, left accent bar (4px, colored per metric)
- `.metricValue` — `font-size: var(--text-2xl)`, `countUp` animation
- `.metricLabel` — `font-size: var(--text-sm)`, `--text-muted`
- `.quickActions` — grid of clickable cards with hover states
- `.recentApps` and `.upcomingTasks` — side by side on desktop, stacked on mobile
- `.card` — `--bg-surface-2`, border, `--radius-lg`, hover states

- [x] **Step 2: Update `src/components/Dashboard.jsx`**

Replace inline styles with CSS Module classes. Remove `GALAXY_IMAGE_URL` import. Remove `hoveredMetric` state (CSS handles hover). Add colored accent bars to each metric. Keep all data fetching and logic unchanged.

- [x] **Step 3: Run tests**

```bash
npx vitest run src/__tests__/Dashboard.test.jsx
```

Expected: PASS. Note: The "overflow ellipsis styles" test (`Dashboard heading styles`) may need updating since styles are now in CSS Modules rather than inline. If it fails, update the test to check for the CSS Module class instead of inline style properties.

- [x] **Step 4: Commit**

```bash
git add src/components/Dashboard.jsx src/components/Dashboard.module.css
git commit -m "feat: redesign Dashboard with CSS Modules

4-column metric grid with colored accent bars and countUp animation.
Quick actions as hoverable cards. Side-by-side recent apps + tasks.
Remove backdrop-filter and galaxy background.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Resume Redesign

**Files:**
- Create: `src/components/Resume.module.css`
- Modify: `src/components/Resume.jsx`

- [x] **Step 1: Create `src/components/Resume.module.css`**

Key classes:
- `.page` — padding, animation
- `.uploadZone` — dashed border, centered icon, hover highlight
- `.sectionCard` — distinct cards for About, Skills, Experience, Education
- `.skillPill` — inline pill/tag for each skill
- `.experienceEntry` — card-per-job with company, title, dates
- `.atsScore` — large score number or circular progress
- `.tabBar` — Profile / ATS Score tabs with underline indicator

- [x] **Step 2: Update `src/components/Resume.jsx`**

Replace inline styles with CSS Module classes. Remove `GALAXY_IMAGE_URL` import. Skills render as pills. Experience entries get visual separation. Keep all PDF parsing, AI analysis, and state logic unchanged.

- [x] **Step 3: Run tests**

```bash
npx vitest run src/__tests__/Resume.test.jsx
```

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add src/components/Resume.jsx src/components/Resume.module.css
git commit -m "feat: redesign Resume with CSS Modules

Section cards for parsed resume, skill pills, experience cards,
drag-drop upload zone, larger ATS score display. Remove
backdrop-filter and galaxy background.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 10: Jobs Redesign

**Files:**
- Create: `src/components/Jobs.module.css`
- Modify: `src/components/Jobs.jsx`

- [x] **Step 1: Create `src/components/Jobs.module.css`**

Key classes:
- `.page` — padding, animation
- `.filterBar` — card-style container, input focus rings
- `.emptyState` — centered SVG icon, headline, subtext, large CTA button
- `.jobCard` — `--bg-surface-2`, hover → `--bg-surface-3` + translateY(-1px) + accent border (all via CSS)
- `.companyAvatar` — 36px circle, flex center, overflow hidden (for logo `<img>`)
- `.matchScore` — colored badge (green/yellow/red based on score)
- `.salary` — highlighted if present
- `.skeleton` — shimmer animation placeholder cards
- `.modal` — overlay + card for Customize/Apply/Tailor modals

CRITICAL: Preserve `.slideOut` and `.collapseHeight` animation classes exactly as-is (timing-critical for apply animation). These use the existing `@keyframes` by name.

- [x] **Step 2: Update `src/components/Jobs.jsx`**

Replace inline styles with CSS Module classes. Key changes:
1. Remove `GALAXY_IMAGE_URL` import
2. **Company logo fix:** In `JobCard`, render `<img src={job.companyLogo}>` with `onError` fallback to initials (React state `imgFailed`)
3. **Hover fix:** Remove `hovered` state and `onMouseEnter`/`onMouseLeave` from `JobCard`. CSS `.jobCard:hover` handles this.
4. **Empty state:** SVG magnifying glass icon, headline, subtext, centered button
5. **Match score coloring:** Green >80%, yellow >60%, red <60%
6. Keep all business logic unchanged (search, apply, customize, tailor, skip)
7. Keep apply animation timing (`setTimeout(750)` with functional `setJobs`) unchanged

- [x] **Step 3: Run tests**

```bash
npx vitest run src/__tests__/Jobs.test.jsx
```

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add src/components/Jobs.jsx src/components/Jobs.module.css
git commit -m "feat: redesign Jobs with CSS Modules

Company logos with fallback, CSS hover states (fixes touch device
stuck highlight), colored match scores, empty state with SVG
illustration, skeleton loading. Remove backdrop-filter and galaxy
background. Preserve apply animation timing.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 11: Applications Redesign

**Files:**
- Create: `src/components/Applications.module.css`
- Modify: `src/components/Applications.jsx`

- [x] **Step 1: Create `src/components/Applications.module.css`**

Key classes:
- `.pipeline` — grid of 4 status count cards, each with distinct status color
- `.pipelineCard` — larger numbers, status-colored left bar
- `.appCard` — tighter layout, hover states, status badge prominent
- `.actionBtn` — icon-only on desktop with `title` attribute for tooltip
- `.modal` — task modal, add job modal with better visual hierarchy

- [x] **Step 2: Update `src/components/Applications.jsx`**

Replace inline styles. Remove `GALAXY_IMAGE_URL` import. Pipeline counts get colored per status. Application cards use CSS hover. Keep all logic unchanged.

- [x] **Step 3: Run tests**

```bash
npx vitest run src/__tests__/Applications.test.jsx
```

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add src/components/Applications.jsx src/components/Applications.module.css
git commit -m "feat: redesign Applications with CSS Modules

Color-coded pipeline counters, hoverable app cards, icon action
buttons. Remove backdrop-filter and galaxy background.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 12: Settings Redesign

**Files:**
- Create: `src/components/Settings.module.css`
- Modify: `src/components/Settings.jsx`

- [x] **Step 1: Create `src/components/Settings.module.css`**

Key classes:
- `.page` — padding, animation
- `.sectionCard` — each settings group in its own card
- `.sectionHeader` — subtle header with icon
- `.toggle` — custom styled toggle switch (replaces checkbox)
- `.input` — focus ring with `--accent-border`
- `.saveBtn` — primary button, sticky at bottom when changes pending

- [x] **Step 2: Update `src/components/Settings.jsx`**

Replace inline styles. Remove `GALAXY_IMAGE_URL` import. Each settings group in a section card. Toggle switches for boolean settings. Keep all logic unchanged.

- [x] **Step 3: Run tests**

```bash
npx vitest run src/__tests__/Settings.test.jsx
```

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add src/components/Settings.jsx src/components/Settings.module.css
git commit -m "feat: redesign Settings with CSS Modules

Section cards per settings group, custom toggle switches, input
focus rings. Remove backdrop-filter and galaxy background.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 13: AdminPanel + WelcomeModal Visual Touch

**Files:**
- Modify: `src/AdminPanel.jsx`
- Modify: `src/components/MainApp.jsx` (WelcomeModal section)

- [x] **Step 1: Update AdminPanel surface colors**

Replace `var(--bg-card)` with `var(--bg-surface-2)` in AdminPanel's inline styles. Replace drawer background with `rgba(10,10,24,0.97)` (opaque, fixes the bleed-through bug). No CSS Module migration needed for AdminPanel — it's low-traffic and the inline style changes are minimal.

- [x] **Step 2: Update WelcomeModal**

In `MainApp.jsx`, update WelcomeModal's inline styles to use `--bg-surface-2` for the card background and `--bg-surface-3` for the step cards. Keep all logic unchanged.

- [x] **Step 3: Run tests**

```bash
npm test
```

Expected: All tests pass.

- [x] **Step 4: Commit**

```bash
git add src/AdminPanel.jsx src/components/MainApp.jsx
git commit -m "fix: update AdminPanel and WelcomeModal surface colors

AdminPanel drawer uses opaque background (fixes bleed-through).
WelcomeModal cards use surface-2/surface-3 tokens.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 14: Accessibility Pass

**Files:**
- Modify: `src/styles/tokens.css` (skip link styles)
- Modify: `src/App.jsx` (skip link, semantic `<main>`)
- Modify: various components (semantic HTML, aria labels)

- [x] **Step 1: Add skip-to-content link**

In `src/App.jsx`, add a visually hidden skip link as the first child:

```jsx
<a href="#main-content" className={s.skipLink}>Skip to content</a>
```

Add to `src/App.module.css`:
```css
.skipLink {
  position: absolute;
  top: -40px;
  left: 0;
  padding: 8px 16px;
  background: var(--accent);
  color: #fff;
  z-index: 9999;
  transition: top 0.2s;
}
.skipLink:focus {
  top: 0;
}
```

- [x] **Step 2: Add `id="main-content"` to the `<main>` element in MainApp**

In `MainApp.jsx`:
```jsx
<main className={s.main} id="main-content">
```

- [x] **Step 3: Verify semantic HTML**

Check that TopNav uses `<nav aria-label="Main navigation">` (already done in Task 2). Check that BottomNav uses `<nav aria-label="Bottom navigation">` (already done in Task 3). Check that page sections use appropriate headings.

- [x] **Step 4: Verify reduced motion**

The `@media (prefers-reduced-motion: reduce)` rule was added in `tokens.css` in Task 1. Verify it's working by inspecting the computed styles with `prefers-reduced-motion: reduce` set.

- [x] **Step 5: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [x] **Step 6: Commit**

```bash
git add src/App.jsx src/App.module.css src/components/MainApp.jsx
git commit -m "feat: accessibility pass — skip link, semantic HTML, focus states

Add skip-to-content link, main content landmark ID, aria labels
on navigation elements. Reduced motion support via tokens.css.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 15: Final Cleanup

> **Prerequisite:** `WelcomeModal` in `MainApp.jsx` still uses `btn()` and `C` (set in Task 13). Do NOT delete `btn()` or `C` until `WelcomeModal`'s inline styles have been migrated to CSS Module classes. If `WelcomeModal` migration was deferred, complete it before this task.

**Files:**
- Modify: `src/lib/styles.jsx`
- Modify: `src/components/MainApp.jsx` (migrate WelcomeModal styles if not done in Task 13)
- Modify: any remaining files importing `C`, `btn`, or `GALAXY_IMAGE_URL`

- [x] **Step 1: Search for remaining `C.card`, `C.metricCard`, `C.input`, `btn(`, `GALAXY_IMAGE_URL` usage**

```bash
grep -rn "C\.\(card\|metricCard\|input\)" src/ --include="*.jsx"
grep -rn "btn(" src/ --include="*.jsx"
grep -rn "GALAXY_IMAGE_URL" src/ --include="*.jsx"
```

If any files still import these, update them to use CSS Module classes or remove unused imports.

- [x] **Step 2: Remove deprecated exports from `styles.jsx`**

Remove `GALAXY_IMAGE_URL`, `C` object, and `btn()` function exports. Keep `GlobalStyles` (now keyframes-only after removing `:root` block — or keep `:root` if any runtime consumers remain), `STATUS_STYLES`, and `Badge`.

**Important:** Before removing `GlobalStyles` `:root` block, verify that `tokens.css` (imported in `main.jsx`) provides all the same variables. If yes, simplify `GlobalStyles` to only emit the `[data-bottom-nav]` styles (for backdrop-filter). If any component still uses `GlobalStyles` vars at runtime, keep them.

- [x] **Step 3: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [x] **Step 4: Run lint**

```bash
npm run lint
```

Fix any lint errors.

- [x] **Step 5: Commit**

```bash
git add src/lib/styles.jsx
git commit -m "refactor: remove deprecated C, btn(), GALAXY_IMAGE_URL from styles

All components now use CSS Modules. Deprecated exports removed.
GlobalStyles simplified to keyframes and bottom-nav backdrop-filter.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 16: Update Project Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/USER-GUIDE.md`

- [x] **Step 1: Update `CLAUDE.md` coding conventions**

In the "Coding Conventions" section, replace:
```
- **No CSS framework** — all styles are inline React style objects; do not add Tailwind, Bootstrap, etc.
```

With:
```
- **CSS Modules** — all styles use `.module.css` files (one per component); do not add Tailwind, Bootstrap, etc. Inline `style={{}}` only for truly dynamic/computed values (e.g., animation delays from index). Design tokens live in `src/styles/tokens.css`.
```

Update the "Repository Layout" section to reflect the new file structure (add `src/styles/`, `TopNav`, `BottomNav`, `*.module.css` files; remove `Sidebar.jsx`).

Update the "What to Preserve" section:
- Remove sidebar-related items (`jh_sidebar_collapsed`, sidebar collapse state)
- Add: `--nav-height: 56px` in tokens.css, TopNav on desktop / BottomNav on mobile pattern, CSS Module file co-location

- [x] **Step 2: Update `docs/USER-GUIDE.md`**

Update any references to the sidebar navigation to describe the new top navigation bar. Update screenshots if they exist in the guide.

- [x] **Step 3: Commit**

```bash
git add CLAUDE.md docs/USER-GUIDE.md
git commit -m "docs: update CLAUDE.md and USER-GUIDE.md for design overhaul

Update coding conventions to CSS Modules, update file structure
to reflect TopNav/BottomNav, update navigation documentation.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Style infrastructure (tokens, animations) | `tokens.css`, `animations.css`, `main.jsx`, `styles.jsx` |
| 2 | TopNav component | `TopNav.jsx`, `TopNav.module.css`, test |
| 3 | BottomNav extraction | `BottomNav.jsx`, `BottomNav.module.css`, test |
| 4 | Wire TopNav + BottomNav into MainApp | `MainApp.jsx`, `MainApp.module.css` |
| 5 | Delete Sidebar + update tests | Remove `Sidebar.jsx`, `Sidebar.test.jsx` |
| 6 | Login page redesign | `App.jsx`, `App.module.css` |
| 7 | ProfileSelect redesign | `ProfileSelect.jsx`, `.module.css` |
| 8 | Dashboard redesign | `Dashboard.jsx`, `.module.css` |
| 9 | Resume redesign | `Resume.jsx`, `.module.css` |
| 10 | Jobs redesign (+ company logos, hover fix) | `Jobs.jsx`, `.module.css` |
| 11 | Applications redesign | `Applications.jsx`, `.module.css` |
| 12 | Settings redesign | `Settings.jsx`, `.module.css` |
| 13 | AdminPanel + WelcomeModal visual touch | `AdminPanel.jsx`, `MainApp.jsx` |
| 14 | Accessibility pass | Skip link, semantic HTML, focus states |
| 15 | Final cleanup | Remove deprecated `styles.jsx` exports |
| 16 | Update documentation | `CLAUDE.md`, `USER-GUIDE.md` |
