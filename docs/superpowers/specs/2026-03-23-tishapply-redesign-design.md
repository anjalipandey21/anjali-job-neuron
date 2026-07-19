# Job Neuron — Full Visual Redesign

**Date:** 2026-03-23
**Status:** Approved
**Scope:** Full visual redesign of all UI views

---

## Overview

Job Neuron is an AI-powered job search platform. This spec covers a full visual redesign inspired by the Starlink aesthetic: dark-first, space-age glassmorphism with animated depth, Space Grotesk typography, and an indigo/violet gradient accent palette. The redesign removes light mode entirely and introduces a space/galaxy full-page background.

Zero new npm packages are added. Space Grotesk is loaded via Google Fonts CDN. The inline-style + CSS-custom-property architecture of `src/lib/styles.jsx` is preserved and extended.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Scope | Full redesign of all views | Consistent identity across all 5 views + modals + admin panel |
| Theme | Dark only — remove light mode | Single definitive visual identity; simpler token set |
| Background | Full-page space/galaxy image | ~7% effective opacity; NASA public domain or Unsplash CC0 |
| Cards & Panels | Glassmorphism | `rgba(255,255,255,0.05)` + `backdrop-filter:blur(12px)` + subtle white border |
| Accent | Indigo → Violet gradient | `#6366f1` → `#8b5cf6`; preserves Job Neuron's purple DNA |
| Typography | Space Grotesk (Google Fonts CDN) | Technical, geometric; Starlink-adjacent; no npm dep |
| Animations | Full suite | Starfield, slide-up on tab switch, shimmer on card load, glow pulse, count-up on metrics |
| Dependencies | Zero new npm packages | CDN font link only |
| Image sources | NASA public domain + Unsplash CC0 | Free, no attribution required, embedded as CSS `background-image` URLs |
| Implementation | Tokens-first (bottom-up) | Update `styles.jsx` CSS custom property values first, then sweep components |

---

## Token Architecture

The project uses **CSS custom properties** for all colours, defined in `GlobalStyles` in `src/lib/styles.jsx`. Components reference these as `var(--token-name)` in inline style objects.

The `C` object contains composite style objects (`C.card`, `C.metricCard`, `C.input`) that use `var()` references internally.

**Migration approach:**
1. Replace existing CSS variable values inside the `:root` block in `GlobalStyles` with the new dark palette
2. Add new CSS variables to `:root` (clearly flagged below as NEW — these do not exist yet)
3. Delete the `[data-theme="dark"]` block entirely (dark is now the only theme)
4. Update `C.card`, `C.metricCard`, `C.input` composite objects
5. Sweep component files — most pick up new values via `var()` automatically; only structural/glassmorphism changes require touching component files

---

## Color System

All values go into the `:root` block in `GlobalStyles`. The `[data-theme="dark"]` block (lines 45–86 of current `styles.jsx`) is **deleted in full**.

Variables marked **NEW** do not exist in the current codebase and must be added to `:root`, not just updated.

### Page Backgrounds

| CSS Variable | Value | Status | Usage |
|---|---|---|---|
| `--bg-page` | `#06060f` | replace | Page / body background |
| `--bg-sidebar` | `#0a0a18` | replace | Sidebar background |
| `--bg-content` | `#0f1020` | replace | Content area tint |
| `--bg-card` | `rgba(255,255,255,0.05)` | replace | Glassmorphism card base |
| `--bg-card-hover` | `rgba(255,255,255,0.08)` | **NEW** | Card hover state |
| `--bg-metric` | `rgba(255,255,255,0.07)` | replace | Metric / stat cards |
| `--input-bg` | `rgba(255,255,255,0.06)` | replace | Input fields |
| `--bg-bottom-nav` | `rgba(6,6,15,0.88)` | replace | Mobile bottom nav |

### Borders

| CSS Variable | Value | Status | Usage |
|---|---|---|---|
| `--border` | `rgba(255,255,255,0.09)` | replace | Default card/panel border |
| `--border-light` | `rgba(255,255,255,0.06)` | replace | Subtle dividers |
| `--input-border` | `rgba(255,255,255,0.15)` | replace | Input border |

### Text

| CSS Variable | Value | Status | Usage |
|---|---|---|---|
| `--text-main` | `#ffffff` | replace | Primary text |
| `--text-muted` | `rgba(255,255,255,0.65)` | replace | Secondary text (descriptions) |
| `--text-light` | `rgba(255,255,255,0.4)` | replace | Muted text (labels, timestamps) |
| `--text-faint` | `rgba(255,255,255,0.2)` | replace | Placeholders, disabled |

### Accent — Indigo/Violet (all NEW)

| CSS Variable | Value | Usage |
|---|---|---|
| `--accent` | `#6366f1` | Accent base colour reference |
| `--accent-alt` | `#8b5cf6` | Accent end colour reference |
| `--accent-fill` | `rgba(99,102,241,0.15)` | Active nav bg, callouts |
| `--accent-border` | `rgba(99,102,241,0.25)` | Accent-tinted borders |
| `--accent-text` | `#a5b4fc` | Accent-coloured labels/eyebrows |

### Buttons

| CSS Variable | Value | Status | Usage |
|---|---|---|---|
| `--btn-primary-bg` | `linear-gradient(135deg,#6366f1,#8b5cf6)` | replace | Primary button background |
| `--btn-primary-text` | `#ffffff` | replace | Primary button text |

### Status Badge Colors

Replace existing `--badge-*-bg` and `--badge-*-text` variables. Add `--badge-*-border` variables (all **NEW**).

| Status | `--badge-*-bg` | `--badge-*-text` | `--badge-*-border` (NEW) |
|---|---|---|---|
| new | `rgba(99,102,241,0.2)` | `#a5b4fc` | `rgba(99,102,241,0.3)` |
| viewed | `rgba(255,255,255,0.08)` | `rgba(255,255,255,0.4)` | `rgba(255,255,255,0.12)` |
| customized (cust) | `rgba(139,92,246,0.2)` | `#c4b5fd` | `rgba(139,92,246,0.3)` |
| applied (app) | `rgba(34,197,94,0.15)` | `#86efac` | `rgba(34,197,94,0.25)` |
| interview (int) | `rgba(234,179,8,0.15)` | `#fde047` | `rgba(234,179,8,0.25)` |
| offer (off) | `rgba(20,184,166,0.15)` | `#5eead4` | `rgba(20,184,166,0.25)` |
| rejected (rej) | `rgba(239,68,68,0.15)` | `#fca5a5` | `rgba(239,68,68,0.25)` |

### Shadows

| CSS Variable | Value | Status | Usage |
|---|---|---|---|
| `--shadow-sm` | `0 2px 8px rgba(0,0,0,0.35)` | replace | Subtle elevation |
| `--shadow-md` | `0 8px 24px rgba(0,0,0,0.4)` | replace | Card hover shadow |
| `--shadow-lg` | `0 16px 48px rgba(0,0,0,0.6)` | replace | Modal shadow |
| `--modal-overlay` | `rgba(0,0,0,0.7)` | replace | Modal backdrop |

### Progress bar

| CSS Variable | Value | Status | Usage |
|---|---|---|---|
| `--progress-track` | `rgba(255,255,255,0.1)` | replace | Progress bar track background |

### Contextual colours (warnings, errors, info, success)

Copy the values from the current `[data-theme="dark"]` block directly into `:root` unchanged:

```
--bg-warning, --text-warning, --border-warning
--bg-error,   --text-error,   --border-error
--bg-info,    --text-info,    --border-info
--bg-success, --text-success, --border-success
```

---

## Typography

### Font Loading

Add to `index.html` before closing `</head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

Add to `body` rule inside `GlobalStyles`:

```css
font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
```

### Type Scale

| Use | Size | Weight | Variable |
|---|---|---|---|
| Page headings / hero titles | 28px | 700 | `--text-main` |
| Section headings / card titles | 20px | 600 | `--text-main` |
| Job titles / nav items / buttons | 15px | 500–600 | `--text-main` |
| Body text / descriptions | 13px | 400 | `--text-muted` |
| Labels / badges / metadata | 11px | 600 | `--text-light` (uppercase + letter-spacing) |

---

## Background

### Galaxy Image Constant

Define at the top of `styles.jsx` (before `GlobalStyles`):

```js
// Free CC0 galaxy image — NASA/Unsplash public domain
const GALAXY_IMAGE_URL =
  'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1800&q=80'
```

### GlobalStyles `body` rule

The current `body` rule uses the shorthand `background: var(--bg-page)`. **Replace this entire `background:` shorthand** (do not leave it in place) with the two-property form, or the shorthand will override `background-image`:

```css
body {
  background-color: #06060f;
  background-image: url('${GALAXY_IMAGE_URL}');
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  color: var(--text-main);
  font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
}
```

Also remove `transition: background 0.2s, color 0.2s;` from the `body` rule — no longer needed without theme switching.

### Overlay divs (in `MainApp.jsx`)

Add two fixed overlay `<div>`s inside the root `<div>` of `MainApp.jsx`. They must appear in **both** the loading-state early return (line 63) and the main return (line 65), so the background is consistent at all stages.

**Loading state** — replace the current bare `<div>` at line 63 with:

```jsx
<div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
  <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'linear-gradient(135deg, rgba(6,6,15,0.92) 0%, rgba(6,6,15,0.88) 100%)' }} />
  <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.05) 0%, transparent 50%)' }} />
  <p style={{ position: 'relative', zIndex: 1, color: 'var(--text-muted)', fontSize: 14 }}>Loading profile…</p>
</div>
```

**Main return** — add as first two children of the root `<div>`, then wrap the sidebar + `<main>` in a `position:'relative', zIndex:1` container:

```jsx
<div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
  {/* Overlays — sit between galaxy background and app chrome */}
  <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'linear-gradient(135deg, rgba(6,6,15,0.92) 0%, rgba(6,6,15,0.88) 100%)' }} />
  <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.05) 0%, transparent 50%)' }} />
  {/* App chrome — sits above overlays */}
  <div style={{ display: 'flex', flex: 1, position: 'relative', zIndex: 1, overflow: 'hidden' }}>
    <Sidebar ... />
    <main ...>...</main>
    <BottomNav ... />
  </div>
</div>
```

### Hero Banners

Each view has a hero section at the top of its content area. Structure:

```jsx
<div style={{ position:'relative', overflow:'hidden', padding:'28px 32px 24px', borderBottom:'1px solid var(--border)' }}>
  {/* Space image layer */}
  <div style={{ position:'absolute', inset:0, backgroundImage:`url(${GALAXY_IMAGE_URL})`, backgroundSize:'cover', backgroundPosition:'center', opacity:0.13, pointerEvents:'none' }} />
  {/* Gradient fade to page bg */}
  <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, transparent 60%, #06060f 100%)', pointerEvents:'none' }} />
  {/* Starfield — 4–8 star divs (see Animation section) */}
  {/* Content: eyebrow + title + subtitle + buttons + stats row */}
  <div style={{ position:'relative', zIndex:1 }}>
    <div style={{ fontSize:11, fontWeight:600, letterSpacing:'1.2px', textTransform:'uppercase', color:'var(--accent-text)', marginBottom:4 }}>EYEBROW LABEL</div>
    <div style={{ fontSize:28, fontWeight:700, color:'var(--text-main)', marginBottom:4 }}>Page Title</div>
    <div style={{ fontSize:13, color:'var(--text-light)' }}>Subtitle text</div>
  </div>
</div>
```

Import `GALAXY_IMAGE_URL` from `styles.jsx` (add to the named export) in each component that uses a hero.

---

## Glassmorphism Card System

### C.card (updated value in `styles.jsx`)

```js
card: {
  background: 'var(--bg-card)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '1.25rem',
  position: 'relative',   // NEW — required for shimmer-line and card-line children
  overflow: 'hidden',     // NEW — required to clip shimmer and top-edge highlight
}
```

**Note:** Adding `position: 'relative'` and `overflow: 'hidden'` to `C.card` may clip content in components that currently position children relative to a higher ancestor. Audit every component that uses `C.card` for absolutely-positioned children before deploying.

### C.metricCard (updated value in `styles.jsx`)

```js
metricCard: {
  background: 'var(--bg-metric)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '1rem',
  position: 'relative',
  overflow: 'hidden',
}
```

### C.input (updated value in `styles.jsx`)

```js
input: {
  padding: '8px 12px',
  border: '1px solid var(--input-border)',
  borderRadius: 8,
  background: 'var(--input-bg)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  color: 'var(--text-main)',
  fontFamily: 'inherit',
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
}
```

### Top-Edge Highlight (add as first child of every card)

```jsx
<div style={{
  position: 'absolute', top: 0, left: 0, right: 0, height: 1,
  background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.6), transparent)',
  pointerEvents: 'none',
}} />
```

### Shimmer Sweep (add as second child, runs on mount)

```jsx
<div style={{
  position: 'absolute', top: 0, left: 0, width: '40%', height: '100%',
  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)',
  animation: 'shimmer 3s ease-in-out infinite',
  pointerEvents: 'none',
}} />
```

### Hover State

Apply via `onMouseEnter` / `onMouseLeave` state toggle on card containers:

```js
// Hovered
{ background: 'var(--bg-card-hover)', borderColor: 'rgba(99,102,241,0.35)', transform: 'translateY(-1px)', boxShadow: 'var(--shadow-md)' }
// Default
{ background: 'var(--bg-card)', borderColor: undefined, transform: 'none', boxShadow: 'none' }
```

### Sidebar

```js
{
  background: 'rgba(10,10,24,0.85)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRight: '1px solid var(--border-light)',
}
```

---

## Animation Suite

Add all keyframe rules to the `<style>` string in `GlobalStyles` (after the existing `@keyframes modalIn` and `@keyframes sheetIn` rules).

### 1. Starfield (Hero Banners)

```css
@keyframes twinkle {
  0%, 100% { opacity: 0.1; }
  50%       { opacity: 0.85; }
}
```

Render 5–8 absolutely-positioned `<div>` children in each hero `position:relative` container:

```jsx
<div style={{
  position: 'absolute', width: 2, height: 2, borderRadius: '50%', background: '#fff',
  top: '18%', left: '25%',
  animation: 'twinkle 2.5s ease-in-out infinite',
  pointerEvents: 'none',
}} />
```

Vary `top`, `left`, `width` (1–2px), duration (2–4s), and `animationDelay` (0–1.5s) per star.

### 2. Slide-Up (Tab / View Switch)

```css
@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Apply to job cards and application cards with staggered delay:

```js
{ animation: `slideUp 0.4s ${index * 0.06}s ease both` }
```

### 3. Shimmer (Card Load)

```css
@keyframes shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}
```

### 4. Glow Pulse (Active / Featured Card)

```css
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 12px rgba(99,102,241,0.2); }
  50%       { box-shadow: 0 0 28px rgba(139,92,246,0.5); }
}
```

### 5. Count-Up (Dashboard Metrics)

```css
@keyframes countUp {
  from { opacity: 0; transform: scale(0.85); }
  to   { opacity: 1; transform: scale(1); }
}
```

---

## Removing Light Mode

### `src/lib/styles.jsx`

- Delete the entire `[data-theme="dark"] { ... }` block (currently lines 45–86)
- In `GlobalStyles` `body` rule: **remove** the existing `background: var(--bg-page)` shorthand line and replace with `background-color` + `background-image` (see Background section). Also remove `transition: background 0.2s, color 0.2s`
- Add `GALAXY_IMAGE_URL` constant at top of file (export it so components can use it in hero banners)

### `src/JobHunterApp.jsx`

- **Delete lines 6–10**: the entire `if (typeof window !== 'undefined') { try { ... } catch (e) {} }` block that reads `jh_theme` from `localStorage` and sets `data-theme` on `document.documentElement`

### `src/components/MainApp.jsx`

- **Delete lines 35–45**: the `useEffect` that reads `profileData.preferences?.darkMode`, sets/removes `data-theme`, and writes `localStorage.setItem('jh_theme', ...)`
- Add overlay `<div>`s to both the loading-state early return and the main return (see Background section)

### `src/components/Settings.jsx`

- Remove `darkMode: false` from the `form` initial state (line 6)
- Remove the `darkMode` checkbox `<label>` + `<input type="checkbox">` UI element
- The `save` handler spreads the whole `form` object — no other handler change needed. Users who previously saved `darkMode: true` will have the stale key removed from their KV entry on their next Settings save (safe, no migration needed)
- Replace the existing hero banner at **lines 23–28** (including the `{/* Hero banner */}` comment on line 23) with the new glassmorphism hero structure

---

## STATUS_STYLES and Badge Update

Add `borderColor` to each `STATUS_STYLES` entry using the new `--badge-*-border` CSS variables. Update `Badge` to include `border: '1px solid'` so `borderColor` takes effect:

```js
export const STATUS_STYLES = {
  new:        { background: 'var(--badge-new-bg)',    color: 'var(--badge-new-text)',    borderColor: 'var(--badge-new-border)' },
  viewed:     { background: 'var(--badge-viewed-bg)', color: 'var(--badge-viewed-text)', borderColor: 'var(--badge-viewed-border)' },
  customized: { background: 'var(--badge-cust-bg)',   color: 'var(--badge-cust-text)',   borderColor: 'var(--badge-cust-border)' },
  applied:    { background: 'var(--badge-app-bg)',    color: 'var(--badge-app-text)',    borderColor: 'var(--badge-app-border)' },
  interview:  { background: 'var(--badge-int-bg)',    color: 'var(--badge-int-text)',    borderColor: 'var(--badge-int-border)' },
  offer:      { background: 'var(--badge-off-bg)',    color: 'var(--badge-off-text)',    borderColor: 'var(--badge-off-border)' },
  rejected:   { background: 'var(--badge-rej-bg)',    color: 'var(--badge-rej-text)',    borderColor: 'var(--badge-rej-border)' },
}

export const Badge = ({ status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.new
  return (
    <span style={{ ...s, border: '1px solid', fontSize: 11, padding: '2px 7px', borderRadius: 20, fontWeight: 500, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  )
}
```

---

## Sidebar

### Structure

```
[Logo mark + Job Neuron wordmark]
[Divider]
MAIN (section label, 11px uppercase)
  Dashboard
  Jobs         [badge: todayJobCount]
  Applications [badge: openAppCount]
[Divider]
PROFILE (section label)
  Resume
  Settings
[Footer: avatar circle + name + role/email]
```

### Active State

```js
// Nav item wrapper
{ background: 'var(--accent-fill)', color: 'var(--text-main)', position: 'relative' }
// Left-edge accent bar (absolute child)
{ position: 'absolute', left: 0, top: '20%', height: '60%', width: 3, background: 'linear-gradient(180deg,#6366f1,#8b5cf6)', borderRadius: '0 2px 2px 0' }
```

### Responsive (existing breakpoints preserved)

- `>768px`: Full 240px sidebar with labels (update colours only)
- `481–768px`: 64px icon rail (update colours only)
- `≤480px`: Bottom tab bar (update colours only)

---

## Component Changes by File

### `index.html`
- Add 3 Space Grotesk Google Fonts `<link>` tags (see Typography section)

### `src/lib/styles.jsx`
- Add `GALAXY_IMAGE_URL` constant at top, export it
- Replace `:root` CSS variable values with new dark palette (see Color System — replace existing, add NEW ones)
- Delete `[data-theme="dark"]` block
- Update `body` rule: remove `background:` shorthand, remove `transition`, add `background-color` + `background-image` + `font-family`
- Add 5 keyframe animation rules to `GlobalStyles` `<style>` string
- Update `C.card`, `C.metricCard`, `C.input` with glassmorphism values (see Glassmorphism section)
- `btn()` itself does **not** need changing — it already uses `var(--btn-primary-bg)`. The gradient takes effect automatically when `--btn-primary-bg` is updated in `:root`
- Update `STATUS_STYLES` + `Badge` (see STATUS_STYLES section)

### `src/JobHunterApp.jsx`
- Delete lines 6–10: the `if (typeof window !== 'undefined') { try { ... } catch (e) {} }` theme-restore block

### `src/components/MainApp.jsx`
- Delete lines 35–45: darkMode `useEffect`
- Add overlay `<div>`s to loading-state return and main return (see Background section)

### `src/components/Sidebar.jsx`
- Apply glassmorphism sidebar background
- Update active nav item: accent fill + left-edge bar
- Update section labels, dividers, footer user card to new palette

### `src/components/Dashboard.jsx`
- Add glassmorphism hero banner with starfield
- Update metric cards using `C.metricCard` with coloured top-border accents
- Add `countUp` animation to metric numbers (wrap number `<span>` with `animation: 'countUp 0.6s ease both'`)
- Update activity log timeline to new palette

### `src/components/Jobs.jsx`
- Add glassmorphism hero banner with starfield + stats row
- Update `JobCard` to glassmorphism card with top-edge highlight, shimmer, and `slideUp` animation
- Update `CustomizeModal`, `ApplyModal`, `TailorModal` to use `--modal-overlay` backdrop and dark glassmorphism card body

### `src/components/Applications.jsx`
- Add glassmorphism hero banner
- Update application cards to glassmorphism with new `STATUS_STYLES` badge colours
- Update `TaskModal` to dark glassmorphism modal

### `src/components/Resume.jsx`
- Add glassmorphism hero banner
- Update ATS score section cards and progress bars to new palette (`--progress-track` updated)

### `src/components/Settings.jsx`
- Remove `darkMode` from `form` initial state (line 6)
- Remove dark mode toggle UI
- Replace hero banner at lines 23–28 with new glassmorphism hero

### `src/components/ProfileSelect.jsx`
- Update profile cards to glassmorphism style
- Background comes from body automatically

### `src/AdminPanel.jsx`
- Update cards/panels to `C.card` glassmorphism
- Update buttons to `btn()` with new primary gradient
- Replace any hardcoded colour values with CSS variable references

---

## Testing Considerations

### Tests that pass without changes

Most of the 140 tests assert on text content, user interaction, and API calls — not style values or DOM shape. These pass untouched.

### Tests that require updates

**`src/__tests__/Settings.test.jsx`** contains structural DOM assertions on `root.firstChild` (the hero banner) and `root.children[1].style.maxWidth`. Replacing the hero banner at lines 23–28 with a multi-layer structure changes the shape of `root.firstChild`. Update these structural assertions to match the new DOM after implementation.

**Workflow:** Run `npm test` before starting to establish a passing baseline. Re-run after step 2 (`styles.jsx` token update) — all 140 tests should still pass. After each component file, re-run tests and fix any structural assertion failures before moving to the next component.

---

## Implementation Order (Tokens-First)

1. `index.html` — add Space Grotesk font link (3 lines)
2. `src/lib/styles.jsx` — replace `:root` values, add NEW variables, delete `[data-theme="dark"]`, update body rule, add keyframes, update `C.*`, update `btn()`, update `STATUS_STYLES` + `Badge`, add `GALAXY_IMAGE_URL` export
3. `src/JobHunterApp.jsx` — delete lines 6–10 (theme-restore block)
4. `src/components/MainApp.jsx` — delete lines 35–45 (darkMode effect), add overlay divs to both returns
5. `src/components/Sidebar.jsx` — glassmorphism styles, active state, footer
6. `src/components/Dashboard.jsx` — hero + metric cards + count-up animation
7. `src/components/Jobs.jsx` — hero + JobCard glassmorphism + modals
8. `src/components/Applications.jsx` — hero + application cards + TaskModal
9. `src/components/Resume.jsx` — hero + ATS cards
10. `src/components/Settings.jsx` — remove darkMode from state/UI, new hero
11. `src/components/ProfileSelect.jsx` — glassmorphism profile cards
12. `src/AdminPanel.jsx` — update cards, buttons, colours
13. Run `npm test` — update structural assertions in `Settings.test.jsx` as needed

---

## Out of Scope

- No changes to Netlify Functions, `db.js`, `api.js`, or any backend logic
- No changes to data structures or KV keys
- No new npm dependencies
- No changes to routing, auth, or profile logic
- No TypeScript migration
- No Radix UI components
