# Per-Job Resume Tailoring — Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Feature:** High-priority backlog item — per-job resume tailoring

---

## Overview

Users need to adapt their resume to specific job descriptions. The app already supports multiple profiles (one per target role), so each profile's resume is already role-focused. Per-job tailoring is the final layer: a targeted refinement of that role-specific resume to match a particular posting.

The feature produces two outputs:
1. **Gap analysis** — scored breakdown of resume sections vs job requirements, showing which sections are strong, weak, or poor
2. **Specific rewrite suggestions** — before/after pairs for the top 3–5 weak bullets/sections, each with a plain-English reason

Results are **read-and-copy only** — no resume version is saved. Resume versioning is a separate backlog item and will be done properly when it ships.

---

## User-Facing Behaviour

### Entry Point

A **"Tailor resume"** button is added to each `JobCard` in the Find Jobs page, sitting alongside the existing "Customize resume" button. The button is **disabled** when `!profileData?.resumeText` (no resume text saved). The disabled state renders at `opacity: 0.5` with `disabled` attribute, same visual pattern as the "Find jobs" button — but the condition is `!resumeText`, not `!analyzedResume`, because tailoring requires the raw resume text, not the analyzed resume data.

### Modal Flow

1. User clicks "Tailor resume" on a job card
2. `TailorModal` opens and immediately fires a background AI call
3. A spinner with polling status updates is shown while the job runs (same UX as the ATS scan)
4. On completion the modal renders three sections:
   - **Gap Analysis** — section scores with progress bars and detail text
   - **Rewrite Suggestions** — before/after cards with individual copy buttons
   - **Keywords** — present vs missing keyword chips

### Result Caching

If `job.tailorResult` is already set on the job object, the modal skips the AI call and renders immediately. This avoids duplicate API calls on re-open (same pattern as `job.customResume` in `CustomizeModal`).

---

## Architecture

### Component

**`TailorModal`** — private component co-located in `src/components/Jobs.jsx`, not exported. Follows the exact same pattern as the existing `CustomizeModal` and `ApplyModal` in that file.

**`JobCard`** — gains an `onTailor` prop and a "Tailor resume" button that calls `onTailor(job)`. Updated signature: `{ job, onApply, onCustomize, onTailor, onSkip }`. The `Jobs` component gains `tailorJob` state (mirrors `customizeJob`) and passes `onTailor={(j) => setTailorJob(j)}` to each `JobCard`.

### AI Call

Uses the existing background job pipeline — no new Netlify functions required:

```
callAIBackground(messages, { tokens: 6000, type: 'resume_tailor', onStatus: setStatus })
  → ai-bg-background.js
  → ai-status.js (polled every 3s)
```

`onStatus` receives raw `bg_jobs.status` enum values as they change during polling: `'processing'` → `'done'` or `'error'`. The modal maps these to display text: `'processing'` → `"Analysing your resume…"`. No richer status feed is available — this is the same behaviour as the ATS scan.

`type: 'resume_tailor'` is a new label value stored in `bg_jobs.type`. No backend code change is needed — it's just a string identifier.

### AI Prompt Input

```
Job: {title} at {company}
Location: {location}
Description: {description} (up to 400 chars)
Qualifications: {(job.highlights || []).find(h => h.title === 'Qualifications')?.items?.slice(0, 5)} (up to 5 items, omitted if not present)

Candidate resume:
{resumeText} (truncated to 3500 chars, control chars stripped)

Return ONLY valid JSON:
{schema}
```

The prompt ends with `Return ONLY valid JSON:` followed by the schema — consistent with every other AI call in the codebase (`CustomizeModal`, ATS scan in `Resume.jsx`).

### AI Output Schema

```json
{
  "overallMatch": 72,
  "matchLabel": "Moderate",
  "sections": [
    {
      "name": "Skills",
      "score": 85,
      "status": "strong",
      "detail": "Python, SQL, AWS all present — strong alignment"
    },
    {
      "name": "Experience",
      "score": 55,
      "status": "weak",
      "detail": "Missing scale metrics and Airflow / dbt references"
    },
    {
      "name": "Summary",
      "score": 40,
      "status": "poor",
      "detail": "Too generic — no mention of data engineering focus"
    }
  ],
  "rewrites": [
    {
      "section": "Experience",
      "original": "Built data pipelines using Python",
      "suggested": "Designed and maintained production ETL pipelines in Python + Apache Airflow, processing 50M+ daily events with 99.9% uptime",
      "reason": "Adds tooling match (Airflow), scale, and reliability metric"
    }
  ],
  "missingKeywords": ["Airflow", "dbt", "Spark"],
  "presentKeywords": ["Python", "SQL", "AWS"]
}
```

`status` values: `"strong"` | `"weak"` | `"poor"` (maps to green / amber / red in the UI).

`matchLabel` values: `"Strong"` | `"Good"` | `"Moderate"` | `"Weak"` | `"Poor"` — rendered as a text label next to the overall score number. The UI does not branch on `matchLabel`; it is display-only.

`rewrites` may be an empty array `[]` if the resume is already well-aligned. When empty, the Rewrite Suggestions section renders: _"No specific rewrites needed — your resume is already well-aligned for this role."_

`callAIBackground` resolves to a **raw text string** (`data.text || ''`). Pass this string to `parseJSON()` from `src/lib/helpers.js` to extract the JSON object. Do not try to use the resolved value directly as an object.

### Data Persistence

None beyond the in-memory cache. After the background call succeeds and results are parsed, `TailorModal` calls an `onSave(jobId, result)` callback (same pattern as `CustomizeModal`'s `onSave`). The `Jobs` component implements `handleTailorSave(jobId, tailorResult)` which sets `job.tailorResult` on the matching job in `jobs` state — so re-opening the modal skips the AI call. No new KV keys. No `dbSet` calls.

---

## Files Changed

| File | Change |
|---|---|
| `src/components/Jobs.jsx` | Add `TailorModal` component (private); add "Tailor resume" button to `JobCard`; add `tailorJob` state and `handleTailorSave` to `Jobs` |
| `src/components/ProfileSelect.jsx` | Replace hardcoded colors with CSS variables |
| `src/components/Settings.jsx` | Replace hardcoded colors with CSS variables |
| `src/components/MainApp.jsx` | Replace hardcoded loading text color with CSS variable |
| `src/App.jsx` | Move `GlobalStyles` up from `JobHunterApp` into `App` so CSS vars are available on login/splash screens; replace hardcoded login screen colors |
| `src/AdminPanel.jsx` | Replace hardcoded content-area colors with CSS variables (intentional dark sidebar kept as-is) |

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| No resume saved (`!resumeText`) | "Tailor resume" button disabled (`opacity: 0.5`, `disabled` attr); no modal opens |
| Job description too short (< 100 chars) | Inline error in modal: "Not enough job description to analyse. Try a job with a full description." |
| Background job returns `status: 'error'` | Show error message + "Try again" button that re-fires the background call |
| `parseJSON()` returns null | Treated as AI error — same "Try again" path |
| Poll timeout (5 min) | "Analysis timed out. Try again." — same as existing `callAIBackground` timeout |

---

## Testing

All tests added to `src/__tests__/Jobs.test.jsx` (extend existing file). No new test files.

The existing `vi.mock('../lib/api', ...)` at the top of `Jobs.test.jsx` must be extended to include `callAIBackground: vi.fn()` alongside the existing mocked exports.

| Test | Setup | Assertion |
|---|---|---|
| Loading state renders | `callAIBackground` returns a never-resolving promise | `screen.getByRole('status')` or spinner element present; status text visible |
| Results render correctly | `callAIBackground` mocked as `vi.fn().mockResolvedValue(JSON.stringify(fixture))` where `fixture` matches the output schema (raw JSON string, not object) | `screen.getByText('Gap Analysis')`, `screen.getByText('Rewrite Suggestions')`, `screen.getByText('Keywords')` all present; at least one section name from fixture visible |
| Error state renders | `callAIBackground` rejects with `new Error('fail')` | `screen.getByText(/try again/i)` present; error message text visible |
| Button disabled without resume | Profile fixture has `resumeText: ''` | `screen.getByRole('button', { name: /tailor resume/i })` has `disabled` attribute |

CSS variable cleanup changes are visual-only; existing render tests provide sufficient regression coverage.

---

## Out of Scope

- Saving tailored resume versions (belongs to the Resume Versioning backlog item)
- Applying rewrite suggestions in-place (belongs to the Resume Section Editor backlog item)
- Re-running tailoring for individual sections only (can be added later if needed)
- `AdminPanel.jsx` dark sidebar theming (intentional design choice, separate discussion)
- `App.jsx` pre-auth screen full dark-mode support beyond CSS var propagation
