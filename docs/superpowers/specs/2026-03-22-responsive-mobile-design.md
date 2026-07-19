# Responsive / Mobile Layout — Design Spec

**Date:** 2026-03-22
**Status:** Draft
**Roadmap item:** Mobile layout — responsive improvements for small screens (current layout is desktop-first)

---

## Goal

Make Job Neuron fully usable on phones (≤ 480px) and tablets (481–768px) without changing the desktop experience. Target both screen sizes with distinct layouts that respect available screen real estate.

---

## Breakpoints

| Name | Range | Key change |
|---|---|---|
| Phone | ≤ 480px | Bottom tab bar, single-column, bottom sheet modals |
| Tablet | 481–768px | 64px icon rail sidebar, 2-col grids |
| Desktop | > 768px | Unchanged (default/fallback — no third boolean needed) |

Desktop is the default state: `isMobile = false`, `isTablet = false`. No `isDesktop` boolean is needed; all desktop rendering is the `else` / fallback case.

---

## Section 1: Breakpoint Hook

**File:** `src/lib/hooks.js` (new file — keeps React hooks separate from pure utilities in `helpers.js`)

Add a `useBreakpoint()` hook using `window.matchMedia`. Returns `{ isMobile, isTablet }`.

```js
// isMobile: true  when window width ≤ 480px
// isTablet: true  when window width 481–768px
// desktop:        isMobile false, isTablet false (default fallback)
```

Implementation details:
- **Initial state:** Read `matchMedia.matches` synchronously as the `useState` initial value, so the first render uses the correct viewport — do not default to `false`.
- Use `matchMedia.addEventListener('change', handler)` — fires only on breakpoint crossing, not every pixel
- Return cleanup `removeEventListener` from the effect to prevent listener leaks
- No third-party dependency
- `MainApp` calls the hook once and passes `isMobile` / `isTablet` as props to child components that need layout changes

**Test mock pattern:** jsdom does not implement `matchMedia`. Tests that render components using this hook must mock it before rendering:

```js
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
})
```

No new test file is required for `useBreakpoint` itself.

---

## Section 2: Navigation

### Desktop (> 768px) — Unchanged
240px full sidebar: brand header, nav labels, section dividers, badge counts, user card footer, action buttons.

### Tablet (481–768px) — 64px Icon Rail
Same `<Sidebar>` component renders in "rail" mode when `isTablet` is true. `MainApp` passes `isTablet` to `<Sidebar>`.

- Width: 240px → 64px
- Icons only — labels hidden
- Active accent bar (left edge purple) remains
- Badge counts shown as small dot indicators on icon (no number text)
- User card footer hidden; Switch Profile, Sign Out, and Admin buttons hidden from sidebar on tablet
- `<main>` fills remaining width automatically (flex layout unchanged)
- `<main>` `paddingBottom` is unchanged on tablet (no bottom bar — leave at `0` or whatever the current value is)

**Switch Profile / Sign Out on tablet and phone:**

`Settings.jsx` already renders "Switch profile" and "Sign out" buttons unconditionally in the profile section card (lines 40–41). No change needed here — these are already accessible on all screen sizes.

**Admin button on tablet and phone:**

The Admin button currently lives only in the sidebar footer and is hidden on tablet (footer hidden) and phone (sidebar hidden). It must be added to `Settings.jsx` so admin users can reach it on tablet and phone.

- Add an "Admin panel" button inside the profile section card in `Settings.jsx`, rendered only when `(isTablet || isMobile) && isAdmin`
- Calls `onOpenAdmin`
- Styled identically to the existing sidebar admin button (warning colour)

`isAdmin` and `onOpenAdmin` are **not** currently in `Settings.jsx`'s prop signature, and are **not** currently passed from `MainApp.jsx` to `<Settings>`. However, `MainApp` already receives both as props from `JobHunterApp`. The changes required:
1. Pass `isAdmin` and `onOpenAdmin` from `MainApp` to `<Settings>` in its render call
2. Add `isAdmin` and `onOpenAdmin` to `Settings.jsx`'s prop signature

### Phone (≤ 480px) — Bottom Tab Bar

**Render strategy:** `MainApp` renders both `<Sidebar>` and `<BottomNav>` at all times. `<Sidebar>` receives `isMobile` and sets `display: none` on itself when true. `<BottomNav>` (exported from `Sidebar.jsx`) receives `isMobile` and renders `null` when false.

**`<BottomNav>` prop signature:** `{ tab, setTab, todayJobCount, openAppCount, isMobile }`

- `tab` — active view string, one of `'dashboard'`, `'resume'`, `'jobs'`, `'applications'`, `'settings'` (matches existing `NAV` array ids and `tab` state in `MainApp`)
- `setTab` — same setter passed to `<Sidebar>`
- `todayJobCount`, `openAppCount` — existing badge count values

**`<BottomNav>` layout:**
- `position: fixed`, `bottom: 0`, `left: 0`, `right: 0`, height 64px, `zIndex: 100`
- 5 tabs from the existing `NAV` array — icon + label each
- Active tab: icon and label colour change to `var(--btn-primary-bg)` (purple); 2px top border in `var(--btn-primary-bg)` on the active tab container
- Inactive tabs: icon and label use `var(--text-muted)`
- Badge counts on Jobs and Applications as pill numbers (same purple pill style as current sidebar)
- `<main>` receives `paddingBottom: 64px` on phone only (not tablet)

**GlobalStyles additions for `<BottomNav>`:**

To make `backdrop-filter: blur(12px)` visually effective, the bar needs a semi-transparent background. Since CSS variables hold opaque colours, define two new CSS custom properties in `GlobalStyles`:

```css
:root {
  --bg-bottom-nav: rgba(230, 233, 239, 0.88); /* Catppuccin Latte sidebar at 88% */
}
[data-theme="dark"] {
  --bg-bottom-nav: rgba(24, 24, 37, 0.88);    /* Catppuccin Mocha sidebar at 88% */
}
```

Then the bar CSS rule (targeting the bottom nav by its `data-bottom-nav` attribute or equivalent inline `id`):

```css
[data-bottom-nav] {
  background: var(--bg-bottom-nav);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding-bottom: env(safe-area-inset-bottom);
}
```

Apply `data-bottom-nav` as an HTML attribute on the `<BottomNav>` root element so the CSS selector can target it without a class name (consistent with the project's no-CSS-classes constraint).

All other `<BottomNav>` styles (flex layout, tab sizing, font sizes, active state colours, zIndex) are inline style objects.

---

## Section 3: Content Layout

All changes are inline style conditionals using `isMobile` / `isTablet` props. No new CSS classes.

### Props passed per component

| Component | New props added to signature |
|---|---|
| `Dashboard` | `isMobile`, `isTablet` |
| `Resume` | `isMobile` |
| `Settings` | `isMobile`, `isTablet`, `isAdmin`, `onOpenAdmin` |
| `Jobs` | `isMobile` (passed through to modals) |
| `Applications` | `isMobile` (passed through to `TaskModal`) |

`MainApp.jsx` must pass all new props listed above in its render calls for each component.

### General Rules (Phone)
- Horizontal padding: `1.25rem` → `0.75rem`
- Card gaps: `1rem` → `0.75rem`
- No fixed widths — all cards `width: 100%`

### Dashboard
- Metric cards: 4-col → 2-col on both tablet (`isTablet`) and phone (`isMobile`); phone gets smaller padding
- Hero banner height: 160px → 120px (tablet) → 90px (phone)
- Upcoming tasks list: single-column already, no change

### Jobs
- Job cards: already single-column stacked, no structural change
- Filter bar: full-width on all sizes, collapses same way
- Match score / keyword chips: wrap naturally, no change

### Applications
- Application cards: full-width stacked already, no structural change
- Status pipeline header on phone: each status label flex child gets `minWidth: 0` so it can shrink; text span inside gets `overflow: 'hidden'`, `textOverflow: 'ellipsis'`, `whiteSpace: 'nowrap'` — truncates to fit, no horizontal scroll
- Timeline activity: no change

### Resume
- ATS score grid (8 categories): 2-col → 1-col on phone (`isMobile`)
- Upload zone: full-width already
- Keyword chip rows: wrap naturally

### Settings
- Section cards: full-width already; reduce padding on phone
- Remove `maxWidth: 560px` constraint on phone — full bleed
- Switch Profile / Sign Out already exist unconditionally — no change needed
- Add Admin button in the profile card when `(isTablet || isMobile) && isAdmin`

---

## Section 4: Modals

Four modals: `CustomizeModal`, `ApplyModal`, `TailorModal` (all in `Jobs.jsx`) and `TaskModal` (in `Applications.jsx`).

### Desktop & Tablet — Unchanged
Centered floating box, `max-width: 600px`, existing `modalIn` scale animation.

### Phone — Bottom Sheet

The existing modal overlay sits at `zIndex: 1000`, which already covers the bottom tab bar at `zIndex: 100`. The sheet itself sits at `zIndex: 1001` to render above the overlay. In summary: tab bar (100) → overlay (1000) covers tab bar → sheet (1001) renders on top of overlay.

- `position: fixed`, `bottom: 0`, `left: 0`, `right: 0`
- `max-height: 90vh`, `overflow-y: auto`
- `border-radius: 16px 16px 0 0`
- `zIndex: 1001`
- Animation: `animation: sheetIn 0.28s cubic-bezier(0.32, 0.72, 0, 1) both`
- New `sheetIn` keyframe added to `GlobalStyles`:
  ```css
  @keyframes sheetIn {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
  ```
- Small drag-handle pill (32×4px, `var(--border)` colour) centred at top of sheet — inline style
- `paddingBottom: 'env(safe-area-inset-bottom)'` as an inline style on the sheet container (valid in React inline styles)
- Overlay unchanged (full-screen dim, `zIndex: 1000`)
- Each modal receives `isMobile` as a prop and switches its container styles conditionally
- No logic changes — wrapper style object only

---

## Files Changed

| File | Change | New props / signatures |
|---|---|---|
| `src/lib/hooks.js` | New file — `useBreakpoint()` hook | — |
| `src/lib/styles.jsx` | Add `sheetIn` keyframe; add `--bg-bottom-nav` CSS vars for both themes; add `[data-bottom-nav]` rule with backdrop-filter + safe-area padding to `GlobalStyles` | — |
| `src/components/MainApp.jsx` | Call `useBreakpoint()`; render `<BottomNav>`; pass `isMobile`/`isTablet` to Sidebar, BottomNav, Dashboard, Resume, Settings, Jobs, Applications; pass `isAdmin`/`onOpenAdmin` to Settings; apply `paddingBottom: 64px` to `<main>` on phone only | — |
| `src/components/Sidebar.jsx` | Icon rail (tablet), `display:none` on phone; add exported `<BottomNav>` component | Sidebar: adds `isMobile`, `isTablet`; BottomNav: `{ tab, setTab, todayJobCount, openAppCount, isMobile }` |
| `src/components/Dashboard.jsx` | Metric card grid reflow, hero height reduction | Adds `isMobile`, `isTablet` |
| `src/components/Resume.jsx` | ATS score grid 2-col → 1-col on phone | Adds `isMobile` |
| `src/components/Settings.jsx` | Remove max-width on phone, reduce padding; add Admin button when `(isTablet \|\| isMobile) && isAdmin` (Switch/Sign out already present) | Adds `isMobile`, `isTablet`, `isAdmin`, `onOpenAdmin` to signature |
| `src/components/Jobs.jsx` | Pass `isMobile` to `CustomizeModal`, `ApplyModal`, `TailorModal` | Adds `isMobile` |
| `src/components/Applications.jsx` | Pass `isMobile` to `TaskModal`; add `minWidth: 0` to status pipeline flex children | Adds `isMobile` |

---

## Out of Scope

- Admin panel page itself — desktop-only is acceptable
- Printer / PDF layouts
- Per-page hero banner redesign (height reduction only)
- Granular per-component polish beyond the above

---

## Success Criteria

- App is fully navigable and usable on a 390px phone screen
- Switch Profile and Sign Out are reachable on tablet and phone (already in Settings)
- Admin button visible in Settings for admin users on tablet and phone
- App is usable on a 768px tablet with icon rail sidebar
- No visual regressions on desktop
- All existing tests continue to pass (`matchMedia` mocked in component tests as needed)
- Modals do not overflow the viewport on any screen size
- `useBreakpoint` hook cleans up its listener on unmount
- First render uses the correct breakpoint state (no flash of wrong layout)
