# Design Spec: Claude Code Slash-Command Workflows

**Date:** 2026-03-23
**Status:** Approved (v3)

---

## Overview

Adapt three code-quality workflows from the OneRedOak/claude-code-workflows repository as local Claude Code slash commands and subagents. The result is five files in `.claude/commands/` and `.claude/agents/` that give Job Neuron developers one-command quality gates without any GitHub Actions or external CI dependencies.

---

## 1. File Structure

Five files total. Security review is intentionally self-contained (no subagent) because its analysis is short and linear; code review and design review use subagents because they produce long structured output that benefits from a dedicated agent context.

```
.claude/
├── commands/
│   ├── code-review.md       # Slash command: runs git diff, dispatches code-reviewer subagent
│   ├── security-review.md   # Slash command: self-contained OWASP-aligned analysis
│   └── design-review.md     # Slash command: checks server, dispatches design-reviewer subagent
└── agents/
    ├── code-reviewer.md     # Subagent: 7-tier Pragmatic Quality framework
    └── design-reviewer.md   # Subagent: Playwright-based visual + UX review
```

**Invocation:**
```
/code-review
/security-review
/design-review
```

---

## 2. Code Review

### Slash command (`code-review.md`)

The command prompt instructs Claude to:

1. Run `git diff main...HEAD` using the Bash tool and capture the output as `$DIFF`
2. Run `git diff main...HEAD --name-only` to capture the changed file list as `$FILES`
3. Invoke the Agent tool targeting the `code-reviewer` subagent (referenced by name `code-reviewer`) with a payload that embeds `$DIFF`, `$FILES`, and the Job Neuron context block defined below
4. After the subagent returns, run `mkdir -p docs/reviews` using the Bash tool, then write the subagent's output to `docs/reviews/code-review-YYYY-MM-DD.md` using the Write tool (date is today's date from `date +%Y-%m-%d`)
5. Print the path of the written file to the user

The command takes no `$ARGUMENTS`. If the diff is empty, print "No changes since main — nothing to review." and stop.

### Subagent (`code-reviewer.md`)

Receives the diff, file list, and context. Implements the **Pragmatic Quality** framework — seven tiers evaluated in order. A FAIL at any tier is noted but evaluation continues through all tiers so the full picture is captured.

| Tier | Name | Scope |
|---|---|---|
| 1 | Correctness | Logic is right, no crashes, no data loss |
| 2 | Security | No key exposure, auth enforced, input sanitised |
| 3 | Clarity | Code readable without a mental model of the whole app |
| 4 | Maintainability | Follows conventions, not over-engineered |
| 5 | Performance | No obvious regressions; efficiency where it matters |
| 6 | Test coverage | Changed logic has a corresponding test |
| 7 | Docs / changelog | User-visible changes documented |

**Job Neuron-specific rules injected per tier:**

- **Correctness**: KV keys must follow `jh_{entity}_{id?}` convention. The `dev_` prefix must never be manually applied — only `devKeyNs()` in `db.js` may apply it. Profile IDs embedded in KV key suffixes are client-supplied values — verify in context that they are scoped to the authenticated user's own profiles.
- **Security**: AI keys (`GEMINI_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`), `SUPABASE_SERVICE_KEY`, and `SERPAPI_KEY` must never appear in `src/` or in any HTTP response body. Every Netlify function (non-background) must check `context.clientContext.user` before any Supabase call. Background functions (`*-background.js`) must parse the JWT manually from the `Authorization` header — they cannot use `clientContext`. Admin-only endpoints must re-verify the user role server-side.
- **Clarity**: Inline React style objects are the correct styling pattern (no CSS classes, no Tailwind). CommonJS `require/module.exports` in `netlify/functions/` (non-test files). ESM `import/export` in `src/`. No `.ts/.tsx` files.
- **Maintainability**: No new npm dependencies without explicit justification. Modals used by only one parent (e.g., `CustomizeModal` in `Jobs.jsx`) must remain private in that file — no export. No `.ts/.tsx` files. `console.log` in `src/` is a violation; use `console.error` only for genuine errors.
- **Test coverage (node environment — netlify/functions/)**: Never mock `@supabase/supabase-js` with `vi.mock()` — Vitest's mock system cannot reliably intercept CJS `require()` for third-party packages. Test exported pure functions directly instead. Auth guard tests (returning 401 before Supabase is called) work fine. **Test coverage (jsdom environment — src/)**: Use `vi.mock('../lib/api', () => ({ dbGet: vi.fn(), dbSet: vi.fn(), ... }))` pattern. The `@supabase/supabase-js` restriction applies only to the node environment.
- **Docs**: Any user-visible change needs a CHANGELOG entry. Breaking KV key renames and new env vars must be flagged as requiring manual migration steps.

**Output format** (written to `docs/reviews/code-review-YYYY-MM-DD.md`):

```markdown
## Code Review — YYYY-MM-DD

### Tier 1: Correctness — PASS / WARN / FAIL
<findings or "No issues">

### Tier 2: Security — PASS / WARN / FAIL
<findings or "No issues">

### Tier 3: Clarity — PASS / WARN / FAIL
<findings or "No issues">

### Tier 4: Maintainability — PASS / WARN / FAIL
<findings or "No issues">

### Tier 5: Performance — PASS / WARN / FAIL
<findings or "No issues">

### Tier 6: Test coverage — PASS / WARN / FAIL
<findings or "No issues">

### Tier 7: Docs / changelog — PASS / WARN / FAIL
<findings or "No issues">

### Summary
<overall verdict — APPROVED / APPROVED WITH NOTES / BLOCKED>
<required actions before merge, or "None">
```

---

## 3. Security Review

### Slash command (`security-review.md`)

Self-contained — no subagent. This is intentional: security analysis is linear and fits within a single prompt context. The command prompt instructs Claude to:

1. Run `git diff main...HEAD` using the Bash tool
2. Run the OWASP-aligned analysis defined below against the diff
3. Run `mkdir -p docs/reviews` using the Bash tool
4. Write the output to `docs/reviews/security-review-YYYY-MM-DD.md` using the Write tool
5. Print the path to the user

If the diff is empty, print "No changes since main — nothing to review." and stop.

**Job Neuron attack surface (what to look for):**

| Category | Specific Risk |
|---|---|
| Secrets in browser | `GEMINI_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `SUPABASE_SERVICE_KEY`, `SERPAPI_KEY` appearing in `src/` or in HTTP response bodies |
| Auth bypass | Any Netlify function (non-background) missing `context.clientContext.user` check before touching data |
| Background auth | Background functions (`*-background.js`) not parsing JWT from `Authorization` header |
| Cross-user data | KV reads/writes using a `profileId` from the request body without verifying the profile belongs to the authenticated user |
| Admin bypass | Admin-only endpoints not re-verifying the user's role server-side (role must come from Supabase `user_roles` table, not from the client) |
| Input injection | Unsanitised user-supplied text sent directly into an AI prompt or a Supabase query |
| XSS | `dangerouslySetInnerHTML` or `eval` anywhere in `src/` |
| Dependency risk | New packages added to `package.json` — flag for manual CVE check |
| SerpApi key | `SERPAPI_KEY` appearing anywhere outside `netlify/functions/` |

**Job Neuron false-positive exclusions (do NOT flag):**

- `devKeyNs()` reading `process.env.NETLIFY_DEV` in `db.js` — this is intentional dev/prod isolation, not an environment variable leak
- Inline React style objects — no XSS risk; they are not parsed as HTML
- `no-control-regex` pattern in PDF/DOCX text extraction — intentional and documented in `eslint.config.mjs`

**Output format** (written to `docs/reviews/security-review-YYYY-MM-DD.md`):

```markdown
## Security Review — YYYY-MM-DD

### CRITICAL (must fix before merge)
<findings or "None">

### HIGH
<findings or "None">

### MEDIUM
<findings or "None">

### LOW / Informational
<findings or "None">

### Verdict
PASS (no critical or high findings) | FAIL (critical or high found)
```

---

## 4. Design Review

### Slash command (`design-review.md`)

The command prompt instructs Claude to:

1. Check whether the dev server is running: use the Bash tool to run `curl -s -o /dev/null -w "%{http_code}" http://localhost:9000` — if the result is not `200`, print: "Dev server not running. Start it with `npm run dev` then re-run `/design-review`." and stop.
2. Run `git diff main...HEAD --name-only` to capture changed files, then filter to component files in `src/components/` for the subagent
3. Invoke the Agent tool targeting the `design-reviewer` subagent with the changed component filenames and the context block below
4. After the subagent returns, print the path of the written report file to the user

**Prerequisite (must be stated in the command prompt):** The developer must be logged in to Job Neuron in their browser before running this command. The design-reviewer subagent uses Playwright to navigate the live app and will encounter the Netlify Identity login screen if not authenticated. The subagent should not attempt to log in — if it sees the login screen, it should report "Auth gate encountered — developer must be logged in" and stop.

### Subagent (`design-reviewer.md`)

Receives the list of changed component files and uses Playwright MCP tools to navigate the live app at `http://localhost:9000`. Seven phases:

**Phase 0 — Auth check**: Navigate to `http://localhost:9000`. Take a snapshot. If the snapshot shows a login form or "Sign in" button, stop and report: "Auth gate encountered — please log in to Job Neuron then re-run /design-review."

**Phase 1 — Baseline**: At 1200px viewport, take a screenshot of the current view. Save as `docs/reviews/screenshots/design-review-YYYY-MM-DD-baseline-1200px.png`. This is the baseline.

**Phase 2 — Changed views**: For each changed component file, navigate to that view using the sidebar. Use this filename-to-nav mapping:

| Component file | Navigation action |
|---|---|
| `Sidebar.jsx` | No navigation needed — sidebar is always visible |
| `Dashboard.jsx` | Click "Dashboard" in the sidebar |
| `Resume.jsx` | Click "Resume" in the sidebar |
| `Jobs.jsx` | Click "Find Jobs" in the sidebar |
| `Applications.jsx` | Click "Applications" in the sidebar |
| `Settings.jsx` | Click "Settings" in the sidebar |
| `ProfileSelect.jsx` | Not reachable via sidebar — screenshot at login/profile select state only if already on that screen |
| `MainApp.jsx` | Dashboard (the default view after login) |
| `AdminPanel.jsx` | Not reachable via sidebar — skip unless user is admin |

After navigating to each view, take screenshots at all three viewport widths: 375px, 700px, 1200px. **Important:** Navigate to each view at 1200px first (sidebar visible), then resize to 700px and 375px to capture responsive states. At 375px the sidebar is hidden — use `browser_snapshot` to confirm the current view rather than clicking sidebar items (which are not visible at this breakpoint). For components where `ProfileSelect.jsx` is in the changed list and cannot be reached via sidebar, add a note to the report: "ProfileSelect.jsx was changed but is not navigable mid-session — visual review skipped."

Screenshot filename convention: `docs/reviews/screenshots/design-review-YYYY-MM-DD-{ComponentName}-{viewport}px.png`
Example: `docs/reviews/screenshots/design-review-2026-03-23-Jobs-375px.png`

If a screenshot file with the same name exists from a previous same-day run, it is overwritten. Create the `docs/reviews/screenshots/` directory first with a Bash tool call `mkdir -p docs/reviews/screenshots`.

**Phase 3 — Catppuccin compliance**: Navigate to Settings. Toggle the "Dark mode" checkbox (label: "Dark mode") and click "Save preferences". Wait for "Saved ✓" to appear. **Note:** This saves the dark mode preference to the database, which is a side effect of the review. After Phase 3 completes, toggle back to the original theme state and save again to restore the user's preference. Then use `browser_evaluate` to run:
```js
document.documentElement.getAttribute('data-theme')
```
Confirm the result is `"dark"`. Repeat to confirm light mode returns `null`. This verifies the theme system is wired correctly.

To check CSS variable usage vs. hardcoded hex colours, use `browser_evaluate` to run:
```js
Array.from(document.querySelectorAll('[style]'))
  .map(el => el.getAttribute('style'))
  .filter(s => /#[0-9a-fA-F]{3,6}/.test(s))
  .slice(0, 10)
```
Flag any hardcoded hex values found. Note: some hardcoded values are intentional (e.g., the admin sidebar background `#0a0a0a` is documented as intentional in CHANGELOG). Cross-reference `src/lib/styles.jsx` for the list of CSS custom properties — any inline style referencing a colour value that is not a `var(--...)` call is worth flagging.

**Phase 4 — Responsive layout**: Verify at each breakpoint:
- **375px (phone)**: Sidebar must be hidden (not visible in snapshot). Modals (open one if accessible) must render as bottom sheets. No horizontal scroll (`browser_evaluate`: `document.documentElement.scrollWidth <= window.innerWidth`).
- **700px (tablet)**: Single-column layout acceptable. No horizontal scroll.
- **1200px (desktop)**: Sidebar must be visible in snapshot. Standard centred modals (not bottom sheets).

**Phase 5 — Interactive states**: Click one primary button per changed view (e.g., "Find Jobs" button on the Jobs view). Verify loading spinner appears. If an error state is triggerable (e.g., network offline), note it as info — do not force errors.

**Phase 6 — Accessibility check**: Use `browser_snapshot` to get the ARIA tree. Verify focus-ring visibility on buttons by evaluating `:focus-visible` styles. Flag any `<button>` or `<a>` elements with no accessible text (no inner text and no `aria-label`).

**Phase 7 — Report**: Write findings to `docs/reviews/design-review-YYYY-MM-DD.md` using the Write tool. For each finding: severity, description, screenshot filename (if applicable), suggested fix.

**Output format** (written to `docs/reviews/design-review-YYYY-MM-DD.md`):

```markdown
## Design Review — YYYY-MM-DD

### Critical (broken layout, invisible text, auth gate)
<findings or "None">

### Warnings (off-brand colours, missing hover states, layout issues)
<findings or "None">

### Info (minor suggestions)
<findings or "None">

### Screenshots captured
- docs/reviews/screenshots/design-review-YYYY-MM-DD-Jobs-375px.png
- ...

### Verdict
PASS | FAIL
```

---

## 5. Shared Constraints

- **JavaScript only** — command/agent files are Markdown; no new `.ts` files
- **No new npm packages** — Playwright is provided via MCP; no additional installs
- **No GitHub Actions** — all workflows are local slash commands only
- **Output directory**: `docs/reviews/` — each command creates it with `mkdir -p docs/reviews` before writing
- **Screenshots directory**: `docs/reviews/screenshots/` — created by design-reviewer subagent with `mkdir -p docs/reviews/screenshots`
- **Idempotent filenames**: Reviews named `YYYY-MM-DD`; re-running same day overwrites the `.md` file and any screenshots with matching names (prior run's files are lost; this is acceptable)

---

## 6. Out of Scope

- GitHub Actions integration (deferred; would require `ANTHROPIC_API_KEY` in GitHub Secrets and workflow YAML)
- Automated scheduling or pre-commit hooks
- Coverage threshold enforcement (test coverage assessed qualitatively in code-review tier 6)
- Automated login in design-reviewer (auth is a prerequisite, not a step)
