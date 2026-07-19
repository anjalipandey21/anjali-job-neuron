# Job Neuron — Catppuccin Theme Design Spec

**Date:** 2026-03-18
**Status:** Approved
**Approach:** Option A — CSS variables only (no new dependencies)

---

## 1. Goal

Replace the existing generic dark/light theme with Catppuccin **Mocha** (dark) and Catppuccin **Latte** (light), and fix all hardcoded color values in components that bypass the CSS variable system — making dark mode fully visible and giving both modes a cohesive visual identity.

Hex values verified against the official Catppuccin palette via Context7 (`/catppuccin/palette`).

---

## 2. Palette Reference

### Catppuccin Mocha (dark)

| Role | Name | Hex |
|---|---|---|
| Page background | Base | `#1e1e2e` |
| Sidebar background | Mantle | `#181825` |
| Card background | Surface0 | `#313244` |
| Metric card / elevated | Surface1 | `#45475a` |
| Nested content bg | Mantle | `#181825` |
| Main text | Text | `#cdd6f4` |
| Muted text | Subtext0 | `#a6adc8` |
| Light text | Overlay1 | `#7f849c` |
| Faint text | Overlay0 | `#6c7086` |
| Primary button | Mauve | `#cba6f7` |
| Blue accent | Blue | `#89b4fa` |
| Green accent | Green | `#a6e3a1` |
| Yellow accent | Yellow | `#f9e2af` |
| Red accent | Red | `#f38ba8` |
| Teal accent | Teal | `#94e2d5` |

### Catppuccin Latte (light)

| Role | Name | Hex |
|---|---|---|
| Page background | Base | `#eff1f5` |
| Sidebar background | Mantle | `#e6e9ef` |
| Card background | — | `#ffffff` |
| Metric card / elevated | Crust | `#dce0e8` |
| Nested content bg | — | `#eaecf2` |
| Main text | Text | `#4c4f69` |
| Muted text | Subtext0 | `#6c6f85` |
| Light text | Overlay1 | `#8c8fa1` |
| Faint text | Overlay0 | `#9ca0b0` |
| Primary button | Mauve | `#8839ef` |
| Blue accent | Blue | `#1e66f5` |
| Green accent | Green | `#40a02b` |
| Yellow accent | Yellow | `#df8e1d` |
| Red accent | Red | `#d20f39` |
| Teal accent | Teal | `#179299` |

---

## 3. CSS Variable Changes — `src/lib/styles.jsx`

### 3a. Updated existing variables (`:root` — Latte)

| Variable | Old | New |
|---|---|---|
| `--bg-page` | `#ffffff` | `#eff1f5` |
| `--bg-sidebar` | `#f9f9f9` | `#e6e9ef` |
| `--bg-card` | `#ffffff` | `#ffffff` _(unchanged)_ |
| `--bg-metric` | `#f5f5f5` | `#dce0e8` |
| `--text-main` | `#0a0a0a` | `#4c4f69` |
| `--text-muted` | `#666666` | `#6c6f85` |
| `--text-light` | `#888888` | `#8c8fa1` |
| `--text-faint` | `#aaaaaa` | `#9ca0b0` |
| `--border` | `rgba(0,0,0,0.1)` | `rgba(76,79,105,0.15)` |
| `--border-light` | `rgba(0,0,0,0.08)` | `rgba(76,79,105,0.08)` |
| `--btn-primary-bg` | `#0a0a0a` | `#8839ef` |
| `--btn-primary-text` | `#ffffff` | `#ffffff` _(unchanged)_ |
| `--badge-new-bg` | `#e8f0fe` | `rgba(30,102,245,0.12)` |
| `--badge-new-text` | `#1a56e8` | `#1e66f5` |
| `--badge-viewed-bg` | `#f5f5f5` | `rgba(108,111,133,0.1)` |
| `--badge-viewed-text` | `#666666` | `#6c6f85` |
| `--badge-cust-bg` | `#EEEDFE` | `rgba(136,57,239,0.12)` |
| `--badge-cust-text` | `#534AB7` | `#8839ef` |
| `--badge-app-bg` | `#e6f4ea` | `rgba(64,160,43,0.12)` |
| `--badge-app-text` | `#137333` | `#40a02b` |
| `--badge-int-bg` | `#fef7e0` | `rgba(223,142,29,0.12)` |
| `--badge-int-text` | `#b06000` | `#df8e1d` |
| `--badge-off-bg` | `#E1F5EE` | `rgba(23,146,153,0.12)` |
| `--badge-off-text` | `#0F6E56` | `#179299` |
| `--badge-rej-bg` | `#fce8e6` | `rgba(210,15,57,0.12)` |
| `--badge-rej-text` | `#c5221f` | `#d20f39` |
| `--input-bg` | `#ffffff` | `#ffffff` _(unchanged)_ |
| `--input-border` | `#e0e0e0` | `#ccd0da` |

### 3b. Updated existing variables (`[data-theme="dark"]` — Mocha)

| Variable | Old | New |
|---|---|---|
| `--bg-page` | `#121212` | `#1e1e2e` |
| `--bg-sidebar` | `#1a1a1a` | `#181825` |
| `--bg-card` | `#1e1e1e` | `#313244` |
| `--bg-metric` | `#2a2a2a` | `#45475a` |
| `--text-main` | `#f5f5f5` | `#cdd6f4` |
| `--text-muted` | `#a3a3a3` | `#a6adc8` |
| `--text-light` | `#737373` | `#7f849c` |
| `--text-faint` | `#555555` | `#6c7086` |
| `--border` | `rgba(255,255,255,0.15)` | `rgba(203,166,247,0.12)` |
| `--border-light` | `rgba(255,255,255,0.08)` | `rgba(203,166,247,0.06)` |
| `--btn-primary-bg` | `#f5f5f5` | `#cba6f7` |
| `--btn-primary-text` | `#0a0a0a` | `#1e1e2e` |
| `--badge-new-bg` | `rgba(26,86,232,0.2)` | `rgba(137,180,250,0.2)` |
| `--badge-new-text` | `#8ab4f8` | `#89b4fa` |
| `--badge-viewed-bg` | `rgba(255,255,255,0.1)` | `rgba(166,173,200,0.1)` |
| `--badge-viewed-text` | `#a3a3a3` | `#a6adc8` |
| `--badge-cust-bg` | `rgba(83,74,183,0.2)` | `rgba(203,166,247,0.2)` |
| `--badge-cust-text` | `#b6aef2` | `#cba6f7` |
| `--badge-app-bg` | `rgba(19,115,51,0.2)` | `rgba(166,227,161,0.2)` |
| `--badge-app-text` | `#81c995` | `#a6e3a1` |
| `--badge-int-bg` | `rgba(176,96,0,0.2)` | `rgba(249,226,175,0.2)` |
| `--badge-int-text` | `#fde293` | `#f9e2af` |
| `--badge-off-bg` | `rgba(15,110,86,0.2)` | `rgba(148,226,213,0.2)` |
| `--badge-off-text` | `#7ad8bd` | `#94e2d5` |
| `--badge-rej-bg` | `rgba(197,34,31,0.2)` | `rgba(243,139,168,0.2)` |
| `--badge-rej-text` | `#f28b82` | `#f38ba8` |
| `--input-bg` | `#2a2a2a` | `#313244` |
| `--input-border` | `#444444` | `#45475a` |

### 3c. New variables (added to both `:root` and `[data-theme="dark"]`)

| Variable | Latte | Mocha | Usage |
|---|---|---|---|
| `--bg-content` | `#eaecf2` | `#181825` | Nested content bg within cards (cover letter, highlights, issues) |
| `--bg-warning` | `rgba(223,142,29,0.12)` | `rgba(249,226,175,0.15)` | Warning alert box background |
| `--bg-error` | `rgba(210,15,57,0.12)` | `rgba(243,139,168,0.15)` | Error alert box background |
| `--bg-info` | `rgba(30,102,245,0.12)` | `rgba(137,180,250,0.15)` | Info alert box background |
| `--bg-success` | `rgba(64,160,43,0.12)` | `rgba(166,227,161,0.15)` | Success alert box background |
| `--text-warning` | `#df8e1d` | `#f9e2af` | Warning text / icon color |
| `--text-error` | `#d20f39` | `#f38ba8` | Error text / icon color |
| `--text-info` | `#1e66f5` | `#89b4fa` | Info text / icon color |
| `--text-success` | `#40a02b` | `#a6e3a1` | Success text / icon color |
| `--border-warning` | `rgba(223,142,29,0.3)` | `rgba(249,226,175,0.25)` | Warning alert box border |
| `--border-error` | `rgba(210,15,57,0.25)` | `rgba(243,139,168,0.25)` | Error alert box border |
| `--border-info` | `rgba(30,102,245,0.25)` | `rgba(137,180,250,0.25)` | Info alert box border |
| `--border-success` | `rgba(64,160,43,0.25)` | `rgba(166,227,161,0.25)` | Success alert box border |
| `--progress-track` | `#ccd0da` | `#45475a` | Progress bar track background |

---

## 4. Component Fixes

At least 75 hardcoded color replacements across 6 files. Each replacement maps a raw hex/rgba to the appropriate CSS variable.

### 4a. `src/lib/styles.jsx`
- Update all values as per tables in Section 3
- Add 14 new variables in both `:root` and `[data-theme="dark"]` blocks

### 4b. `src/components/Dashboard.jsx`
- `'#666'` → `var(--text-muted)` — all instances: date line (~line 62), metric card labels (~line 89), recent apps company name (~line 118)
- `'#888'` → `var(--text-light)` — "No applications yet." empty state (~line 110)
- Warning banner (~line 67): `background '#fffbeb'` → `var(--bg-warning)`, `borderColor '#ffd166'` → `var(--border-warning)`, `color '#b06000'` → `var(--text-warning)`
- Info banner (~line 74): `background '#e8f0fe'` → `var(--bg-info)`, `borderColor '#a8c7fa'` → `var(--border-info)`, `color '#1a56e8'` → `var(--text-info)`

### 4c. `src/components/Sidebar.jsx`
- `color: '#888'` (email ~line 54) → `var(--text-light)`
- Admin button (~line 59): `color: '#b06000'` → `var(--text-warning)`, `borderColor: 'rgba(176,96,0,0.3)'` → `var(--border-warning)`
- Sign out button (~line 61): `color: '#c5221f'` → `var(--text-error)`, `borderColor: 'rgba(197,34,31,0.25)'` → `var(--border-error)`

### 4d. `src/components/Jobs.jsx` (includes `ApplyModal`, `CustomizeModal`, `JobCard`)
- `'#666'` → `var(--text-muted)` — job subtitle, loading subtitle (~line 403)
- `'#888'` → `var(--text-light)` — jobType, skip button, skipped count, filters toggle
- `'#aaa'` → `var(--text-faint)` — postedDate, sourcePlatform
- `'#555'` → `var(--text-muted)` — filters toggle text, skip list company text
- `'#0a0a0a'` (loading heading ~line 401) → `var(--text-main)`
- `'#137333'` (salary) → `var(--text-success)`
- `'#1a56e8'` (match reason, bg status ~line 404) → `var(--text-info)`
- Verified source / PTO chip: `'#e8f0fe'/'#1a56e8'` → `var(--bg-info)/var(--text-info)`
- Health chip: `'#e6f4ea'/'#137333'` → `var(--bg-success)/var(--text-success)`
- Dental chip: `'#f3e8ff'/'#6b21a8'` → `var(--badge-cust-bg)/var(--badge-cust-text)`
- **Active filter tab** (~line 393): ternary `filter === f ? '#f5f5f5' : 'transparent'` → `filter === f ? 'var(--bg-metric)' : 'transparent'` — note this is a conditional expression, not a bare string
- Warning banners (no analysis ~line 318, expired ~line 109, scheduled error ~line 383): hardcoded → `var(--bg-warning)`, `var(--border-warning)`, `var(--text-warning)`
- Error banner (~line 381): `background '#fce8e6'` → `var(--bg-error)`, `borderColor '#f5c6c6'` → `var(--border-error)`, `color '#c5221f'` → `var(--text-error)`
- Skip list dividers: `'#e8e8e8'` → `var(--border)`, `'#f0f0f0'` → `var(--border-light)`
- **ApplyModal** (~lines 79–98): `color '#666'` → `var(--text-muted)`, tailored strip `background '#e6f4ea'` → `var(--bg-success)` / `color '#137333'` → `var(--text-success)`, body `color '#555'` → `var(--text-muted)`
- **CustomizeModal** content blocks (~lines 47, 53, 63): `background '#f9f9f9'` → `var(--bg-content)`; `color '#666'/'#888'/'#aaa'` → appropriate text vars

### 4e. `src/components/Resume.jsx`

**Helper function refactor** — these 6 functions return strings used directly in inline `style` objects. Change them to return CSS variable strings:

```js
const scoreColor = (s) => s >= 80 ? 'var(--text-success)' : s >= 60 ? 'var(--text-warning)' : 'var(--text-error)'
const scoreBg   = (s) => s >= 80 ? 'var(--bg-success)'   : s >= 60 ? 'var(--bg-warning)'   : 'var(--bg-error)'
const statusColor = (st) => st === 'pass' ? 'var(--text-success)' : st === 'warn' ? 'var(--text-warning)' : 'var(--text-error)'
const statusBg    = (st) => st === 'pass' ? 'var(--bg-success)'   : st === 'warn' ? 'var(--bg-warning)'   : 'var(--bg-error)'
const sevColor = (sv) => sv === 'high' ? 'var(--text-error)' : sv === 'medium' ? 'var(--text-warning)' : 'var(--text-muted)'
const sevBg    = (sv) => sv === 'high' ? 'var(--bg-error)'   : sv === 'medium' ? 'var(--bg-warning)'   : 'var(--bg-metric)'
```

These functions are used for: ATS circle score, ATS category status icons, ATS category score numbers, ATS issues severity badges, ATS progress bar fills, and semantic section score bars. Since they now return CSS var strings they work identically as inline style values.

**Inline color replacements:**
- `'#666'` → `var(--text-muted)`; `'#888'` → `var(--text-light)`; `'#555'` → `var(--text-muted)`
- File upload success strip: `background '#e6f4ea'` → `var(--bg-success)`, `color '#137333'` → `var(--text-success)`
- Resume tab bar border: `borderBottom: '1px solid #e8e8e8'` → `var(--border)`
- Active tab text + underline: `color '#0a0a0a'` → `var(--text-main)`, `borderBottom '2px solid #0a0a0a'` → `2px solid var(--text-main)`
- Inactive tab text: `color '#888'` → `var(--text-light)`
- Section header labels (`SUMMARY`, `TARGET ROLES`, etc.): `color '#888'` → `var(--text-light)`
- Target roles chips: `background '#e8f0fe'` → `var(--bg-info)`, `color '#1a56e8'` → `var(--text-info)`
- Skills chips: `background '#f5f5f5'` → `var(--bg-metric)`
- Experience/Education muted text: `color '#666'` → `var(--text-muted)`
- ATS score description text (~line 210): `color '#555'` → `var(--text-muted)`
- ATS category detail text (~line 234): `color '#888'` → `var(--text-light)`
- ATS issues detail text (~line 251): `color '#666'` → `var(--text-muted)`
- ATS section label headers (CATEGORY BREAKDOWN, ISSUES FOUND, etc.): `color '#888'` → `var(--text-light)`
- **ATS progress bar track (two locations):** `background '#f0f0f0'` → `var(--progress-track)` — applies to ATS category breakdown bars (~line 231) and semantic section score bars (~line 341)
- ATS issues list item background (~line 245): `background '#fafafa'` → `var(--bg-content)`
- ATS detected keywords chips: `background '#e6f4ea'` → `var(--bg-success)`, `color '#137333'` → `var(--text-success)`
- ATS missing keywords chips: `background '#fce8e6'` → `var(--bg-error)`, `color '#c5221f'` → `var(--text-error)`
- **Semantic section score ternaries (~lines 339, 342):** these use thresholds `>= 70` / `>= 40` (different from scoreColor's `>= 80` / `>= 60`). Replace the hardcoded hex inline with CSS vars but **keep the same threshold logic**:
  - `s.score >= 70 ? '#137333' : s.score >= 40 ? '#b06000' : '#c5221f'` → `s.score >= 70 ? 'var(--text-success)' : s.score >= 40 ? 'var(--text-warning)' : 'var(--text-error)'`
  - same pattern for the bar fill background
- Semantic analysis card: `background '#e8f0fe'` → `var(--bg-info)`, `borderColor '#a8c7fa'` → `var(--border-info)`, `color '#1a56e8'` → `var(--text-info)`
- Semantic matched keywords chips: success vars; missing keywords chips: error vars
- Quick wins index numbers: `color '#aaa'` → `var(--text-faint)`

### 4f. `src/components/Applications.jsx` (includes `TaskModal`)
- **Status metric cards (~line 130):** built from a data array `[{ label, key, bg, c }]` with hardcoded hex in `bg` and `c` fields. Replace array values directly:
  - Applied: `bg: '#e6f4ea'` → `'var(--bg-success)'`, `c: '#137333'` → `'var(--text-success)'`
  - Interview: `bg: '#fef7e0'` → `'var(--bg-warning)'`, `c: '#b06000'` → `'var(--text-warning)'`
  - Offer: `bg: '#E1F5EE'` → `'var(--badge-off-bg)'`, `c: '#0F6E56'` → `'var(--badge-off-text)'`
  - Rejected: `bg: '#fce8e6'` → `'var(--bg-error)'`, `c: '#c5221f'` → `'var(--text-error)'`
- `'#666'` → `var(--text-muted)` (company/location/date ~line 151)
- `'#888'` → `var(--text-light)` (notes italic text ~line 161)
- Remove button: `color '#c5221f'` → `var(--text-error)`
- **TaskModal:**
  - `'#666'` (~line 37) → `var(--text-muted)` (subtitle)
  - `'#aaa'` (~line 39, 44, 78) → `var(--text-faint)` (close icon, "No tasks yet", "Quick add:")
  - Task row border (~line 47): `borderBottom '1px solid #f5f5f5'` → `var(--border-light)`
  - Task text ternary (~line 50): `color: t.completed ? '#bbb' : isOverdue(t) ? '#c5221f' : '#111'` → `color: t.completed ? 'var(--text-faint)' : isOverdue(t) ? 'var(--text-error)' : 'var(--text-main)'`
  - Overdue badge (~line 52): `background '#fce8e6'` → `var(--bg-error)`, `color '#c5221f'` → `var(--text-error)`
  - Due date text (~line 54): overdue `'#c5221f'` → `var(--text-error)`, normal `'#888'` → `var(--text-light)`
  - Notes text (~line 55): `'#888'` → `var(--text-light)`
  - Remove button (~line 57): `color '#ccc'` → `var(--text-faint)`
  - Date label (~line 64): `'#888'` → `var(--text-light)`
  - Modal footer border (~line 89): `borderTop '1px solid #f0f0f0'` → `var(--border-light)`

---

## 5. Implementation Order

1. `src/lib/styles.jsx` — update all vars + add 14 new vars
2. `src/components/Dashboard.jsx`
3. `src/components/Sidebar.jsx`
4. `src/components/Applications.jsx` (+ TaskModal)
5. `src/components/Jobs.jsx` (+ CustomizeModal, JobCard)
6. `src/components/Resume.jsx`
7. Run `npm test` — verify all 72 tests still pass
8. Invoke `superpowers:code-simplifier` on changed files

---

## 6. Out of Scope

- `AdminPanel.jsx` — not part of this pass
- `ProfileSelect.jsx` — minimal colors, not part of this pass
- Layout, spacing, font sizes — no changes
- Netlify functions — no changes
- Dark mode toggle mechanism — no changes
- New npm dependencies — none added

---

## 7. Testing Notes

Component tests use React Testing Library and test behavior (click, render, state), not color values. No test changes expected. Run `npm test` after implementation to confirm.

---

## 8. Explicitly Out of Scope

- Pre-existing `console.log('[ats]', s)` in `Resume.jsx` line 98 — violates CLAUDE.md but is a separate concern; **do not remove it in this pass**
- `AdminPanel.jsx` and `ProfileSelect.jsx` — not touched
- Any layout, spacing, or font-size changes
- Netlify functions / backend
- Dark mode toggle mechanism (`Settings.jsx` checkbox, `JobHunterApp.jsx` theme-restore logic)
- Adding `@catppuccin/palette` npm package — hex values are hardcoded in `styles.jsx` per Option A
