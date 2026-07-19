# Job Neuron — Changelog

All notable changes to this project are documented here.

---

## [2026-04-13] — Job Search Quality Improvements

### Added
- **50-job daily pool** — backend now fires 5 parallel SerpApi pages (start=0,10,20,30,40) using a single API key; up to 50 unique jobs per search (was ~10 from a single page)
- **Infinite scroll** — Jobs page loads 10 cards on mount and reveals 10 more each time the user scrolls to the bottom; IntersectionObserver sentinel always in DOM
- **GET-based link validation** — expiry checker upgraded from HEAD to GET with 8 KB body stream scan; 6 dead-listing phrases detected (`"no longer accepting applications"`, `"this position has been filled"`, etc.); concurrency raised to 10; content-type guard skips binary responses
- **Date window filter on Jobs page** — collapsible filter bar now includes a "Date posted" select (Last 30 / 60 / 90 days); session-only override that defaults to the profile preference; does not save back to Settings
- **`jh_jobs_pool_` KV key** — new key stores the full 50-job pool written by frontend after search and by scheduled search; `jh_jobs_` repurposed as a sparse mutation log (`{ id, status, customResume, tailorResult, appliedAt }[]`)

### Improved
- **AI scoring uses full descriptions** — removed 300-character truncation from the scoring prompt; all `job_highlights` sections and items included; description field no longer truncated at 1200 chars
- **Token budget doubled** — `scoreJobs` AI call increased from `tokens=2000` to `tokens=4000`; scores top 25 of the 50-job pool to stay within budget
- **Badge counts read from pool** — Dashboard and MainApp Jobs badge now counts from `jh_jobs_pool_` (total jobs found today) instead of the mutation log
- **Scheduled search dual write** — scheduled background function writes full 50 to `jh_jobs_pool_` and first 10 to `jh_jobs_` for badge compatibility
- **`deduplicateJobs` extracted** — shared dedup helper in `serpapi.js` used by both `fetchJobs` and `fetchAllPages` (seniority-word normalisation, two-stage exact/fuzzy dedup)
- **Parallel Supabase upserts** — scheduled search now writes all 3 KV keys in parallel via `Promise.all`

### Engineering
- **Test suite** — 191 tests across 19 suites (was 179 across 19); new tests for `fetchAllPages`, full-description preservation, all 6 dead-listing phrases, pool/mutation write assertions

---

## [2026-03-25] — UX: Onboarding, Hero Descriptions & User Guide

### Added
- **Welcome modal** — first-time users see a 4-step onboarding guide (Upload Resume, Search Jobs, Apply, Track Progress); dismissed state persists via `jh_welcomed_{profileId}` KV key
- **Hero descriptions** — all 5 pages (Dashboard, Resume, Find Jobs, Applications, Settings) now show descriptive subtitle text in the hero banner explaining what the page does
- **Bug report in sidebar** — "Report a bug" link with info icon added to the sidebar footer (in addition to Settings > Help & Feedback)
- **User guide** — `docs/USER-GUIDE.md` — comprehensive documentation covering all features, navigation, and tips

### Changed
- `MainApp.jsx` — added `WelcomeModal` component (private, co-located), `showWelcome` state, useEffect to check KV welcomed flag
- `Sidebar.jsx` — added bug report link in footer section with SVG info icon

---

## [2026-03-25] — API Key Rotation

### Added
- **Multi-key rotation** — all API key env vars (`GEMINI_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `SERPAPI_KEY`) support comma-separated keys for automatic rotation
- **`key-rotator.js`** (`netlify/functions/lib/`) — shared module: `withKeyRotation(envVar, fn)` wraps any async call with round-robin key selection and rate-limit failover
  - `parseKeys(envVar)` — splits comma-separated env var into key array
  - `isRateLimitError(err)` — detects 429, rate limit, quota, resource_exhausted, too many requests
  - Round-robin counter persists across requests within the same Lambda instance
  - Single key skips rotation overhead entirely
- All 4 AI providers (`gemini.js`, `anthropic.js`, `openai.js`, `groq.js`) accept optional `apiKey` parameter
- `ai-router.js` wraps provider calls with `withKeyRotation`
- `serpapi.js` `fetchJobs` wraps `fetchOnePage` with `withKeyRotation`

### Engineering
- **Test suite** — 177 tests across 18 suites (was 157 across 17); 20 new tests for key rotation (parseKeys, isRateLimitError, round-robin, failover, logging)

---

## [2026-03-25] — UX Improvements & Job Card Enhancements

### Job Cards (`Jobs.jsx`)
- **3-row button layout** — Primary row (Details/Customize/Tailor), Decision row (Skip left, Apply right), External links row (prioritized, max 3)
- **Link prioritization** — `prioritizeLinks()` ranks: company site > LinkedIn > Indeed > Glassdoor > ZipRecruiter; deduplicates by domain
- **Description grid** — `job_highlights` rendered as 2-column glassmorphic grid (Qualifications, Benefits, Responsibilities); fallback parses description sentences into "Overview" card
- **Salary display** — dedicated line with SVG dollar icon; fallback `extractSalaryFromDesc()` regex when SerpApi salary field is empty
- **Sponsorship detection** — `detectSponsorship()` scans descriptions for visa sponsorship phrases; green "Visa Sponsor" / red "No Sponsorship" badges
- **Apply animation** — `slideOut` + `collapseHeight` CSS keyframes with 750ms delay; functional `setJobs((prev) => ...)` prevents stale closure

### AI Prompt (`Jobs.jsx` — CustomizeModal)
- **Chain-of-thought analysis** — 3-step structured prompt: identify gaps, map keywords, generate rewrites
- **Structured output** — `keywords_to_add`, `sections_to_strengthen`, `rewrite_suggestions` (before/after pairs)
- **Token limit** increased from 4000 to 6000

### Applications (`Applications.jsx`)
- **Add External Job** — `AddJobModal` for manually adding jobs (URL, title, company, location, notes); saves to apps and applied-urls index
- **Customize from Applications** — `AppCustomizeModal` generates cover letter analysis from saved application data
- **Button reorganization** — Desktop: Row 1 (Tasks, Activity, Notes, Customize) + Row 2 (View, Remove); Mobile: overflow menu includes Customize

### SVG Icons
- **Dashboard** — metric card emojis replaced with inline SVGs (search, inbox, chat, sparkle)
- **Resume** — upload emoji replaced with SVG document icon
- **Sidebar** — all nav items use SVG icons (from previous session)

### Backend (`serpapi.js`)
- **Description limit** increased from 400 to 1200 characters
- **`detectSponsorship(desc)`** — keyword matching for visa sponsorship phrases
- **`extractSalaryFromDesc(desc)`** — regex fallback for salary patterns

### Other
- **Wallpaper** — updated to sun's curve against deep black space (Unsplash CC0, 4K)
- **Bug report link** — Settings help card links to project GitHub Issues
- **`btn()` transitions** — upgraded from `opacity 0.15s` to `all 0.2s ease`

### Engineering
- **Bug report URL** fixed (was pointing to wrong repository)
- **Unused `onUpdate` prop** removed from Applications component
- **File cleanup** — removed 20+ temp PNGs, Playwright artifacts, stale pid/lock files
- **Test suite** — 157 tests, all passing; 0 lint errors

---

## [2026-03-24] — Full Visual Redesign (Space Glassmorphism)

### Design System
- **Dark-only theme** — removed Catppuccin light/dark duality; single dark palette with deep navy backgrounds (`#06060f`)
- **Space Grotesk typography** — loaded via Google Fonts CDN; replaces system-ui stack throughout
- **Indigo/Violet accent** — `#6366f1` → `#8b5cf6` gradient replaces all previous accent colours
- **Galaxy background** — full-page NASA/Unsplash CC0 space image at 7–13% opacity with fixed attachment; dark overlay preserves readability
- **Glassmorphism cards** — `rgba(255,255,255,0.05)` + `backdrop-filter: blur(12px)` + subtle white borders; top-edge violet highlight on every card
- **Animation suite** — 7 CSS keyframe animations: `twinkle`, `slideUp`, `shimmer`, `glowPulse`, `countUp`, `modalIn`, `sheetIn`

### Components Updated
- **`index.html`** — Space Grotesk font links, dark static body background (`#06060f`) to eliminate white flash
- **`src/lib/styles.jsx`** — full rewrite: new dark CSS custom property token set, all 7 keyframes, glassmorphism `C.card`/`C.metricCard`/`C.input`, `GALAXY_IMAGE_URL` constant, `STATUS_STYLES` with `borderColor`, `Badge` with visible border
- **`src/JobHunterApp.jsx`** — removed theme-restore block (no longer needed in dark-only mode)
- **`src/components/MainApp.jsx`** — removed `darkMode` useEffect; added two fixed galaxy overlay divs behind app chrome
- **`src/components/Sidebar.jsx`** — glassmorphism aside, active nav accent bar (3px violet gradient), "Main"/"Profile" section labels, footer user card with gradient avatar
- **`src/components/Dashboard.jsx`** — galaxy hero banner with twinkling stars, glassmorphism metric cards with count-up animation
- **`src/components/Jobs.jsx`** — galaxy hero banner, glassmorphism `JobCard` with slideUp stagger + shimmer + hover lift, dark glassmorphism modals (`CustomizeModal`, `ApplyModal`, `TailorModal`)
- **`src/components/Applications.jsx`** — galaxy hero banner, glassmorphism application cards, dark `TaskModal`
- **`src/components/Resume.jsx`** — galaxy hero banner, glassmorphism ATS score cards, indigo/violet gradient progress bars
- **`src/components/Settings.jsx`** — removed dark mode toggle and `darkMode` form state; new glassmorphism hero (DOM structure preserved for test compatibility)
- **`src/components/ProfileSelect.jsx`** — glassmorphism profile cards with top-edge highlight
- **`src/AdminPanel.jsx`** — glassmorphism cards via shared `C` tokens, sidebar updated to CSS variable references

### Engineering
- **Zero new npm packages** — Space Grotesk loaded via CDN; all animations in pure CSS keyframes
- **Test suite** — 157 tests, all passing; `TaskModal.test.jsx` wait sentinel updated to match new hero text

---

## [2026-03-23] — Design Review Fixes

### Fixed
- **Applications card — mobile overflow menu** — replaced right-side action column (status select + 5 buttons) with a `•••` toggle button on mobile; tapping opens an absolute-positioned dropdown (status select + full-width action buttons); a fixed transparent backdrop closes it on outside click; desktop layout unchanged
- **Settings banner full width** — hero banner moved outside the `maxWidth: 560` wrapper so it spans the full viewport width at all breakpoints; matches the pattern used by Dashboard and Applications
- **`var(--text-muted)` hex fallbacks** — removed `, #666` / `, #888` fallback values from 3 inline styles in `Settings.jsx`; token is defined for both light and dark themes in `styles.jsx`
- **Application status `<select>` accessibility** — added `aria-label="Application status"` to the status select in both desktop and mobile render paths
- **Resume file input accessibility** — added `aria-label="Upload resume file"` to both hidden `<input type="file">` elements (empty-state and has-resume branches)
- **Resume experience trailing separator** — `{e.company} · {e.period}` now conditionally renders the separator only when `e.period` is non-empty; same guard applied to education entries
- **Dashboard "Recent applications" heading** — added `overflow: hidden`, `textOverflow: ellipsis`, `whiteSpace: nowrap` to prevent clipping at 375px

### Engineering
- **Test suite** — 157 tests across 17 suites (was 140); 17 new tests covering overflow menu open/close/backdrop, aria-labels, period separator edge cases, and heading overflow styles
- **`@eslint/js` peer dependency** — downgraded from `^10.0.1` → `^9.39.4` to match `eslint@9`; was causing `ERESOLVE` failures on Netlify builds

### Housekeeping
- **`.gitignore`** — added `dist/`, `.env` / `.env.local`, `.netlify/`, `.worktrees/`, `deno.lock`, `docs/reviews/` (screenshots), `Relationship/` (local-only personal folder)
- **`deno.lock`** — removed from git tracking (Deno file has no place in an npm project)

---

## [2026-03-23] — Claude Code Slash-Command Workflows

### Added
- **`/code-review`** — 7-tier Pragmatic Quality code review against Job Neuron conventions; dispatches `code-reviewer` subagent; output to `docs/reviews/code-review-YYYY-MM-DD.md`
- **`/security-review`** — OWASP-aligned security review covering Job Neuron's specific attack surface (JWT auth, KV cross-user access, key exposure, XSS, admin bypass); output to `docs/reviews/security-review-YYYY-MM-DD.md`
- **`/design-review`** — Playwright-based 7-phase visual and UX review (auth check, baseline, per-view screenshots at 3 breakpoints, Catppuccin compliance, responsive layout, interactive states, accessibility); dispatches `design-reviewer` subagent; output to `docs/reviews/design-review-YYYY-MM-DD.md`

---

## [2026-03-23] — ESLint setup

### Added
- **ESLint 9 (flat config)** — `eslint.config.mjs` with four rule blocks:
  - `src/**` — ESM, browser globals, `eslint-plugin-react` + `eslint-plugin-react-hooks`
  - `src/__tests__/**` — same + Vitest globals (`describe`, `it`, `expect`, `vi`, …)
  - `netlify/functions/**` (non-test) — CommonJS, Node globals
  - `netlify/functions/__tests__/**` — ESM, Node + Vitest globals
- **`npm run lint`** — check all source files
- **`npm run lint:fix`** — auto-fix what ESLint can fix

### Config highlights
- `react/react-in-jsx-scope: off` — React 17+ (no JSX import needed)
- `react/prop-types: off` — JS-only project
- `no-empty: allowEmptyCatch: true` — silent-fail catch blocks are intentional throughout
- `no-control-regex: off` — intentional control-char stripping in PDF/DOCX text extraction
- `react-hooks/set-state-in-effect: off` — calling setState inside effects is valid React
- `no-unused-vars: warn` — warnings only, not errors
- Result: **0 errors, 25 warnings** on the existing codebase

---

## [2026-03-22] — Premium App Suite Redesign + Activity Log

### Added
- **Premium App Suite visual redesign** — full-app frontend polish across all views:
  - **Sidebar** — 200 → 240px, gradient purple brand header ("Job Neuron" + "AI Job Search"), inline SVG icons per nav item, "MAIN" / "ACCOUNT" section dividers, 3px active accent bar, badge counts (today's jobs / open applications), redesigned footer user card (gradient avatar + name + email + side-by-side Switch/Sign out buttons)
  - **Page hero banners** — gradient hero at top of every view (Dashboard: purple, Resume: teal, Find Jobs: blue, Applications: amber, Settings: neutral); each hero shows a contextual chip (open app count, job count, resume status, etc.)
  - **Dashboard** — elevated metric cards with colored left border, accent-colored number, icon badge (top-right), hover lift; quick action rows with emoji prefix and purple-tint hover; due-date chips on task rows (overdue in red)
  - **Jobs** — company avatar initials circle, colored left border per status, hover lift
  - **Applications** — company avatar, colored left border, timeline-style activity log (left border + dot connector), accessible custom checkbox in TaskModal (hidden native input + visual div via `htmlFor`), modal open animation
  - **Resume** — dashed upload zone for empty state, colored dot prefix on analysis section headers, large accented ATS score
  - **Settings** — max-width 480 → 560px, colored dot prefix on section titles
  - **ProfileSelect** — full-height centered layout, Job Neuron branding with gradient icon
  - **Design tokens** — added `--shadow-md`, Badge `borderRadius` 6 → 20 (pill shape), `@keyframes modalIn` added to GlobalStyles
- **Application activity log** — per-application event timeline (phone calls, emails, interviews, etc.) accessible via "Activity" button on each card; status changes are auto-logged

### Engineering
- **Test suite** — 140 tests across 17 suites (was 136); activity log tests added; TaskModal test selector updated for nav badge counts

---

## [2026-03-22] — Per-Job Resume Tailoring + CSS Variable Cleanup

### Added
- **Per-job resume tailoring** (`TailorModal` in `Jobs.jsx`) — "✦ Tailor resume" button on every job card opens a modal that runs an AI gap analysis between the saved resume and the job description:
  - **Gap analysis** — section scores (0–100) with progress bars and detail text; colour-coded strong / weak / poor
  - **Rewrite suggestions** — top 3–5 before/after bullet pairs, each with a plain-English reason and a per-suggestion copy button; shows "No rewrites needed" message when resume is already well-aligned
  - **Keyword chips** — present keywords (green) and missing keywords (red) side by side
  - **ATS-aware prompting** — ATS scan issues and recommended keywords are injected into the prompt so tailoring suggestions are never contradictory to what the ATS scan already found
  - Button disabled (`opacity: 0.5`, `disabled` attr) when profile has no resume text saved
  - Result cached on the job object in React state — re-opening the modal skips the AI call
  - Uses the existing `callAIBackground` pipeline (same pattern as ATS scan); no new Netlify functions

### Fixed
- **CSS variables — login/splash screens** (`App.jsx`) — `GlobalStyles` moved from `JobHunterApp` up to `App` so CSS custom properties (`--bg-page`, `--text-main`, etc.) are available before authentication; all hardcoded hex values on the login card, splash screen, logo, and sign-in/sign-up buttons replaced with semantic vars
- **CSS variables — ProfileSelect** — avatar background/text, subtitle, email, delete button, and sign-out button colors replaced with CSS vars
- **CSS variables — Settings** — profile email, sign-out button, and all four label colors replaced with CSS vars
- **CSS variables — MainApp** — loading state `color: '#888'` replaced with `var(--text-muted)`
- **CSS variables — AdminPanel** — local `C` design tokens and `btn()` function updated to use CSS vars; all content-area inline colors (card backgrounds, muted/faint text, metric tiles, user role badges, disabled badge, application status badges, activity feed rows) replaced with CSS vars; intentional dark sidebar (`#0a0a0a`) preserved

### Engineering
- **Test suite** — 136 tests across 17 suites (was 132); 4 new TailorModal tests: loading state, success render, error/retry, button disabled without resume

---

## [2026-03-21] — Catppuccin Theme (Dark + Light)

### Added
- **Catppuccin Mocha** dark theme + **Catppuccin Latte** light theme — full palette applied via CSS custom properties; both modes share the same accent color names (mauve, blue, green, yellow, red) for a cohesive cross-mode experience
- **14 new semantic CSS variables** — `--bg-content` (nested content areas), `--bg-warning/error/info/success` (alert backgrounds), `--text-warning/error/info/success` (alert text), `--border-warning/error/info/success` (alert borders), `--progress-track` (progress bar track)

### Fixed
- **Dark mode visibility** — all hardcoded hex colors in Dashboard, Sidebar, Applications, Jobs, and Resume replaced with semantic CSS variables; previously invisible text and sections now display correctly in dark mode
- **ATS progress bar fill** — `scoreBg()` now used for bar fill (was incorrectly using `scoreColor()` which returns a text color var)

### Improved
- **`styles.jsx` CSS variables** — 28 existing vars updated to official Catppuccin Mocha/Latte hex values; `--btn-primary-bg` in dark mode is now mauve (`#cba6f7`) with `--btn-primary-text: #1e1e2e` for legibility
- **Score/status helper functions** (`Resume.jsx`) — `scoreColor`, `scoreBg`, `statusColor`, `statusBg`, `sevColor`, `sevBg` refactored from hardcoded hex strings to CSS var strings; light and dark mode correct automatically

---

## [2026-03-18] — Job Search Filters, Skip Feature + Quick Fixes

### Added
- **Filter bar** (`Jobs.jsx`) — collapsible panel pre-filled from profile preferences; override roles, location, work type, and job type per-search without touching Settings; search triggered by explicit "Search" button
- **Skip / Not Interested** — Skip button on each job card removes the job from the current view and persists it to `jh_skipped_{profileId}` KV key; skipped jobs are excluded from all future searches (server-side Step 3b filter); skipped list visible in the filter bar with per-entry Undo
- **Adaptive single-query job search** — replaced 5-query SerpApi fan-out with one targeted query built from `buildQuery(filters)` + `parseLocation(filters.location)`; saves 4 API credits per search on the free plan (100 req/month)
- **`employment_type` SerpApi param** — passed when `jobType` is `fulltime`, `parttime`, or `contractor`; omitted for `any`
- **`buildQuery(filters)`** and **`parseLocation(locationsStr)`** exported from `serpapi.js` for testability; 9 new unit tests

### Fixed
- **Resume save button** — `save()` made async; shows "Saved ✓" for 2 seconds after a successful KV write (previously synchronous with no visual feedback)

### Improved
- **Jobs sorted by match %** — `filtered` derivation now `.slice().sort()` descending by `matchScore`; highest-match jobs always appear first
- **`filters` object flows end-to-end** — `Jobs.jsx` → `callJobsSearch` → `jobs-search.js` → `fetchAndScoreJobs` → `fetchJobs`; eliminates the old `query !== 'default'` sentinel and the manual `query`/`location` derivation in three places
- **Scheduled job search** picks up `workType` and `jobType` from profile preferences (previously only `roles`, `locations`, `dateWindowDays` were used)

### Changed
- `serpapi.js` — `fetchJobs(customQuery, location, dateWindowDays)` positional signature replaced by `fetchJobs(filters)`; `ROLE_QUERIES` constant deleted
- `job-search-core.js` — `fetchAndScoreJobs` params `query`, `location`, `dateWindowDays` replaced by single `filters` object; Step 3b (skipped-job filter) added after Step 3 (applied-job filter)
- `jobs-search.js` — payload now expects `{ jobId, filters, resumeText, targetRoles, profileId }`; `!query` guard replaced by `!filters` guard
- `scheduled-job-search-background.js` — builds `filters` object from `prefs` instead of deriving `query`/`location` strings
- `api.js` — `callJobsSearch` signature changed from positional `{ query, location, ... }` to `{ filters, ... }`
- **Test suite** — 132 tests across 17 suites (was 98 across 15); 9 new `serpapi.js` unit tests (`buildQuery` × 4, `parseLocation` × 3, `employment_type` × 2)

---

## [2026-03-17] — SerpApi Migration + Job Expiry Checker

### Added
- **SerpApi Google Jobs** — replaced JSearch/RapidAPI with SerpApi; `netlify/functions/lib/job-providers/serpapi.js` handles fetch, normalisation, deduplication, source-priority sort
  - `normaliseJob(raw)` — maps SerpApi shape to internal job object: `serpApiJobId`, `title`, `company`, `location`, `sourcePlatform`, `companyLogo`, `description` (max 1200 chars), `highlights`, `postedAt`, `jobType`, `benefits`, `links`, `url`, `salary`, `sponsorship`
  - `getBestApplyLink(applyOptions)` — prefers direct company page over aggregators (LinkedIn → Indeed → Glassdoor → first)
  - `detectSponsorship(desc)` — keyword matching for visa sponsorship phrases; returns `'yes'`/`'no'`/`null`
  - `extractSalaryFromDesc(desc)` — regex fallback for salary patterns when SerpApi salary field is empty
  - `parseRelativeDate(str)` — converts "3 days ago" → ISO datetime
- **Job expiry checker** — `netlify/functions/check-job-expiry-background.js`
  - Cron: daily at 4 AM UTC; scans all `jh_jobs_*` keys written in the last 14 days
  - HEAD-checks each job URL (`isLinkAlive`, 5 s timeout, concurrency 5); marks dead links `expired: true` + `expiredAt`
  - Fetch-time validation also runs in the search pipeline (Step 5) — dead links removed before AI scoring
- **Configurable date window** — Settings → Job Search card: 30-day / 60-day selector; stored as `preferences.dateWindowDays`; used in both manual search and scheduled search
- **Applied-job filter** (`jh_applied_urls_{profileId}` KV key) — jobs already applied to are filtered server-side (Step 3) using URL, `serpApiJobId`, and normalised company+title matching
- **Richer job cards** — company logo, Health/PTO/Dental benefit badges, highlights panel (when expanded), `sourcePlatform` display, expired amber banner, apply links use `link.title` / `link.link` from `apply_options`

### Fixed
- **`is60DaysOld` called but not defined** — `fetchAndScoreJobs` was referencing the old helper name after the rename to `isWithinDateWindow`; fixed at line 163 of `job-search-core.js`

### Changed
- `RAPIDAPI_KEY` → `SERPAPI_KEY` throughout `.env.example`, `CLAUDE.md`, `README.md`
- `jobs-search.js` — accepts `profileId` and `dateWindowDays` from payload; passes `userId` and `supabase` to `fetchAndScoreJobs` for applied-job filtering
- `netlify.toml` — added `[functions."check-job-expiry-background"]` with `schedule = "0 4 * * *"` and `timeout = 900`
- `vitest.config.js` — added `.worktrees/**` exclusion to prevent worktree React version conflicts from breaking the test run

---

## [Earlier] — Platform Foundation

### Added
- **Scheduled daily job search** — per-profile opt-in; Netlify scheduled background function runs at 8 AM in each user's local timezone
  - Settings → **Job Search** card: checkbox to enable automatic daily search; timezone auto-detected from browser on every preferences save
  - Runs every 6 hours via cron (`0 */6 * * *`); fires for each profile whose 8 AM falls in the current UTC window
  - Results written directly to `jh_jobs_{profileId}_{date}` KV key; run outcome tracked in `jh_scheduled_status_{profileId}`
  - Jobs tab shows a dismissible amber error banner if the scheduled run failed; silent on success
  - `netlify/functions/lib/job-search-core.js` — shared job-search pipeline extracted from `jobs-search.js`; used by both the HTTP handler and the scheduled function
  - 14 new unit tests for timing helpers (`getLocalDate`, `isProfileDue`, `getProfilesToRun`)
- **Structured logging & diagnostics** — zero-dependency, request-correlated JSON logging across the full stack
  - `src/lib/logger.js` — frontend logger singleton; `debug/info/warn` gated by `localStorage.jh_debug` or `VITE_DEBUG`; `error` always fires
  - `netlify/functions/logger.js` — backend logger factory; same rules via `DEBUG` env var
  - Every frontend API call generates a 6-char `rid`, sent as `X-Request-ID` header; every backend handler echoes it in every log line
  - Log format: `{ level, ts, rid, op, ...ctx }` — structured JSON, filterable by `rid` to trace a single request end-to-end
  - Settings → **Developer tools** card: per-session debug toggle (writes `localStorage.jh_debug` directly, no save required)
- **Task Management** (`jh_tasks_{profileId}_{jobId}` KV key)
  - `TaskModal` component: per-application task list with title, due date, completion toggle, and notes
  - Quick-add preset buttons: "Prepare for interview", "Send thank you email", "Follow up", "Research company", "Negotiate offer"
  - Overdue badge (red) when `dueDate < today && !completed`
  - Dashboard "Upcoming tasks" panel: shows tasks due within 7 days, sorted by date, across all applications
- **Dark mode** (full CSS variable system)
- **Dev/prod data isolation** — `db.js` prefixes all Supabase keys with `dev_` when `NETLIFY_DEV=true`
- **Helper module** (`src/lib/helpers.js`) — `uid`, `todayStr`, `fmtDate`, `parseJSON`
- **Component split** — `src/JobHunterApp.jsx` (1,300 lines) split into focused files; now a 44-line root shell

### Fixed
- Port conflict on GitHub Codespaces (port 9000)
- Netlify Identity not initialising in local dev
- Profile details blank on first login
- Refresh sends user back to create-profile page
- `gemini-2.5-flash-lite` `thinkingConfig` rejection
- `GEMINI_API_KEY` collision with GitHub Codespaces injected JWT → renamed to `GEMINI_KEY`

---

## Known Constraints

- `vi.mock('@supabase/supabase-js')` does not work in Vitest's node environment for Netlify function tests — Vitest cannot intercept CJS `require()` for third-party packages. Tests that require Supabase are either written against exported pure functions or skipped.
- Background functions (`*-background.js`) cannot use `context.clientContext` — they parse the JWT manually from the `Authorization` header.
- Port 9000 is required for local dev on GitHub Codespaces — port 8888 is reserved by Codespaces infrastructure.
- GitHub Codespaces injects environment variables that may collide with project env var names — use `GEMINI_KEY` (not `GEMINI_API_KEY`) to avoid the JWT collision.
