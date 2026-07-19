# Design Spec: SerpApi Job Search + Job Expiry Checker

**Date:** 2026-03-18
**Status:** Approved
**Scope:** Replace JSearch (RapidAPI) with SerpApi Google Jobs; implement job link expiry checker (fetch-time + scheduled); filter applied jobs from search results; surface richer job data in UI.

---

## 1. Overview

This spec covers two related features:

1. **SerpApi migration** — swap the job-fetch layer from JSearch (RapidAPI) to SerpApi Google Jobs, extracting and displaying significantly richer data (structured highlights, benefits, company logo, multiple apply links, source platform).
2. **Job expiry checker** — validate apply links at fetch time (drop dead links before storing), and re-check stored jobs on a daily schedule (flag expired jobs in the UI).

Additional improvements bundled with the migration:
- Configurable date window per profile: 30 or 60 days (default 30)
- Filter out jobs the user has already applied to, before AI scoring
- Source-prioritised sorting: LinkedIn / Indeed / Glassdoor surface first

---

## 2. Architecture

### New files

| File | Purpose |
|---|---|
| `netlify/functions/lib/job-providers/serpapi.js` | SerpApi HTTP call, response normalisation, source prioritisation, apply-link selection |
| `netlify/functions/lib/expiry-checker.js` | `isLinkAlive` + `validateJobLinks` — shared by fetch-time and scheduled checker |
| `netlify/functions/check-job-expiry-background.js` | Scheduled Netlify background function — daily re-check of stored jobs |
| `netlify/functions/__tests__/serpapi.test.js` | Unit tests for normalisation, link selection, date parsing |
| `netlify/functions/__tests__/expiry-checker.test.js` | Unit tests for HEAD-check logic |

### Modified files

| File | Change |
|---|---|
| `netlify/functions/lib/job-search-core.js` | `fetchJobs()` delegates to `serpapi.js`; receives `userId`/`profileId` and `dateWindowDays` to load applied-jobs index and apply date filter; calls `validateJobLinks` after quality filter; `is60DaysOld` → `isWithinDateWindow(days)`; `isReputableSource` updated to use normalised `url`/`links` fields |
| `netlify/functions/jobs-search.js` | Pass `profileId` and `dateWindowDays` through to `fetchAndScoreJobs` |
| `netlify/functions/scheduled-job-search-background.js` | Pass `profileId` through to `fetchAndScoreJobs` |
| `netlify/functions/__tests__/jobs-search.test.js` | Update `makeJob` helper to SerpApi-normalised field names; update `isReputableSource` tests |
| `netlify.toml` | Register `check-job-expiry-background` scheduled function with `timeout = 900` |
| `src/components/Jobs.jsx` | Show amber "May no longer be available" banner on `job.expired === true`; render company logo, benefits badges, highlights; write to `jh_applied_urls_{profileId}` in `handleApply()` |
| `src/components/Applications.jsx` | Remove entry from `jh_applied_urls_{profileId}` when status changes away from `"Applied"` in `updateStatus()` |
| `src/components/Settings.jsx` | Add "Date window" toggle (30 days / 60 days) to the Job Search preferences card; saved to `jh_p_{profileId}` |
| `.env.example` + `CLAUDE.md` + `README.md` | Swap `RAPIDAPI_KEY` → `SERPAPI_KEY` |

### Unchanged
`applyQualityFilters`, `getBestLink`, the AI scoring pipeline, all auth logic, all other Netlify functions.

### Modified quality-filter functions (field name updates only)

The following functions are listed as "Unchanged" in spirit (logic stays identical) but **must have their internal field access updated** from JSearch raw field names to the normalised shape field names. Failing to do so would silently produce empty strings for all fields, breaking deduplication and filtering.

| Function | JSearch field → normalised field |
|---|---|
| `isStaffingAgency` | `j.employer_name` → `j.company`; `j.job_description` → `j.description` |
| `hasGoodDescription` | `j.job_description` → `j.description` |
| `deduplicateSimilar` | `j.job_title` → `j.title`; `j.employer_name` → `j.company` |
| `isReputableSource` | `j.job_apply_link`, `j.job_google_link`, `j.employer_website` → `j.url` + `j.links[].link` |

`applyQualityFilters` calls these functions by reference and needs no change beyond the functions themselves being updated. Tests for all four functions must be updated to use normalised field names.

---

## 3. SerpApi Provider (`serpapi.js`)

### API call

```
GET https://serpapi.com/search
  ?engine=google_jobs
  &q=<query>
  &location=<location>
  &date_posted=month        ← last 30 days, server-side filter
  &api_key=<SERPAPI_KEY>
```

Returns up to 10 results per call (page 1 only for now; pagination planned for future — add TODO comment in code).

### Adaptive query logic

- Custom query provided → 1 API call (1 credit)
- No custom query → 5 parallel calls using `ROLE_QUERIES` array (5 credits), same role categories as today

### Response → internal job shape

| SerpApi field | Internal field | Notes |
|---|---|---|
| `title` | `title` | direct |
| `company_name` | `company` | direct |
| `location` | `location` | as-is |
| `via` | `sourcePlatform` | e.g. `"GitHub Careers"`, `"LinkedIn"` |
| `thumbnail` | `companyLogo` | company logo URL; `""` if absent |
| `description` | `description` | first 400 chars |
| `job_highlights` | `highlights` | structured `{title, items[]}` array — Qualifications, Responsibilities, Benefits |
| `detected_extensions.posted_at` | `postedAt` | parsed via `parseRelativeDate()` → ISO datetime |
| `detected_extensions.schedule_type` | `jobType` | `"Full-time"` |
| `detected_extensions.health_insurance` | `benefits.healthInsurance` | boolean |
| `detected_extensions.paid_time_off` | `benefits.paidTimeOff` | boolean |
| `detected_extensions.dental_coverage` | `benefits.dental` | boolean |
| `apply_options` | `links` | all `{title, link}` entries, used as labelled apply buttons |
| `apply_options` (best) | `url` | primary CTA — see priority logic below |
| `job_id` | `serpApiJobId` | stored on the normalised job object; used for dedup and applied-job filtering |

`serpApiJobId` is a stable base64 string provided by SerpApi. It is preserved on the normalised job shape so it can be written to `jh_applied_urls_{profileId}` when the user applies and matched against in subsequent searches. The internal ephemeral `id` field (generated by `uidGen()`) is retained for UI keying only and is not used for matching.

### Apply link priority (from `apply_options` array)

1. First entry whose title is not a known aggregator (direct company careers page)
2. LinkedIn
3. Indeed
4. Glassdoor
5. First entry as fallback

Known aggregators: LinkedIn, Indeed, Glassdoor, ZipRecruiter, Monster, Dice, Top Jobs Today, HiringCafe, VirtualInterview.ai, JobScroller, FactoryFix, Talentify, Job Abstracts, Experteer, Snagajob.

### Source sort order (before AI scoring reorders by match %)

1. `via` matches LinkedIn / Indeed / Glassdoor
2. Other known boards
3. Direct company career pages
4. Unknown

### `isReputableSource` — adapted to normalised fields

`isReputableSource` currently checks JSearch-specific fields (`job_apply_link`, `job_google_link`, `employer_website`). After migration it operates on the normalised shape, checking `job.url` and all `job.links[].link` URLs against `REPUTABLE_SOURCES`. The `REPUTABLE_SOURCES` list is unchanged. The function signature and export are unchanged — only the field access inside is updated.

### Configurable date window

The date filter window is stored per-profile in `jh_p_{profileId}` as `preferences.dateWindowDays`. Valid values: `30` (default) or `60`.

`isWithinDateWindow(postedAt, days)` replaces `is60DaysOld` — same logic, threshold driven by `days` parameter.

The SerpApi `date_posted` API parameter:
- `30` days → `date_posted=month` (server-side filter, reduces results returned)
- `60` days → `date_posted` parameter omitted (SerpApi returns all recency; client-side `isWithinDateWindow` handles the 60-day cutoff)

`isWithinDateWindow` always runs client-side as a safety net regardless of which window is chosen.

### Relative date parsing

`parseRelativeDate(str)` converts SerpApi's `detected_extensions.posted_at` strings to ISO datetimes:
- `"17 hours ago"` → now minus 17 hours
- `"3 days ago"` → now minus 3 days
- `"2 weeks ago"` → now minus 14 days
- `"1 month ago"` → now minus 30 days
- Unparseable → today's date (safe fallback — job stays in results)

---

## 4. Fetch Pipeline Order

The full pipeline in `fetchAndScoreJobs` runs in this order:

1. **Fetch** raw jobs from SerpApi (normalised to internal shape; `date_posted=month` passed if `dateWindowDays=30`)
2. **`isWithinDateWindow` filter** — drop jobs outside the configured window (30 or 60 days)
3. **Applied-job filter** — load `jh_applied_urls_{profileId}`, drop already-applied jobs
4. **Quality filter** (`applyQualityFilters`) — drop staffing agencies, thin descriptions, deduplicate
5. **Link validation** (`validateJobLinks`) — drop dead links (HEAD requests, batched at 5)
6. **AI scoring** — score remaining jobs against resume
7. **Sort** — reputable sources first, then by match %; cap at 20

Applied jobs are dropped before quality filtering and AI scoring — they never consume credits or appear in results. Link validation runs after quality filtering to avoid wasting HEAD requests on jobs that will be dropped anyway.

---

## 5. Job Expiry Checker (`expiry-checker.js`)

### `isLinkAlive(url, timeoutMs = 5000)`

Sends a HEAD request to the URL. Returns:
- `true` — HTTP 200–399
- `false` — HTTP 404 or 410 (definitively dead — drop or flag)
- `null` — HTTP 403, 429, timeout, network error (ambiguous — keep job, do not penalise)

### `validateJobLinks(jobs, concurrency = 5)`

Runs `isLinkAlive` in batches of 5 (avoids rate-limiting). Returns the input array with `isLinkAlive === false` jobs removed. Jobs where result is `null` are kept. Called at step 5 of the fetch pipeline.

### Scheduled re-checker (`check-job-expiry-background.js`)

- **Cron:** `0 4 * * *` (4 AM UTC daily — offset from job-search cron `0 */6 * * *`)
- **Timeout:** `900` seconds (same as `scheduled-job-search-background.js` — set in `netlify.toml` under `[functions."check-job-expiry-background"]`)
- **Supabase scan strategy (two-step, mirrors existing scheduled function):**
  1. Query `kv_store` for all rows where `key = 'jh_profiles'` — returns one row per user, giving all `user_id` values and their profile arrays
  2. For each user + profileId pair, query `kv_store` scoped by both `user_id = <userId> AND key LIKE 'jh_jobs_{profileId}_%'` — bounded by user and date suffix so the query does not load unbounded cross-user history. This mirrors the `user_id`-scoped pattern used throughout the codebase.
- Only re-checks jobs within those results where `postedAt` is older than **14 days** (recently fetched jobs were already validated at fetch time)
- **On dead link:** adds `expired: true` + `expiredAt: <ISO timestamp>` to the job object; writes updated array back to KV
- **Does not delete** — flags only; user stays in control
- **Dev mode note:** Scheduled functions never run under `netlify dev` — they only execute on Netlify's infrastructure. The `devKeyNs` mechanism is not applicable here. Local testing of the expiry-checker logic is done via unit tests against the exported pure functions; the scheduled handler itself is not testable locally.

### Frontend (`Jobs.jsx`)

If `job.expired === true`, show a small amber "This job may no longer be available" banner on the job card. Non-blocking — user can still click through.

---

## 6. Applied Jobs Filter

### KV index key: `jh_applied_urls_{profileId}`

A lightweight array of objects, one per application the user has submitted:

```json
[
  {
    "url": "https://github.careers/...",
    "serpApiJobId": "eyJqb2J...",
    "company": "GitHub, Inc.",
    "title": "Software Engineer II, Security"
  }
]
```

**Write locations:**
- **Add entry:** `handleApply()` in `Jobs.jsx` — fires when the user confirms an application. Appends `{url, serpApiJobId, company, title}` to the index. Also stores `serpApiJobId` on the `jh_apps_{profileId}` application record at this point, so it is available later for removal. This is the only place a job first transitions into "Applied" status.
- **Remove entry:** `updateStatus()` in `Applications.jsx` — fires when the user changes an existing application's status away from `"Applied"`. Looks up the application record in `jh_apps_{profileId}` by the internal `jobId`, reads its `serpApiJobId` and `url`, then removes the matching entry from `jh_applied_urls_{profileId}` by `serpApiJobId` (primary) or `url` (fallback).

### Filter in `job-search-core.js`

`fetchAndScoreJobs` receives `profileId`. At step 3 of the pipeline:
1. Load `jh_applied_urls_{profileId}` from Supabase (single KV read; if key absent, treat as empty array)
2. Build a `Set` of applied URLs and a `Set` of applied `serpApiJobId`s
3. Drop any normalised job where `job.url` is in the URL set **or** `job.serpApiJobId` is in the ID set
4. Secondary fallback: normalise `company + title` (lowercase, strip seniority words: senior, sr., junior, jr., lead, principal, staff) — drop if normalised key matches an applied entry

### No Supabase schema change required

The existing `kv_store` table handles this cleanly. A proper relational `applications` table would only be warranted when server-side aggregation, cross-user analytics, or email digest queries are needed (backlog items). At current scale, the KV index is sufficient.

---

## 7. Environment Variables

| Key | Purpose |
|---|---|
| `SERPAPI_KEY` | SerpApi API key — replaces `RAPIDAPI_KEY` |

`RAPIDAPI_KEY` is removed from `.env.example`, `CLAUDE.md`, and `README.md`.

---

## 8. Data Model Changes

Stored job objects gain the following new fields (additive — no migration needed for existing stored jobs):

| Field | Type | Description |
|---|---|---|
| `serpApiJobId` | string | Stable SerpApi job identifier; used for applied-job dedup |
| `sourcePlatform` | string | e.g. `"LinkedIn"`, `"GitHub Careers"` |
| `companyLogo` | string \| `""` | URL to company thumbnail |
| `highlights` | `{title, items[]}[]` | Structured qualifications / responsibilities / benefits |
| `benefits` | `{healthInsurance, paidTimeOff, dental}` | Boolean benefit flags |
| `links` | `{title, link}[]` | All labelled apply options |
| `expired` | boolean | Set by expiry checker; absent = not yet checked |
| `expiredAt` | string | ISO timestamp when flagged expired |
| `source` | `"serpapi"` | Was `"jsearch"` |

**Profile preference (stored in `jh_p_{profileId}.preferences`):**

| Field | Type | Default | Description |
|---|---|---|---|
| `dateWindowDays` | `30 \| 60` | `30` | Job search date window; set in Settings → Job Search card |

---

## 9. Testing

### New test files

**`netlify/functions/__tests__/serpapi.test.js`** (~12 tests)
- Normalises a full SerpApi job object to internal shape correctly (all fields including `serpApiJobId`)
- `getBestApplyLink`: prefers company direct link; correct fallback order; handles missing options
- `parseRelativeDate`: hours, days, weeks, months, unparseable string
- Source sort order: LinkedIn/Indeed/Glassdoor jobs sort before company-direct

**`netlify/functions/__tests__/expiry-checker.test.js`** (~8 tests)
- `isLinkAlive`: alive (200, 301), dead (404, 410), ambiguous (403, 429, timeout, network error)
- `validateJobLinks`: dead links removed; ambiguous kept; alive kept; batch concurrency respected

### Updated test files

**`netlify/functions/__tests__/jobs-search.test.js`**
- `makeJob` helper updated to SerpApi-normalised field names (`title`, `company`, `url`, `links`, `serpApiJobId`, etc.)
- `isReputableSource` tests updated: check against `url` and `links` fields, not JSearch fields
- `isWithinDateWindow` tests replace `is60DaysOld` tests: 30-day threshold, 60-day threshold, boundary day
- Existing filter logic tests (`isStaffingAgency`, `hasGoodDescription`, `deduplicateSimilar`) unchanged

### Test count
~20 new tests → suite grows from 98 → ~118 tests across 17 suites.

---

## 10. Out of Scope

- Pagination beyond page 1 (planned — noted in code with TODO comment)
- JSearch kept as fallback provider — not needed; JSearch is being retired
- Supabase schema migration — not required at this scale
- UI changes beyond: expired badge, company logo, benefits badges, highlights panel in job card
