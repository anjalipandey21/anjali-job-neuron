# UX & Design Overhaul — Design Spec

**Date:** 2026-04-09
**Status:** Draft
**Supersedes:** `2026-03-26-tailwind-migration-design.md` (Tailwind approach replaced by CSS Modules)

---

## Problem Statement

Job Neuron's current UI has several issues that undermine its professional feel:

1. **Galaxy/planet background images** distract from content and add visual noise
2. **Sidebar navigation** consumes horizontal space on every page, especially problematic on tablets/mobile
3. **Inconsistent visual hierarchy** — dashboard stats cards all look identical, empty states are bare, typography is too small
4. **No hover/focus/active states** — inline styles can't express `:hover`, making the app feel static
5. **`backdrop-filter: blur()` on every card** — GPU-intensive, causes jank on lower-end devices when many cards are visible
6. **Dense text walls** (Resume page) — no visual structure to help users scan
7. **400+ inline style objects** scattered across components — impossible to maintain consistently

## Design Direction

- **Dark theme** — refined, not reimagined. Inspired by Linear/Vercel dark mode quality
- **No space imagery** — clean dark gradients replace galaxy/planet backgrounds
- **Top navigation bar** — replaces sidebar; frees horizontal space
- **CSS Modules** — replaces inline styles; enables hover/focus/media queries natively
- **Visual polish + layout rethink + micro-interactions** — all addressed per page

---

## Architecture

### Styling Strategy: CSS Modules

**Why CSS Modules over Tailwind:**
- Zero new dependencies (Vite supports `.module.css` natively)
- Full CSS feature access (`:hover`, `:focus-visible`, `@media`, `::placeholder`, transitions)
- Scoped by default — no class name collisions
- Easier to read than long utility class strings
- Aligns with project's lean-dependency philosophy

**File structure:**
```
src/
├── styles/
│   ├── tokens.css          # CSS custom properties (design tokens) — imported globally
│   └── animations.css      # @keyframes — imported globally
├── components/
│   ├── TopNav.jsx
│   ├── TopNav.module.css
│   ├── Dashboard.jsx
│   ├── Dashboard.module.css
│   ├── Jobs.jsx
│   ├── Jobs.module.css
│   └── ... (one .module.css per component)
├── App.jsx
└── App.module.css
```

**Migration approach:** Convert inline styles to CSS Modules as each page is redesigned. Both inline styles and CSS Modules coexist during migration — no big-bang rewrite needed.

### Design Tokens (`src/styles/tokens.css`)

Consolidates all CSS custom properties from `GlobalStyles`. Adds new tokens for the redesign:

```css
:root {
  /* ── Existing tokens (preserved) ── */
  --bg-page: #06060f;
  --bg-card: rgba(255,255,255,0.05);
  /* ... all current vars from styles.jsx ... */

  /* ── New tokens ── */

  /* Surfaces — layered elevation without blur */
  --bg-surface-1: #0c0c1a;       /* top nav, page sections */
  --bg-surface-2: #111126;       /* cards, elevated content */
  --bg-surface-3: #16162e;       /* hover states, active items */

  /* Subtle gradient for page background (replaces galaxy image) */
  --bg-page-gradient: linear-gradient(145deg, #06060f 0%, #0a0a1e 50%, #080815 100%);

  /* Typography scale */
  --text-xs: 0.75rem;      /* 12px — captions, badges */
  --text-sm: 0.8125rem;    /* 13px — secondary text, buttons */
  --text-base: 0.875rem;   /* 14px — body text */
  --text-md: 1rem;          /* 16px — card titles, nav items */
  --text-lg: 1.25rem;       /* 20px — section headers */
  --text-xl: 1.5rem;        /* 24px — page titles */
  --text-2xl: 1.875rem;     /* 30px — hero numbers */

  /* Spacing scale (4px base) */
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */

  /* Border radius scale */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms ease;

  /* Top nav height */
  --nav-height: 56px;
}
```

### Animations (`src/styles/animations.css`)

All existing `@keyframes` from `GlobalStyles` move here. New additions:

```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}
```

### What Stays from `styles.jsx`

- **`GlobalStyles` component** — retains `:root` vars (now also in `tokens.css` for IDE autocomplete, but `GlobalStyles` remains as the runtime source of truth to avoid a breaking migration)
- **`STATUS_STYLES` map** — kept as JS object; badge styling remains inline since it's data-driven
- **`Badge` component** — stays, minor visual update
- **`GALAXY_IMAGE_URL`** — export removed; `body` background-image rule removed

### What Goes

- **`GALAXY_IMAGE_URL`** — no longer used
- **`body { background-image }` rule** — replaced with `--bg-page-gradient`
- **`C.card`, `C.metricCard`, `C.input`** — replaced by CSS Module classes (removed after last consuming component is migrated)
- **`btn()` function** — replaced by CSS Module button classes (kept exported during migration; removed in final cleanup step after all pages are migrated)
- **`backdrop-filter: blur()` on cards** — removed for performance; replaced by solid `--bg-surface-2` backgrounds. Blur preserved only on overlays/modals where it has visual impact and only 1 instance is on screen
- **`twinkle` animation** — login page stars removed (no space imagery)
- **Sidebar component** — replaced by TopNav (mobile bottom tab bar extracted to `BottomNav.jsx` first)

### Token Duplication Strategy (`GlobalStyles` vs `tokens.css`)

`tokens.css` is the **authoritative** source of design tokens going forward. During migration:
- `GlobalStyles` continues to inject `:root` vars at runtime (existing components depend on it)
- `tokens.css` is imported in `main.jsx` for IDE autocomplete and new CSS Module files
- Both files define the same vars — `tokens.css` is kept in sync as the primary copy
- **After all pages are migrated:** `GlobalStyles` is simplified to only inject `@keyframes` animations; all `:root` vars come from `tokens.css` alone

---

## Navigation: Sidebar to Top Nav

### Current: Sidebar
- 200px wide (expanded) / 56px (collapsed) on left
- Vertical list: Dashboard, Resume, Find Jobs, Applications, Settings
- User info + logout at bottom
- Collapses to icons on tablet
- Bottom tab bar on mobile

### New: Top Navigation Bar

**Desktop (>768px):**
```
┌──────────────────────────────────────────────────────────────────┐
│ [Logo] Job Neuron    Dashboard  Resume  Jobs  Applications       │
│                                        Settings  [Profile ▾]    │
└──────────────────────────────────────────────────────────────────┘
```

- Fixed at top, 56px height
- Background: `--bg-surface-1` with 1px bottom border (`--border`)
- Logo left, nav links center-left, profile dropdown right
- Active tab: accent underline (2px, `--accent`) + `--text-main` color
- Inactive: `--text-muted`, hover → `--text-main` with transition
- Profile dropdown: avatar circle + name, dropdown shows Switch Profile, Admin Panel (if admin), Sign Out

**Mobile (<768px):**
- Top bar: Logo + hamburger menu icon
- Hamburger opens a slide-down menu with all nav items
- OR: keep existing bottom tab bar pattern (it works well on mobile)
- Decision: **Keep bottom tab bar on mobile** — it's thumb-friendly and already works. Top nav only replaces the sidebar on desktop/tablet.

### Hash-Based Routing Integration
The most recent commit (`1b41af7`) added hash-based routing for browser back/forward navigation. TopNav must read the active tab from the URL hash (via the existing `tabFromHash()` helper in `MainApp.jsx`), not just a React prop. Active tab highlighting reflects the hash state.

### Files Affected
- **Delete:** `src/components/Sidebar.jsx` (after migration — see step 5 below for details)
- **Create:** `src/components/TopNav.jsx` + `TopNav.module.css`
- **Create:** `src/components/BottomNav.jsx` + `BottomNav.module.css` — extracted from `Sidebar.jsx`'s mobile bottom tab bar code before deletion
- **Modify:** `src/components/MainApp.jsx` — replace `<Sidebar>` with `<TopNav>`, remove sidebar width calculations from layout
- **Migrate:** Bug report link (currently in Sidebar) → Profile dropdown in TopNav
- **Cleanup:** Remove `jh_sidebar_collapsed` from localStorage (add a one-time cleanup in `MainApp.jsx` or `App.jsx`)

---

## Page-by-Page Redesign

### Login Page (`App.jsx`)

**Current issues:** Near-black background, small card in center, tiny twinkling stars barely visible.

**Changes:**
- Remove twinkling stars and glow div
- Background: `--bg-page-gradient` (subtle dark gradient, no image)
- Login card: `--bg-surface-2` background, slightly larger (max-width 380px), more padding
- Add subtle top accent line (2px gradient border-top on card)
- Button improvements: primary button gets hover brightness increase, ghost button gets hover background
- "Access is by invitation only" — slightly larger, `--text-light` instead of `--text-faint`

### Profile Select (`ProfileSelect.jsx`)

**Current issues:** Functional but plain.

**Changes:**
- Profile cards: `--bg-surface-2`, hover → `--bg-surface-3` with border color shift to `--accent-border`
- Add subtle scale transform on hover (`transform: scale(1.01)`)
- "Create new profile" card: dashed border, accent color on hover

### Dashboard (`Dashboard.jsx`)

**Current issues:** Stats all look the same (no hierarchy), two-column layout wastes space, quick actions are a plain list.

**Changes:**
- **Metric cards redesign:**
  - Each metric gets a distinct left-side color accent bar (4px wide, rounded)
  - Numbers use `--text-2xl` font size with `countUp` animation
  - Labels use `--text-sm` in `--text-muted`
  - Layout: 4-column grid on desktop, 2x2 on tablet, stack on mobile
- **Quick actions:** Styled as clickable cards with icons, not a text list
- **Recent applications:** Card rows with company name, role, status badge, date — denser and more scannable
- **Upcoming tasks:** Compact checklist style with due dates
- **Overall layout:** Single-column flow (metrics → quick actions → recent apps + tasks side by side)
- Remove galaxy image from content area background

### Resume (`Resume.jsx`)

**Current issues:** Dense wall of text, hard to scan, ATS score section cramped.

**Changes:**
- **Parsed resume display:** Sections (About, Skills, Experience, Education) as distinct cards with headers
- **Skills:** Render as pill/tag layout instead of comma-separated text
- **Experience entries:** Card-per-job with company, title, dates, bullet points — visual separation between entries
- **ATS Score tab:** Larger score display (circular progress or large number), actionable suggestions as a checklist
- **Upload area:** Drag-and-drop zone with dashed border, clear icon, file type hints

### Jobs (`Jobs.jsx`)

**Current issues:** Empty state is very bare, filter bar is plain, job cards lack visual interest.

**Changes:**
- **Empty state redesign:**
  - Illustration or icon (SVG, not an image) — magnifying glass or briefcase
  - Clear headline: "No jobs searched yet today"
  - Subtext: "Set your preferences and let AI find matching jobs"
  - Primary action button: larger, centered
- **Filter bar:** Visually grouped in a card, input fields get focus ring (`--accent-border`), search button is prominent
- **Job cards:**
  - Company logo (already available from SerpApi `thumbnail` — render with fallback to initials)
  - Match score as a colored bar or badge (green >80%, yellow >60%, red <60%)
  - Salary range highlighted if present
  - Hover: `--bg-surface-3` + slight Y translate + border accent
  - "Not Interested" / "Apply" buttons: clear visual hierarchy
- **Skeleton loading:** Shimmer placeholder cards while AI search runs

### Applications (`Applications.jsx`)

**Current issues:** Pipeline counts are plain boxes, cards are functional but could be more scannable.

**Changes:**
- **Pipeline counts:** Larger, each with distinct color matching its status (Applied=green, Interview=yellow, Offer=teal, Rejected=red). Active count pulses subtly
- **Application cards:** Tighter layout, status badge more prominent, action buttons as icon-only with tooltips on desktop
- **Add job manually:** Floating action button (FAB) or prominent "+" button
- **Task modal:** Better visual hierarchy for task list, checkbox animations

### Settings (`Settings.jsx`)

**Current issues:** Clean but plain form layout.

**Changes:**
- **Section cards:** Each settings group (Profile, Preferences, Developer, etc.) in its own card with a subtle header
- **Toggle switches:** Custom styled (not browser default checkboxes)
- **Save button:** Sticky at bottom of form when changes are pending
- **Form inputs:** Focus ring with `--accent-border`, smooth transition

---

## Micro-Interactions

### Hover States (enabled by CSS Modules)
- **Cards:** Background shift (`--bg-surface-2` → `--bg-surface-3`), border color shift, subtle Y translate (-1px)
- **Buttons:** Primary → brightness increase; Ghost → background fill with `--bg-surface-3`
- **Nav items:** Color transition + underline slide-in
- **All transitions:** `var(--transition-base)` (200ms ease)

### Focus States (accessibility)
- **`:focus-visible`** on all interactive elements — 2px `--accent` outline with 2px offset
- Keyboard navigation fully visible throughout

### Loading States
- **Skeleton screens:** Shimmer animation on placeholder cards (already exists as `@keyframes shimmer`)
- **Button loading:** Spinner icon replaces text, button disabled during action
- **Page transitions:** Subtle `fadeInUp` animation when switching tabs

### Exit Animations
- **Job card apply:** Existing `slideOut` + `collapseHeight` preserved (timing-critical, do not change)
- **Modal dismiss:** `scaleIn` reversed (scale down + fade out)

---

## Performance Improvements

### Remove `backdrop-filter: blur()` from Cards
**Current:** Every `C.card` and `C.metricCard` applies `backdrop-filter: blur(12px)`. With 10+ cards on screen (Applications page), this causes significant GPU load.

**Fix:** Replace with solid `--bg-surface-2` backgrounds. Visually nearly identical on the dark theme (blur was barely perceptible over the dark background). Keep blur only on:
- Modal overlays (1 instance at a time)
- Bottom nav bar on mobile (1 instance, always visible)

### Remove Galaxy Background Image
The 4K Unsplash image (`w=3840&q=100`) is the largest single asset. Removing it eliminates:
- ~500KB-1MB network transfer
- Continuous GPU compositing for `background-attachment: fixed`
- `background-size: cover` repaints on scroll

### `collapseHeight` Animation
**Current:** Uses `max-height` which triggers layout reflow on every frame.

**Future improvement (not in this spec):** Could be replaced with CSS Grid `grid-template-rows: 0fr → 1fr` approach for GPU-composited collapse. Deferred because current implementation works and timing is carefully calibrated.

---

## Accessibility Improvements

### Color Contrast
- All text meets **WCAG 2.1 AA** (4.5:1 for normal text, 3:1 for large text)
- `--text-muted` (currently `rgba(255,255,255,0.65)`) verified against `--bg-surface-2`
- Badge text colors verified against badge backgrounds

### Focus Management
- `:focus-visible` outlines on all interactive elements (CSS Modules make this trivial)
- Skip-to-content link at top of page (hidden until focused)
- Modal focus trap: focus stays within modal when open, returns to trigger on close

### Semantic HTML
- Top nav uses `<nav>` with `aria-label="Main navigation"`
- Page sections use `<main>`, `<section>` with headings
- Metric cards are not interactive — no misleading `role="button"`

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## New Dependencies

**None.** CSS Modules are built into Vite. No new packages required.

---

## Migration Order

1. **Create style infrastructure** — `src/styles/tokens.css`, `src/styles/animations.css`, import in `main.jsx`
2. **Remove galaxy background** — delete `GALAXY_IMAGE_URL`, update `body` style to use `--bg-page-gradient`
3. **Build TopNav** — `TopNav.jsx` + `TopNav.module.css`; wire into `MainApp.jsx`
4. **Redesign pages** (one at a time, tests after each):
   - Login page (`App.jsx`)
   - Profile Select
   - Dashboard
   - Resume
   - Jobs (includes company logo fix, hover fix)
   - Applications
   - Settings
5. **Remove old Sidebar** — extract mobile bottom tab bar to `BottomNav.jsx`, migrate bug report link to TopNav profile dropdown, then delete `Sidebar.jsx`. Add one-time `localStorage.removeItem('jh_sidebar_collapsed')` cleanup.
6. **Remaining pages** — AdminPanel (light visual touch: surface colors, card styles, no layout rethink), WelcomeModal (match updated card/button styles)
7. **Accessibility pass** — focus states, skip link, reduced motion, semantic HTML
8. **Performance audit** — verify `backdrop-filter` removal, check Lighthouse scores
9. **Test updates** — fix any tests broken by Sidebar → TopNav transition (nav label queries, logout button location)
10. **Update CLAUDE.md** — new styling conventions (CSS Modules), updated file structure
11. **Update USER-GUIDE.md** — new screenshots, navigation changes
12. **Final cleanup** — remove `C`, `btn()`, `GALAXY_IMAGE_URL` exports from `styles.jsx`; simplify `GlobalStyles` to keyframes-only

### Risk Mitigation
- CSS Modules and inline styles coexist — partially migrated files work fine
- Tests run after every page migration (most tests query by text/role, not styles — but Sidebar→TopNav transition will require test updates for nav-related queries)
- Visual output is verifiable via screenshots (same camoufox setup)
- No logic changes — only presentation layer
- TopNav can be built alongside Sidebar, switched over when ready

---

## What Does NOT Change

- No new pages or features
- No state management, API, or data flow changes
- CSS custom properties remain the single source of truth for colors
- Component file structure unchanged (one file per feature area, co-located modals)
- All existing tests should continue to pass
- Invite-only auth, dev/prod isolation, server-side key security all untouched
- `jh_active_profile` NOT cleared in `onLogout` — preserved
- Apply animation timing in `Jobs.jsx` — preserved
- Bottom tab bar on mobile — preserved
- WelcomeModal behavior — preserved
