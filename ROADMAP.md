# Job Neuron — Roadmap

## ✅ Implemented

### Core Platform
- **Invite-only auth** — Netlify Identity, no self-signup
- **Multi-profile support** — one account, multiple job-seeker profiles (family members, different roles)
- **Dev/prod data isolation** — `NETLIFY_DEV=true` namespaces all Supabase keys as `dev_*`
- **Admin panel** — view all users, stats, disable accounts, manage roles
- **Multi-AI provider** — switch between Gemini, Claude, OpenAI, Groq with one env var
- **Space glassmorphism dark theme** — single dark palette (`#06060f`), Space Grotesk typography, indigo/violet accent gradient, galaxy background at low opacity, glassmorphism cards with `backdrop-filter: blur(12px)`, 7+ CSS keyframe animations (twinkle, slideUp, shimmer, glowPulse, slideOut, collapseHeight, etc.)
- **SVG icon system** — all nav items, dashboard metrics, resume upload, and job card actions use inline SVGs (no icon library, zero dependencies)
- **Collapsible sidebar** — toggle chevron, persisted to localStorage via `jh_sidebar_collapsed`, smooth width transition
- **Responsive layout** — two-breakpoint responsive design: 64px icon rail on tablet (481–768px); bottom tab bar on phone (≤480px); bottom-sheet modals; content grid reflow on all pages

### Resume & Profile
- **Resume upload** — PDF, Word, or paste plain text
- **AI resume analysis** — extracts skills, roles, experience, education
- **ATS score** — simulates ATS scoring across 8 categories with actionable fix suggestions (background function)
- **Semantic keyword matching** — TF-IDF cosine similarity, matches resume keywords to job descriptions (no AI cost)

### Job Search
- **Daily job search** — 5 parallel SerpApi pages fetch up to 50 unique scored jobs; deduped by ID and normalised title; full descriptions used for AI scoring (no truncation)
- **Infinite scroll** — Jobs page shows 10 cards on mount, loads 10 more per scroll via IntersectionObserver; pool exhausted message when all jobs shown
- **Scheduled daily job search** — per-profile opt-in toggle; Netlify scheduled background function fires at 8 AM in each profile's local timezone; writes full pool + legacy mutation key; silent on success, error banner in Jobs tab on failure
- **Filter bar** — collapsible panel on Jobs page; override roles, location, work type, job type, and date window per-search without changing profile settings
- **Skip / Not Interested** — hide jobs from view and exclude from future searches; undo from the skipped list
- **Applied-job filter** — jobs already applied to are excluded from all future searches (server-side and client-side via appliedSet)
- **Job expiry checker** — daily cron GET-checks all job URLs from the last 14 days with 8 KB body scan; detects "position filled" / "no longer accepting" phrases; fetch-time validation also removes dead links before AI scoring
- **AI match scoring** — every job scored 0–100% against full resume (all highlights, no description truncation); sorted by match %, with a plain-English reason; tokens=4000, scores top 25 of 50-job pool
- **Quality filters** — removes staffing agencies, jobs with no description, stale listings, duplicates
- **Link prioritization** — ranks apply links: company site > LinkedIn > Indeed > Glassdoor > ZipRecruiter; deduplicates by domain, max 3 per card
- **Sponsorship detection** — scans job descriptions for visa sponsorship phrases; shows green "Visa Sponsor" / red "No Sponsorship" badges
- **Salary extraction** — displays salary from SerpApi; regex fallback parses salary patterns from description text when field is empty
- **Job description grid** — `job_highlights` rendered as 2-column glassmorphic grid (Qualifications, Benefits, Responsibilities); fallback parses sentences into "Overview" card
- **Configurable date window** — 30, 60, or 90-day search window; configurable in Settings (saved) or Jobs filter bar (session-only)

### Applications
- **Application tracker** — full pipeline: Applied → Interview → Offer / Rejected with notes; manually add external jobs via AddJobModal
- **Custom cover letters** — one-click AI cover letter + 5 resume highlights tailored per job; chain-of-thought analysis with structured before/after rewrites (token limit 6000)
- **Application customization** — generate cover letter analysis from saved application data via AppCustomizeModal
- **Per-job resume tailoring** — AI gap analysis of resume vs job description: section scores with progress bars, before/after rewrite suggestions with copy buttons, present/missing keyword chips; ATS scan findings included in prompt to prevent contradictory advice; result cached per job so re-opening skips the AI call
- **Task management** — per-application tasks with title, due date, completed flag; overdue badges; preset quick-add buttons
- **Application activity log** — per-application event timeline (phone calls, emails, interviews, etc.) accessible via "Activity" button on each card; status changes are auto-logged
- **Apply animation** — slideOut + collapseHeight CSS keyframes with 750ms delay; functional state update prevents stale closures
- **Dashboard** — upcoming/overdue tasks overview, match score summary, quick stats, SVG metric icons
- **Bug report** — Settings → Help & Feedback card + sidebar footer link; both link to project GitHub Issues
- **Welcome onboarding modal** — first-time users see a 4-step guide (Upload Resume, Search Jobs, Apply, Track Progress); dismissed state persists via `jh_welcomed_{profileId}` KV key; Skip or Get Started buttons
- **Hero descriptions** — all 5 pages show descriptive subtitle text in the hero banner explaining what the page does
- **User guide** — comprehensive `docs/USER-GUIDE.md` documenting all features, navigation, tips, and bug reporting

### Engineering
- **API key rotation** — comma-separated keys per provider (AI + SerpApi); round-robin distribution with automatic failover on 429/rate-limit/quota errors; `key-rotator.js` shared module
- **Test suite** — 191 tests across 19 suites (Vitest + React Testing Library)
- **CI/CD** — auto-deploy on push to `main`; deploy previews on PRs
- **Serverless** — all API keys server-side; Netlify Functions proxy every AI and DB call
- **Background functions** — long-running ATS scan runs async, polled by frontend
- **Structured logging & diagnostics** — request-correlated JSON logging (`rid` propagation) across frontend and all Netlify Functions; debug toggle in Settings and via `DEBUG`/`VITE_DEBUG` env vars

---

## 🔄 In Progress

_Nothing currently in active development._

---

## 📋 Backlog

### High Priority
- **Email digest** — daily/weekly summary of new matches, upcoming tasks, application status changes

### Medium Priority
- **Download cover letter** — export as PDF or `.docx` (currently copy-paste only)
- **Resume versioning** — save multiple resume versions per profile; select which version to use per application
- **Analytics dashboard** — response rate by job type, location, source, match score band; funnel visualization *(inspired by [JobSync](https://github.com/Gsync/jobsync))*
- **ATS PDF export** — export the ATS score report as a formatted PDF
- **Resume PDF generator** — export a clean, formatted resume PDF directly from profile data; AI structures it into a professional layout *(inspired by [Resume-Matcher](https://github.com/srbhr/Resume-Matcher) + [ai-job-scraper](https://github.com/anandanair/job-scraper))*
- **Keyword gap analysis** — ~~show exactly which keywords are missing~~ *Partially implemented: per-job tailoring shows present/missing keyword chips and rewrite suggestions. Remaining: standalone keyword comparison tool outside of job context* *(inspired by [Resume-Matcher](https://github.com/srbhr/Resume-Matcher))*
- ~~**AI provider failover**~~ — *Implemented: multi-key rotation with round-robin and auto-failover on rate limits. Cross-provider failover (e.g. Gemini → Claude) remains a future enhancement* *(inspired by [ai-job-scraper](https://github.com/anandanair/job-scraper))*
- **Application funnel charts** — visual weekly activity chart: applications sent, responses received, interviews booked; trend over time *(inspired by [JobSync](https://github.com/Gsync/jobsync))*

### Low Priority / Nice-to-Have
- **Browser extension** — one-click "Save job from LinkedIn/Indeed" directly into tracker
- **Interview notes** — per-application rich-text notes section; timestamps; searchable
- **Salary tracking** — ~~add expected / offered salary~~ *Partially implemented: salary extracted from job listings and displayed on cards. Remaining: manual salary entry on applications, offered vs expected comparison*
- **Multiple job boards** — integrate more sources (Dice, SimplyHired, AngelList, etc.)
- **AI interview prep** — generate interview questions based on the job description and your resume
- **Referral tracking** — record who referred you to a role; filter applications by referral
- **AI chat assistant** — conversational interface to ask questions about your job search ("why am I not getting responses?"), get personalized advice *(inspired by [JobSync](https://github.com/Gsync/jobsync))*
- **Multi-language cover letters** — generate cover letters in the target language when applying to international roles *(inspired by [Resume-Matcher](https://github.com/srbhr/Resume-Matcher))*
- **Resume section editor** — structured UI for editing resume sections (summary, skills, experience, education) with drag-and-drop reorder *(inspired by [Resume-Matcher](https://github.com/srbhr/Resume-Matcher))*
- **Time tracking** — log hours spent on job search activities; weekly summary in dashboard *(inspired by [JobSync](https://github.com/Gsync/jobsync))*

---

## 🗑️ Dropped / Won't Do

- **Self-signup** — intentionally invite-only to control access and costs
- **Resume builder** — out of scope; use a dedicated tool then paste/upload here
- **Job board scraping** — using SerpApi Google Jobs instead; scraping is fragile and violates ToS
