# Job Neuron — AI Agent Steering File

This file provides context and instructions for AI coding assistants (Claude, Gemini, ChatGPT, etc.) working on this codebase.

---

## What This Project Is

Job Neuron is an **invite-only AI-powered job search platform** deployed at `https://jobneuron.netlify.app`.

- **Frontend**: Vite + React (no framework), single-page app
- **Backend**: Netlify Functions (serverless, Node.js)
- **Auth**: Netlify Identity (invite-only)
- **Database**: Supabase Postgres used purely as a KV store (`kv_store` table)
- **AI**: Gemini 2.0 Flash by default; switchable via env var (`AI_PROVIDER` / `AI_MODEL`)
- **Job listings**: SerpApi Google Jobs API
- **Tests**: Vitest + React Testing Library (179 tests across 19 suites)

---

## Repository Layout

```
jobhunter-ai/
├── netlify/functions/         # All serverless backend
│   ├── ai.js                  # AI proxy — routes to provider
│   ├── ai-bg-background.js    # Background AI worker (ATS scan)
│   ├── ai-router.js           # Provider router + key rotation (AI_PROVIDER env var)
│   ├── ai-status.js           # Poll background job status
│   ├── admin.js               # Admin API
│   ├── db.js                  # Supabase KV proxy + dev key namespacing
│   ├── jobs-search.js         # SerpApi Google Jobs + quality filters + semantic scoring
│   ├── providers/             # gemini.js, anthropic.js, openai.js, groq.js
│   ├── lib/
│   │   ├── job-providers/serpapi.js  # SerpApi fetch, normalise, sponsorship, salary extraction
│   │   ├── job-search-core.js       # Shared pipeline (manual + scheduled search)
│   │   ├── semantic.js              # TF-IDF cosine similarity scoring
│   │   ├── expiry-checker.js        # URL liveness HEAD checks
│   │   ├── key-rotator.js          # Round-robin API key rotation + rate-limit failover
│   │   └── logger.js               # Structured JSON logger (shared by all functions)
│   └── __tests__/             # Node environment tests
├── src/
│   ├── App.jsx                # Auth wrapper (Netlify Identity init)
│   ├── JobHunterApp.jsx       # Root shell (~44 lines) — routing
│   ├── components/            # One file per feature area (named exports)
│   │   ├── AdminPanel.jsx     # Admin dashboard
│   │   ├── AdminPanel.module.css
│   │   ├── TopNav.jsx         # Top navigation bar (desktop + tablet)
│   │   ├── TopNav.module.css
│   │   ├── BottomNav.jsx      # Bottom tab bar (mobile only)
│   │   ├── BottomNav.module.css
│   │   ├── Dashboard.jsx      # Dashboard
│   │   ├── Dashboard.module.css
│   │   ├── Resume.jsx         # Resume (+ private loadPdfJs, extractPdfText)
│   │   ├── Resume.module.css
│   │   ├── Jobs.jsx           # Jobs (+ private JobCard, CustomizeModal, ApplyModal, TailorModal)
│   │   ├── Jobs.module.css
│   │   ├── Applications.jsx   # Applications (+ private TaskModal, AddJobModal, AppCustomizeModal, TASK_PRESETS)
│   │   ├── Applications.module.css
│   │   ├── Settings.jsx       # Settings
│   │   ├── Settings.module.css
│   │   ├── ProfileSelect.jsx  # ProfileSelect
│   │   ├── ProfileSelect.module.css
│   │   ├── MainApp.jsx        # MainApp (composes all pages + WelcomeModal)
│   │   └── MainApp.module.css
│   ├── styles/
│   │   ├── tokens.css         # All CSS custom properties (colors, spacing, typography, radius, shadows)
│   │   └── animations.css     # Keyframe animations (fadeInUp, slideUp, modalIn, etc.)
│   ├── lib/
│   │   ├── api.js             # Client-side API helpers (dbGet, dbSet, callAI, ...)
│   │   ├── helpers.js         # uid, todayStr, fmtDate, parseJSON
│   │   ├── hooks.js           # useBreakpoint hook
│   │   ├── logger.js          # Frontend structured logger
│   │   └── styles.jsx         # Badge component, GlobalStyles (body/bottom-nav CSS injection)
│   └── __tests__/
│       ├── components/        # jsdom tests for each page component
│       ├── lib/               # jsdom tests for lib utilities
│       └── setup.js           # vitest setup (jest-dom matchers)
├── docs/
│   └── USER-GUIDE.md            # End-user documentation (all features, navigation, tips)
├── supabase-schema.sql        # Run once to provision all Supabase tables
├── netlify.toml               # Build + dev config
├── vite.config.js
├── vitest.config.js
└── .env.example
```

---

## Critical Architecture Decisions

### 1. Component structure
All UI components live in `src/components/` — one file per feature area, named exports only. Each component has a paired `Component.module.css` for its styles. `src/JobHunterApp.jsx` is a thin root shell (~44 lines): it manages the `view` state (profiles vs. app) and renders `<ProfileSelect>` or `<MainApp>`. Modals that are only used by one parent (`CustomizeModal`, `ApplyModal`, `TailorModal` in `Jobs.jsx`; `TaskModal`, `AddJobModal`, `AppCustomizeModal` in `Applications.jsx`) are co-located in the same file as their parent and kept private (no export). `AdminPanel` is a default export in `src/components/AdminPanel.jsx`.

Navigation uses `<TopNav>` (fixed top bar, desktop + tablet) and `<BottomNav>` (fixed bottom bar, mobile only — returns `null` when `isMobile` is false). Both live in `src/components/`.

### 2. KV store, not relational
Supabase is used as a KV store via the `kv_store` table (`user_id`, `key`, `value` JSONB). There is no ORM, no joins, no migrations after the initial schema. All data is read/written via `dbGet(key)` / `dbSet(key, value)` on the frontend, which calls `/.netlify/functions/db`.

Key naming convention (all prefixed `jh_`):
| Key | Content |
|---|---|
| `jh_profiles` | Array of all profile objects |
| `jh_p_{profileId}` | Full profile data |
| `jh_apps_{profileId}` | Array of application records |
| `jh_jobs_{profileId}_{YYYY-MM-DD}` | Sparse mutation log `{ id, status, customResume, tailorResult, appliedAt }[]`. One entry per job the user has interacted with (applied/customized/tailored). |
| `jh_jobs_pool_{profileId}_{YYYY-MM-DD}` | Full pool of up to 50 scored jobs for the day. Written by frontend after `callJobsSearch` completes and by scheduled search. Never mutated by UI actions. |
| `jh_tasks_{profileId}_{jobId}` | Tasks for an application |
| `jh_applied_urls_{profileId}` | Applied-job index `[{ url, serpApiJobId, company, title }]` — filters already-applied jobs from future searches |
| `jh_skipped_{profileId}` | Skipped-job index `[{ url, serpApiJobId, company, title }]` — filters "Not Interested" jobs from future searches |
| `jh_welcomed_{profileId}` | Boolean — tracks whether the user has seen the welcome onboarding modal |

In dev: all keys are prefixed `dev_` (handled transparently in `db.js`).

### 3. Dev/prod data isolation
`NETLIFY_DEV=true` is automatically set by `netlify dev`. `db.js` detects this and prefixes all Supabase keys with `dev_`. The frontend never knows about this prefix — `LIST` strips it from returned keys. **Never remove this mechanism.**

### 4. Auth in Netlify Functions
Every function extracts the user from `context.clientContext.user.sub` (Netlify Identity JWT). The service key **never** reaches the browser. Auth check always happens before any Supabase call.

Background functions (`*-background.js`) cannot use `clientContext` — they parse the JWT manually from the `Authorization` header.

### 5. Local dev must use `netlify dev`
Running `vite` alone skips all Netlify Functions — auth and all data operations will fail. Always use `npm run dev` (which runs `netlify dev --port 9000`).

**Port 9000 is required** — port 8888 is reserved by GitHub Codespaces infrastructure and will fail silently.

---

## Environment Variables

| Key | Purpose |
|---|---|
| `AI_PROVIDER` | `gemini` / `anthropic` / `openai` / `groq` |
| `AI_MODEL` | Model name matching provider |
| `GEMINI_KEY` | Google AI Studio key (comma-separated for rotation) |
| `ANTHROPIC_API_KEY` | Anthropic key (comma-separated for rotation) |
| `OPENAI_API_KEY` | OpenAI key (comma-separated for rotation) |
| `GROQ_API_KEY` | Groq key (comma-separated for rotation) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (never exposed to browser) |
| `SERPAPI_KEY` | SerpApi API key (comma-separated for rotation) |

---

## Linting

```bash
npm run lint           # check src/ and netlify/functions/
npm run lint:fix       # auto-fix what ESLint can fix
```

Config: `eslint.config.mjs` (ESLint 9 flat config). Key rule decisions:
- `react/prop-types: off` — JS project, no PropTypes
- `no-empty: allowEmptyCatch: true` — silent-fail catch blocks are intentional
- `no-control-regex: off` — intentional in PDF/DOCX text extraction
- `react-hooks/set-state-in-effect: off` — calling setState in effects is valid
- `no-unused-vars: warn` — warnings only

---

## Running Tests

```bash
npm test               # run all tests once
npm run test:watch     # watch mode
npm run test:coverage  # coverage report
```

Tests use `environmentMatchGlobs` in `vitest.config.js`:
- `netlify/functions/**` → `node` environment
- `src/**` → `jsdom` environment

### Known test constraints

- **`vi.mock('@supabase/supabase-js')` does not work** in the node environment for Netlify function tests. Vitest's mock system cannot reliably intercept CJS `require()` for third-party packages. **Solution**: export pure functions from function files (like `devKeyNs` in `db.js`) and test those directly. Auth guard tests (returning before Supabase is called) work fine.
- Integration tests requiring a live Supabase connection are **not run in CI** — they are marked with a comment and skipped.

---

## Coding Conventions

- **JavaScript only** — no TypeScript; do not add `.ts` / `.tsx` files
- **CSS Modules, not inline styles** — component styles go in `ComponentName.module.css` files, imported as `import s from './ComponentName.module.css'`. Design tokens (colors, spacing, radius, shadows) are defined in `src/styles/tokens.css` and referenced via CSS custom properties (e.g., `var(--accent)`, `var(--bg-surface-2)`). Do not add Tailwind, Bootstrap, or other CSS frameworks.
- **Inline styles only for dynamic values** — use `style={{ ... }}` only when the value is computed at runtime (e.g., animation delay based on index, per-item status color). Static visual styles belong in CSS modules.
- **CommonJS in Netlify functions** — `require()` / `module.exports`; do not use ESM `import/export` in function files
- **ESM in src/** — `import/export`; do not use `require()` in frontend files
- **No new dependencies without asking** — the package list is intentionally lean
- **Helper functions** — pure utilities go in `src/lib/helpers.js`; export them for testability
- **No console.log in frontend** — use `console.error` only for genuine errors

---

## What to Preserve

- **Invite-only auth** — do not add self-signup
- **Dev/prod isolation** — `devKeyNs()` mechanism in `db.js` must never be removed
- **Server-side key security** — AI keys, Supabase service key, RapidAPI key must never be exposed to the browser
- **Port 9000** in `npm run dev` — do not change back to 8888 or default
- **`APIUrl` in `App.jsx`** — required for local dev to authenticate against production Netlify Identity
- **`jh_active_profile` NOT cleared in `onLogout`** — Netlify Identity fires `logout` during normal token refresh before re-firing `init`; clearing it there causes the profile picker to reappear on every refresh. Only `handleSwitch` should clear it.
- **JWT verification in `onInit` (`App.jsx`)** — after Identity fires `init` with a cached user, `u.jwt()` is awaited before trusting the session. If the token is expired and cannot be refreshed, the user is immediately treated as logged out. Do not remove this check — without it, users with stale cached sessions see the app render but all API calls fail silently.
- **`pushState` in `setTab` (`MainApp.jsx`)** — history pushes must happen outside the React state updater. React 18 concurrent mode can call functional updaters more than once; putting `pushState` inside one causes duplicate or missing history entries. The check `window.location.hash !== \`#${t}\`` guards against duplicate pushes when re-clicking the active tab.
- **`thinkingConfig: { thinkingBudget: 0 }` in `gemini.js`** — only applied to `gemini-2.5` non-lite models (thinking is ON by default for those and incompatible with `responseMimeType: 'application/json'`). `gemini-2.5-flash-lite` does not support `thinkingConfig` at all — do not set it for that model.
- **`GEMINI_KEY` (not `GEMINI_API_KEY`)** — GitHub Codespaces injects a JWT token under the name `GEMINI_API_KEY`, which overrides the `.env` value. The env var is named `GEMINI_KEY` to avoid this collision.
- **Apply animation timing in `Jobs.jsx`** — the `handleApply` function uses `setTimeout(750)` with functional `setJobs((prev) => ...)` to avoid stale closures. The delay must match `slideOut (0.4s) + collapseHeight (0.35s)`. Do not replace with immediate state update or the exit animation will break.
- **WelcomeModal** — shown once per profile via `jh_welcomed_{profileId}` KV key. Dismiss/GetStarted both set the KV flag to `true`. Do not switch to localStorage — KV ensures it persists across devices.
- **CSS Module import alias** — all CSS modules are imported as `import s from './Component.module.css'`. If a function inside a component uses a local parameter also named `s`, rename the parameter (e.g., `step`, `st`, `sec`) to avoid shadowing the module alias.

---

## Common Tasks

### Add a new AI operation
1. Add a new action type in `src/lib/api.js` → `callAI()`
2. Handle it in `netlify/functions/ai.js`
3. All providers receive the same prompt; provider-specific logic stays in `netlify/functions/providers/`

### Add a new KV key
1. Choose a name following `jh_{entity}_{id?}` convention
2. Read/write via `dbGet` / `dbSet` in frontend — no backend changes needed
3. In dev, the `dev_` prefix is applied automatically

### Add a Netlify Function
1. Create `netlify/functions/my-function.js`
2. Export `handler` as an async function `(event, context) => ...`
3. Always check `context.clientContext.user` before touching data

### Add a test
- Frontend component tests: `src/__tests__/MyComponent.test.jsx`
- Pure function tests: `src/__tests__/helpers.test.js` (extend existing file or create new)
- Netlify function tests: `netlify/functions/__tests__/my-function.test.js`
- Mock `src/lib/api` with `vi.mock('../lib/api', () => ({ dbGet: vi.fn(), ... }))`

---

## Deployment

- Every push to `main` auto-deploys to Netlify (~60 seconds)
- PRs get a Deploy Preview URL automatically
- Environment variables are managed in Netlify dashboard → Site settings → Environment variables
- After adding/changing env vars: Deploys → Trigger deploy → Deploy site

---

## Supabase Schema

Three tables (see `supabase-schema.sql`):
- `kv_store` — all app data
- `bg_jobs` — background job queue
- `user_roles` — role assignments + disabled flag

To grant admin access:
```sql
UPDATE user_roles SET role = 'admin' WHERE email = 'user@example.com';
```

To disable a user:
```sql
UPDATE user_roles SET disabled = true WHERE email = 'user@example.com';
```
