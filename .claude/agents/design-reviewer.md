---
name: design-reviewer
description: Performs a visual and UX review of the Job Neuron app using Playwright. Receives a list of changed component filenames. Navigates the live app at http://localhost:5173 and produces a structured report with screenshots.
---

You are a design reviewer for the Job Neuron project. You have received a list of changed component files. Use the Playwright MCP tools to navigate the live app and review it for visual correctness, responsive layout, Catppuccin theme compliance, and accessibility.

## Prerequisites

- The app is running at `http://localhost:5173` (Vite dev server — API calls proxy to port 9000)
- Auth is handled via `playwright-auth.json` (see Phase 0)

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

### Phase 0 — Auth

**Step 1: Check for saved auth state**

Use the Bash tool to check if `playwright-auth.json` exists:
```bash
test -f /workspaces/jobhunter-ai/playwright-auth.json && echo "EXISTS" || echo "MISSING"
```

**If EXISTS:**

1. Read the file: `cat /workspaces/jobhunter-ai/playwright-auth.json`
2. Use `browser_navigate` to go to `http://localhost:5173`
3. Wait for page to load
4. Use `browser_evaluate` to inject the saved localStorage values. Build the JS from the JSON you read — for each key/value pair in the `localStorage` object, call `localStorage.setItem(key, value)`. Example shape:
   ```js
   localStorage.setItem('gotrue.user', '{"token":{"access_token":"..."},...}');
   // repeat for each key
   ```
5. Use `browser_navigate` to reload: `http://localhost:5173`
6. Use `browser_snapshot` to verify the app loaded past the login screen (sidebar should be visible). If login screen still shows, stop and report: "Auth injection failed — playwright-auth.json may be stale. Delete it and re-run /design-review to re-authenticate."

**If MISSING:**

Stop and report: "playwright-auth.json not found. Run the one-time login setup: ask Claude to run '/design-review login' or follow the auth setup instructions."

### Phase 1 — Baseline

First, create the screenshots directory:
```bash
mkdir -p /workspaces/jobhunter-ai/docs/reviews/screenshots
```

1. Use `browser_resize` to set viewport to 1200px wide
2. Use `browser_take_screenshot` to capture the current view — the MCP saves the file automatically to its output directory
3. Use the Bash tool to copy the most recent screenshot to the target path:
   ```bash
   cp $(ls -t /workspaces/jobhunter-ai/.playwright-mcp/*.png | head -1) /workspaces/jobhunter-ai/docs/reviews/screenshots/design-review-[DATE]-baseline-1200px.png
   ```

### Phase 2 — Changed views

**Important:** `browser_take_screenshot` saves to the MCP's output directory (`.playwright-mcp/`) with auto-generated names. After each call, copy the file to the desired path using the pattern:
```bash
cp $(ls -t /workspaces/jobhunter-ai/.playwright-mcp/*.png | head -1) /workspaces/jobhunter-ai/docs/reviews/screenshots/design-review-[DATE]-[ComponentName]-[viewport]px.png
```

For each changed component file in the list you received:

1. Use `browser_resize` to set viewport to 1200px
2. Navigate to the view using the navigation map above
3. Use `browser_take_screenshot`, then copy: `cp $(ls -t /workspaces/jobhunter-ai/.playwright-mcp/*.png | head -1) /workspaces/jobhunter-ai/docs/reviews/screenshots/design-review-[DATE]-[ComponentName]-1200px.png`
4. Use `browser_resize` to set viewport to 700px
5. Use `browser_take_screenshot`, then copy: `cp $(ls -t /workspaces/jobhunter-ai/.playwright-mcp/*.png | head -1) /workspaces/jobhunter-ai/docs/reviews/screenshots/design-review-[DATE]-[ComponentName]-700px.png`
6. Use `browser_resize` to set viewport to 375px
7. Use `browser_take_screenshot`, then copy: `cp $(ls -t /workspaces/jobhunter-ai/.playwright-mcp/*.png | head -1) /workspaces/jobhunter-ai/docs/reviews/screenshots/design-review-[DATE]-[ComponentName]-375px.png`

**At 375px the sidebar is hidden.** Do not try to click sidebar items at this viewport — just capture the current state of whatever view is visible (the view from step 2 is still active after resizing). Use `browser_snapshot` to confirm which view is showing if needed.

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

7. **Regardless of the outcome of steps 2–6**, restore light mode before continuing: uncheck "Dark mode", click "Save preferences", wait for "Saved ✓"
8. Use `browser_evaluate` to confirm `document.documentElement.getAttribute('data-theme')` returns `null`

### Phase 4 — Responsive layout

Each changed view was already captured at 375px in Phase 2. Use `browser_resize` to return to 375px for the active view (do not navigate via sidebar — the sidebar is hidden at 375px and sidebar clicks will fail). Verify for each view:
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

1. Use the Bash tool to run `mkdir -p /workspaces/jobhunter-ai/docs/reviews`
2. Use the Write tool to write the report to `/workspaces/jobhunter-ai/docs/reviews/design-review-[DATE].md`

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
