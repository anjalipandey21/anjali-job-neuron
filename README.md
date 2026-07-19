# Job Neuron — AI-Powered Job Search Platform

An invite-only AI-powered job search platform. Analyzes your resume, finds real matching jobs every day from LinkedIn, Indeed, Glassdoor and more, generates tailored cover letters per job, and tracks your entire application pipeline.

**Live at:** `https://jobneuron.netlify.app`

---

## Features

| Feature | Details |
|---|---|
| **Resume analysis** | Upload PDF, Word, or paste text — AI extracts skills, roles, experience, education |
| **ATS score** | Simulates how ATS systems score your resume across 8 categories with actionable fixes |
| **Semantic keyword matching** | TF-IDF cosine similarity engine matches resume keywords to job descriptions — no AI cost |
| **Daily job search** | 5 parallel SerpApi pages fetch up to 50 unique scored jobs per search; deduped by job ID and normalised title |
| **Infinite scroll** | Jobs page loads 10 cards on mount, reveals 10 more per scroll via IntersectionObserver |
| **Filter bar** | Override search filters per-search (roles, location, work type, job type, date window) without changing profile settings |
| **Skip / Not Interested** | Hide jobs from current view and exclude them from future searches; undo from the skipped list |
| **AI match scoring** | Every job is scored 0–100% against your resume and sorted by match %, with a reason |
| **Custom cover letters** | One-click AI cover letter + 5 resume highlights tailored per job; chain-of-thought analysis with structured before/after rewrites |
| **Per-job resume tailoring** | Gap analysis, section scores, keyword chips (present/missing), and rewrite suggestions |
| **Sponsorship detection** | Scans job descriptions for visa sponsorship phrases; green/red badges on job cards |
| **Salary extraction** | Displays salary from SerpApi; regex fallback parses salary from description text |
| **Application tracker** | Full pipeline: Applied → Interview → Offer / Rejected with notes; manually add external jobs |
| **Task management** | Per-application tasks with due dates, overdue alerts, and dashboard overview |
| **Application customization** | Generate cover letter analysis from saved application data |
| **Multi-profile** | One account, multiple job-seeker profiles (family members, different roles) |
| **Admin panel** | Oversee all users, view their stats, disable accounts, manage roles |
| **Multi-AI provider** | Switch between Gemini, Claude, OpenAI, or Groq with one env var |
| **API key rotation** | Comma-separated keys per provider; round-robin distribution with automatic failover on rate limits (429) |
| **Welcome onboarding** | First-time users see a 4-step guide; state persists via KV so it only shows once |
| **User guide** | Comprehensive `docs/USER-GUIDE.md` covering all features, navigation, and tips |
| **Dev/prod separation** | All dev data is namespaced `dev_*` in Supabase — production data is never touched locally |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React (no framework) |
| Auth | Netlify Identity (invite-only) |
| Backend | Netlify Functions (serverless) |
| Background jobs | Netlify Background Functions |
| Database | Supabase (Postgres KV store + job queue) |
| AI | Gemini 2.5 Flash-Lite (default), switchable |
| Job listings | SerpApi Google Jobs API |
| CI/CD | GitHub → Netlify (auto-deploy on push to `main`) |
| Tests | Vitest + React Testing Library |

---

## Prerequisites

- [GitHub account](https://github.com)
- [Netlify account](https://netlify.com) — free tier
- [Supabase account](https://supabase.com) — free tier
- [SerpApi account](https://serpapi.com) — free tier (Google Jobs, 100 req/month)
- [Google AI Studio account](https://aistudio.google.com) — free tier (Gemini, 1,000 req/day)
- Node.js 18+

---

## Setup (one-time, ~20 minutes)

### 1. Supabase — create project and tables

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Wait for provisioning, then open **SQL Editor → New query**
3. Paste the contents of `supabase-schema.sql` and click **Run**
4. Go to **Settings → API Keys** and copy:
   - **URL** → `SUPABASE_URL`
   - **Secret key** (`sb_secret_...`) → `SUPABASE_SERVICE_KEY`

### 2. SerpApi — get Google Jobs key

1. Sign up at [serpapi.com](https://serpapi.com)
2. Go to **Dashboard** and copy your API key
3. Paste into `SERPAPI_KEY`

### 3. Google AI Studio — get Gemini key

1. Go to [aistudio.google.com](https://aistudio.google.com) → **Get API key → Create API key**
2. Copy the key (`AIza...`) → `GEMINI_KEY`

> Google Pro subscribers get $10/month Gemini credits. Otherwise free tier (1,000 req/day) is sufficient for dev.

### 4. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/jobhunter-ai.git
git push -u origin main
```

### 5. Deploy to Netlify

1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import from GitHub**
2. Select your repo — build settings are auto-detected from `netlify.toml`
3. Click **Deploy site** (first deploy may fail until env vars are added)

### 6. Add environment variables in Netlify

**Site settings → Environment variables:**

| Key | Value | Required |
|---|---|---|
| `AI_PROVIDER` | `gemini` | ✓ |
| `AI_MODEL` | `gemini-2.5-flash-lite` | ✓ |
| `GEMINI_KEY` | `AIza...` (comma-separated for multi-key rotation) | ✓ |
| `SUPABASE_URL` | `https://xxx.supabase.co` | ✓ |
| `SUPABASE_SERVICE_KEY` | `sb_secret_...` | ✓ |
| `SERPAPI_KEY` | your SerpApi key (comma-separated for multi-key rotation) | ✓ |
| `DEBUG` | `false` | optional (enables backend JSON logs) |
| `VITE_DEBUG` | `false` | optional (enables browser JSON logs) |

Then: **Deploys → Trigger deploy → Deploy site**

### 7. Enable Netlify Identity

1. Netlify dashboard → **Identity → Enable Identity**
2. **Registration preferences → Invite only**
3. **Identity → Invite users** → enter your email
4. Click the invite link in your email to set a password

### 8. Make yourself admin

After your first login, run in **Supabase → SQL Editor**:

```sql
UPDATE user_roles SET role = 'admin' WHERE email = 'your@email.com';
```

---

## Local development

### Standard environment

```bash
npm install
npm install -g netlify-cli
cp .env.example .env       # fill in your keys

netlify login              # authorize with Netlify
netlify link               # links to the deployed site (enables Identity locally)
npm run dev                # starts on http://localhost:9000
```

> **GitHub Codespaces / iPad:** Port 8888 is reserved by Codespaces infrastructure. `npm run dev` is pre-configured to use port 9000.

### Why `netlify dev` instead of `npm run dev` (vite only)?

`netlify dev` starts both Vite and the Netlify Functions server together. Running Vite alone skips the functions (`/ai`, `/db`, `/jobs-search`, etc.) so auth and all data operations will fail.

### Dev vs prod data isolation

When running locally, `NETLIFY_DEV=true` is set automatically. All Supabase keys are transparently namespaced as `dev_jh_*` instead of `jh_*`. Your local testing never touches production data.

---

## Linting

```bash
npm run lint               # check src/ and netlify/functions/
npm run lint:fix           # auto-fix what ESLint can fix
```

ESLint 9 (flat config) — `eslint.config.mjs`. Four rule blocks:
- `src/**` — ESM, browser + React + hooks rules
- `src/__tests__/**` — same + Vitest globals
- `netlify/functions/**` — CommonJS, Node rules
- `netlify/functions/__tests__/**` — ESM, Node + Vitest globals

---

## Running tests

```bash
npm test                   # run all tests once
npm run test:watch         # watch mode
npm run test:coverage      # with coverage report
```

**191 tests across 19 suites:**
- `src/__tests__/helpers.test.js` — uid, todayStr, fmtDate, parseJSON
- `src/__tests__/ProfileSelect.test.jsx` — auto-select, first-time user, duplicate guard
- `src/__tests__/TaskModal.test.jsx` — add/complete/remove tasks, overdue badges, presets
- `src/__tests__/logger.test.js` — debug flag, per-level routing, withRid binding
- `src/__tests__/styles.test.jsx` — design token structure, Badge component
- `src/__tests__/Applications.test.jsx` — application cards, overflow menu, activity log
- `src/__tests__/Dashboard.test.jsx` — metric cards, quick actions
- `src/__tests__/Jobs.test.jsx` — job pool model, filter bar, TailorModal states
- `src/__tests__/Resume.test.jsx` — upload, ATS score display
- `src/__tests__/Settings.test.jsx` — preferences, help card
- `src/__tests__/TopNav.test.jsx` — navigation, profile menu
- `netlify/functions/__tests__/jobs-search.test.js` — quality filters, deduplication, link priority
- `netlify/functions/__tests__/serpapi.test.js` — normaliseJob, no truncation, fetchAllPages dedup, buildQuery
- `netlify/functions/__tests__/db.test.js` — key namespacing, auth guards
- `netlify/functions/__tests__/logger.test.js` — debug flag, rid baking, always-on error
- `netlify/functions/__tests__/expiry-checker.test.js` — GET liveness, 8KB body scan, dead-phrase detection
- `netlify/functions/__tests__/scheduled-job-search.test.js` — timing helpers, pool/mutation dual write
- `netlify/functions/__tests__/key-rotator.test.js` — parseKeys, isRateLimitError, round-robin, failover
- `netlify/functions/__tests__/ai.test.js` — provider routing, background job dispatch

---

## Switching AI providers

Change `AI_PROVIDER` (and the matching key) in Netlify env vars — no code changes needed:

| `AI_PROVIDER` | Default model | Free tier | Env key |
|---|---|---|---|
| `gemini` | `gemini-2.5-flash-lite` | ✓ 1,000/day | `GEMINI_KEY` |
| `anthropic` | `claude-sonnet-4-20250514` | ✗ | `ANTHROPIC_API_KEY` |
| `openai` | `gpt-4o-mini` | ✗ | `OPENAI_API_KEY` |
| `groq` | `llama-3.3-70b-versatile` | ✓ rate limited | `GROQ_API_KEY` |

> Groq does not support web search grounding. Job search will work but without search context.

### API key rotation

All API key env vars support **multiple comma-separated keys** for automatic rotation:

```bash
GEMINI_KEY=AIza...key1,AIza...key2,AIza...key3
SERPAPI_KEY=serpkey1,serpkey2
```

- **Round-robin** — requests are distributed across keys evenly, not just failover
- **Auto-failover** — on 429/rate-limit/quota errors, automatically retries with the next key
- **Immediate fail** — non-rate-limit errors (invalid key, bad request) fail without trying other keys
- **Zero overhead** — single key works exactly as before, no rotation logic

This is useful for scaling beyond a single free-tier quota (e.g., multiple Gemini or SerpApi keys).

---

## Project structure

```
jobhunter-ai/
├── netlify/functions/                # All serverless backend
│   ├── ai.js                        # AI proxy — routes to provider
│   ├── ai-bg-background.js          # Background AI worker (ATS scan)
│   ├── ai-router.js                 # Provider router + key rotation (AI_PROVIDER env var)
│   ├── ai-status.js                 # Poll background job status
│   ├── admin.js                     # Admin API
│   ├── db.js                        # Supabase KV proxy + dev key namespacing
│   ├── jobs-search.js               # SerpApi Google Jobs + quality filters + semantic scoring
│   ├── providers/                   # gemini.js, anthropic.js, openai.js, groq.js
│   ├── lib/
│   │   ├── job-providers/serpapi.js  # SerpApi fetch, normalise, sponsorship, salary extraction
│   │   ├── job-search-core.js       # Shared search pipeline (HTTP + scheduled)
│   │   ├── semantic.js              # TF-IDF cosine similarity scoring
│   │   ├── expiry-checker.js        # URL liveness GET checks with 8 KB body scan
│   │   └── key-rotator.js          # Round-robin API key rotation + rate-limit failover
│   └── __tests__/                   # Node environment tests (6 suites)
├── src/
│   ├── App.jsx                      # Auth wrapper (Netlify Identity init)
│   ├── JobHunterApp.jsx             # Root shell (~44 lines) — routing
│   ├── AdminPanel.jsx               # Admin dashboard
│   ├── components/                  # One file per feature area (named exports)
│   │   ├── TopNav.jsx               # Fixed top navigation bar (desktop + tablet)
│   │   ├── BottomNav.jsx            # Fixed bottom tab bar (mobile only)
│   │   ├── Dashboard.jsx            # Dashboard (metric cards, task overview)
│   │   ├── Resume.jsx               # Resume (+ private loadPdfJs, extractPdfText)
│   │   ├── Jobs.jsx                 # Jobs (+ private JobCard, CustomizeModal, ApplyModal, TailorModal)
│   │   ├── Applications.jsx         # Applications (+ private TaskModal, AddJobModal, AppCustomizeModal)
│   │   ├── Settings.jsx             # Settings
│   │   ├── ProfileSelect.jsx        # Profile picker
│   │   ├── AdminPanel.jsx           # Admin dashboard
│   │   └── MainApp.jsx              # Root shell — composes all pages + WelcomeModal
│   └── lib/
│       ├── api.js                   # Client-side API helpers (dbGet, dbSet, callAI, ...)
│       ├── helpers.js               # uid, todayStr, fmtDate, parseJSON
│       ├── hooks.js                 # useBreakpoint hook
│       ├── logger.js                # Frontend structured logger
│       └── styles.jsx               # Badge component, GlobalStyles (body/bottom-nav CSS injection)
├── src/__tests__/                   # jsdom environment tests (11 suites)
├── supabase-schema.sql
├── netlify.toml
├── vite.config.js
├── vitest.config.js
├── .env.example
└── CLAUDE.md
```

---

## Security model

- API keys never reach the browser — all AI and DB calls go through Netlify Functions
- Every function verifies the Netlify Identity JWT before touching data
- Background functions parse JWT manually (`clientContext` is unavailable in bg functions)
- Each user's data is isolated by `user_id` in Supabase
- Registration is invite-only — no self-signup
- Admin role is verified server-side on every admin request
- Dev data is namespaced separately from production in the same Supabase instance

---

## Database tables

| Table | Purpose |
|---|---|
| `kv_store` | All app data (profiles, jobs, applications, tasks) keyed `user_id + key` |
| `bg_jobs` | Background job queue — status: `pending → processing → done / error` |
| `user_roles` | Role assignments (`admin` / `user`) with disabled flag |

Key naming convention (all prefixed `jh_`):

| Key | Content |
|---|---|
| `jh_profiles` | Array of all profile objects for the user |
| `jh_p_{profileId}` | Full profile data (resume, analysis, preferences) |
| `jh_apps_{profileId}` | Array of application records |
| `jh_jobs_{profileId}_{YYYY-MM-DD}` | Sparse mutation log `{ id, status, customResume, tailorResult, appliedAt }[]` — one entry per job the user has interacted with |
| `jh_jobs_pool_{profileId}_{YYYY-MM-DD}` | Full pool of up to 50 scored jobs for the day; written by frontend after search and by scheduled search; never mutated by UI |
| `jh_tasks_{profileId}_{jobId}` | Task list for a specific application |
| `jh_applied_urls_{profileId}` | Applied-job index — filters already-applied jobs from future searches |
| `jh_skipped_{profileId}` | Skipped-job index — filters "Not Interested" jobs from future searches |

In dev: all keys are prefixed `dev_` (e.g. `dev_jh_profiles`).

---

## API cost estimates (Gemini 2.5 Flash-Lite)

| Operation | AI calls | Approx cost |
|---|---|---|
| Analyze profile | 1 | ~$0.001 |
| ATS score check | 1 | ~$0.002 |
| Find jobs (50 pool, score top 25) | 1 (scoring only) | ~$0.005 |
| Custom cover letter | 1 | ~$0.001 |
| **Full daily session** | **4** | **~$0.007** |

$10/month credit ≈ 1,400 full sessions. Semantic matching (job %) runs locally — no AI cost.

---

## CI/CD

Every `git push` to `main` triggers an automatic Netlify deploy (~60 seconds).

```bash
git add .
git commit -m "your message"
git push
```

Pull requests automatically get a **Deploy Preview** URL for testing before merging.

---

## Managing users

**Invite a new user:**
Netlify dashboard → Identity → Invite users → enter email

**Promote to admin:**
```sql
UPDATE user_roles SET role = 'admin' WHERE email = 'their@email.com';
```

**Disable without deleting:**
```sql
UPDATE user_roles SET disabled = true WHERE email = 'their@email.com';
```

**View all users:** Admin panel → Users tab (in-app)
