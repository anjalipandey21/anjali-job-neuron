# Component Split Design — Job Neuron

**Date:** 2026-03-17
**Scope:** Split `src/JobHunterApp.jsx` (1,300 lines, 14 components) into focused files, reorganise tests to match.

---

## Motivation

`src/JobHunterApp.jsx` was intentionally kept as a single file (it started as a Claude artifact). The file has grown to 1,300 lines with 14 components across 6 feature areas. Splitting it improves navigability, makes each component easier to reason about in isolation, and allows test files to mirror the source structure.

---

## File Structure

```
src/
├── lib/
│   ├── helpers.js          # existing — uid, todayStr, fmtDate, parseJSON
│   └── styles.js           # NEW — C, btn, STATUS_STYLES, Badge, GlobalStyles
├── components/
│   ├── Sidebar.jsx
│   ├── Dashboard.jsx
│   ├── Resume.jsx          # includes loadPdfJs()
│   ├── Jobs.jsx            # Jobs + JobCard + CustomizeModal + ApplyModal
│   ├── Applications.jsx    # Applications + TaskModal
│   ├── Settings.jsx
│   ├── ProfileSelect.jsx
│   └── MainApp.jsx
├── JobHunterApp.jsx        # thin root shell (~20 lines)
└── App.jsx                 # unchanged
```

---

## Component Allocation

| File | Components / Functions |
|---|---|
| `src/lib/styles.js` | `C`, `btn`, `STATUS_STYLES`, `Badge`, `GlobalStyles` |
| `src/components/Sidebar.jsx` | `Sidebar`, `NAV` |
| `src/components/Dashboard.jsx` | `Dashboard` |
| `src/components/Resume.jsx` | `Resume` (named export); `loadPdfJs` is a module-private helper — not exported, tested only indirectly through `Resume` |
| `src/components/Jobs.jsx` | `Jobs`, `JobCard`, `CustomizeModal`, `ApplyModal` |
| `src/components/Applications.jsx` | `Applications`, `TaskModal` |
| `src/components/Settings.jsx` | `Settings` |
| `src/components/ProfileSelect.jsx` | `ProfileSelect` |
| `src/components/MainApp.jsx` | `MainApp` |
| `src/JobHunterApp.jsx` | `JobHunterApp` (default export, ~20 lines) + theme-restore side-effect block |

### Theme-restore side-effect block

Lines 6–11 of the current `JobHunterApp.jsx` contain a module-level side effect that runs at import time:

```js
if (typeof window !== 'undefined') {
  try {
    if (localStorage.getItem('jh_theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
  } catch (e) {}
}
```

This block **stays in `src/JobHunterApp.jsx`** (the entry point imported by `App.jsx`). It must execute as early as possible to prevent a flash of unstyled content, and `JobHunterApp.jsx` is imported first in the render tree. Do not move it to `styles.js` or any component file.

---

## Import & Export Strategy

- All component files use **named exports** (e.g. `export function Dashboard`).
- `JobHunterApp.jsx` keeps its **default export** — `App.jsx` imports it that way and is not changed.
- Shared dependencies for **`src/components/*.jsx`** (one directory below `src/`):
  - Design tokens/styles: `import { C, btn, STATUS_STYLES, Badge, GlobalStyles } from '../lib/styles'`
  - Helpers: `import { uid, todayStr, fmtDate, parseJSON } from '../lib/helpers'`
  - API: `import { dbGet, dbSet, callAI, callAIBackground, callJobsSearch } from '../lib/api'`
- **`src/JobHunterApp.jsx`** lives at the `src/` root, so its paths are one level shorter:
  - `import { ... } from './lib/styles'`
  - `import { ... } from './components/MainApp'`  etc.
- Dependency direction: `JobHunterApp` → `MainApp` + `ProfileSelect` → page components → `lib/*`. No circular imports.

---

## Test Reorganisation

```
src/__tests__/
├── helpers.test.js          # existing — unchanged
├── styles.test.js           # NEW — smoke: GlobalStyles renders, Badge renders per status
├── Sidebar.test.jsx         # NEW — smoke: renders with required props
├── Dashboard.test.jsx       # NEW — smoke: renders stats and recent apps
├── Resume.test.jsx          # NEW — file upload, analyze, ATS scan
├── Jobs.test.jsx            # NEW — smoke: renders search UI
├── Applications.test.jsx    # NEW — smoke: renders empty state
├── Settings.test.jsx        # NEW — smoke: renders preferences form
├── ProfileSelect.test.jsx   # existing — import path updated only
└── TaskModal.test.jsx       # existing — import path updated only
```

**Existing tests** keep their logic intact and their import paths **unchanged** — both still import from `../JobHunterApp`:
- `ProfileSelect.test.jsx` renders `JobHunterApp` to reach `ProfileSelect` indirectly (no path change needed)
- `TaskModal.test.jsx` renders the full app and navigates to the Applications tab to open `TaskModal` (no path change needed; `TaskModal` is not a named export and should not be imported directly)

The thin `JobHunterApp.jsx` shell still composes `ProfileSelect` and `MainApp`, so the existing tests continue to work without modification.

**New test files** start with minimal smoke tests (component renders without crashing). Full coverage is out of scope for this refactor.

**`styles.test.js` constraint**: `GlobalStyles` injects a `<style>` tag into the DOM — the test asserts it renders without throwing, but does not attempt to query computed CSS variable values (jsdom does not compute custom properties). `Badge` tests assert correct rendering per status variant. `styles.js` itself has no DOM dependency (`C`, `btn`, `STATUS_STYLES` are plain objects), but it is browser-safe only — no Netlify function should import from it.

**`MainApp` is intentionally excluded from smoke tests.** It is a pure orchestrator that composes all page components and requires every mock wired up. It is exercised indirectly by `ProfileSelect.test.jsx` and `TaskModal.test.jsx` (which both render the full `JobHunterApp` tree). A dedicated `MainApp.test.jsx` is out of scope for this refactor.

---

## What Does Not Change

- `App.jsx` — unchanged
- `src/lib/api.js` — unchanged
- `src/lib/helpers.js` — unchanged
- `netlify/functions/` — unchanged
- All existing test logic — unchanged, import paths updated only
- CSS approach — inline style objects throughout, no new CSS files

---

## Out of Scope

- Adding TypeScript
- Adding a CSS framework
- Splitting Netlify functions
- Rewriting or expanding test coverage beyond smoke tests for new files

---

## Success Criteria

1. `npm test` passes (62 existing + new smoke tests)
2. `npm run dev` serves the app correctly
3. No behaviour changes — pure structural refactor