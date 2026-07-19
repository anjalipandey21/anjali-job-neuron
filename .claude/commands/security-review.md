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
