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
<diff>
[INSERT FULL DIFF]
</diff>

Apply all seven tiers of the Pragmatic Quality framework with Job Neuron-specific rules as defined in your instructions. Return the full structured report.
---

### Step 5: Write the report

After the subagent returns its report:

1. Use the Bash tool to run: `mkdir -p docs/reviews`
2. Use the Write tool to write the report to `docs/reviews/code-review-[DATE].md` (use the date from Step 3)
3. Respond to the user: "Code review complete. Report saved to `docs/reviews/code-review-[DATE].md`."
