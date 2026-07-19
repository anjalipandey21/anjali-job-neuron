# Per-Job Resume Tailoring Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Tailor resume" button to each job card that runs an AI gap analysis and produces section scores, before/after rewrite suggestions, and keyword chips — all read-and-copy only, no saving.

**Architecture:** A private `TailorModal` component is co-located in `Jobs.jsx` alongside the existing `CustomizeModal` and `ApplyModal`. It fires a background AI job via the existing `callAIBackground` pipeline and caches the result on the job object in React state. Five additional files receive CSS variable cleanup (replacing hardcoded hex colors with theme-aware `var(--...)` tokens).

**Tech Stack:** React + inline styles, `callAIBackground` from `src/lib/api.js`, `parseJSON` from `src/lib/helpers.js`, Vitest + React Testing Library.

---

## File Map

| File | Change |
|---|---|
| `src/__tests__/Jobs.test.jsx` | Extend mock, add 4 TailorModal tests |
| `src/components/Jobs.jsx` | Add `TailorModal`; add `onTailor` to `JobCard`; add `tailorJob` state + `handleTailorSave` to `Jobs` |
| `src/components/ProfileSelect.jsx` | Replace hardcoded hex colors with CSS vars |
| `src/components/Settings.jsx` | Replace hardcoded hex colors with CSS vars |
| `src/components/MainApp.jsx` | Replace one hardcoded loading color with CSS var |
| `src/App.jsx` | Add `GlobalStyles` import + render; replace hardcoded colors in login/splash screens |
| `src/JobHunterApp.jsx` | Remove `GlobalStyles` (moved to App.jsx) |
| `src/AdminPanel.jsx` | Replace local `C` tokens + inline hardcoded colors with CSS vars (keep dark sidebar) |

---

## Task 1: Write Failing Tests for TailorModal

**Files:**
- Modify: `src/__tests__/Jobs.test.jsx`

- [ ] **Step 1: Extend the vi.mock to include callAIBackground**

Open `src/__tests__/Jobs.test.jsx`. Replace the existing mock block:

```js
vi.mock('../lib/api', () => ({
  dbGet: vi.fn().mockResolvedValue(null),
  dbSet: vi.fn().mockResolvedValue(undefined),
  callAI: vi.fn(),
  callJobsSearch: vi.fn(),
  callAIBackground: vi.fn(),
}))
```

- [ ] **Step 2: Add shared fixtures after the existing `profile` constant**

```js
const profileWithResume = {
  resumeText: 'Python developer with 5 years building data pipelines on AWS using SQL, Kafka, and Spark.',
  analyzedResume: { targetRoles: ['Data Engineer'] },
  preferences: {},
}

const profileNoResume = {
  resumeText: '',
  analyzedResume: null,
  preferences: {},
}

const job = {
  id: 'j1',
  title: 'Data Engineer',
  company: 'Databricks',
  location: 'Remote',
  description: 'We are looking for a Data Engineer to build scalable pipelines using Python, Airflow, dbt, Spark, and Delta Lake on AWS. You will work with petabyte-scale data and own reliability.',
  matchScore: 85,
  highlights: [],
  status: 'new',
}

const tailorFixture = {
  overallMatch: 72,
  matchLabel: 'Moderate',
  sections: [
    { name: 'Skills', score: 85, status: 'strong', detail: 'Python, SQL, AWS all present' },
    { name: 'Experience', score: 55, status: 'weak', detail: 'Missing Airflow and dbt references' },
  ],
  rewrites: [
    {
      section: 'Experience',
      original: 'Built data pipelines using Python',
      suggested: 'Designed ETL pipelines in Python + Airflow processing 50M+ daily events',
      reason: 'Adds tooling match and scale metric',
    },
  ],
  missingKeywords: ['Airflow', 'dbt'],
  presentKeywords: ['Python', 'SQL', 'AWS'],
}
```

- [ ] **Step 3: Update the top-of-file imports, then add the four failing test cases**

First, update the imports at the **top** of the file (not inside any describe block):

- Add `screen`, `waitFor`, `fireEvent` to the `@testing-library/react` import:
  ```js
  import { render, screen, waitFor, fireEvent } from '@testing-library/react'
  ```
- Add `callAIBackground` and `dbGet` to the named import from `../lib/api` (the mock factory already declares them):
  ```js
  import { callAIBackground, dbGet } from '../lib/api'
  ```

Then add a new `describe` block at the **bottom** of the file:

```js
describe('TailorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbGet.mockResolvedValue([job])
  })

  it('shows loading state while AI call is pending', async () => {
    callAIBackground.mockReturnValue(new Promise(() => {})) // never resolves
    render(<Jobs profile={profile} profileData={profileWithResume} />)
    const btn = await screen.findByRole('button', { name: /tailor resume/i })
    fireEvent.click(btn)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders gap analysis, rewrites, and keywords on success', async () => {
    callAIBackground.mockResolvedValue(JSON.stringify(tailorFixture))
    render(<Jobs profile={profile} profileData={profileWithResume} />)
    const btn = await screen.findByRole('button', { name: /tailor resume/i })
    fireEvent.click(btn)
    await waitFor(() => expect(screen.getByText('Gap Analysis')).toBeInTheDocument())
    expect(screen.getByText('Rewrite Suggestions')).toBeInTheDocument()
    expect(screen.getByText('Keywords')).toBeInTheDocument()
    expect(screen.getByText('Skills')).toBeInTheDocument()
  })

  it('shows error message and Try again button on failure', async () => {
    callAIBackground.mockRejectedValue(new Error('Network error'))
    render(<Jobs profile={profile} profileData={profileWithResume} />)
    const btn = await screen.findByRole('button', { name: /tailor resume/i })
    fireEvent.click(btn)
    await waitFor(() => expect(screen.getByText(/try again/i)).toBeInTheDocument())
    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('disables Tailor resume button when profile has no resume text', async () => {
    render(<Jobs profile={profile} profileData={profileNoResume} />)
    const btn = await screen.findByRole('button', { name: /tailor resume/i })
    expect(btn).toBeDisabled()
  })
})
```

- [ ] **Step 4: Run tests and confirm the new tests fail for the right reason**

```bash
npm test -- Jobs
```

Expected: 4 new tests FAIL with errors like "Unable to find role='button' with name /tailor resume/i" — the button does not exist yet. The existing smoke test should still pass.

- [ ] **Step 5: Commit the failing tests**

```bash
git add src/__tests__/Jobs.test.jsx
git commit -m "test: add failing tests for TailorModal"
```

---

## Task 2: Implement TailorModal, JobCard onTailor, and Jobs State

**Files:**
- Modify: `src/components/Jobs.jsx`

- [ ] **Step 1: Add callAIBackground to the import at line 2**

Change:
```js
import { callAI, callJobsSearch, dbGet, dbSet } from '../lib/api'
```
To:
```js
import { callAI, callAIBackground, callJobsSearch, dbGet, dbSet } from '../lib/api'
```

- [ ] **Step 2: Add TailorModal as a private component after ApplyModal (before the JobCard section)**

Insert the following block between the `ApplyModal` function and the `// ─── Job Card` comment:

```js
// ─── Tailor Modal ─────────────────────────────────────────────────────────────
function TailorModal({ job, profileData, onSave, onClose }) {
  const [loading, setLoading] = useState(!job.tailorResult)
  const [status, setStatus] = useState('')
  const [result, setResult] = useState(job.tailorResult || null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  useEffect(() => {
    if (job.tailorResult) return
    if ((job.description || '').length < 100) {
      setError('Not enough job description to analyse. Try a job with a full description.')
      setLoading(false)
      return
    }
    run()
  }, [])

  const run = async () => {
    setLoading(true); setError(''); setStatus('')
    const quals = (job.highlights || []).find((h) => h.title === 'Qualifications')?.items?.slice(0, 5)
    const resumeClean = (profileData.resumeText || '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').slice(0, 3500)
    const prompt = `Job: ${job.title} at ${job.company}
Location: ${job.location}
Description: ${(job.description || '').slice(0, 400)}${quals?.length ? `\nQualifications: ${quals.join('; ')}` : ''}

Candidate resume:
${resumeClean}

Return ONLY valid JSON:
{"overallMatch":72,"matchLabel":"Moderate","sections":[{"name":"Skills","score":85,"status":"strong","detail":"..."},{"name":"Experience","score":55,"status":"weak","detail":"..."}],"rewrites":[{"section":"Experience","original":"...","suggested":"...","reason":"..."}],"missingKeywords":["Airflow"],"presentKeywords":["Python"]}`
    try {
      const text = await callAIBackground([{ role: 'user', content: prompt }], {
        tokens: 6000,
        type: 'resume_tailor',
        onStatus: (s) => setStatus(s),
      })
      const parsed = parseJSON(text)
      if (!parsed) throw new Error('Failed to analyse. Try again.')
      setResult(parsed)
      onSave(job.id, parsed)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const copy = (text, key) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 2000) }
  const scoreColor = (s) => s === 'strong' ? 'var(--text-success)' : s === 'weak' ? 'var(--text-warning)' : 'var(--text-error)'
  const scoreIcon  = (s) => s === 'strong' ? '✓' : s === 'weak' ? '!' : '✕'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ ...C.card, maxWidth: 680, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 0 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 20px 12px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 600 }}>Resume tailoring</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{job.title} · {job.company} · {job.location}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {result && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-warning)' }}>{result.overallMatch}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{result.matchLabel} match</div>
              </div>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-light)', padding: '2px 6px' }}>✕</button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-main)', fontSize: 14, margin: '0 0 6px', fontWeight: 500 }} role="status">Analysing your resume…</p>
            {status === 'processing' && <p style={{ color: 'var(--text-info)', fontSize: 12, margin: 0, fontFamily: 'monospace' }}>⟳ AI is working — this can take 30–60 seconds</p>}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ padding: '1.5rem 20px' }}>
            <p style={{ color: 'var(--text-error)', fontSize: 13, margin: '0 0 12px' }}>{error}</p>
            <button onClick={run} style={btn()}>Try again</button>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            {/* Gap Analysis */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 600, color: 'var(--text-light)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Gap Analysis</p>
              {(result.sections || []).map((sec, i) => (
                <div key={i} style={{ marginBottom: i < (result.sections.length - 1) ? 10 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 16, height: 16, borderRadius: '50%', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: scoreColor(sec.status), background: `color-mix(in srgb, ${scoreColor(sec.status)} 15%, transparent)` }}>{scoreIcon(sec.status)}</span>
                      <span style={{ fontSize: 13 }}>{sec.name}</span>
                    </div>
                    <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 500, color: scoreColor(sec.status) }}>{sec.score}</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--bg-metric)', borderRadius: 2, marginLeft: 23 }}>
                    <div style={{ width: `${sec.score}%`, height: '100%', background: scoreColor(sec.status), borderRadius: 2, opacity: 0.7 }} />
                  </div>
                  <p style={{ margin: '3px 0 0 23px', fontSize: 11, color: 'var(--text-muted)' }}>{sec.detail}</p>
                </div>
              ))}
            </div>

            {/* Rewrite Suggestions */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 600, color: 'var(--text-light)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Rewrite Suggestions</p>
              {(result.rewrites || []).length === 0
                ? <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No specific rewrites needed — your resume is already well-aligned for this role.</p>
                : (result.rewrites || []).map((rw, i) => (
                  <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: i < (result.rewrites.length - 1) ? 10 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', background: 'var(--bg-metric)', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-light)' }}>{rw.section.toUpperCase()}</span>
                      <button onClick={() => copy(rw.suggested, `rw-${i}`)} style={{ ...btn(), fontSize: 11, padding: '3px 8px' }}>{copied === `rw-${i}` ? 'Copied!' : 'Copy →'}</button>
                    </div>
                    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 600, color: 'var(--text-error)', letterSpacing: '0.05em' }}>BEFORE</p>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, fontStyle: 'italic' }}>"{rw.original}"</p>
                      </div>
                      <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
                        <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 600, color: 'var(--text-success)', letterSpacing: '0.05em' }}>AFTER</p>
                        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>"{rw.suggested}"</p>
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>↳ {rw.reason}</p>
                    </div>
                  </div>
                ))
              }
            </div>

            {/* Keywords */}
            <div style={{ padding: '14px 20px' }}>
              <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 600, color: 'var(--text-light)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Keywords</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <p style={{ margin: '0 0 7px', fontSize: 11, fontWeight: 500, color: 'var(--text-success)' }}>✓ Present in your resume</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(result.presentKeywords || []).map((kw, i) => (
                      <span key={i} style={{ fontSize: 11, padding: '2px 7px', background: 'var(--bg-success)', color: 'var(--text-success)', borderRadius: 5 }}>{kw}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p style={{ margin: '0 0 7px', fontSize: 11, fontWeight: 500, color: 'var(--text-error)' }}>+ Add to your resume</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(result.missingKeywords || []).map((kw, i) => (
                      <span key={i} style={{ fontSize: 11, padding: '2px 7px', background: 'var(--bg-error)', color: 'var(--text-error)', borderRadius: 5 }}>{kw}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add onTailor prop to JobCard and the Tailor resume button**

In the `JobCard` function signature at line 101, change:
```js
function JobCard({ job, onApply, onCustomize, onSkip }) {
```
To:
```js
function JobCard({ job, onApply, onCustomize, onTailor, onSkip }) {
```

In the button row (after the `✦ Customize resume` button at line 161), add the Tailor button:
```js
<button
  onClick={() => onTailor(job)}
  disabled={!job._hasResume}
  style={{ ...btn(), fontSize: 12, padding: '5px 9px', opacity: !job._hasResume ? 0.5 : 1 }}
>
  ✦ Tailor resume
</button>
```

Note: `job._hasResume` is a transient flag set by the `Jobs` component (see next step). It is never persisted to KV.

- [ ] **Step 4: Add tailorJob state, handleTailorSave, and wire up in Jobs**

In the `Jobs` component, after `const [applyJob, setApplyJob] = useState(null)` (line 185), add:
```js
const [tailorJob, setTailorJob] = useState(null)
```

After `handleCustomizeSave` (line 249), add:
```js
const handleTailorSave = (jobId, tailorResult) => {
  setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, tailorResult } : j))
}
```

In the `filtered.map` at line 410, change:
```js
<JobCard key={job.id} job={job} onApply={(j) => setApplyJob(j)} onCustomize={(j) => setCustomizeJob(j)} onSkip={handleSkip} />
```
To:
```js
<JobCard
  key={job.id}
  job={{ ...job, _hasResume: !!profileData?.resumeText }}
  onApply={(j) => setApplyJob(j)}
  onCustomize={(j) => setCustomizeJob(j)}
  onTailor={(j) => setTailorJob(j)}
  onSkip={handleSkip}
/>
```

After the existing `{customizeJob && ...}` line at line 419, add:
```js
{tailorJob && profileData && (
  <TailorModal
    job={tailorJob}
    profileData={profileData}
    onSave={handleTailorSave}
    onClose={() => setTailorJob(null)}
  />
)}
```

- [ ] **Step 5: Run the tests and confirm all 5 tests pass**

```bash
npm test -- Jobs
```

Expected: All pre-existing tests still pass, plus the 4 new TailorModal tests. No regressions.

- [ ] **Step 6: Commit**

```bash
git add src/components/Jobs.jsx src/__tests__/Jobs.test.jsx
git commit -m "feat: add TailorModal — per-job resume gap analysis and rewrite suggestions"
```

---

## Task 3: CSS Var Cleanup — ProfileSelect, Settings, MainApp

**Files:**
- Modify: `src/components/ProfileSelect.jsx`
- Modify: `src/components/Settings.jsx`
- Modify: `src/components/MainApp.jsx`

### ProfileSelect.jsx

- [ ] **Step 1: Fix the loading spinner color (line 64)**

Change `color: '#888'` to `color: 'var(--text-muted)'` in the loading return:
```js
if (!loaded) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</p></div>
```

- [ ] **Step 2: Fix the subtitle text (line 75)**

Change `color: '#666'` to `color: 'var(--text-muted)'`:
```js
<p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Select a profile or create a new one.</p>
```

- [ ] **Step 3: Fix the profile avatar (line 83)**

Change hardcoded avatar colors to CSS vars:
```js
<div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--badge-new-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--badge-new-text)', flexShrink: 0 }}>{p.name.slice(0, 2).toUpperCase()}</div>
```

- [ ] **Step 4: Fix the profile email text (line 86)**

Change `color: '#888'` to `color: 'var(--text-muted)'`:
```js
<p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{p.email || 'No email'} · {fmtDate(p.createdAt)}</p>
```

- [ ] **Step 5: Fix the delete button color (line 89)**

Change `color: '#ccc'` to `color: 'var(--text-light)'`:
```js
<button onClick={(e) => del(p.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', fontSize: 16, padding: '4px 6px' }}>✕</button>
```

- [ ] **Step 6: Fix the sign out button (line 111)**

Change hardcoded error colors to CSS vars:
```js
<button onClick={onLogout} style={{ ...btn(), marginTop: 24, color: 'var(--text-error)', borderColor: 'var(--border-error)', fontSize: 12 }}>Sign out</button>
```

### Settings.jsx

- [ ] **Step 7: Fix profile email muted text (line 30)**

Change `color: '#888'` to `color: 'var(--text-muted)'`:
```js
<p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{profile.email || 'No email'} · Since {fmtDate(profile.createdAt)}</p>
```

- [ ] **Step 8: Fix sign out button (line 35)**

Change hardcoded error colors:
```js
<button onClick={onLogout} style={{ ...btn(), color: 'var(--text-error)', borderColor: 'var(--border-error)' }}>Sign out</button>
```

- [ ] **Step 9: Fix all four label colors (lines 42, 46, 50, 58)**

Change each `color: '#666'` to `color: 'var(--text-muted)'`. There are four `<label>` elements with inline `fontSize: 12, color: '#666'`:
```js
// Each of these:
<label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>...</label>
```

### MainApp.jsx

- [ ] **Step 10: Fix loading text color (line 46)**

Change `color: '#888'` to `color: 'var(--text-muted)'`:
```js
if (!profileData) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading profile…</p></div>
```

- [ ] **Step 11: Run tests to confirm no regressions**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 12: Commit**

```bash
git add src/components/ProfileSelect.jsx src/components/Settings.jsx src/components/MainApp.jsx
git commit -m "fix: replace hardcoded colors in ProfileSelect, Settings, MainApp with CSS vars"
```

---

## Task 4: CSS Var Cleanup — App.jsx (GlobalStyles move + login screen)

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/JobHunterApp.jsx`

**Background:** `GlobalStyles` currently renders inside `JobHunterApp` — only after auth. Moving it to `App` means CSS vars (`--bg-page`, `--text-main`, etc.) are available on the splash and login screens.

- [ ] **Step 1: Add GlobalStyles to App.jsx**

Add the import at the top of `src/App.jsx` (after existing imports):
```js
import { GlobalStyles } from './lib/styles'
```

In the `App` component return, wrap the existing conditional renders to always render `GlobalStyles` first. Change the return block to:
```js
return (
  <>
    <GlobalStyles />
    {(() => {
      if (loading) return <Splash />
      if (!user)   return <LoginScreen />
      if (role === 'admin' && view === 'admin') return <AdminPanel user={user} onExit={() => setView('app')} />
      return (
        <JobHunterApp
          user={user}
          isAdmin={role === 'admin'}
          onOpenAdmin={() => setView('admin')}
          onLogout={() => ni()?.logout()}
        />
      )
    })()}
  </>
)
```

- [ ] **Step 2: Remove GlobalStyles from JobHunterApp.jsx**

In `src/JobHunterApp.jsx`, remove the import line:
```js
import { GlobalStyles } from './lib/styles'
```

And remove `<GlobalStyles />` from the JSX return (line 38).

- [ ] **Step 3: Replace hardcoded colors in Splash**

In the `Splash` component:
```js
function Splash() {
  return (
    <div style={styles.center}>
      <Logo />
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 12 }}>Loading…</p>
    </div>
  )
}
```

- [ ] **Step 4: Replace hardcoded colors in LoginScreen**

```js
function LoginScreen() {
  return (
    <div style={styles.center}>
      <div style={styles.loginCard}>
        <Logo />
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '8px 0 28px', textAlign: 'center', lineHeight: 1.6 }}>
          Your AI-powered daily job search.<br />Sign in to access your dashboard.
        </p>
        <button onClick={() => ni()?.open('login')} style={styles.btn}>
          Sign in
        </button>
        <button onClick={() => ni()?.open('signup')} style={styles.signupBtn}>
          Create account
        </button>
        <p style={{ color: 'var(--text-faint)', fontSize: 11, marginTop: 20, textAlign: 'center' }}>Access is by invitation only.</p>
      </div>
    </div>
  )
}
```

Note: Remove the `onMouseEnter`/`onMouseLeave` handlers — they hardcode hex. The buttons will use the `styles.btn` / `styles.signupBtn` objects defined next.

- [ ] **Step 5: Replace hardcoded colors in Logo**

```js
function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, background: 'var(--btn-primary-bg)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--btn-primary-text)"><circle cx="8" cy="6" r="3"/><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" strokeWidth="0"/></svg>
      </div>
      <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-main)' }}>JobHunter AI</span>
    </div>
  )
}
```

- [ ] **Step 6: Replace hardcoded colors in the styles object**

Replace the entire `styles` const:
```js
const styles = {
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-page)', padding: 20 },
  loginCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '36px 32px', width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: 'var(--shadow-lg)' },
  btn: { width: '100%', padding: '11px 0', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  signupBtn: { width: '100%', padding: '11px 0', background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', marginTop: 8 },
}
```

- [ ] **Step 7: Run tests to confirm no regressions**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx src/JobHunterApp.jsx
git commit -m "fix: move GlobalStyles to App.jsx; replace hardcoded colors on login/splash screens with CSS vars"
```

---

## Task 5: CSS Var Cleanup — AdminPanel.jsx

**Files:**
- Modify: `src/AdminPanel.jsx`

**Note:** The dark sidebar (`background: '#0a0a0a'` at line 267 and related nav elements) is an intentional brand choice — do NOT change it. Only content-area colors are updated.

- [ ] **Step 1: Replace the local C design tokens (lines 11–15)**

Change the `C` object to use CSS vars:
```js
const C = {
  card: { background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '1.25rem' },
  metric: { background: 'var(--bg-metric)', borderRadius: 8, padding: '1rem' },
  input: { padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--input-bg)', color: 'var(--text-main)', fontFamily: 'inherit', fontSize: 13, outline: 'none' },
}
```

- [ ] **Step 2: Replace the local btn function (lines 17–23)**

```js
const btn = (variant = 'ghost', danger = false) => ({
  padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 12, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4,
  ...(variant === 'primary'
    ? { background: danger ? 'var(--text-error)' : 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none' }
    : { background: 'transparent', color: danger ? 'var(--text-error)' : 'var(--text-main)', border: `0.5px solid ${danger ? 'var(--border-error)' : 'var(--border)'}` }),
})
```

- [ ] **Step 3: Replace hardcoded colors in Metric component (lines 31–33)**

```js
<p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--text-muted)' }}>{label}</p>
<p style={{ margin: '0 0 2px', fontSize: 24, fontWeight: 500, fontFamily: 'monospace', color: color || 'var(--text-main)' }}>{value ?? '—'}</p>
{sub && <p style={{ margin: 0, fontSize: 11, color: 'var(--text-faint)' }}>{sub}</p>}
```

- [ ] **Step 4: Replace hardcoded colors in UserRow avatar (line 46)**

```js
<div style={{ width: 32, height: 32, borderRadius: '50%', background: user.role === 'admin' ? 'var(--badge-int-bg)' : 'var(--badge-new-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: user.role === 'admin' ? 'var(--badge-int-text)' : 'var(--badge-new-text)', flexShrink: 0 }}>
```

- [ ] **Step 5: Replace remaining inline hardcoded colors in UserRow (lines 54–58)**

```js
{isSelf && <span style={{ fontSize: 10, padding: '1px 5px', background: 'var(--bg-metric)', borderRadius: 4, color: 'var(--text-muted)' }}>you</span>}
<span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 500, background: user.role === 'admin' ? 'var(--badge-int-bg)' : 'var(--badge-new-bg)', color: user.role === 'admin' ? 'var(--badge-int-text)' : 'var(--badge-new-text)' }}>{user.role}</span>
{user.disabled && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 500, background: 'var(--bg-error)', color: 'var(--text-error)' }}>disabled</span>}
// ...
<p style={{ margin: 0, fontSize: 11, color: 'var(--text-faint)' }}>
```

- [ ] **Step 6: Replace hardcoded colors in UserDetail panel (lines 89–175)**

Work through the UserDetail component and replace:
- `color: '#888'` → `color: 'var(--text-muted)'`
- `color: '#aaa'` → `color: 'var(--text-faint)'`
- `color: '#555'` → `color: 'var(--text-muted)'`
- `background: '#fff'` (content area only, not sidebar) → `background: 'var(--bg-card)'`
- `background: '#f5f5f5'` → `background: 'var(--bg-metric)'`
- `background: '#f9f9f9'` → `background: 'var(--bg-content)'`
- `border: '...' #eee` → `border: '... var(--border)'`
- Application status badge colors: replace the inline ternary chain for `a.status` with CSS vars:
  ```js
  background: a.status === 'offer' ? 'var(--badge-off-bg)' : a.status === 'interview' ? 'var(--badge-int-bg)' : a.status === 'rejected' ? 'var(--badge-rej-bg)' : 'var(--badge-app-bg)',
  color: a.status === 'offer' ? 'var(--badge-off-text)' : a.status === 'interview' ? 'var(--badge-int-text)' : a.status === 'rejected' ? 'var(--badge-rej-text)' : 'var(--badge-app-text)',
  ```

- [ ] **Step 7: Replace hardcoded colors in Activity tab (lines 198–207)**

```js
<p style={{ margin: '0 0 1rem', fontSize: 13, color: 'var(--text-muted)' }}>Recent platform activity across all users.</p>
// activity row:
<div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--bg-content)', borderRadius: 8 }}>
<span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: e.type === 'join' ? 'var(--badge-new-bg)' : 'var(--bg-metric)', color: e.type === 'join' ? 'var(--badge-new-text)' : 'var(--text-muted)', fontWeight: 500, flexShrink: 0 }}>{e.label}</span>
// ...
<span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>{fmtTime(e.date)}</span>
// empty state:
{events.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No activity yet.</p>}
```

- [ ] **Step 8: Run tests to confirm no regressions**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/AdminPanel.jsx
git commit -m "fix: replace hardcoded colors in AdminPanel content area with CSS vars"
```

---

## Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests pass. Confirm the TailorModal test count shows 4 passing under the TailorModal describe block.

- [ ] **Step 2: Start dev server and do a smoke test**

```bash
npm run dev
```

Manually verify:
1. Find Jobs page shows "✦ Tailor resume" button on each job card
2. Button is disabled (greyed out) when profile has no resume text
3. Clicking the button opens the modal with a spinner
4. (If you have a dev account with resume text and a job with a long description) AI call fires, results render with gap analysis, rewrite cards, and keyword chips
5. Login screen and profile picker render correctly in both light and dark mode
