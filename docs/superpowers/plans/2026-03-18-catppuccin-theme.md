# Catppuccin Theme Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic dark/light theme with Catppuccin Mocha (dark) + Latte (light) and fix all hardcoded colors in components so dark mode is fully visible and both modes share a cohesive identity.

**Architecture:** CSS variables only — update `src/lib/styles.jsx` first (28 existing vars + 14 new semantic vars), then sweep 5 component files replacing hardcoded hex values with the new vars. No new dependencies, no structural changes.

**Tech Stack:** React (JSX), inline style objects, CSS custom properties via `<style>` tag in `GlobalStyles`. Tests: Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-03-18-catppuccin-theme-design.md`

---

### Task 1: Update CSS variables in `src/lib/styles.jsx`

**Files:**
- Modify: `src/lib/styles.jsx`

This is the foundation. All other tasks depend on this being done first. Replace every value inside the `:root` and `[data-theme="dark"]` blocks, and add 14 new semantic variables to both blocks.

- [ ] **Step 1: Update `:root` (Latte — light mode)**

Replace the entire `:root { ... }` block in `src/lib/styles.jsx` with:

```css
:root {
  --bg-page: #eff1f5;
  --bg-sidebar: #e6e9ef;
  --bg-card: #ffffff;
  --bg-metric: #dce0e8;
  --bg-content: #eaecf2;
  --text-main: #4c4f69;
  --text-muted: #6c6f85;
  --text-light: #8c8fa1;
  --text-faint: #9ca0b0;
  --border: rgba(76,79,105,0.15);
  --border-light: rgba(76,79,105,0.08);
  --btn-primary-bg: #8839ef;
  --btn-primary-text: #ffffff;
  --badge-new-bg: rgba(30,102,245,0.12); --badge-new-text: #1e66f5;
  --badge-viewed-bg: rgba(108,111,133,0.1); --badge-viewed-text: #6c6f85;
  --badge-cust-bg: rgba(136,57,239,0.12); --badge-cust-text: #8839ef;
  --badge-app-bg: rgba(64,160,43,0.12); --badge-app-text: #40a02b;
  --badge-int-bg: rgba(223,142,29,0.12); --badge-int-text: #df8e1d;
  --badge-off-bg: rgba(23,146,153,0.12); --badge-off-text: #179299;
  --badge-rej-bg: rgba(210,15,57,0.12); --badge-rej-text: #d20f39;
  --input-bg: #ffffff;
  --input-border: #ccd0da;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.18);
  --modal-overlay: rgba(0,0,0,0.45);
  --bg-warning: rgba(223,142,29,0.12);
  --bg-error: rgba(210,15,57,0.12);
  --bg-info: rgba(30,102,245,0.12);
  --bg-success: rgba(64,160,43,0.12);
  --text-warning: #df8e1d;
  --text-error: #d20f39;
  --text-info: #1e66f5;
  --text-success: #40a02b;
  --border-warning: rgba(223,142,29,0.3);
  --border-error: rgba(210,15,57,0.25);
  --border-info: rgba(30,102,245,0.25);
  --border-success: rgba(64,160,43,0.25);
  --progress-track: #ccd0da;
}
```

- [ ] **Step 2: Update `[data-theme="dark"]` (Mocha — dark mode)**

Replace the entire `[data-theme="dark"] { ... }` block with:

```css
[data-theme="dark"] {
  --bg-page: #1e1e2e;
  --bg-sidebar: #181825;
  --bg-card: #313244;
  --bg-metric: #45475a;
  --bg-content: #181825;
  --text-main: #cdd6f4;
  --text-muted: #a6adc8;
  --text-light: #7f849c;
  --text-faint: #6c7086;
  --border: rgba(203,166,247,0.12);
  --border-light: rgba(203,166,247,0.06);
  --btn-primary-bg: #cba6f7;
  --btn-primary-text: #1e1e2e;
  --badge-new-bg: rgba(137,180,250,0.2); --badge-new-text: #89b4fa;
  --badge-viewed-bg: rgba(166,173,200,0.1); --badge-viewed-text: #a6adc8;
  --badge-cust-bg: rgba(203,166,247,0.2); --badge-cust-text: #cba6f7;
  --badge-app-bg: rgba(166,227,161,0.2); --badge-app-text: #a6e3a1;
  --badge-int-bg: rgba(249,226,175,0.2); --badge-int-text: #f9e2af;
  --badge-off-bg: rgba(148,226,213,0.2); --badge-off-text: #94e2d5;
  --badge-rej-bg: rgba(243,139,168,0.2); --badge-rej-text: #f38ba8;
  --input-bg: #313244;
  --input-border: #45475a;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.7);
  --modal-overlay: rgba(0,0,0,0.7);
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
  --progress-track: #45475a;
}
```

- [ ] **Step 3: Verify visually**

Run `npm run dev` (port 9000). Toggle dark mode in Settings. Check that:
- Page background changes (light: warm off-white `#eff1f5`, dark: deep `#1e1e2e`)
- Sidebar is slightly different from page background in both modes
- Primary buttons turn purple/mauve
- Badges still have color (blue new, green applied, yellow interview, etc.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/styles.jsx
git commit -m "feat: update CSS variables to Catppuccin Mocha (dark) + Latte (light)"
```

---

### Task 2: Fix `src/components/Dashboard.jsx`

**Files:**
- Modify: `src/components/Dashboard.jsx`

5 hardcoded color values on lines 62, 67–69, 74–75, 88, 110, 117–118.

- [ ] **Step 1: Fix date subtitle and metric labels (lines 62, 88, 117)**

Line 62: `color: '#666'` → `color: 'var(--text-muted)'`
Line 88: `color: '#666'` → `color: 'var(--text-muted)'`
Line 117: `color: '#666'` → `color: 'var(--text-muted)'`

- [ ] **Step 2: Fix empty state (line 110)**

Line 110: `color: '#888'` → `color: 'var(--text-light)'`

- [ ] **Step 3: Fix warning banner (lines 67–69)**

```jsx
// Before:
<div style={{ ...C.card, marginBottom: '1.25rem', borderColor: '#ffd166', background: '#fffbeb' }}>
  <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 500, color: '#b06000' }}>...</p>
  <p style={{ margin: '0 0 10px', fontSize: 12, color: '#b06000' }}>...</p>

// After:
<div style={{ ...C.card, marginBottom: '1.25rem', borderColor: 'var(--border-warning)', background: 'var(--bg-warning)' }}>
  <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 500, color: 'var(--text-warning)' }}>...</p>
  <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-warning)' }}>...</p>
```

- [ ] **Step 4: Fix info banner (lines 74–75)**

```jsx
// Before:
<div style={{ ...C.card, marginBottom: '1.25rem', borderColor: '#a8c7fa', background: '#e8f0fe' }}>
  <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 500, color: '#1a56e8' }}>...</p>

// After:
<div style={{ ...C.card, marginBottom: '1.25rem', borderColor: 'var(--border-info)', background: 'var(--bg-info)' }}>
  <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 500, color: 'var(--text-info)' }}>...</p>
```

- [ ] **Step 5: Verify and commit**

```bash
git add src/components/Dashboard.jsx
git commit -m "fix: replace hardcoded colors in Dashboard with CSS vars"
```

---

### Task 3: Fix `src/components/Sidebar.jsx`

**Files:**
- Modify: `src/components/Sidebar.jsx`

3 changes on lines 54, 59, 61.

- [ ] **Step 1: Fix email text, admin button, sign out button**

Line 54: `color: '#888'` → `color: 'var(--text-light)'`

Line 59 (admin button):
```jsx
// Before:
color: '#b06000', borderColor: 'rgba(176,96,0,0.3)'
// After:
color: 'var(--text-warning)', borderColor: 'var(--border-warning)'
```

Line 61 (sign out button):
```jsx
// Before:
color: '#c5221f', borderColor: 'rgba(197,34,31,0.25)'
// After:
color: 'var(--text-error)', borderColor: 'var(--border-error)'
```

- [ ] **Step 2: Verify and commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "fix: replace hardcoded colors in Sidebar with CSS vars"
```

---

### Task 4: Fix `src/components/Applications.jsx` (includes TaskModal)

**Files:**
- Modify: `src/components/Applications.jsx`

Two sections: `TaskModal` (lines 37–89) and `Applications` (lines 130–172).

- [ ] **Step 1: Fix TaskModal subtitle and close button (lines 37, 39)**

Line 37: `color: '#666'` → `color: 'var(--text-muted)'`
Line 39: `color: '#aaa'` → `color: 'var(--text-faint)'`

- [ ] **Step 2: Fix TaskModal empty state, row border, task row (lines 44, 47, 50–55)**

Line 44: `color: '#aaa'` → `color: 'var(--text-faint)'`

Line 47 (task row div):
```jsx
// Before:
borderBottom: '1px solid #f5f5f5'
// After:
borderBottom: '1px solid var(--border-light)'
```

Line 50 (task text ternary):
```jsx
// Before:
color: t.completed ? '#bbb' : isOverdue(t) ? '#c5221f' : '#111'
// After:
color: t.completed ? 'var(--text-faint)' : isOverdue(t) ? 'var(--text-error)' : 'var(--text-main)'
```

Line 52 (overdue badge):
```jsx
// Before:
background: '#fce8e6', color: '#c5221f'
// After:
background: 'var(--bg-error)', color: 'var(--text-error)'
```

Line 54 (due date text):
```jsx
// Before:
color: isOverdue(t) ? '#c5221f' : '#888'
// After:
color: isOverdue(t) ? 'var(--text-error)' : 'var(--text-light)'
```

Line 55 (notes text): `color: '#888'` → `color: 'var(--text-light)'`

- [ ] **Step 3: Fix TaskModal remove button, date label, quick add, footer border (lines 57, 64, 78, 89)**

Line 57: `color: '#ccc'` → `color: 'var(--text-faint)'`
Line 64: `color: '#888'` → `color: 'var(--text-light)'`
Line 78: `color: '#aaa'` → `color: 'var(--text-faint)'`

Line 89 (modal footer):
```jsx
// Before:
borderTop: '1px solid #f0f0f0'
// After:
borderTop: '1px solid var(--border-light)'
```

- [ ] **Step 4: Fix Applications metric card data array (~line 130)**

The metric cards are built from a data array. Find this array:

```jsx
// Before (approximate):
[
  { label: 'Applied', key: 'applied', bg: '#e6f4ea', c: '#137333' },
  { label: 'Interview', key: 'interview', bg: '#fef7e0', c: '#b06000' },
  { label: 'Offer', key: 'offer', bg: '#E1F5EE', c: '#0F6E56' },
  { label: 'Rejected', key: 'rejected', bg: '#fce8e6', c: '#c5221f' },
]

// After:
[
  { label: 'Applied', key: 'applied', bg: 'var(--bg-success)', c: 'var(--text-success)' },
  { label: 'Interview', key: 'interview', bg: 'var(--bg-warning)', c: 'var(--text-warning)' },
  { label: 'Offer', key: 'offer', bg: 'var(--badge-off-bg)', c: 'var(--badge-off-text)' },
  { label: 'Rejected', key: 'rejected', bg: 'var(--bg-error)', c: 'var(--text-error)' },
]
```

- [ ] **Step 5: Fix Applications text colors and remove button (~lines 151, 161, 172)**

Line 151: `color: '#666'` → `color: 'var(--text-muted)'` (company/location/date)
Line 161: `color: '#888'` → `color: 'var(--text-light)'` (notes italic text)
Line 172: `color: '#c5221f'` → `color: 'var(--text-error)'` (Remove button)

- [ ] **Step 6: Verify and commit**

```bash
git add src/components/Applications.jsx
git commit -m "fix: replace hardcoded colors in Applications + TaskModal with CSS vars"
```

---

### Task 5: Fix `src/components/Jobs.jsx` (includes ApplyModal, CustomizeModal, JobCard)

**Files:**
- Modify: `src/components/Jobs.jsx`

This file is the largest sweep (~30 replacements). Work section by section.

- [ ] **Step 1: Fix JobCard text colors and benefit chips (~lines 103–137)**

Line 103 (`sc` variable — score color for the match % badge):
```jsx
// Before:
const sc = job.matchScore >= 80 ? '#137333' : job.matchScore >= 60 ? '#b06000' : '#888'
// After:
const sc = job.matchScore >= 80 ? 'var(--text-success)' : job.matchScore >= 60 ? 'var(--text-warning)' : 'var(--text-light)'
```

Line 109 (expired job banner):
```jsx
// Before:
background: '#fffbeb', color: '#b06000'
// After:
background: 'var(--bg-warning)', color: 'var(--text-warning)'
```

Line 125: `color: '#888'` (jobType) → `color: 'var(--text-light)'`
Line 126: `color: '#137333'` (salary) → `color: 'var(--text-success)'`

Line 127 (verified source chip): `background: '#e8f0fe'` → `var(--bg-info)`, `color: '#1a56e8'` → `var(--text-info)`
Line 128 (health chip): `background: '#e6f4ea'` → `var(--bg-success)`, `color: '#137333'` → `var(--text-success)`
Line 129 (PTO chip): `background: '#e8f0fe'` → `var(--bg-info)`, `color: '#1a56e8'` → `var(--text-info)`
Line 130 (dental chip): `background: '#f3e8ff'` → `var(--badge-cust-bg)`, `color: '#6b21a8'` → `var(--badge-cust-text)`

Line 132: `color: '#666'` (job description) → `var(--text-muted)`
Line 134: `color: '#aaa'` (postedDate) → `var(--text-faint)`
Line 135: `color: '#aaa'` (sourcePlatform) → `var(--text-faint)`
Line 137: `color: '#1a56e8'` (matchReason) → `var(--text-info)`
Line 143: `color: '#888'` (highlights title) → `var(--text-light)`
Line 157: `color: '#aaa'` ("match" label) → `var(--text-faint)`
Line 163: `color: '#888'` (Skip button) → `var(--text-light)`

- [ ] **Step 2: Fix main Jobs panel text and loading state (~lines 312, 318, 324, 401–415)**

Line 312: `color: '#666'` → `var(--text-muted)`

Line 318 (no analysis warning banner):
```jsx
// Before:
background: '#fffbeb', borderColor: '#ffd166', color: '#b06000'
// After:
background: 'var(--bg-warning)', borderColor: 'var(--border-warning)', color: 'var(--text-warning)'
```

Line 324: `color: '#555'` (filter button text) → `var(--text-muted)`
Line 331: `color: '#888'` → `var(--text-light)`
Lines 340, 344, 348, 357: `color: '#888'` → `var(--text-light)` (various filter/section labels)

Line 401: `color: '#0a0a0a'` (loading heading) → `var(--text-main)`
Line 402: `color: '#666'` (loading subtitle) → `var(--text-muted)`
Line 404: `color: '#1a56e8'` (bg status) → `var(--text-info)`
Line 415: `color: '#888'` (empty state) → `var(--text-light)`

- [ ] **Step 3: Fix error/warning banners and skip list (~lines 370–393)**

Line 370: `borderTop: '1px solid #e8e8e8'` → `var(--border)`
Line 371: `color: '#888'` → `var(--text-light)`
Line 373: `borderBottom: '1px solid #f0f0f0'` → `var(--border-light)`
Line 374: `color: '#555'` → `var(--text-muted)`

Line 381 (error banner):
```jsx
// Before:
background: '#fce8e6', borderColor: '#f5c6c6', color: '#c5221f'
// After:
background: 'var(--bg-error)', borderColor: 'var(--border-error)', color: 'var(--text-error)'
```

Lines 383–385 (scheduled error banner — warning style):
```jsx
// Before:
background: '#fffbeb', borderColor: '#ffd166', color: '#b06000'
// After:
background: 'var(--bg-warning)', borderColor: 'var(--border-warning)', color: 'var(--text-warning)'
```

Line 387: `color: '#888'` (dismiss button) → `var(--text-light)`

Line 393 (active filter tab — **ternary expression, not a bare string**):
```jsx
// Before:
background: filter === f ? '#f5f5f5' : 'transparent'
// After:
background: filter === f ? 'var(--bg-metric)' : 'transparent'
```

- [ ] **Step 4: Fix ApplyModal (~lines 79–98)**

Find the `ApplyModal` function. Replace:
- `color: '#666'` (subtitle) → `var(--text-muted)`
- Success strip: `background: '#e6f4ea'` → `var(--bg-success)`, `color: '#137333'` → `var(--text-success)`
- Body text `color: '#555'` → `var(--text-muted)`

- [ ] **Step 5: Fix CustomizeModal content blocks (~lines 47, 53, 63)**

Find the `CustomizeModal` function. Replace:
- Content block backgrounds: `background: '#f9f9f9'` → `var(--bg-content)` (3 occurrences: cover letter, highlights row, tweaks block)
- `color: '#666'` → `var(--text-muted)`
- `color: '#888'` → `var(--text-light)`
- `color: '#aaa'` → `var(--text-faint)`

- [ ] **Step 6: Verify and commit**

```bash
git add src/components/Jobs.jsx
git commit -m "fix: replace hardcoded colors in Jobs + ApplyModal + CustomizeModal with CSS vars"
```

---

### Task 6: Fix `src/components/Resume.jsx`

**Files:**
- Modify: `src/components/Resume.jsx`

Two parts: refactor 6 helper functions, then fix ~25 inline color values.

- [ ] **Step 1: Refactor the 6 color helper functions**

Find these functions near the top of the file (around lines 119–125) and replace them entirely:

```js
// Before:
const scoreColor = (s) => s >= 80 ? '#137333' : s >= 60 ? '#b06000' : '#c5221f'
const scoreBg   = (s) => s >= 80 ? '#e6f4ea' : s >= 60 ? '#fef7e0' : '#fce8e6'
const statusColor = (st) => st === 'pass' ? '#137333' : st === 'warn' ? '#b06000' : '#c5221f'
const statusBg    = (st) => st === 'pass' ? '#e6f4ea' : st === 'warn' ? '#fef7e0' : '#fce8e6'
const sevColor = (sv) => sv === 'high' ? '#c5221f' : sv === 'medium' ? '#b06000' : '#666'
const sevBg    = (sv) => sv === 'high' ? '#fce8e6' : sv === 'medium' ? '#fef7e0' : '#f5f5f5'

// After:
const scoreColor = (s) => s >= 80 ? 'var(--text-success)' : s >= 60 ? 'var(--text-warning)' : 'var(--text-error)'
const scoreBg   = (s) => s >= 80 ? 'var(--bg-success)'   : s >= 60 ? 'var(--bg-warning)'   : 'var(--bg-error)'
const statusColor = (st) => st === 'pass' ? 'var(--text-success)' : st === 'warn' ? 'var(--text-warning)' : 'var(--text-error)'
const statusBg    = (st) => st === 'pass' ? 'var(--bg-success)'   : st === 'warn' ? 'var(--bg-warning)'   : 'var(--bg-error)'
const sevColor = (sv) => sv === 'high' ? 'var(--text-error)' : sv === 'medium' ? 'var(--text-warning)' : 'var(--text-muted)'
const sevBg    = (sv) => sv === 'high' ? 'var(--bg-error)'   : sv === 'medium' ? 'var(--bg-warning)'   : 'var(--bg-metric)'
```

- [ ] **Step 2: Fix file upload success strip (~line 141)**

```jsx
// Before:
background: '#e6f4ea', color: '#137333'
// After:
background: 'var(--bg-success)', color: 'var(--text-success)'
```

- [ ] **Step 3: Fix resume tabs (~lines 154, 159–160)**

Line 154 (tab container border): `borderBottom: '1px solid #e8e8e8'` → `'1px solid var(--border)'`

Lines 159–160 (active/inactive tab):
```jsx
// Before:
color: resumeTab === t.id ? '#0a0a0a' : '#888',
borderBottom: resumeTab === t.id ? '2px solid #0a0a0a' : '2px solid transparent',
// After:
color: resumeTab === t.id ? 'var(--text-main)' : 'var(--text-light)',
borderBottom: resumeTab === t.id ? '2px solid var(--text-main)' : '2px solid transparent',
```

- [ ] **Step 4: Fix section labels and content chips (~lines 169–193)**

Lines 169, 173, 177, 182, 190: `color: '#888'` → `var(--text-light)` (SUMMARY, TARGET ROLES, SKILLS section headers)
Line 174 (target roles chip): `background: '#e8f0fe'` → `var(--bg-info)`, `color: '#1a56e8'` → `var(--text-info)`
Line 178 (skills chip): `background: '#f5f5f5'` → `var(--bg-metric)`
Lines 185, 193: `color: '#666'` → `var(--text-muted)` (experience, education dates)

- [ ] **Step 5: Fix ATS section text (~lines 210, 220, 234, 242, 251)**

Line 210: `color: '#555'` → `var(--text-muted)` (ATS score description)
Line 220: `color: '#888'` → `var(--text-light)` (ATS section label)
Line 234: `color: '#888'` → `var(--text-light)` (ATS category detail)
Line 242: `color: '#888'` → `var(--text-light)` (ATS section label)
Line 251: `color: '#666'` → `var(--text-muted)` (ATS issue detail text)

- [ ] **Step 6: Fix ATS progress bars and issues list (~lines 231, 245, 262–272)**

Line 231 (progress track): `background: '#f0f0f0'` → `var(--progress-track)`
Line 245 (issues item background): `background: '#fafafa'` → `var(--bg-content)`

Lines 262–264 (detected keywords section label + chips):
- `color: '#888'` → `var(--text-light)` (label)
- `background: '#e6f4ea'` → `var(--bg-success)`, `color: '#137333'` → `var(--text-success)` (chips)

Lines 270–272 (missing keywords section label + chips):
- `color: '#888'` → `var(--text-light)` (label)
- `background: '#fce8e6'` → `var(--bg-error)`, `color: '#c5221f'` → `var(--text-error)` (chips)

Quick wins index (~line 284): `color: '#aaa'` → `var(--text-faint)`

- [ ] **Step 7: Fix semantic analysis card and section scores (~lines 295–342)**

Lines 295–300 (semantic analysis card):
```jsx
// Before:
background: '#e8f0fe', borderColor: '#a8c7fa'
color: '#1a56e8'  (multiple instances)
// After:
background: 'var(--bg-info)', borderColor: 'var(--border-info)'
color: 'var(--text-info)'
```

Lines 280, 311, 321, 333: `color: '#888'` → `var(--text-light)` (section labels)
Lines 314 (semantic matched chips): `background: '#e6f4ea'` → `var(--bg-success)`, `color: '#137333'` → `var(--text-success)`
Lines 324 (semantic missing chips): `background: '#fce8e6'` → `var(--bg-error)`, `color: '#c5221f'` → `var(--text-error)`

Line 339 (semantic section score text — **keep >= 70 / >= 40 thresholds**):
```jsx
// Before:
color: s.score >= 70 ? '#137333' : s.score >= 40 ? '#b06000' : '#c5221f'
// After:
color: s.score >= 70 ? 'var(--text-success)' : s.score >= 40 ? 'var(--text-warning)' : 'var(--text-error)'
```

Line 341 (second progress track):
```jsx
// Before:
background: '#f0f0f0'
// After:
background: 'var(--progress-track)'
```

Line 342 (semantic section score bar fill — **keep >= 70 / >= 40 thresholds**):
```jsx
// Before:
background: s.score >= 70 ? '#137333' : s.score >= 40 ? '#b06000' : '#c5221f'
// After:
background: s.score >= 70 ? 'var(--bg-success)' : s.score >= 40 ? 'var(--bg-warning)' : 'var(--bg-error)'
```

- [ ] **Step 8: Verify and commit**

```bash
git add src/components/Resume.jsx
git commit -m "fix: replace hardcoded colors in Resume with CSS vars, refactor score helper functions"
```

---

### Task 7: Run full test suite

**Files:** None modified

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: all 72 tests pass. Tests use React Testing Library and test behavior (clicks, renders, state) — not color values — so no test changes are needed.

If any test fails: the failure is unrelated to this change (colors don't affect test assertions). Investigate independently before continuing.

- [ ] **Step 2: Commit is already done per-task. No additional commit needed.**

---

### Task 8: Run code simplifier

**Files:** All 6 modified files

- [ ] **Step 1: Invoke simplifier**

Invoke `superpowers:code-simplifier` (simplify skill) on the changed files:
- `src/lib/styles.jsx`
- `src/components/Dashboard.jsx`
- `src/components/Sidebar.jsx`
- `src/components/Applications.jsx`
- `src/components/Jobs.jsx`
- `src/components/Resume.jsx`

- [ ] **Step 2: Run tests again after simplification**

```bash
npm test
```

Expected: still 72 tests passing.

- [ ] **Step 3: Commit any simplifier changes**

```bash
git add src/lib/styles.jsx src/components/Dashboard.jsx src/components/Sidebar.jsx src/components/Applications.jsx src/components/Jobs.jsx src/components/Resume.jsx
git commit -m "refactor: simplify Catppuccin theme implementation"
```

---

## Done

All hardcoded colors replaced. Both light (Latte) and dark (Mocha) modes now use the official Catppuccin palette throughout. The 72 existing tests continue to pass.
