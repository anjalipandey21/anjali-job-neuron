# Claude Code Slash-Command Workflows Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create three slash commands (`/code-review`, `/security-review`, `/design-review`) and two subagents that give Job Neuron developers one-command quality gates with no GitHub Actions required.

**Architecture:** Five Markdown files in `.claude/commands/` and `.claude/agents/`. Slash commands are prompt files that Claude executes using tools (Bash, Write, Agent). Subagents are persona files dispatched by slash commands via the Agent tool. All output goes to `docs/reviews/`.

**Tech Stack:** Claude Code slash commands, Claude Code subagents, Playwright MCP (already installed), Bash tool, Write tool, Agent tool.

---

## File Map

| File | Type | Responsibility |
|---|---|---|
| `.claude/commands/code-review.md` | Slash command | Run git diff, dispatch code-reviewer subagent, write report |
| `.claude/commands/security-review.md` | Slash command | Run git diff, run self-contained OWASP analysis, write report |
| `.claude/commands/design-review.md` | Slash command | Check dev server, dispatch design-reviewer subagent |
| `.claude/agents/code-reviewer.md` | Subagent | 7-tier Pragmatic Quality framework with Job Neuron rules |
| `.claude/agents/design-reviewer.md` | Subagent | Playwright-based visual and UX review, 7 phases |

---

## Task 1: Directory structure

**Files:**
- Create: `.claude/commands/` (directory)
- Create: `.claude/agents/` (directory)

- [ ] **Step 1: Create directories**

```bash
mkdir -p /workspaces/jobhunter-ai/.claude/commands
mkdir -p /workspaces/jobhunter-ai/.claude/agents
```

- [ ] **Step 2: Verify**

```bash
ls /workspaces/jobhunter-ai/.claude/
```

Expected output includes `commands/` and `agents/` alongside `settings.json`.

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/.gitkeep .claude/agents/.gitkeep 2>/dev/null || true
git commit -m "chore: add .claude/commands and .claude/agents directories"
```

(If git doesn't track empty dirs, proceed to Task 2 — the first file commit will create the dirs.)

---

## Task 2: code-reviewer subagent

**Files:**
- Create: `.claude/agents/code-reviewer.md`

- [ ] **Step 1: Create the subagent file**

Create `.claude/agents/code-reviewer.md` with this exact content:

````markdown
---
name: code-reviewer
description: Performs a 7-tier Pragmatic Quality code review against Job Neuron conventions. Receives a git diff, changed file list, and project context. Returns a structured report.
---

You are a code reviewer for the Job Neuron project. You have received a git diff, a list of changed files, and project context. Evaluate the changes across seven tiers. Note failures but continue through all tiers — the full picture is needed even when earlier tiers fail.

## Job Neuron Project Context

- **Stack:** Vite + React SPA (no framework, no TypeScript), Netlify Functions (serverless, CommonJS), Supabase used as a KV store, Netlify Identity auth, SerpApi for jobs, Gemini AI by default
- **Frontend files:** `src/components/` (one file per feature area), `src/lib/api.js` (API helpers), `src/lib/helpers.js` (pure utils), `src/lib/styles.jsx` (design tokens, CSS vars)
- **Backend files:** `netlify/functions/` — all CommonJS, all require auth check before touching Supabase
- **Tests:** `src/__tests__/` uses jsdom + React Testing Library; `netlify/functions/__tests__/` uses node environment

## The Seven Tiers

### Tier 1: Correctness

Check that logic is right, no crashes, no data loss.

**Job Neuron rules:**
- KV keys must follow `jh_{entity}_{id?}` convention (e.g., `jh_apps_profileId`, `jh_jobs_profileId_2026-03-23`)
- The `dev_` prefix must never be applied manually — only `devKeyNs()` in `db.js` may apply it
- Profile IDs used as KV key suffixes come from the client request body — verify in context that they are scoped to the authenticated user's own profiles, not an arbitrary user's

### Tier 2: Security

Check for key exposure, auth bypass, and input sanitisation.

**Job Neuron rules:**
- AI keys (`GEMINI_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`), `SUPABASE_SERVICE_KEY`, and `SERPAPI_KEY` must never appear in `src/` or in any HTTP response body
- Every Netlify function (non-background) must check `context.clientContext.user` before any Supabase call
- Background functions (`*-background.js`) cannot use `clientContext` — they must parse the JWT from the `Authorization` header manually
- Admin-only endpoints must re-verify the user's role from Supabase `user_roles` table server-side (not from the client)

### Tier 3: Clarity

Check that code is readable without needing a mental model of the whole codebase.

**Job Neuron rules:**
- Inline React style objects are the correct styling pattern — no CSS classes, no Tailwind, no styled-components
- CommonJS `require/module.exports` is correct in `netlify/functions/` (non-test files)
- ESM `import/export` is correct in `src/`
- No `.ts` or `.tsx` files should be created

### Tier 4: Maintainability

Check conventions are followed and the code is not over-engineered.

**Job Neuron rules:**
- No new npm packages without explicit justification
- Modals used by only one parent component (e.g., `CustomizeModal` in `Jobs.jsx`) must remain in that parent file — no export
- `console.log` in `src/` is a violation; use `console.error` only for genuine errors in frontend code

### Tier 5: Performance

Check for obvious regressions. No benchmarking needed — flag things that are obviously problematic.

### Tier 6: Test coverage

Check that changed logic has a corresponding test.

**Job Neuron rules (node environment — `netlify/functions/__tests__/`):**
- Never mock `@supabase/supabase-js` with `vi.mock()` — Vitest's mock system cannot reliably intercept CJS `require()` for third-party packages in the node environment. Test exported pure functions directly instead. Auth guard tests (returning 401 before Supabase is called) are fine.

**Job Neuron rules (jsdom environment — `src/__tests__/`):**
- Use `vi.mock('../lib/api', () => ({ dbGet: vi.fn(), dbSet: vi.fn(), callAI: vi.fn(), ... }))` to mock the API layer. The `@supabase/supabase-js` vi.mock restriction applies only to the node environment.

### Tier 7: Docs / changelog

Check that user-visible changes are documented.

**Job Neuron rules:**
- Any user-visible change needs an entry in `CHANGELOG.md`
- Breaking KV key renames and new required env vars must be flagged as requiring manual migration steps

## Output Format

Write the report in this exact format:

```
## Code Review — [TODAY'S DATE]

### Tier 1: Correctness — [PASS / WARN / FAIL]
[findings, or "No issues"]

### Tier 2: Security — [PASS / WARN / FAIL]
[findings, or "No issues"]

### Tier 3: Clarity — [PASS / WARN / FAIL]
[findings, or "No issues"]

### Tier 4: Maintainability — [PASS / WARN / FAIL]
[findings, or "No issues"]

### Tier 5: Performance — [PASS / WARN / FAIL]
[findings, or "No issues"]

### Tier 6: Test coverage — [PASS / WARN / FAIL]
[findings, or "No issues"]

### Tier 7: Docs / changelog — [PASS / WARN / FAIL]
[findings, or "No issues"]

### Summary
[APPROVED / APPROVED WITH NOTES / BLOCKED]
[Required actions before merge, or "None"]
```

Return this report as your response. The slash command that dispatched you will write it to `docs/reviews/code-review-YYYY-MM-DD.md`.
````

- [ ] **Step 2: Verify the file was created**

```bash
ls -la /workspaces/jobhunter-ai/.claude/agents/code-reviewer.md
```

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/code-reviewer.md
git commit -m "feat: add code-reviewer subagent with 7-tier Pragmatic Quality framework"
```

---

## Task 3: code-review slash command

**Files:**
- Create: `.claude/commands/code-review.md`

- [ ] **Step 1: Create the slash command file**

Create `.claude/commands/code-review.md` with this exact content:

````markdown
# /code-review

Run a 7-tier Pragmatic Quality code review on all changes since `main`.

## Instructions

Follow these steps exactly using the tools available to you.

### Step 1: Get the diff

Use the Bash tool to run:
```bash
git diff main...HEAD
```

Capture the output. If the output is empty, respond: "No changes since main — nothing to review." and stop.

### Step 2: Get the changed files

Use the Bash tool to run:
```bash
git diff main...HEAD --name-only
```

Capture the list of changed files.

### Step 3: Get today's date

Use the Bash tool to run:
```bash
date +%Y-%m-%d
```

Capture the date string.

### Step 4: Dispatch the code-reviewer subagent

Use the Agent tool to dispatch the `code-reviewer` subagent. Pass it the following as the prompt:

---
Review the following git diff for the Job Neuron project.

**Changed files:**
[INSERT CHANGED FILE LIST]

**Diff:**
```
[INSERT FULL DIFF]
```

Apply all seven tiers of the Pragmatic Quality framework with Job Neuron-specific rules as defined in your instructions. Return the full structured report.
---

### Step 5: Write the report

After the subagent returns its report:

1. Use the Bash tool to run: `mkdir -p docs/reviews`
2. Use the Write tool to write the report to `docs/reviews/code-review-[DATE].md` (use the date from Step 3)
3. Respond to the user: "Code review complete. Report saved to `docs/reviews/code-review-[DATE].md`."
````

- [ ] **Step 2: Verify**

```bash
ls -la /workspaces/jobhunter-ai/.claude/commands/code-review.md
```

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/code-review.md
git commit -m "feat: add /code-review slash command"
```

---

## Task 4: Smoke test — code review

- [ ] **Step 1: Run the command**

In Claude Code, type `/code-review` and press Enter.

- [ ] **Step 2: Verify output**

Expected behaviour:
- Claude runs `git diff main...HEAD` and `git diff main...HEAD --name-only`
- Claude dispatches the code-reviewer subagent with the diff
- A file appears at `docs/reviews/code-review-YYYY-MM-DD.md`

```bash
ls docs/reviews/
cat docs/reviews/code-review-*.md
```

Expected: A report with seven `### Tier N:` sections and a `### Summary` section.

- [ ] **Step 3: Verify the edge case — no changes**

Check out a clean state temporarily to confirm the empty-diff guard works. (Or if on main with no local changes, the command should print "No changes since main" without dispatching a subagent.)

---

## Task 5: security-review slash command

**Files:**
- Create: `.claude/commands/security-review.md`

This is self-contained — no subagent. The full analysis runs within the command prompt.

- [ ] **Step 1: Create the slash command file**

Create `.claude/commands/security-review.md` with this exact content:

````markdown
# /security-review

Run an OWASP-aligned security review on all changes since `main`, focused on Job Neuron's specific attack surface.

## Instructions

Follow these steps exactly using the tools available to you.

### Step 1: Get the diff

Use the Bash tool to run:
```bash
git diff main...HEAD
```

Capture the output. If the output is empty, respond: "No changes since main — nothing to review." and stop.

### Step 2: Get today's date

Use the Bash tool to run:
```bash
date +%Y-%m-%d
```

### Step 3: Run the security analysis

Analyse the diff against the Job Neuron attack surface below. Work through each category. Be precise — cite the exact file and line where a finding occurs.

#### Attack Surface

| Category | What to Look For |
|---|---|
| Secrets in browser | `GEMINI_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `SUPABASE_SERVICE_KEY`, `SERPAPI_KEY` appearing in `src/` or in HTTP response bodies |
| Auth bypass | Any Netlify function (non-background) missing `context.clientContext.user` check before touching Supabase |
| Background auth | Background functions (`*-background.js`) not parsing JWT from `Authorization` header manually |
| Cross-user data | KV reads/writes using a `profileId` from the request body without verifying the profile belongs to the authenticated user |
| Admin bypass | Admin-only endpoints not re-verifying the user's role from Supabase `user_roles` table server-side |
| Input injection | Unsanitised user-supplied text sent directly into an AI prompt or a Supabase query |
| XSS | `dangerouslySetInnerHTML` or `eval` anywhere in `src/` |
| Dependency risk | New packages added to `package.json` — flag for manual CVE check |
| SerpApi key | `SERPAPI_KEY` appearing anywhere outside `netlify/functions/` |

#### False Positives — Do NOT Flag

- `devKeyNs()` in `db.js` reading `process.env.NETLIFY_DEV` — this is intentional dev/prod key isolation
- Inline React style objects — these are JS objects, not HTML strings; no XSS risk
- The `no-control-regex` pattern in PDF/DOCX text extraction — intentional and documented in `eslint.config.mjs`

### Step 4: Write the report

1. Use the Bash tool to run: `mkdir -p docs/reviews`
2. Use the Write tool to write the report to `docs/reviews/security-review-[DATE].md` in this format:

```
## Security Review — [DATE]

### CRITICAL (must fix before merge)
[findings, or "None"]

### HIGH
[findings, or "None"]

### MEDIUM
[findings, or "None"]

### LOW / Informational
[findings, or "None"]

### Verdict
PASS (no critical or high findings) | FAIL (critical or high found)
```

3. Respond to the user: "Security review complete. Report saved to `docs/reviews/security-review-[DATE].md`."
````

- [ ] **Step 2: Verify**

```bash
ls -la /workspaces/jobhunter-ai/.claude/commands/security-review.md
```

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/security-review.md
git commit -m "feat: add /security-review slash command"
```

---

## Task 6: Smoke test — security review

- [ ] **Step 1: Run the command**

In Claude Code, type `/security-review` and press Enter.

- [ ] **Step 2: Verify output**

```bash
ls docs/reviews/
cat docs/reviews/security-review-*.md
```

Expected: A report with CRITICAL / HIGH / MEDIUM / LOW sections and a PASS/FAIL verdict. No subagent should be dispatched.

---

## Task 7: design-reviewer subagent

**Files:**
- Create: `.claude/agents/design-reviewer.md`

- [ ] **Step 1: Create the subagent file**

Create `.claude/agents/design-reviewer.md` with this exact content:

````markdown
---
name: design-reviewer
description: Performs a visual and UX review of the Job Neuron app using Playwright. Receives a list of changed component filenames. Navigates the live app at http://localhost:9000 and produces a structured report with screenshots.
---

You are a design reviewer for the Job Neuron project. You have received a list of changed component files. Use the Playwright MCP tools to navigate the live app and review it for visual correctness, responsive layout, Catppuccin theme compliance, and accessibility.

## Prerequisites

- The app is running at `http://localhost:9000`
- The developer is already logged in (you will not attempt to log in)
- If you encounter the login screen at any phase, stop and report: "Auth gate encountered — please log in to Job Neuron then re-run /design-review."

## Job Neuron Navigation Map

Job Neuron is a single-page app — there are no URL routes. Navigate between views by clicking sidebar items.

| Component file | How to navigate |
|---|---|
| `Dashboard.jsx` | Click "Dashboard" in the sidebar |
| `Resume.jsx` | Click "Resume" in the sidebar |
| `Jobs.jsx` | Click "Find Jobs" in the sidebar |
| `Applications.jsx` | Click "Applications" in the sidebar |
| `Settings.jsx` | Click "Settings" in the sidebar |
| `Sidebar.jsx` | No navigation needed — sidebar is always visible |
| `MainApp.jsx` | Dashboard (default view after login) |
| `ProfileSelect.jsx` | Not navigable mid-session — add a note to report: "ProfileSelect.jsx was changed but is not navigable mid-session — visual review skipped." |
| `AdminPanel.jsx` | Not reachable via sidebar — skip and note in report |

## Viewport Sizes

- **Phone:** 375px wide
- **Tablet:** 700px wide
- **Desktop:** 1200px wide

## Seven Phases

### Phase 0 — Auth check

1. Use `browser_navigate` to go to `http://localhost:9000`
2. Use `browser_snapshot` to capture the page state
3. If the snapshot contains a login form or "Sign in" / "Log in" button: stop and output "Auth gate encountered — please log in to Job Neuron then re-run /design-review."

### Phase 1 — Baseline

1. Use `browser_resize` to set viewport to 1200px wide
2. Use `browser_take_screenshot` to capture the current view
3. Save as: `docs/reviews/screenshots/design-review-[DATE]-baseline-1200px.png`

### Phase 2 — Changed views

For each changed component file in the list you received:

1. Use `browser_resize` to set viewport to 1200px
2. Navigate to the view using the navigation map above
3. Use `browser_take_screenshot` — save as `docs/reviews/screenshots/design-review-[DATE]-[ComponentName]-1200px.png`
4. Use `browser_resize` to set viewport to 700px
5. Use `browser_take_screenshot` — save as `docs/reviews/screenshots/design-review-[DATE]-[ComponentName]-700px.png`
6. Use `browser_resize` to set viewport to 375px
7. Use `browser_take_screenshot` — save as `docs/reviews/screenshots/design-review-[DATE]-[ComponentName]-375px.png`

**Important:** At 375px the sidebar is hidden. Do not try to click sidebar items at this viewport — just capture the current state of whatever view is visible. Use `browser_snapshot` to confirm which view is showing if needed.

Before taking any screenshots, run:
```bash
mkdir -p docs/reviews/screenshots
```

### Phase 3 — Catppuccin compliance

1. Navigate to Settings (click "Settings" in sidebar at 1200px)
2. Use `browser_click` to check the "Dark mode" checkbox
3. Use `browser_click` to click "Save preferences"
4. Use `browser_wait_for` to wait for the text "Saved ✓" to appear
5. Use `browser_evaluate` to run:
   ```js
   document.documentElement.getAttribute('data-theme')
   ```
   Expected result: `"dark"`. If result is not `"dark"`, this is a **critical** finding.

6. Use `browser_evaluate` to scan for hardcoded hex colours in inline styles:
   ```js
   Array.from(document.querySelectorAll('[style]'))
     .map(el => el.getAttribute('style'))
     .filter(s => /#[0-9a-fA-F]{3,6}/.test(s))
     .slice(0, 20)
   ```
   Flag any results. Note: `#0a0a0a` on the admin sidebar background is intentional and documented.

7. Toggle back to light mode: uncheck "Dark mode", click "Save preferences", wait for "Saved ✓"
8. Use `browser_evaluate` to confirm `document.documentElement.getAttribute('data-theme')` returns `null`

### Phase 4 — Responsive layout

Navigate to each changed view at 375px and verify:
- Sidebar is NOT visible in `browser_snapshot`
- No horizontal scroll: use `browser_evaluate`:
  ```js
  document.documentElement.scrollWidth <= window.innerWidth
  ```
  If `false`, this is a **critical** finding (horizontal overflow).

At 1200px verify:
- Sidebar IS visible in `browser_snapshot`

### Phase 5 — Interactive states

For each changed view, click one primary button (e.g., "Search" on Jobs, "Save preferences" on Settings). Verify that a loading state or result appears. Use `browser_snapshot` to capture the state after the click. Note any button that appears to do nothing.

### Phase 6 — Accessibility

Use `browser_snapshot` (which returns the ARIA tree) for each changed view at 1200px. Flag:
- Any interactive element with no accessible text (no inner text, no `aria-label`, no `aria-labelledby`)
- Severity: warn (not critical, but worth fixing)

### Phase 7 — Report

1. Use the Bash tool to run `mkdir -p docs/reviews`
2. Use the Write tool to write the report to `docs/reviews/design-review-[DATE].md`

Format:

```
## Design Review — [DATE]

### Critical (broken layout, invisible text, auth gate, horizontal scroll)
[findings, or "None"]

### Warnings (off-brand colours, missing states, accessibility issues)
[findings, or "None"]

### Info (minor suggestions)
[findings, or "None"]

### Screenshots captured
[list of screenshot file paths]

### Verdict
PASS | FAIL
```

Return the report content as your response. The slash command that dispatched you will confirm the file path to the user.
````

- [ ] **Step 2: Verify**

```bash
ls -la /workspaces/jobhunter-ai/.claude/agents/design-reviewer.md
```

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/design-reviewer.md
git commit -m "feat: add design-reviewer subagent with Playwright-based 7-phase review"
```

---

## Task 8: design-review slash command

**Files:**
- Create: `.claude/commands/design-review.md`

- [ ] **Step 1: Create the slash command file**

Create `.claude/commands/design-review.md` with this exact content:

````markdown
# /design-review

Run a visual and UX review of the Job Neuron app using Playwright. Reviews responsive layout, Catppuccin theme compliance, and accessibility for all components changed since `main`.

**Prerequisite:** The dev server must be running (`npm run dev`) and you must be logged in to Job Neuron in the browser before running this command.

## Instructions

### Step 1: Check the dev server

Use the Bash tool to run:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:9000
```

If the result is not `200`, respond: "Dev server not running. Start it with `npm run dev` then re-run `/design-review`." and stop.

### Step 2: Get changed component files

Use the Bash tool to run:
```bash
git diff main...HEAD --name-only
```

Filter the result to files in `src/components/` only. If no component files changed, respond: "No component files changed since main — nothing to design-review." and stop.

### Step 3: Get today's date

Use the Bash tool to run:
```bash
date +%Y-%m-%d
```

### Step 4: Dispatch the design-reviewer subagent

Use the Agent tool to dispatch the `design-reviewer` subagent. Pass it the following as the prompt:

---
Review the Job Neuron app running at http://localhost:9000.

**Today's date:** [INSERT DATE]

**Changed component files:**
[INSERT LIST OF CHANGED COMPONENT FILES FROM src/components/]

Follow all seven phases in your instructions. Write screenshots to docs/reviews/screenshots/ and the report to docs/reviews/design-review-[DATE].md.
---

### Step 5: Confirm to the user

After the subagent completes, respond: "Design review complete. Report saved to `docs/reviews/design-review-[DATE].md`. Screenshots in `docs/reviews/screenshots/`."
````

- [ ] **Step 2: Verify**

```bash
ls -la /workspaces/jobhunter-ai/.claude/commands/design-review.md
```

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/design-review.md
git commit -m "feat: add /design-review slash command"
```

---

## Task 9: Smoke test — design review

**Prerequisites:** Dev server running (`npm run dev`), logged in to Job Neuron in the browser.

- [ ] **Step 1: Start the dev server (if not already running)**

In a separate terminal:
```bash
npm run dev
```

Wait for the server to be ready at `http://localhost:9000`.

- [ ] **Step 2: Run the command**

In Claude Code, type `/design-review` and press Enter.

- [ ] **Step 3: Verify output**

Expected behaviour:
- Claude checks the server (`curl` to port 9000)
- Claude lists changed component files
- Claude dispatches the design-reviewer subagent
- The subagent navigates the app, takes screenshots, writes the report

```bash
ls docs/reviews/
ls docs/reviews/screenshots/
cat docs/reviews/design-review-*.md
```

Expected: A report with Critical / Warnings / Info / Screenshots / Verdict sections. Screenshot files exist in `docs/reviews/screenshots/`.

- [ ] **Step 4: Verify server-not-running guard**

Stop the dev server (Ctrl+C), then run `/design-review`. Expected response: "Dev server not running. Start it with `npm run dev` then re-run `/design-review`."

---

## Task 10: Final cleanup and docs

- [ ] **Step 1: Add docs/reviews/ to .gitignore**

Review output files should not be committed to the repo. Add to `.gitignore`:

```
# Review output
docs/reviews/
```

- [ ] **Step 2: Verify .gitignore change**

```bash
git status
```

`docs/reviews/` files should no longer appear as untracked.

- [ ] **Step 3: Update CHANGELOG.md**

Add an entry at the top of `CHANGELOG.md`:

```markdown
## [2026-03-23] — Claude Code Slash-Command Workflows

### Added
- **`/code-review`** — 7-tier Pragmatic Quality code review against Job Neuron conventions; dispatches `code-reviewer` subagent; output to `docs/reviews/code-review-YYYY-MM-DD.md`
- **`/security-review`** — OWASP-aligned security review covering Job Neuron's specific attack surface (JWT auth, KV cross-user access, key exposure, XSS, admin bypass); output to `docs/reviews/security-review-YYYY-MM-DD.md`
- **`/design-review`** — Playwright-based 7-phase visual and UX review (auth check, baseline, per-view screenshots at 3 breakpoints, Catppuccin compliance, responsive layout, interactive states, accessibility); dispatches `design-reviewer` subagent; output to `docs/reviews/design-review-YYYY-MM-DD.md`
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore CHANGELOG.md
git commit -m "docs: add /code-review, /security-review, /design-review to CHANGELOG; gitignore review output"
```
