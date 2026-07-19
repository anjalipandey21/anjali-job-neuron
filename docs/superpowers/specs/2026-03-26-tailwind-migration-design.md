# Tailwind CSS Migration + Bug Fixes — Design Spec

**Date:** 2026-03-26
**Status:** Approved
**Scope:** 4 issues — admin drawer overlap, company logos, hover bug, modular code architecture

---

## Problem Statement

Four issues need resolution:

1. **Admin panel drawer overlap** — The UserDetail drawer in `AdminPanel.jsx` uses a semi-transparent background (`rgba(255,255,255,0.05)`), causing the Users list to bleed through on mobile browsers. Similar transparency issues may exist in other modal/drawer overlays.
2. **Missing company logos on job cards** — SerpApi returns `thumbnail` URLs, stored as `companyLogo` in `normaliseJob()`, but never rendered. Job cards show 2-letter initial avatars only.
3. **Hover highlight sticking on touch devices** — `JobCard` uses `onMouseEnter`/`onMouseLeave` with React state to toggle hover styles. On touch devices, `mouseenter` fires on tap but `mouseleave` never fires, leaving the highlight stuck permanently.
4. **No modular style system** — 405+ inline style occurrences across 8 component files with heavily duplicated values (font sizes, paddings, colors, border-radiuses). Changes require hunting through every file.

## Solution: Tailwind CSS Migration

Adopt Tailwind CSS v4 as the utility-first styling system. This solves all four issues:

- Issue 1: Drawer gets opaque background via Tailwind class
- Issue 2: Company logo rendered with `<img>` + React state fallback, styled with Tailwind
- Issue 3: CSS `hover:` prefix replaces JS-based hover state entirely — browsers handle touch correctly
- Issue 4: All inline styles replaced with composable Tailwind utility classes; shared component classes via `@utility`

### CLAUDE.md Convention Override

CLAUDE.md currently states: "No CSS framework — all styles are inline React style objects; do not add Tailwind, Bootstrap, etc."

This convention is being **intentionally overridden** with user approval. Step 7 of the migration updates CLAUDE.md to:
- Replace "No CSS framework" with: "**Tailwind CSS v4** — all styles use Tailwind utility classes via `className`; no inline `style={{}}` objects except for truly dynamic/computed values (e.g., animation delays computed from index). Shared component patterns are defined in `src/app.css` using `@utility`."
- Replace "all styles are inline React style objects" with the new convention
- Add Tailwind-specific guidance: class ordering, `@theme` usage, when inline styles are still acceptable

### What Tailwind Is

Tailwind CSS is a utility-first CSS framework. Instead of writing `style={{ padding: '1.25rem', background: 'var(--bg-card)', borderRadius: 12 }}`, you write `className="p-5 bg-card rounded-xl"`. It generates only the CSS classes you actually use, resulting in a tiny production stylesheet.

---

## Architecture

### Tailwind v4 Setup

Tailwind v4 uses **CSS-native configuration** instead of a JS config file. The `@tailwindcss/vite` plugin handles content detection automatically — no `content` array or `postcss.config.js` needed.

**Vite config** — add the plugin to `vite.config.js`:
```js
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

### Theme Configuration (`src/app.css`)

All design tokens are mapped in a single CSS file using Tailwind v4's `@theme` directive:

```css
@import "tailwindcss";

/* ─── Design Token Mapping ─────────────────────────────────────────────────
   Maps existing CSS variables from GlobalStyles to Tailwind utility classes.
   e.g. --color-card → bg-card, text-card, border-card
   ────────────────────────────────────────────────────────────────────────── */
@theme {
  /* Backgrounds */
  --color-page: var(--bg-page);
  --color-sidebar: var(--bg-sidebar);
  --color-content: var(--bg-content);
  --color-card: var(--bg-card);
  --color-card-hover: var(--bg-card-hover);
  --color-metric: var(--bg-metric);
  --color-input-bg: var(--input-bg);
  --color-bottom-nav: var(--bg-bottom-nav);
  --color-drawer: rgba(10, 10, 24, 0.97);

  /* Borders */
  --color-border: var(--border);
  --color-border-light: var(--border-light);
  --color-input-border: var(--input-border);

  /* Text */
  --color-text-main: var(--text-main);
  --color-text-muted: var(--text-muted);
  --color-text-light: var(--text-light);
  --color-text-faint: var(--text-faint);

  /* Accent — Indigo/Violet */
  --color-accent: var(--accent);
  --color-accent-alt: var(--accent-alt);
  --color-accent-fill: var(--accent-fill);
  --color-accent-border: var(--accent-border);
  --color-accent-text: var(--accent-text);

  /* Badge colors (all pairs) */
  --color-badge-new-bg: var(--badge-new-bg);
  --color-badge-new-text: var(--badge-new-text);
  --color-badge-new-border: var(--badge-new-border);
  --color-badge-viewed-bg: var(--badge-viewed-bg);
  --color-badge-viewed-text: var(--badge-viewed-text);
  --color-badge-viewed-border: var(--badge-viewed-border);
  --color-badge-cust-bg: var(--badge-cust-bg);
  --color-badge-cust-text: var(--badge-cust-text);
  --color-badge-cust-border: var(--badge-cust-border);
  --color-badge-app-bg: var(--badge-app-bg);
  --color-badge-app-text: var(--badge-app-text);
  --color-badge-app-border: var(--badge-app-border);
  --color-badge-int-bg: var(--badge-int-bg);
  --color-badge-int-text: var(--badge-int-text);
  --color-badge-int-border: var(--badge-int-border);
  --color-badge-off-bg: var(--badge-off-bg);
  --color-badge-off-text: var(--badge-off-text);
  --color-badge-off-border: var(--badge-off-border);
  --color-badge-rej-bg: var(--badge-rej-bg);
  --color-badge-rej-text: var(--badge-rej-text);
  --color-badge-rej-border: var(--badge-rej-border);

  /* Contextual */
  --color-bg-warning: var(--bg-warning);
  --color-bg-error: var(--bg-error);
  --color-bg-info: var(--bg-info);
  --color-bg-success: var(--bg-success);
  --color-text-warning: var(--text-warning);
  --color-text-error: var(--text-error);
  --color-text-info: var(--text-info);
  --color-text-success: var(--text-success);
  --color-border-warning: var(--border-warning);
  --color-border-error: var(--border-error);
  --color-border-info: var(--border-info);
  --color-border-success: var(--border-success);

  /* Typography */
  --font-sans: 'Space Grotesk', system-ui, -apple-system, sans-serif;

  /* Backdrop blur */
  --backdrop-blur-card: 12px;
  --backdrop-blur-sidebar: 20px;
  --backdrop-blur-sm: 8px;

  /* Shadows */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.35);
  --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.6);
}

/* ─── Shared Component Classes ─────────────────────────────────────────────
   Reusable patterns defined once, used everywhere via className.
   Tailwind v4 uses @utility for custom component classes.
   ────────────────────────────────────────────────────────────────────────── */

@utility card {
  background: var(--bg-card);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.25rem;
  position: relative;
  overflow: hidden;
}

@utility metric-card {
  background: var(--bg-metric);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
  position: relative;
  overflow: hidden;
}

@utility input-field {
  padding: 8px 12px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  background: var(--input-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--text-main);
  font-family: var(--font-sans);
  font-size: 14px;
  width: 100%;
  box-sizing: border-box;
  outline: none;
}

@utility btn-ghost {
  padding: 7px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all 0.2s ease;
  background: transparent;
  color: var(--text-main);
  border: 1px solid var(--border);
}

@utility btn-primary {
  padding: 7px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all 0.2s ease;
  background: linear-gradient(135deg, var(--accent), var(--accent-alt));
  color: #ffffff;
  border: none;
}
```

**Note on `-webkit-backdrop-filter`:** The `@utility` definitions use explicit `-webkit-backdrop-filter` to ensure Safari/iPad compatibility. Tailwind's built-in `backdrop-blur-*` utilities only generate the standard property, but this project is actively used on iPad (Safari) which requires the webkit prefix.

### What Stays

- **`GlobalStyles` component** — still injects `:root` CSS variables and `@keyframes` animations (Tailwind consumes these, doesn't replace them)
- **CSS variable definitions** — the single source of truth for all color values
- **`STATUS_STYLES` map** — remains as a JS object with Tailwind class strings instead of inline style objects (e.g., `{ bg: 'bg-badge-new-bg', text: 'text-badge-new-text', border: 'border-badge-new-border' }`)
- **Component file structure** — same files, same exports, same co-location
- **All business logic** — no state management, API, or data flow changes

### What Goes

- **`C.card`, `C.metricCard`, `C.input`** — replaced by `card`, `metric-card`, `input-field` utility classes
- **`btn()` function** — replaced by `btn-ghost`, `btn-primary` classes
- **All 405+ inline `style={{}}` objects** — replaced by `className=""` strings
- **`hovered` React state in JobCard** — replaced by CSS `hover:` prefix
- **Manual `isMobile`/`isTablet` style conditionals** (where possible) — replaced by Tailwind responsive prefixes (`md:`, `lg:`)
- **`postcss.config.js`** — not needed with `@tailwindcss/vite`

---

## Bug Fixes

### Issue 1: Admin Drawer Overlap

**File:** `AdminPanel.jsx` line 95

**Current:** `background: 'var(--bg-card)'` → `rgba(255,255,255,0.05)` (transparent)

**Fix:** New `--color-drawer` token (`rgba(10,10,24,0.97)`) defined in `@theme`. Drawer panel uses `bg-drawer` class — opaque enough to block bleed-through while maintaining the dark aesthetic.

**Audit:** All modal/drawer overlays checked for same issue:
- `AdminPanel.jsx` — UserDetail drawer (**FIX** — use `bg-drawer`)
- `Jobs.jsx` — CustomizeModal, ApplyModal, TailorModal (modal content uses `card` class inside a backdrop overlay — verify opacity is sufficient)
- `Applications.jsx` — TaskModal, AddJobModal, AppCustomizeModal (same check)
- `MainApp.jsx` — WelcomeModal (same check)

### Issue 2: Company Logos on Job Cards

**File:** `Jobs.jsx` — `JobCard` component, avatar section (line 460)

**Data:** `job.companyLogo` already populated from SerpApi `thumbnail` in `serpapi.js:112`

**Fix:** Render `<img>` with React state fallback to initials (idiomatic React, no direct DOM manipulation):
```jsx
function CompanyAvatar({ logo, company }) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImg = logo && !imgFailed

  return (
    <div className="w-9 h-9 rounded-full bg-metric flex items-center justify-center shrink-0 overflow-hidden">
      {showImg
        ? <img src={logo} alt="" className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
        : <span className="text-xs font-semibold text-text-muted">{company?.slice(0, 2).toUpperCase() || '??'}</span>
      }
    </div>
  )
}
```

### Issue 3: Hover Highlight Sticking

**File:** `Jobs.jsx` — `JobCard` component (lines 424, 430-431, 441-446)

**Fix:** Delete `hovered` state and `onMouseEnter`/`onMouseLeave`. Use Tailwind hover:
```jsx
<div className="card mb-3 transition-all duration-200
  hover:bg-card-hover hover:border-accent-border hover:-translate-y-px hover:shadow-md">
```

**Audit:** Search all components for `onMouseEnter`/`onMouseLeave` patterns.

---

## Code Quality

### JSDoc Documentation

All exported components and utility functions get JSDoc headers with `@param` annotations. Example:

```jsx
/**
 * Job search card displaying match score, company info, and action buttons.
 * Renders company logo from SerpApi thumbnail with initials fallback.
 *
 * @param {Object} props
 * @param {Object} props.job - Normalized job object from SerpApi
 * @param {number} props.index - Position in list (used for stagger animation)
 * @param {Function} props.onApply - Called when user clicks Apply
 * @param {Function} props.onCustomize - Called when user clicks Customize
 * @param {Function} props.onTailor - Called when user clicks Tailor
 * @param {Function} props.onSkip - Called when user clicks Skip
 * @param {boolean} [props.isMobile=false] - Mobile layout flag
 * @param {boolean} [props.applying=false] - True during apply exit animation
 */
function JobCard({ job, index, onApply, onCustomize, onTailor, onSkip, isMobile, applying }) {
```

Applied to: all exported components, all utility functions in `lib/`, all Netlify Functions handlers, all provider modules.

### ESLint Enhancements

New dev dependencies:
- `eslint-plugin-jsdoc` — enforce JSDoc on exported functions
- `eslint-config-prettier` — disable ESLint rules that conflict with Prettier
- `eslint-plugin-prettier` — run Prettier as an ESLint rule

**Note:** `eslint-plugin-tailwindcss` is **excluded** — it does not reliably support Tailwind v4's CSS-based config and `@theme` approach. Tailwind class validation will be handled by developer review until plugin support matures.

### Prettier Config

`.prettierrc`:
```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 120,
  "tabWidth": 2
}
```

Matches existing code style (no semicolons, single quotes).

New scripts in `package.json`:
```json
"format": "prettier --write src/ netlify/functions/",
"format:check": "prettier --check src/ netlify/functions/"
```

---

## New Dependencies (all devDependencies)

| Package | Purpose |
|---------|---------|
| `tailwindcss` | Utility CSS framework (v4) |
| `@tailwindcss/vite` | Vite plugin — handles content detection, no PostCSS needed |
| `prettier` | Code formatter |
| `eslint-config-prettier` | Disables ESLint rules that conflict with Prettier |
| `eslint-plugin-prettier` | Runs Prettier as an ESLint rule |
| `eslint-plugin-jsdoc` | Enforces JSDoc on exported functions |

**Rationale for new dependencies:** CLAUDE.md states "No new dependencies without asking." These are all devDependencies (zero production impact) approved by the user during brainstorming. The Tailwind adoption was explicitly requested.

Zero production dependencies added. No bundle size impact beyond the generated Tailwind CSS (which replaces all inline styles, so net size is similar or smaller).

---

## Migration Order

1. **Infrastructure** — Install deps, add `@tailwindcss/vite` to `vite.config.js`, create `src/app.css` with `@theme` + `@utility` definitions, import `app.css` in `main.jsx`, create `.prettierrc`
2. **`styles.jsx` update** — Keep `GlobalStyles` (CSS vars + keyframes), convert `STATUS_STYLES` to Tailwind class maps, deprecate `C`/`btn` exports (components will use `className` instead)
3. **Bug fixes** — AdminPanel drawer opacity, JobCard company logo, JobCard hover
4. **Component migration** (one at a time, tests after each):
   - `Sidebar.jsx`
   - `Dashboard.jsx`
   - `Settings.jsx`
   - `ProfileSelect.jsx`
   - `Resume.jsx`
   - `Applications.jsx`
   - `Jobs.jsx`
   - `MainApp.jsx`
   - `AdminPanel.jsx`
   - `App.jsx`
5. **Linting + formatting** — Add ESLint plugins, Prettier config, run format pass
6. **JSDoc pass** — Add documentation to all exports
7. **CLAUDE.md update** — Update coding conventions to reflect Tailwind v4 adoption (see "CLAUDE.md Convention Override" section above)

### Risk Mitigation

- Tailwind and inline styles coexist — partially migrated files work fine
- Tests run after every component migration
- Visual output is identical — same design tokens, same animations
- No logic changes anywhere
- `-webkit-backdrop-filter` explicitly included in `@utility` definitions for Safari/iPad compatibility

---

## What Does NOT Change

- No new pages or features
- No state management, API, or data flow changes
- CSS variables remain the single source of truth for colors
- Component file structure unchanged (one file per feature area)
- All 177 tests should continue to pass (they query by text/role, not styles)
- `GlobalStyles` component stays (CSS vars + keyframes)
- Invite-only auth, dev/prod isolation, server-side key security all untouched
