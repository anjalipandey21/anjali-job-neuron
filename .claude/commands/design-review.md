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
