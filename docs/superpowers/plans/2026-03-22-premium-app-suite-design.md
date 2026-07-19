# Premium App Suite Design Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Job Neuron's full frontend into a premium SaaS aesthetic using the approved "Direction B — Premium App Suite" spec, touching 9 files with zero new dependencies.

**Architecture:** All changes are purely visual — inline React style objects only, no CSS framework, no new routes or KV keys. We layer on top of the existing Catppuccin design token system, adding one new token (`--shadow-md`) and a modal keyframe animation. Each component gets a gradient hero banner, elevated cards with hover lift, and richer typography.

**Tech Stack:** React (JSX), Vite, inline styles, Vitest + React Testing Library

---

## File Map

| File | What changes |
|---|---|
| `src/lib/styles.jsx` | New `--shadow-md` token (light + dark), Badge `borderRadius` 6→20, `@keyframes modalIn` |
| `src/components/Sidebar.jsx` | 240px width, Job Neuron branding, SVG nav icons, section labels, active accent bar, badge counts, user card footer |
| `src/components/MainApp.jsx` | Fetch `todayJobCount` + `openAppCount` on mount, pass to Sidebar |
| `src/components/Dashboard.jsx` | Hero banner, elevated metric cards with accent colors, action row hover, task due chips |
| `src/components/ProfileSelect.jsx` | Vertically centered layout, Job Neuron branding, card hover lift |
| `src/components/Jobs.jsx` | Hero banner, status-tinted card left border, company avatar circle, hover lift |
| `src/components/Applications.jsx` | Hero banner, row left border + avatar, timeline activity log, TaskModal custom checkbox |
| `src/components/Resume.jsx` | Hero banner, styled empty upload zone, analysis section dots, ATS score style |
| `src/components/Settings.jsx` | Hero banner, 560px max-width, section card dots |

---

## Task 1: Design System Foundation

**Files:**
- Modify: `src/lib/styles.jsx`
- Test: `src/__tests__/styles.test.jsx`

- [ ] **Step 1: Run existing styles tests to confirm baseline**

```bash
npm test -- --reporter=verbose src/__tests__/styles.test.jsx
```

Expected: all tests pass.

- [ ] **Step 2: Add `--shadow-md` token to light theme**

In `src/lib/styles.jsx`, inside the `:root {` block (after `--shadow-sm`), add:

```css
--shadow-md: 0 4px 16px rgba(0,0,0,0.10);
```

- [ ] **Step 3: Add `--shadow-md` token to dark theme**

In `src/lib/styles.jsx`, inside the `[data-theme="dark"] {` block (after `--shadow-sm`), add:

```css
--shadow-md: 0 4px 16px rgba(0,0,0,0.35);
```

- [ ] **Step 4: Add `@keyframes modalIn` to the `<style>` template literal**

At the end of the CSS string in `GlobalStyles` (before the closing backtick), add:

```css
@keyframes modalIn {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}
```

- [ ] **Step 5: Change Badge `borderRadius` from 6 to 20**

In `src/lib/styles.jsx`, find the `Badge` component return statement:

```js
<span style={{ ...s, fontSize: 11, padding: '2px 7px', borderRadius: 6, fontWeight: 500, whiteSpace: 'nowrap' }}>
```

Change `borderRadius: 6` → `borderRadius: 20`.

- [ ] **Step 6: Run styles tests to confirm no regressions**

```bash
npm test -- --reporter=verbose src/__tests__/styles.test.jsx
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/styles.jsx
git commit -m "feat: add shadow-md token, pill badges, and modal keyframe animation"
```

---

## Task 2: Sidebar Redesign

**Files:**
- Modify: `src/components/Sidebar.jsx`
- Test: `src/__tests__/Sidebar.test.jsx`

- [ ] **Step 1: Run existing Sidebar tests to confirm baseline**

```bash
npm test -- --reporter=verbose src/__tests__/Sidebar.test.jsx
```

Expected: all tests pass.

- [ ] **Step 2: Update the `NAV` array to include icons**

Replace the existing `NAV` array in `src/components/Sidebar.jsx`:

```js
export const NAV = [
  {
    id: 'dashboard', label: 'Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="2" fill="currentColor" opacity="0.9"/>
        <rect x="9" y="1" width="6" height="6" rx="2" fill="currentColor" opacity="0.5"/>
        <rect x="1" y="9" width="6" height="6" rx="2" fill="currentColor" opacity="0.5"/>
        <rect x="9" y="9" width="6" height="6" rx="2" fill="currentColor" opacity="0.5"/>
      </svg>
    ),
  },
  {
    id: 'resume', label: 'Resume',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/>
        <line x1="5" y1="5.5" x2="11" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="5" y1="8.5" x2="11" y2="8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="5" y1="11.5" x2="8" y2="11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'jobs', label: 'Find Jobs',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4"/>
        <line x1="11" y1="11" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'applications', label: 'Applications',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M1 5l7 5 7-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'settings', label: 'Settings',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
]
```

- [ ] **Step 3: Update the `Sidebar` function signature to accept new props**

Change the function signature from:

```js
export function Sidebar({ tab, setTab, profile, onSwitch, onLogout, userEmail, isAdmin, onOpenAdmin }) {
```

to:

```js
export function Sidebar({ tab, setTab, profile, onSwitch, onLogout, userEmail, isAdmin, onOpenAdmin, todayJobCount = 0, openAppCount = 0 }) {
```

- [ ] **Step 4: Replace the `aside` root element style (width 200 → 240)**

Change `width: 200` to `width: 240` in the `aside` style object.

- [ ] **Step 5: Replace the brand header**

Replace the existing logo `<div>` block (the one with `padding: '18px 14px 10px'`):

```jsx
{/* Brand */}
<div style={{ padding: '16px 14px 12px', borderBottom: '0.5px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 10 }}>
  <div style={{
    width: 34, height: 34,
    background: 'linear-gradient(135deg, #8839ef, #7c3aed)',
    borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(136,57,239,0.35)',
    flexShrink: 0,
  }}>
    <svg width="18" height="18" viewBox="0 0 18 18" fill="white">
      <circle cx="9" cy="6.5" r="3.5"/>
      <path d="M2 16c0-3.5 3.1-5.5 7-5.5s7 2 7 5.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    </svg>
  </div>
  <div>
    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>Job Neuron</div>
    <div style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 1 }}>AI Job Search</div>
  </div>
</div>
```

- [ ] **Step 6: Replace the nav section with grouped items + section labels + icons + active bar + badge counts**

Replace the entire `<nav>` block:

```jsx
<nav style={{ padding: '4px 8px', flex: 1, overflowY: 'auto' }}>
  {/* MAIN section */}
  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-light)', textTransform: 'uppercase', padding: '14px 8px 6px' }}>Main</div>
  {NAV.filter(n => n.id !== 'settings').map((n) => {
    const isActive = tab === n.id
    const count = n.id === 'jobs' ? todayJobCount : n.id === 'applications' ? openAppCount : 0
    return (
      <button key={n.id} onClick={() => setTab(n.id)} style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
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
        <span style={{ flexShrink: 0, display: 'flex', color: isActive ? 'var(--btn-primary-bg)' : 'currentColor' }}>{n.icon}</span>
        {n.label}
        {count > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: 'var(--badge-cust-bg)', color: 'var(--badge-cust-text)' }}>
            {count}
          </span>
        )}
      </button>
    )
  })}

  {/* ACCOUNT section */}
  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-light)', textTransform: 'uppercase', padding: '14px 8px 6px' }}>Account</div>
  {NAV.filter(n => n.id === 'settings').map((n) => {
    const isActive = tab === n.id
    return (
      <button key={n.id} onClick={() => setTab(n.id)} style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
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
        <span style={{ flexShrink: 0, display: 'flex', color: isActive ? 'var(--btn-primary-bg)' : 'currentColor' }}>{n.icon}</span>
        {n.label}
      </button>
    )
  })}
</nav>
```

- [ ] **Step 7: Replace the footer with user card + action buttons**

Replace the existing footer `<div>` (the one with `padding: '10px 8px'`):

```jsx
<div style={{ padding: '10px 8px', borderTop: '0.5px solid var(--border-light)' }}>
  {/* User card */}
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)', marginBottom: 8 }}>
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--badge-new-bg), var(--btn-primary-bg))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0,
    }}>
      {profile.name.slice(0, 2).toUpperCase()}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name}</p>
      <p style={{ margin: 0, fontSize: 10, color: 'var(--text-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</p>
    </div>
  </div>
  {/* Admin button (if applicable) */}
  {isAdmin && (
    <button onClick={onOpenAdmin} style={{ ...btn(), width: '100%', justifyContent: 'center', fontSize: 12, padding: '5px 0', marginBottom: 6, color: 'var(--text-warning)', borderColor: 'var(--border-warning)' }}>Admin panel</button>
  )}
  {/* Action buttons */}
  <div style={{ display: 'flex', gap: 6 }}>
    <button onClick={onSwitch} style={{ ...btn(), flex: 1, justifyContent: 'center', fontSize: 12, padding: '5px 0' }}>Switch profile</button>
    <button onClick={onLogout} style={{ ...btn(), flex: 1, justifyContent: 'center', fontSize: 12, padding: '5px 0', color: 'var(--text-error)', borderColor: 'var(--border-error)' }}>Sign out</button>
  </div>
</div>
```

- [ ] **Step 8: Run Sidebar tests to confirm no regressions**

```bash
npm test -- --reporter=verbose src/__tests__/Sidebar.test.jsx
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "feat: redesign sidebar — 240px, Job Neuron branding, icons, section labels, badge counts, user card footer"
```

---

## Task 3: MainApp — Fetch Sidebar Badge Counts

**Files:**
- Modify: `src/components/MainApp.jsx`

- [ ] **Step 1: Add imports for `todayStr` and `dbGet`**

Check the existing imports in `MainApp.jsx`. It already imports `dbGet` from `'../lib/api'` and has `useState` from React. Add `todayStr` to the helpers import:

```js
import { todayStr } from '../lib/helpers'
```

(If it's already imported, skip this step.)

- [ ] **Step 2: Add state variables for sidebar badge counts**

Inside `MainApp`, after the existing `const [profileData, setProfileData] = useState(null)` line, add:

```js
const [todayJobCount, setTodayJobCount] = useState(0)
const [openAppCount, setOpenAppCount] = useState(0)
```

- [ ] **Step 3: Fetch badge count data on mount**

Add a new `useEffect` after the existing profile-fetching `useEffect`:

```js
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
```

- [ ] **Step 4: Pass counts to `<Sidebar>`**

Find the `<Sidebar ... />` render call and add the two new props:

```jsx
<Sidebar
  tab={tab} setTab={setTab} profile={profile}
  onSwitch={onSwitch} onLogout={onLogout}
  userEmail={userEmail} isAdmin={isAdmin} onOpenAdmin={onOpenAdmin}
  todayJobCount={todayJobCount}
  openAppCount={openAppCount}
/>
```

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: all tests pass (the new `useEffect` uses mocked `dbGet` in tests which returns null by default, so counts default to 0).

- [ ] **Step 6: Commit**

```bash
git add src/components/MainApp.jsx
git commit -m "feat: fetch todayJobCount and openAppCount in MainApp, pass to Sidebar"
```

---

## Task 4: Dashboard Upgrade

**Files:**
- Modify: `src/components/Dashboard.jsx`
- Test: `src/__tests__/Dashboard.test.jsx`

- [ ] **Step 1: Run existing Dashboard tests to confirm baseline**

```bash
npm test -- --reporter=verbose src/__tests__/Dashboard.test.jsx
```

Expected: all tests pass.

- [ ] **Step 2: Add hero banner — replace the `<h2>` greeting + date paragraph**

At the top of the Dashboard return, replace:

```jsx
<h2 style={{ fontSize: 20, fontWeight: 500, margin: '0 0 4px' }}>{greeting}, {profile.name.split(' ')[0]}</h2>
<p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 1.5rem' }}>
  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
</p>
```

with:

```jsx
{/* Hero banner */}
<div style={{ background: 'linear-gradient(135deg, #8839ef 0%, #7c3aed 60%, #6d28d9 100%)', padding: '24px 28px 20px', color: 'white', position: 'relative', overflow: 'hidden', marginBottom: '1.5rem' }}>
  <div style={{ position: 'absolute', right: -30, top: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
  <div style={{ position: 'absolute', right: 60, bottom: -40, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
  <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 2, position: 'relative' }}>{greeting}, {profile.name.split(' ')[0]}</div>
  <div style={{ fontSize: 13, opacity: 0.75, position: 'relative' }}>
    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
  </div>
  {recentApps.filter(a => !['rejected','offer'].includes(a.status)).length > 0 && (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500, marginTop: 10, position: 'relative' }}>
      {recentApps.filter(a => !['rejected','offer'].includes(a.status)).length} applications open
    </div>
  )}
</div>
```

Also remove `padding: '2rem'` from the outer wrapper (or reduce to `padding: '0 0 2rem'`) since the hero handles top spacing. Change:

```jsx
<div style={{ padding: '2rem' }}>
```

to:

```jsx
<div style={{ paddingBottom: '2rem' }}>
```

- [ ] **Step 3: Upgrade metric cards with accent colors and hover lift**

Replace the existing metric card `.map()` block. First add a `hoveredMetric` state:

```js
const [hoveredMetric, setHoveredMetric] = useState(null)
```

Then replace the metrics grid:

```jsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: '1.5rem', padding: '0 2rem' }}>
  {[
    { label: 'Jobs found today', val: stats.jobsToday,    accent: '#8839ef', icon: '🔍' },
    { label: 'Total applied',    val: stats.totalApplied, accent: '#1e66f5', icon: '📨' },
    { label: 'Interviews',       val: stats.interviews,   accent: '#df8e1d', icon: '💬' },
    { label: 'Offers',           val: stats.offers,       accent: '#40a02b', icon: '🎉' },
  ].map((s, i) => (
    <div
      key={s.label}
      onMouseEnter={() => setHoveredMetric(i)}
      onMouseLeave={() => setHoveredMetric(null)}
      style={{
        background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px',
        boxShadow: hoveredMetric === i ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        border: '1px solid var(--border-light)',
        borderLeft: `3px solid ${s.accent}`,
        position: 'relative', overflow: 'hidden',
        transform: hoveredMetric === i ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
    >
      <div style={{ position: 'absolute', right: 12, top: 12, width: 28, height: 28, borderRadius: 8, background: `${s.accent}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{s.icon}</div>
      <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</p>
      <p style={{ margin: 0, fontSize: 26, fontWeight: 700, fontFamily: 'monospace', color: s.accent }}>{s.val}</p>
    </div>
  ))}
</div>
```

- [ ] **Step 4: Upgrade quick action buttons with icon + hover accent**

Replace the three quick-action `<button>` elements inside the "Quick actions" card. Change the outer card `<div>` to add padding/spacing, and replace the button map:

```jsx
{[
  { label: 'Find 20 matching jobs today', tab: 'jobs', icon: '🔍' },
  { label: hasResume ? 'Update or re-analyze resume' : 'Add your resume', tab: 'resume', icon: '📄' },
  { label: 'View all applications', tab: 'applications', icon: '📋' },
].map((a) => (
  <button key={a.tab} onClick={() => setTab(a.tab)} style={{
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '9px 10px', borderRadius: 8, border: '1px solid var(--border-light)',
    background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13, color: 'var(--text-main)', textAlign: 'left',
    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
  }}
  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(136,57,239,0.08)'; e.currentTarget.style.borderColor = 'rgba(136,57,239,0.2)'; e.currentTarget.style.color = '#8839ef' }}
  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-main)' }}
  >
    <span style={{ fontSize: 15 }}>{a.icon}</span>
    {a.label}
  </button>
))}
```

- [ ] **Step 5: Add due-date chips to upcoming task rows**

In the `upcomingTasks.map()` block, add a due-date chip to each row. Replace the existing task row div contents to add a chip element at the right:

```jsx
<div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0', borderBottom: '0.5px solid var(--border-light)' }}>
  <div style={{ flex: 1, minWidth: 0 }}>
    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: overdue ? 'var(--badge-rej-text)' : 'var(--text-main)' }}>
      {t.title}
    </p>
    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-light)' }}>{t.jobTitle} · {t.company}</p>
  </div>
  {t.dueDate && (
    <span style={{
      fontSize: 10, padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap',
      background: overdue ? 'var(--badge-rej-bg)' : 'var(--bg-metric)',
      color: overdue ? 'var(--badge-rej-text)' : 'var(--text-light)',
    }}>
      {overdue ? 'Overdue' : `Due ${fmtDate(t.dueDate)}`}
    </span>
  )}
</div>
```

- [ ] **Step 6: Move card sections to have consistent horizontal padding**

Wrap the two-column card grid and upcoming tasks card with `padding: '0 2rem'` (or add it to each card's containing div) so all content aligns with the `2rem` side padding that the hero doesn't use.

Specifically, find:

```jsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
```

and wrap it:

```jsx
<div style={{ padding: '0 2rem' }}>
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
    {/* ... card content ... */}
  </div>
  {upcomingTasks.length > 0 && (
    <div style={{ ...C.card, marginTop: '1rem' }}>
      {/* ... tasks ... */}
    </div>
  )}
</div>
```

Also move the warning/info banners inside this padding wrapper.

- [ ] **Step 7: Run Dashboard tests to confirm no regressions**

```bash
npm test -- --reporter=verbose src/__tests__/Dashboard.test.jsx
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/Dashboard.jsx
git commit -m "feat: dashboard hero banner, accent metric cards, action hover, task due chips"
```

---

## Task 5: ProfileSelect Redesign

**Files:**
- Modify: `src/components/ProfileSelect.jsx`
- Test: `src/__tests__/ProfileSelect.test.jsx`

- [ ] **Step 1: Run existing ProfileSelect tests to confirm baseline**

```bash
npm test -- --reporter=verbose src/__tests__/ProfileSelect.test.jsx
```

Expected: all tests pass.

- [ ] **Step 2: Add `hoveredProfile` state**

Inside `ProfileSelect`, add:

```js
const [hoveredProfile, setHoveredProfile] = useState(null)
```

- [ ] **Step 3: Change the outer layout to full-height centered**

Replace:

```jsx
<div style={{ maxWidth: 500, margin: '72px auto', padding: '0 20px' }}>
```

with:

```jsx
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '0 20px' }}>
<div style={{ maxWidth: 480, width: '100%' }}>
```

(Remember to close the extra `<div>` at the end of the return.)

- [ ] **Step 4: Replace the brand header with Job Neuron branding**

Replace the existing brand `<div>` (the one with `display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8`):

```jsx
<div style={{ marginBottom: '2rem' }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
    <div style={{
      width: 34, height: 34,
      background: 'linear-gradient(135deg, #8839ef, #7c3aed)',
      borderRadius: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(136,57,239,0.35)',
    }}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="white">
        <circle cx="9" cy="6.5" r="3.5"/>
        <path d="M2 16c0-3.5 3.1-5.5 7-5.5s7 2 7 5.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      </svg>
    </div>
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Job Neuron</h1>
      <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 1 }}>AI Job Search</div>
    </div>
  </div>
  <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Select a profile or create a new one.</p>
</div>
```

- [ ] **Step 5: Add hover lift to profile cards**

In the `profiles.map()` block, update each profile card `<div>`:

```jsx
<div
  key={p.id}
  onClick={() => onSelect(p)}
  onMouseEnter={() => setHoveredProfile(p.id)}
  onMouseLeave={() => setHoveredProfile(null)}
  style={{
    ...C.card, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    transform: hoveredProfile === p.id ? 'translateY(-2px)' : 'translateY(0)',
    boxShadow: hoveredProfile === p.id ? 'var(--shadow-md)' : 'var(--shadow-sm)',
    transition: 'transform 0.15s, box-shadow 0.15s',
  }}
>
```

- [ ] **Step 6: Run ProfileSelect tests to confirm no regressions**

```bash
npm test -- --reporter=verbose src/__tests__/ProfileSelect.test.jsx
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/ProfileSelect.jsx
git commit -m "feat: ProfileSelect — centered layout, Job Neuron branding, card hover lift"
```

---

## Task 6: Jobs Upgrade

**Files:**
- Modify: `src/components/Jobs.jsx`
- Test: `src/__tests__/Jobs.test.jsx`

- [ ] **Step 1: Run existing Jobs tests to confirm baseline**

```bash
npm test -- --reporter=verbose src/__tests__/Jobs.test.jsx
```

Expected: all tests pass.

- [ ] **Step 2: Add a status-to-border-color map constant**

Near the top of `Jobs.jsx` (after imports), add:

```js
const STATUS_BORDER = {
  new:        '#1e66f5',
  viewed:     'var(--border)',
  customized: '#8839ef',
  applied:    '#40a02b',
  interview:  '#df8e1d',
  offer:      '#179299',
  rejected:   '#d20f39',
}
```

- [ ] **Step 3: Add hero banner at the top of the Jobs return**

In the `Jobs` component return, before the existing content wrapper, add a hero banner. The jobs count is available from the existing `jobs` state array. Add it as the first element inside the outermost `<div>`:

```jsx
{/* Hero banner */}
<div style={{ background: 'linear-gradient(135deg, #1e66f5 0%, #1a56d6 100%)', padding: '24px 28px 20px', color: 'white', position: 'relative', overflow: 'hidden' }}>
  <div style={{ position: 'absolute', right: -30, top: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
  <div style={{ position: 'absolute', right: 60, bottom: -40, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
  <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 2, position: 'relative' }}>Find Jobs</div>
  {jobs.length > 0 && (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500, marginTop: 10, position: 'relative' }}>
      {jobs.length} found today
    </div>
  )}
</div>
```

- [ ] **Step 4: Add `hoveredJob` state and update job cards**

Add state:

```js
const [hoveredJob, setHoveredJob] = useState(null)
```

For each job card rendered in the list, update the card `<div>` style to include:
- `borderLeft: \`3px solid ${STATUS_BORDER[job.status] || 'var(--border)'}\``
- `transform` and `boxShadow` based on `hoveredJob === job.jobId`
- `transition: 'transform 0.15s, box-shadow 0.15s'`
- `onMouseEnter` / `onMouseLeave` setting `hoveredJob`

Also add a company avatar before the job title in each card:

```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
  <div style={{
    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
    background: 'var(--bg-metric)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
  }}>
    {job.company.slice(0, 2).toUpperCase()}
  </div>
  <div style={{ flex: 1, minWidth: 0 }}>
    {/* existing job title + company + location */}
  </div>
</div>
```

- [ ] **Step 5: Run Jobs tests to confirm no regressions**

```bash
npm test -- --reporter=verbose src/__tests__/Jobs.test.jsx
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/Jobs.jsx
git commit -m "feat: Jobs — hero banner, status-tinted card border, company avatar, hover lift"
```

---

## Task 7: Applications Upgrade

**Files:**
- Modify: `src/components/Applications.jsx`
- Test: `src/__tests__/Applications.test.jsx`

- [ ] **Step 1: Run existing Applications tests to confirm baseline**

```bash
npm test -- --reporter=verbose src/__tests__/Applications.test.jsx
```

Expected: all tests pass.

- [ ] **Step 2: Add the same `STATUS_BORDER` map**

Near the top of `Applications.jsx` (after imports):

```js
const STATUS_BORDER = {
  new:        '#1e66f5',
  viewed:     'var(--border)',
  customized: '#8839ef',
  applied:    '#40a02b',
  interview:  '#df8e1d',
  offer:      '#179299',
  rejected:   '#d20f39',
}
```

- [ ] **Step 3: Add hero banner**

In the `Applications` component return, add before existing content:

```jsx
{/* Hero banner */}
<div style={{ background: 'linear-gradient(135deg, #df8e1d 0%, #b87514 100%)', padding: '24px 28px 20px', color: 'white', position: 'relative', overflow: 'hidden' }}>
  <div style={{ position: 'absolute', right: -30, top: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
  <div style={{ position: 'absolute', right: 60, bottom: -40, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
  <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 2, position: 'relative' }}>Applications</div>
  {apps.filter(a => !['rejected','offer'].includes(a.status)).length > 0 && (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500, marginTop: 10, position: 'relative' }}>
      {apps.filter(a => !['rejected','offer'].includes(a.status)).length} open
    </div>
  )}
</div>
```

(Use the existing `apps` state variable — `Applications` already fetches `jh_apps_{profileId}`.)

- [ ] **Step 4: Add hover lift + left border + company avatar to application rows**

Add state:

```js
const [hoveredApp, setHoveredApp] = useState(null)
```

For each application row card, update the style:

```jsx
<div
  key={app.jobId}
  onMouseEnter={() => setHoveredApp(app.jobId)}
  onMouseLeave={() => setHoveredApp(null)}
  style={{
    ...C.card,
    borderLeft: `3px solid ${STATUS_BORDER[app.status] || 'var(--border)'}`,
    transform: hoveredApp === app.jobId ? 'translateY(-2px)' : 'translateY(0)',
    boxShadow: hoveredApp === app.jobId ? 'var(--shadow-md)' : 'var(--shadow-sm)',
    transition: 'transform 0.15s, box-shadow 0.15s',
    display: 'flex', alignItems: 'center', gap: 12,
  }}
>
  {/* Company avatar */}
  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-metric)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>
    {app.company.slice(0, 2).toUpperCase()}
  </div>
  {/* existing row content */}
</div>
```

- [ ] **Step 5: Apply timeline style to activity log entries**

Locate the activity log rendering block in `Applications.jsx`. Wrap the activity list container with `position: 'relative', paddingLeft: 16, borderLeft: '2px solid var(--border)'`. For each activity entry, add an absolute dot:

```jsx
<div style={{ position: 'relative', paddingLeft: 16, borderLeft: '2px solid var(--border)' }}>
  {activities.map((entry, i) => (
    <div key={i} style={{ position: 'relative', marginBottom: 12 }}>
      <div style={{ position: 'absolute', left: -21, top: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--btn-primary-bg)' }} />
      {/* existing entry content */}
    </div>
  ))}
</div>
```

- [ ] **Step 6: Upgrade TaskModal with accessible custom checkbox and due-date chips**

In `TaskModal`, for each task row, replace the native `<input type="checkbox">` with an accessible custom checkbox:

```jsx
<label htmlFor={`task-${t.id}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}>
  <input
    id={`task-${t.id}`}
    type="checkbox"
    checked={t.completed}
    onChange={() => toggleDone(t.id)}
    style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
  />
  <div onClick={(e) => { e.stopPropagation(); toggleDone(t.id) }} style={{
    width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 2,
    border: t.completed ? 'none' : '1.5px solid var(--border)',
    background: t.completed ? 'var(--btn-primary-bg)' : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  }}>
    {t.completed && <span style={{ color: 'white', fontSize: 10, lineHeight: 1 }}>✓</span>}
  </div>
  <div style={{ flex: 1, minWidth: 0 }}>
    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, textDecoration: t.completed ? 'line-through' : 'none', color: t.completed ? 'var(--text-faint)' : isOverdue(t) ? 'var(--text-error)' : 'var(--text-main)' }}>
      {t.title}
    </p>
    {t.notes && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-light)', fontStyle: 'italic' }}>{t.notes}</p>}
  </div>
  {t.dueDate && (
    <span style={{
      fontSize: 10, padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0,
      background: isOverdue(t) ? 'var(--badge-rej-bg)' : 'var(--bg-metric)',
      color: isOverdue(t) ? 'var(--badge-rej-text)' : 'var(--text-light)',
    }}>
      {isOverdue(t) ? 'Overdue' : `Due ${fmtDate(t.dueDate)}`}
    </span>
  )}
  <button onClick={(e) => { e.preventDefault(); removeTask(t.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 14, padding: '2px 4px', flexShrink: 0 }}>✕</button>
</label>
```

Also add `animation: 'modalIn 0.18s ease'` to the modal inner card style (`background: 'var(--bg-card)'` div).

- [ ] **Step 7: Run Applications tests to confirm no regressions**

```bash
npm test -- --reporter=verbose src/__tests__/Applications.test.jsx
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/Applications.jsx
git commit -m "feat: Applications — hero, status borders, avatars, timeline activity, custom checkbox"
```

---

## Task 8: Resume Upgrade

**Files:**
- Modify: `src/components/Resume.jsx`
- Test: `src/__tests__/Resume.test.jsx`

- [ ] **Step 1: Run existing Resume tests to confirm baseline**

```bash
npm test -- --reporter=verbose src/__tests__/Resume.test.jsx
```

Expected: all tests pass.

- [ ] **Step 2: Add hero banner**

In `Resume`'s return, before the existing content, add:

```jsx
{/* Hero banner */}
<div style={{ background: 'linear-gradient(135deg, #179299 0%, #0d7377 100%)', padding: '24px 28px 20px', color: 'white', position: 'relative', overflow: 'hidden' }}>
  <div style={{ position: 'absolute', right: -30, top: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
  <div style={{ position: 'absolute', right: 60, bottom: -40, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
  <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 2, position: 'relative' }}>Your Resume</div>
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500, marginTop: 10, position: 'relative' }}>
    {profileData?.resumeText?.length > 50 ? 'Resume uploaded' : 'No resume yet'}
  </div>
</div>
```

- [ ] **Step 3: Style the empty-state upload zone**

Locate the section that shows when no resume text exists. Replace or wrap the existing prompt with:

```jsx
<div style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: '2rem', textAlign: 'center', background: 'var(--bg-card)' }}>
  <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
  <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 500, color: 'var(--text-main)' }}>Drop your resume PDF here or click to upload</p>
  <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>Supports PDF files</p>
  {/* existing upload button/input */}
</div>
```

- [ ] **Step 4: Add colored dot prefix to analysis section headers**

Locate the section headers inside the resume analysis results card (labels like "SUMMARY", "SKILLS", "ATS SCORE", etc.). Before each label text, add:

```jsx
<span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--btn-primary-bg)', marginRight: 6, verticalAlign: 'middle' }} />
```

- [ ] **Step 5: Style the ATS score**

Locate where the ATS score value is displayed. Update it to:

```jsx
<span style={{ fontSize: 28, fontWeight: 700, color: 'var(--btn-primary-bg)' }}>{atsScore}</span>
```

- [ ] **Step 6: Run Resume tests to confirm no regressions**

```bash
npm test -- --reporter=verbose src/__tests__/Resume.test.jsx
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/Resume.jsx
git commit -m "feat: Resume — hero banner, styled upload zone, analysis section dots, ATS score style"
```

---

## Task 9: Settings Upgrade

**Files:**
- Modify: `src/components/Settings.jsx`
- Test: `src/__tests__/Settings.test.jsx`

- [ ] **Step 1: Run existing Settings tests to confirm baseline**

```bash
npm test -- --reporter=verbose src/__tests__/Settings.test.jsx
```

Expected: all tests pass.

- [ ] **Step 2: Add hero banner and increase max-width**

Replace the outer wrapper:

```jsx
<div style={{ padding: '2rem', maxWidth: 480 }}>
  <h2 style={{ fontSize: 20, fontWeight: 500, margin: '0 0 1.5rem' }}>Settings</h2>
```

with:

```jsx
<div style={{ maxWidth: 560 }}>
  {/* Hero banner */}
  <div style={{ background: 'linear-gradient(135deg, #6c6f85 0%, #4c4f69 100%)', padding: '24px 28px 20px', color: 'white', position: 'relative', overflow: 'hidden', marginBottom: '2rem' }}>
    <div style={{ position: 'absolute', right: -30, top: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
    <div style={{ position: 'absolute', right: 60, bottom: -40, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
    <div style={{ fontSize: 20, fontWeight: 700, position: 'relative' }}>Settings</div>
  </div>
  <div style={{ padding: '0 2rem 2rem' }}>
```

(Add an extra closing `</div>` at the end.)

- [ ] **Step 3: Add colored dot prefix to section card titles**

For each `<p>` that acts as a card section title (e.g. "Profile", "Job search preferences"), add a dot prefix before the text:

```jsx
<p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 500 }}>
  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--btn-primary-bg)', marginRight: 6, verticalAlign: 'middle' }} />
  Profile
</p>
```

Apply this pattern to all card title `<p>` elements in the Settings view.

- [ ] **Step 4: Run Settings tests to confirm no regressions**

```bash
npm test -- --reporter=verbose src/__tests__/Settings.test.jsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Settings.jsx
git commit -m "feat: Settings — hero banner, 560px max-width, section card dot prefixes"
```

---

## Task 10: Final Integration Check

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all 140+ tests pass with no failures.

- [ ] **Step 2: Verify dark mode tokens are intact**

Manually check that `--shadow-md` appears in both the `:root` and `[data-theme="dark"]` blocks in `src/lib/styles.jsx`.

- [ ] **Step 3: Verify no "JobHunter AI" text remains in user-facing components**

```bash
grep -r "JobHunter AI" src/
```

Expected: no results (or only in test files if any assert on it — update those if so).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Premium App Suite frontend redesign"
```
