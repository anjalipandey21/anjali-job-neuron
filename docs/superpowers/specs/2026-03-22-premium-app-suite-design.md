# Job Neuron — Premium App Suite Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Full-app frontend redesign — all views
**Design direction:** Premium App Suite (Direction B)

---

## Overview

Elevate the existing Catppuccin-themed interface into a polished, premium SaaS feel. The layout bones remain unchanged (sidebar + main content, single-page app). All changes are purely visual: no new routes, no new data fetching, no new KV keys, no new dependencies. All styles remain inline React style objects per project convention.

---

## Design System Changes (`src/lib/styles.jsx`)

### New token
Add `--shadow-md` to both light and dark `:root` blocks:
- Light: `0 4px 16px rgba(0,0,0,0.10)`
- Dark: `0 4px 16px rgba(0,0,0,0.35)`

### Badge pill shape
`Badge` component: change `borderRadius` from `6` to `20` (pill shape across all status badges app-wide).

### No other token changes
`C.metricCard` stays as-is. Dashboard metric cards get their own elevated inline style, not a shared token change, to avoid breaking other uses.

---

## Sidebar (`src/components/Sidebar.jsx`)

### Width
200px → **240px**

### Brand header
Replace the current plain icon + "JobHunter AI" text with:
- Gradient icon box: `linear-gradient(135deg, #8839ef, #7c3aed)`, 34×34px, `borderRadius: 10`, `boxShadow: '0 2px 8px rgba(136,57,239,0.35)'`
- Primary label: **"Job Neuron"**, 15px, weight 700
- Sub-label: **"AI Job Search"**, 10px, `var(--text-light)`

### Nav section labels
Add two uppercase section dividers rendered as non-interactive `<div>` elements:
- **"MAIN"** — above Dashboard
- **"ACCOUNT"** — above Settings

Label style: `fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-light)', textTransform: 'uppercase', padding: '14px 16px 6px'`

### Nav item icons
Add a 16×16px inline SVG icon before each label. Icons:

| Nav item | Icon description |
|---|---|
| Dashboard | 2×2 grid of rounded squares |
| Resume | Document with horizontal lines |
| Find Jobs | Circle with exclamation (or magnifier) |
| Applications | Envelope with fold line |
| Settings | Sun/cog with radiating lines |

Active state gains a **3px left accent bar** (`position: absolute, left: 0, top: 6px, bottom: 6px, width: 3, background: 'var(--btn-primary-bg)', borderRadius: 2`). Nav item must be `position: relative` to contain it.

### Badge counts on nav
- **Find Jobs**: show count of today's jobs (passed as `todayJobCount` prop, 0 if none)
- **Applications**: show count of open (non-rejected, non-offer) applications (passed as `openAppCount` prop, 0 if none)

Counts are shown as small pill badges (`fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: 'var(--badge-cust-bg)', color: 'var(--badge-cust-text)', marginLeft: 'auto'`). Badge hidden when count is 0.

**"Open" application definition:** `openAppCount` = applications where `status` is NOT in `['rejected', 'offer']`. Equivalently: `apps.filter(a => !['rejected', 'offer'].includes(a.status)).length`. This covers statuses `new`, `viewed`, `customized`, `applied`, `interview`.

**Props change:** `Sidebar` gains two new optional props: `todayJobCount` (number, default 0) and `openAppCount` (number, default 0). `MainApp` passes these values.

**Data sourcing in `MainApp`:** `MainApp` adds its own two `dbGet` calls on mount (alongside the existing `jh_p_{profileId}` call, all in parallel via `Promise.all`):
- `dbGet('jh_jobs_{profileId}_{todayStr()}')` → `todayJobCount = (result || []).length`
- `dbGet('jh_apps_{profileId}')` → `openAppCount = (result || []).filter(a => !['rejected', 'offer'].includes(a.status)).length`

These are stored as state in `MainApp` and passed to `<Sidebar>`. They are fetched once on mount and not re-fetched unless `profile.id` changes (same `useEffect` dependency pattern as the existing profile fetch). This is the minimum new fetching required — it does not duplicate the Dashboard's own fetching (Dashboard still fetches its own copies for the full stats display).

### Footer user card
Replace the current three stacked buttons with:
1. A **user card** row: gradient avatar circle + name + email + `⋯` icon, styled as a card (`background: 'var(--bg-card)', borderRadius: 8, padding: '10px', boxShadow: 'var(--shadow-sm)'`)
2. A **button row** below: "Switch profile" ghost + "Sign out" danger ghost, side by side, `flex: 1` each
3. Admin button (when `isAdmin`): inserted between user card and button row, full-width, retains existing warning color

Avatar: 32×32px circle, `background: 'linear-gradient(135deg, var(--badge-new-bg), var(--btn-primary-bg))'`, initials text white.

---

## Page Heroes

Each main content view gains a **gradient hero banner** at the top, replacing the current plain `<h2>` heading. The hero renders inside the view component's root div, above all existing content. The `<h2>` heading is removed from each view; its text moves into the hero.

### Hero structure (shared pattern)
```
position: relative, overflow: hidden
padding: '24px 28px 20px'
color: white
```
Two decorative circles via absolutely-positioned `<div>` elements (no pseudo-elements in inline styles):
- Circle 1: `position: absolute, right: -30, top: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none'`
- Circle 2: `position: absolute, right: 60, bottom: -40, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none'`

Hero title: `fontSize: 20, fontWeight: 700, marginBottom: 2`
Hero sub: `fontSize: 13, opacity: 0.75`
Optional chip: `display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500, marginTop: 10`

### Per-view gradients and content

| View | Gradient | Title | Chip |
|---|---|---|---|
| Dashboard | `linear-gradient(135deg, #8839ef 0%, #7c3aed 60%, #6d28d9 100%)` | `{greeting}, {firstName}` + date sub | "{N} applications open" where N = `apps.filter(a => !['rejected','offer'].includes(a.status)).length`, shown when N > 0. Computed from the `apps` array already fetched inside `Dashboard.jsx`. |
| Resume | `linear-gradient(135deg, #179299 0%, #0d7377 100%)` | "Your Resume" | "Resume uploaded" or "No resume yet" |
| Find Jobs | `linear-gradient(135deg, #1e66f5 0%, #1a56d6 100%)` | "Find Jobs" | "{N} found today" (when > 0) |
| Applications | `linear-gradient(135deg, #df8e1d 0%, #b87514 100%)` | "Applications" | "{N} open" (when > 0) |
| Settings | `linear-gradient(135deg, #6c6f85 0%, #4c4f69 100%)` | "Settings" | None |

---

## Dashboard (`src/components/Dashboard.jsx`)

### Metric cards
Replace `C.metricCard` with an elevated inline style per card:

```js
{
  background: 'var(--bg-card)',
  borderRadius: 12,
  padding: '14px 16px',
  boxShadow: 'var(--shadow-sm)',
  border: '1px solid var(--border-light)',
  borderLeft: '3px solid {accentColor}',
  position: 'relative',
  overflow: 'hidden',
  transition: 'transform 0.15s, box-shadow 0.15s',
}
```

On hover (via `onMouseEnter`/`onMouseLeave` state): `transform: 'translateY(-2px)', boxShadow: 'var(--shadow-md)'`

Metric accent colors:
- Jobs found today: `#8839ef` (purple)
- Total applied: `#1e66f5` (blue)
- Interviews: `#df8e1d` (yellow)
- Offers: `#40a02b` (green)

Each card gets a small icon badge (top-right, absolute): 28×28px rounded box with soft background matching accent, containing an emoji or SVG icon.

Metric number color matches accent. Font size stays 26px, weight changes 500 → **700**.

### Quick action items
Change from plain ghost `<button>` to a styled row with:
- `border: '1px solid var(--border-light)', borderRadius: 8, padding: '9px 10px'`
- Hover: `background: 'rgba(136,57,239,0.08)', borderColor: 'rgba(136,57,239,0.2)', color: 'var(--btn-primary-bg)'`
- Emoji icon prefix per action (🔍 / 📄 / 📋)

### Upcoming tasks
Each task row gets a styled due-date chip (right-aligned):
- Normal: `background: 'var(--bg-metric)', color: 'var(--text-light)', padding: '1px 6px', borderRadius: 4, fontSize: 10`
- Overdue: `background: 'var(--badge-rej-bg)', color: 'var(--badge-rej-text)'`

---

## Jobs (`src/components/Jobs.jsx`)

### Job cards
Each job card (`C.card`) gains:
- `borderLeft: '3px solid {statusColor}'` — color derived from job status using the existing badge color map
- Hover lift: `transform: 'translateY(-2px)', boxShadow: 'var(--shadow-md)'` via onMouseEnter/Leave state
- Company avatar: 36×36px circle, `background: 'var(--bg-metric)'`, initials (first 2 chars of company name), `fontSize: 12, fontWeight: 600, color: 'var(--text-muted)'` — placed before the job title

Status → border color map:
```
new:        var(--badge-new-text)   → #1e66f5
viewed:     var(--border)
customized: var(--badge-cust-text)  → #8839ef
applied:    var(--badge-app-text)   → #40a02b
interview:  var(--badge-int-text)   → #df8e1d
offer:      var(--badge-off-text)   → #179299
rejected:   var(--badge-rej-text)   → #d20f39
```

---

## Applications (`src/components/Applications.jsx`)

### Application rows
Each application row gains:
- `borderLeft: '3px solid {statusColor}'` (same map as Jobs)
- Company avatar circle (same style as Jobs — 36×36px initials circle)
- Hover lift on the row card

### Activity log
Entries rendered in a **timeline style**: left border line (`borderLeft: '2px solid var(--border)'`) with an absolute dot at the top of each entry (`width: 8, height: 8, borderRadius: '50%', background: 'var(--btn-primary-bg)', position: 'absolute', left: -5, top: 6`).

### TaskModal
- Modal header: `borderBottom: '1px solid var(--border-light)', paddingBottom: 12`
- Task rows: keep the native `<input type="checkbox">` for accessibility (keyboard + screen reader support), but visually hide it (`position: 'absolute', opacity: 0, width: 0, height: 0`) and place a sibling styled `<div>` immediately after it that acts as the visual checkbox. The styled div: `width: 16, height: 16, borderRadius: 4, border: '1.5px solid var(--border)', cursor: 'pointer', flexShrink: 0`. When `t.completed` is true, fill it with accent color and show a checkmark (✓) in white. Clicking the visible div calls the same `toggleDone(t.id)` handler. The `<label>` wrapper (or `htmlFor` + `id` pairing) connects the visible div click to the native checkbox for accessibility.
- Due date chip on each task (same style as Dashboard upcoming tasks)

---

## Resume (`src/components/Resume.jsx`)

### Empty state upload zone
When no resume text exists, replace the current plain prompt with a styled upload zone:
- `border: '2px dashed var(--border)', borderRadius: 12, padding: '2rem', textAlign: 'center'`
- Icon (📄) at 32px, then "Drop your resume PDF here or click to upload" label

### Analysis results
Section headers within the analysis card get a colored dot prefix (`width: 6, height: 6, borderRadius: '50%', background: 'var(--btn-primary-bg)', display: 'inline-block', marginRight: 6`).

ATS score (if present): large colored number styled consistently with Dashboard metric numbers (`fontSize: 28, fontWeight: 700, color: 'var(--btn-primary-bg)'`).

---

## Settings (`src/components/Settings.jsx`)

- Max-width: 480px → **560px**
- Section card titles get the colored dot prefix (same as Resume analysis section headers)
- No other structural changes

---

## ProfileSelect (`src/components/ProfileSelect.jsx`)

### Layout
Change from `margin: '72px auto'` to full-height centered layout:
```js
{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '0 20px' }
```
Inner container: `maxWidth: 480, width: '100%'`

### Branding
- Update "JobHunter AI" → **"Job Neuron"**
- Brand icon box: match Sidebar gradient style (34×34px, `linear-gradient(135deg, #8839ef, #7c3aed)`, `borderRadius: 10`, glow shadow)
- Add sub-label "AI Job Search" below the name

### Profile cards
Each profile card on hover: `transform: 'translateY(-2px)', boxShadow: 'var(--shadow-md)'` via onMouseEnter/Leave state

---

## Animations

| Element | Trigger | Effect |
|---|---|---|
| Metric cards | hover | `translateY(-2px)` + shadow-md, 150ms ease |
| Job cards | hover | `translateY(-2px)` + shadow-md, 150ms ease |
| Application rows | hover | `translateY(-2px)` + shadow-md, 150ms ease |
| Profile cards | hover | `translateY(-2px)` + shadow-md, 150ms ease |
| Quick action rows | hover | purple tint bg + border + text color, 150ms |
| Nav items | hover | `background: 'var(--bg-metric)'`, 120ms via `transition` CSS property (no JS state needed — add `transition: 'background 0.12s'` directly to the button style; no `hoveredId` state required) |
| Modals | open | `opacity: 0→1, transform: scale(0.97)→scale(1)`, 180ms via CSS keyframe in GlobalStyles |

Modal animation requires adding one `@keyframes modalIn` block to `GlobalStyles` in `styles.jsx` and applying `animation: 'modalIn 0.18s ease'` to modal inner cards. The exact CSS to add inside the `<style>` tag:

```css
@keyframes modalIn {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}
```

---

## What Does NOT Change

- No new npm dependencies
- No TypeScript
- No CSS framework
- No new routes or pages
- No new KV keys or data fetching beyond the two new Sidebar props (`todayJobCount`, `openAppCount`) which are derived from data already loaded in `MainApp`/`Dashboard`
- Dark mode variables remain fully functional — all new colors use existing CSS variables where possible; hardcoded hex values are only used where the variable doesn't exist (e.g. gradient stops match Catppuccin Mocha accent colors)
- All existing tests must continue to pass; no test changes required unless snapshot tests break

---

## File Change Summary

| File | Change type |
|---|---|
| `src/lib/styles.jsx` | Add `--shadow-md` token, Badge radius 6→20, add `@keyframes modalIn` |
| `src/components/Sidebar.jsx` | Width, branding, icons, section labels, active bar, badge counts, footer user card |
| `src/components/MainApp.jsx` | Compute `todayJobCount` + `openAppCount` and pass to Sidebar |
| `src/components/Dashboard.jsx` | Hero banner, elevated metric cards, action row styling, task due chips |
| `src/components/Jobs.jsx` | Hero banner, card left border + avatar + hover lift |
| `src/components/Applications.jsx` | Hero banner, row left border + avatar, timeline activity, TaskModal improvements |
| `src/components/Resume.jsx` | Hero banner, upload zone, analysis section dots, ATS score styling |
| `src/components/Settings.jsx` | Hero banner, max-width, section dots |
| `src/components/ProfileSelect.jsx` | Centered layout, Job Neuron branding, card hover lift |
