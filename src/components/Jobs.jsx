import { useState, useEffect, useRef } from 'react'
import { callAI, callAIBackground, callJobsSearch, dbGet, dbSet } from '../lib/api'
import { todayStr, parseJSON } from '../lib/helpers'
import { Badge } from '../lib/styles'
import s from './Jobs.module.css'

// ─── Link prioritization helper ──────────────────────────────────────────────
function prioritizeLinks(links, company) {
  if (!links || links.length === 0) return []
  const companyLower = (company || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const ranked = links.map((l) => {
    const href = (l.link || '').toLowerCase()
    const domain = href.replace(/^https?:\/\//, '').split('/')[0]
    let priority = 99
    if (companyLower && (domain.includes(companyLower) || domain.includes(companyLower.slice(0, 5)))) priority = 1
    else if (href.includes('linkedin.com')) priority = 2
    else if (href.includes('indeed.com')) priority = 3
    else if (href.includes('glassdoor.com')) priority = 4
    else if (href.includes('ziprecruiter.com')) priority = 5
    const label = priority === 1 ? 'Company Site' : l.title || domain.split('.')[0]
    return { ...l, priority, label }
  })
  ranked.sort((a, b) => a.priority - b.priority)
  const seen = new Set()
  const deduped = ranked.filter((l) => {
    const d = (l.link || '').replace(/^https?:\/\//, '').split('/')[0]
    if (seen.has(d)) return false
    seen.add(d)
    return true
  })
  return deduped.slice(0, 3)
}

function DragHandle() {
  return (
    <div className={s.dragHandle}>
      <div className={s.dragHandleBar} />
    </div>
  )
}

// ─── Customize Modal ──────────────────────────────────────────────────────────
function CustomizeModal({ job, profileData, onSave, onClose, isMobile = false }) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState(job.customResume || null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  useEffect(() => {
    if (job.customResume) { setLoading(false); return }
    ;(async () => {
      try {
        const prompt = `You are an expert career coach and resume strategist.

STEP 1 — Analyze the job posting:
- Extract the top 5 MUST-HAVE qualifications
- Extract the top 3 NICE-TO-HAVE qualifications
- Identify the key industry keywords and technologies

STEP 2 — Analyze the candidate's resume:
- Identify matching qualifications (with evidence from resume)
- Identify gaps (qualifications the resume doesn't address)

STEP 3 — Generate customized outputs based on your analysis:

Job: ${job.title} at ${job.company}
Location: ${job.location}
Description: ${job.description}

Candidate resume:
${profileData.resumeText?.slice(0, 5000)}

Return ONLY valid JSON:
{
  "coverLetter": "A 3-paragraph cover letter: (1) Open with a specific hook referencing the company and role — not a generic opener. (2) Map 3 concrete achievements from the resume to the job's top requirements, include metrics or quantified results where possible. (3) Close with enthusiasm for the specific company mission or product.",
  "highlights": [
    "5 bullet points. Each MUST: start with a STRONG ACTION VERB, map a SPECIFIC resume achievement to a SPECIFIC job requirement, include a METRIC or QUANTIFIED RESULT. Example format: 'Led migration of 12 microservices to Kubernetes, reducing deploy time by 40% — directly relevant to the DevOps infrastructure requirement'"
  ],
  "tweaks": {
    "keywords_to_add": ["5 important keywords from the job posting that are missing from the resume"],
    "sections_to_strengthen": ["which resume sections to expand and specific guidance on how"],
    "rewrite_suggestions": [
      {"original": "a weak or generic bullet from the resume", "improved": "a stronger version that targets this specific job", "reason": "why this change matters for this role"}
    ]
  }
}`
        const res = await callAI([{ role: 'user', content: prompt }], { tokens: 6000 })
        const parsed = parseJSON(res)
        if (!parsed) throw new Error('Failed to generate. Try again.')
        setResult(parsed)
      } catch (e) { setError(e.message) }
      setLoading(false)
    })()
  }, [])

  const copy = (text, key) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 2000) }

  return (
    <div className={s.overlay}>
      <div className={isMobile ? s.modalSheet : s.modal}>
        {isMobile && <DragHandle />}
        <div className={s.modalHeader}>
          <div>
            <p className={s.modalTitle}>Tailored for: {job.title}</p>
            <p className={s.modalSub}>{job.company} · {job.location}</p>
          </div>
          <button className={s.modalClose} onClick={onClose}>✕</button>
        </div>
        {loading && <div className={s.modalLoading}>Generating tailored materials…</div>}
        {error && <p className={s.modalError}>{error}</p>}
        {result && (
          <>
            <div>
              <div className={s.sectionLabelRow}>
                <p className={s.sectionLabel}>Cover Letter</p>
                <button className={`${s.btn} ${s.btnSm}`} onClick={() => copy(result.coverLetter, 'cl')}>{copied === 'cl' ? 'Copied!' : 'Copy'}</button>
              </div>
              <div className={s.preBlock}>{result.coverLetter}</div>
            </div>
            <div>
              <p className={s.sectionLabel}>Key Highlights to Lead With</p>
              <div className={s.highlightList}>
                {(result.highlights || []).map((h, i) => (
                  <div key={i} className={s.highlightItem}>
                    <span className={s.highlightNum}>0{i + 1}</span>
                    <p className={s.highlightText}>{h}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className={s.sectionLabel}>Resume Customization Advice</p>
              {typeof result.tweaks === 'string' ? (
                <div className={s.preBlock}>{result.tweaks}</div>
              ) : (
                <div className={s.tweaksBlock}>
                  {result.tweaks?.keywords_to_add?.length > 0 && (
                    <div className={s.tweakSection}>
                      <p className={`${s.tweakSectionLabel} ${s.tweakErrorLabel}`}>Missing Keywords</p>
                      <div className={s.tweakPillList}>
                        {result.tweaks.keywords_to_add.map((kw, i) => <span key={i} className={s.tweakPillError}>{kw}</span>)}
                      </div>
                    </div>
                  )}
                  {result.tweaks?.sections_to_strengthen?.length > 0 && (
                    <div className={s.tweakSection}>
                      <p className={`${s.tweakSectionLabel} ${s.tweakWarnLabel}`}>Sections to Strengthen</p>
                      <ul className={s.tweakList}>
                        {result.tweaks.sections_to_strengthen.map((sec, i) => <li key={i} className={s.tweakListItem}>{sec}</li>)}
                      </ul>
                    </div>
                  )}
                  {result.tweaks?.rewrite_suggestions?.length > 0 && (
                    <div>
                      <p className={`${s.tweakSectionLabel} ${s.tweakInfoLabel}`}>Rewrite Suggestions</p>
                      {result.tweaks.rewrite_suggestions.map((rw, i) => (
                        <div key={i} className={s.rewriteCard}>
                          <div className={s.rewriteCardHeader}>
                            <span className={s.rewriteCardHeaderLabel}>{rw.section || 'Resume'}</span>
                            <button className={`${s.btn} ${s.btnSm}`} onClick={() => copy(rw.improved, `rw-${i}`)}>{copied === `rw-${i}` ? 'Copied!' : 'Copy →'}</button>
                          </div>
                          <div className={s.rewriteCardBody}>
                            <div>
                              <p className={s.beforeLabel}>Before</p>
                              <p className={s.beforeText}>{rw.original}</p>
                            </div>
                            <div className={s.dividerDash}>
                              <p className={s.afterLabel}>After</p>
                              <p className={s.afterText}>{rw.improved}</p>
                            </div>
                            {rw.reason && <p className={s.rewriteReason}>↳ {rw.reason}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className={s.modalActions}>
              <button className={s.btnPrimary} onClick={() => onSave(result)}>Save & mark ready</button>
              <button className={s.btn} onClick={() => copy(result.coverLetter + '\n\n---\n\n' + (result.highlights || []).join('\n'), 'all')}>{copied === 'all' ? 'Copied!' : 'Copy all'}</button>
              <button className={s.btn} onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Apply Modal ──────────────────────────────────────────────────────────────
function ApplyModal({ job, onConfirm, onClose, isMobile = false }) {
  return (
    <div className={s.overlay}>
      <div className={isMobile ? s.modalSheet : s.modal}>
        {isMobile && <DragHandle />}
        <p className={s.modalTitle}>Apply to {job.title}</p>
        <p className={s.modalSub}>{job.company} · {job.location}</p>
        {job.customResume && (
          <div className={s.applyReady}>
            <p className={s.applyReadyText}>✓ Tailored cover letter & highlights ready to paste</p>
          </div>
        )}
        <p className={s.applyDesc}>
          Opens the job listing in a new tab and marks it as applied in your tracker.
        </p>
        <div className={s.modalActions}>
          <button className={s.btnPrimary} onClick={onConfirm}>Open & apply →</button>
          <button className={s.btn} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Tailor Modal ─────────────────────────────────────────────────────────────
function TailorModal({ job, profileData, onSave, onClose, isMobile = false }) {
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
    const ats = profileData.atsAnalysis
    const atsContext = ats
      ? `\nATS scan findings (your rewrite suggestions MUST be consistent with these, not contradictory):\n${(ats.issues || []).slice(0, 3).map((i) => `- ${i.severity.toUpperCase()}: ${i.title} — ${i.detail}`).join('\n')}${ats.suggestedKeywords?.length ? `\nATS-recommended keywords to add: ${ats.suggestedKeywords.slice(0, 6).join(', ')}` : ''}`
      : ''
    const prompt = `Job: ${job.title} at ${job.company}
Location: ${job.location}
Description: ${(job.description || '').slice(0, 400)}${quals?.length ? `\nQualifications: ${quals.join('; ')}` : ''}${atsContext}

Candidate resume:
${resumeClean}

Return ONLY valid JSON:
{"overallMatch":72,"matchLabel":"Moderate","sections":[{"name":"Skills","score":85,"status":"strong","detail":"..."},{"name":"Experience","score":55,"status":"weak","detail":"..."}],"rewrites":[{"section":"Experience","original":"...","suggested":"...","reason":"..."}],"missingKeywords":["Airflow"],"presentKeywords":["Python"]}`
    try {
      const text = await callAIBackground([{ role: 'user', content: prompt }], {
        tokens: 6000,
        type: 'resume_tailor',
        onStatus: (st) => setStatus(st),
      })
      const parsed = parseJSON(text)
      if (!parsed) throw new Error('Failed to analyse. Try again.')
      setResult(parsed)
      onSave(job.id, parsed)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const copy = (text, key) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 2000) }
  const scoreColor = (st) => st === 'strong' ? 'var(--text-success)' : st === 'weak' ? 'var(--text-warning)' : 'var(--text-error)'
  const scoreIcon  = (st) => st === 'strong' ? '✓' : st === 'weak' ? '!' : '✕'
  const scoreBg    = (st) => st === 'strong' ? 'var(--bg-success)' : st === 'weak' ? 'var(--bg-warning)' : 'var(--bg-error)'

  return (
    <div className={s.overlay}>
      <div className={isMobile ? s.modalSheet : s.tailorModal}>
        {isMobile && <DragHandle />}
        <div className={s.tailorHeader}>
          <div>
            <p className={s.modalTitleBold}>Resume tailoring</p>
            <p className={s.modalSub}>{job.title} · {job.company} · {job.location}</p>
          </div>
          <div className={s.tailorHeaderRight}>
            {result && (
              <div className={s.tailorScore}>
                <div className={s.tailorScoreNum}>{result.overallMatch}</div>
                <div className={s.tailorScoreLabel}>{result.matchLabel} match</div>
              </div>
            )}
            <button className={s.modalClose} onClick={onClose}>✕</button>
          </div>
        </div>

        {loading && (
          <div className={s.tailorLoading}>
            <p className={s.tailorLoadingTitle} role="status">Analysing your resume…</p>
            {status === 'processing' && <p className={s.tailorLoadingStatus}>⟳ AI is working — this can take 30–60 seconds</p>}
          </div>
        )}

        {!loading && error && (
          <div className={s.tailorErrorBody}>
            <p className={s.modalErrorSpaced}>{error}</p>
            <button className={s.btn} onClick={run}>Try again</button>
          </div>
        )}

        {result && !loading && (
          <>
            <div className={s.tailorSection}>
              <p className={s.tailorSectionTitle}>Gap Analysis</p>
              {(result.sections || []).map((sec, i) => (
                <div key={i} style={{ marginBottom: i < (result.sections.length - 1) ? 10 : 0 }}>
                  <div className={s.gapRow}>
                    <div className={s.gapRowLeft}>
                      <span className={s.statusBadge} style={{ color: scoreColor(sec.status), background: scoreBg(sec.status) }}>{scoreIcon(sec.status)}</span>
                      <span className={s.gapName}>{sec.name}</span>
                    </div>
                    <span className={s.gapScore} style={{ color: scoreColor(sec.status) }}>{sec.score}</span>
                  </div>
                  <div className={s.progressTrack}>
                    <div className={s.progressFill} style={{ width: `${sec.score}%`, background: scoreColor(sec.status) }} />
                  </div>
                  <p className={s.tailorDetail}>{sec.detail}</p>
                </div>
              ))}
            </div>

            <div className={s.tailorSection}>
              <p className={s.tailorSectionTitle}>Rewrite Suggestions</p>
              {(result.rewrites || []).length === 0
                ? <p className={s.tailorSectionNoRewrites}>No specific rewrites needed — your resume is already well-aligned for this role.</p>
                : (result.rewrites || []).map((rw, i) => (
                  <div key={i} className={s.rewriteCard} style={{ marginBottom: i < (result.rewrites.length - 1) ? 10 : 0 }}>
                    <div className={s.rewriteCardHeader}>
                      <span className={s.rewriteCardHeaderLabel}>{rw.section.toUpperCase()}</span>
                      <button className={`${s.btn} ${s.btnSm}`} onClick={() => copy(rw.suggested, `rw-${i}`)}>{copied === `rw-${i}` ? 'Copied!' : 'Copy →'}</button>
                    </div>
                    <div className={s.rewriteCardBody}>
                      <div>
                        <p className={s.beforeLabel}>Before</p>
                        <p className={s.beforeText}>&ldquo;{rw.original}&rdquo;</p>
                      </div>
                      <div className={s.dividerDash}>
                        <p className={s.afterLabel}>After</p>
                        <p className={s.afterText}>&ldquo;{rw.suggested}&rdquo;</p>
                      </div>
                      <p className={s.rewriteReason}>↳ {rw.reason}</p>
                    </div>
                  </div>
                ))
              }
            </div>

            <div className={s.tailorSection}>
              <p className={s.tailorSectionTitle}>Keywords</p>
              <div className={s.tailorKeywordsGrid}>
                <div>
                  <p className={`${s.tailorKeywordsLabel} ${s.tailorKeywordsLabelPresent}`}>✓ Present in your resume</p>
                  <div className={s.tailorKeywordPills}>
                    {(result.presentKeywords || []).map((kw, i) => <span key={i} className={s.pillSuccess}>{kw}</span>)}
                  </div>
                </div>
                <div>
                  <p className={`${s.tailorKeywordsLabel} ${s.tailorKeywordsLabelMissing}`}>+ Add to your resume</p>
                  <div className={s.tailorKeywordPills}>
                    {(result.missingKeywords || []).map((kw, i) => <span key={i} className={s.pillError}>{kw}</span>)}
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

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ job, index, onApply, onCustomize, onTailor, onSkip, isMobile = false, applying = false }) {
  const [expanded, setExpanded] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const sc = job.matchScore >= 80 ? 'var(--text-success)' : job.matchScore >= 60 ? 'var(--text-warning)' : 'var(--text-light)'
  const postedDate = job.postedAt ? new Date(job.postedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''

  return (
    <div
      className={`${s.jobCard}${applying ? ` ${s.jobCardApplying}` : ''}`}
      style={{
        animation: applying
          ? 'slideOut 0.4s ease forwards, collapseHeight 0.35s 0.4s ease forwards'
          : `slideUp 0.4s ${(index || 0) * 0.06}s ease both`,
      }}
    >
      {job.expired && (
        <div className={s.expiredBanner}>
          <p className={s.expiredText}>⚠ This job may no longer be available</p>
        </div>
      )}
      <div className={s.cardTop}>
        <div className={s.companyAvatar}>
          {job.companyLogo && !imgFailed ? (
            <img
              src={job.companyLogo}
              alt={job.company}
              className={s.companyAvatarImg}
              onError={() => setImgFailed(true)}
            />
          ) : (
            job.company?.slice(0, 2).toUpperCase() || '??'
          )}
        </div>
        <div className={s.cardBody}>
          <div className={s.cardTitleRow}>
            <span className={s.cardTitle}>{job.title}</span>
            <Badge status={job.status || 'new'} />
            {job.jobType && <span className={s.tagJobType}>{job.jobType}</span>}
            {job.isReputable && <span className={`${s.tagPill} ${s.tagVerified}`}>✓ Verified source</span>}
            {job.benefits?.healthInsurance && <span className={`${s.tagPill} ${s.tagHealth}`}>Health</span>}
            {job.benefits?.paidTimeOff && <span className={`${s.tagPill} ${s.tagPto}`}>PTO</span>}
            {job.benefits?.dental && <span className={`${s.tagPill} ${s.tagDental}`}>Dental</span>}
            {job.sponsorship === 'yes' && <span className={`${s.tagPill} ${s.tagVisaSponsor}`}>Visa Sponsor</span>}
            {job.sponsorship === 'no' && <span className={`${s.tagPill} ${s.tagNoSponsor}`}>No Sponsorship</span>}
          </div>
          <p className={s.cardMeta}>
            {job.company} · {job.location}
            {postedDate && <span className={s.cardMetaFaint}> · Posted {postedDate}</span>}
            {job.sourcePlatform && <span className={s.cardMetaFaint}> · via {job.sourcePlatform}</span>}
          </p>
          {job.salary && (
            <p className={s.cardSalary}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3"/><path d="M8 4v8M6 5.5h3.5a1.5 1.5 0 010 3H6m0 0h4a1.5 1.5 0 010 3H5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
              {job.salary}
            </p>
          )}
          {job.matchReason && <p className={s.cardMatchReason}>{job.matchReason}</p>}
          {expanded && (() => {
            let sections = (job.highlights || []).filter((h) => h.items?.length > 0).slice(0, 4)
            if (sections.length === 0 && job.description) {
              const sentences = job.description.split(/(?<=[.!?])\s+/).filter((sen) => sen.length > 15).slice(0, 8)
              if (sentences.length > 0) sections = [{ title: 'Overview', items: sentences }]
            }
            return sections.length > 0 ? (
              <div
                className={s.detailGrid}
                style={{ gridTemplateColumns: isMobile ? '1fr' : sections.length > 1 ? '1fr 1fr' : '1fr' }}
              >
                {sections.map((h, i) => (
                  <div key={i} className={s.detailSection}>
                    <p className={s.detailSectionTitle}>{h.title}</p>
                    <ul className={s.detailList}>
                      {(h.items || []).slice(0, 6).map((item, j) => (
                        <li key={j} className={s.detailListItem}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className={s.detailDesc}>{job.description}</p>
            )
          })()}
        </div>
        <div className={s.matchScore}>
          <p className={s.matchScoreNum} style={{ color: sc }}>{job.matchScore}%</p>
          <p className={s.matchScoreLabel}>match</p>
        </div>
      </div>

      <div className={s.cardActions}>
        <button className={`${s.btn} ${s.btnSm}`} onClick={() => setExpanded((v) => !v)}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d={expanded ? 'M2 8l4-4 4 4' : 'M2 4l4 4 4-4'} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {expanded ? 'Less' : 'Details'}
        </button>
        <button className={`${s.btn} ${s.btnSm}`} onClick={() => onCustomize(job)}>✦ Customize resume</button>
        <button
          className={`${s.btn} ${s.btnSm}`}
          onClick={() => onTailor(job)}
          disabled={!job._hasResume}
        >
          ✦ Tailor resume
        </button>
      </div>

      <div className={s.cardDecision}>
        {job.status !== 'applied' && (
          <button className={`${s.btn} ${s.btnSm} ${s.btnDim}`} onClick={() => onSkip(job)}>Skip</button>
        )}
        <div className={s.cardDecisionSpacer} />
        <button
          className={`${s.btnPrimary} ${s.btnSm}`}
          onClick={() => onApply(job)}
          disabled={job.status === 'applied'}
        >
          {job.status === 'applied' ? 'Applied ✓' : 'Apply →'}
        </button>
      </div>

      {(() => {
        const rawLinks = job.links?.length > 0 ? job.links : job.url ? [{ link: job.url, title: 'View' }] : []
        const linkedIn = rawLinks.find((l) => (l.link || '').toLowerCase().includes('linkedin.com'))
        const links = expanded ? prioritizeLinks(rawLinks, job.company) : []
        const alwaysShow = !expanded && linkedIn ? [{ ...linkedIn, label: 'LinkedIn' }] : []
        const allLinks = [...alwaysShow, ...links]
        return allLinks.length > 0 ? (
          <div className={s.cardLinks}>
            {allLinks.map((link) => (
              <a key={link.link} href={link.link} target="_blank" rel="noreferrer" className={s.btnLink}>
                {link.label} ↗
              </a>
            ))}
          </div>
        ) : null
      })()}
    </div>
  )
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export function Jobs({ profile, profileData, isMobile = false }) {
  const [jobPool, setJobPool]             = useState([])
  const [visibleCount, setVisibleCount]   = useState(10)
  const [appliedSet, setAppliedSet]       = useState(() => new Set())
  const [mutations, setMutations]         = useState([])
  const sentinelRef                       = useRef(null)
  const [loading, setLoading] = useState(false)
  const [bgStatus, setBgStatus] = useState('')
  const [error, setError] = useState('')
  const [customizeJob, setCustomizeJob] = useState(null)
  const [applyJob, setApplyJob] = useState(null)
  const [tailorJob, setTailorJob] = useState(null)
  const [filter, setFilter] = useState('all')
  const [applyingId, setApplyingId] = useState(null)
  const [scheduledStatus, setScheduledStatus] = useState(null)
  const [statusDismissed, setStatusDismissed] = useState(false)

  const pref = profileData?.preferences || {}
  const [filterRoles, setFilterRoles] = useState(pref.roles || '')
  const [filterLocation, setFilterLocation] = useState(
    (pref.locations || '').split(',').map((l) => l.trim()).find((l) => l.toLowerCase() !== 'remote') || ''
  )
  const [filterWorkType, setFilterWorkType] = useState(pref.workType || 'any')
  const [filterJobType, setFilterJobType] = useState('any')
  const [filterDateWindow, setFilterDateWindow] = useState(pref.dateWindowDays || 30)
  const [filtersOpen, setFiltersOpen] = useState(true)

  const [skippedJobs, setSkippedJobs] = useState([])
  const [showSkipList, setShowSkipList] = useState(false)

  useEffect(() => {
    setVisibleCount(10)
    Promise.all([
      dbGet(`jh_jobs_pool_${profile.id}_${todayStr()}`),
      dbGet(`jh_jobs_${profile.id}_${todayStr()}`),
      dbGet(`jh_applied_urls_${profile.id}`),
    ]).then(([pool, muts, applied]) => {
      setJobPool(pool || [])
      setMutations(muts || [])
      const aSet = new Set()
      ;(applied || []).forEach((a) => {
        if (a.url) aSet.add(a.url)
        if (a.serpApiJobId) aSet.add(a.serpApiJobId)
      })
      setAppliedSet(aSet)
    })
  }, [profile.id])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setVisibleCount((prev) => prev + 10)
    })
    if (sentinelRef.current) observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setScheduledStatus(null)
    setStatusDismissed(false)
    dbGet(`jh_scheduled_status_${profile.id}`).then(setScheduledStatus)
  }, [profile.id])

  useEffect(() => {
    dbGet(`jh_skipped_${profile.id}`).then((sk) => setSkippedJobs(sk || []))
  }, [profile.id])


  const findJobs = async () => {
    if (!profileData?.analyzedResume) { setError('Please analyze your resume first in the Resume tab.'); return }
    setLoading(true); setError(''); setBgStatus('')
    setJobPool([])
    setMutations([])
    setVisibleCount(10)
    await Promise.all([
      dbSet(`jh_jobs_pool_${profile.id}_${todayStr()}`, []),
      dbSet(`jh_jobs_${profile.id}_${todayStr()}`, []),
    ])
    try {
      const filters = {
        roles:          filterRoles,
        location:       filterLocation,
        workType:       filterWorkType,
        jobType:        filterJobType,
        dateWindowDays: filterDateWindow,
      }
      const { targetRoles = [] } = profileData.analyzedResume
      const found = await callJobsSearch({
        filters,
        resumeText: profileData.resumeText,
        targetRoles: filterRoles || targetRoles.join(', ') || 'Data Engineer, Software Engineer, AI Engineer',
        profileId: profile.id,
        onStatus: (st) => setBgStatus(st),
      })
      if (!found || found.length === 0) throw new Error('No jobs found. Try updating your role preferences in Settings.')
      setJobPool(found)
      await dbSet(`jh_jobs_pool_${profile.id}_${todayStr()}`, found)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const handleCustomizeSave = async (jobId, data) => {
    setMutations((prev) => {
      const existing = prev.find((m) => m.id === jobId)
      const updated = existing
        ? prev.map((m) => m.id === jobId ? { ...m, customResume: data, status: 'customized' } : m)
        : [...prev, { id: jobId, customResume: data, status: 'customized' }]
      dbSet(`jh_jobs_${profile.id}_${todayStr()}`, updated)
      return updated
    })
    setCustomizeJob(null)
  }

  const handleTailorSave = (jobId, tailorResult) => {
    setMutations((prev) => {
      const existing = prev.find((m) => m.id === jobId)
      const updated = existing
        ? prev.map((m) => m.id === jobId ? { ...m, tailorResult } : m)
        : [...prev, { id: jobId, tailorResult }]
      dbSet(`jh_jobs_${profile.id}_${todayStr()}`, updated)
      return updated
    })
  }

  const handleApply = async (job) => {
    if (job.url) window.open(job.url, '_blank')
    setApplyJob(null)
    setApplyingId(job.id)
    const apps = (await dbGet(`jh_apps_${profile.id}`)) || []
    if (!apps.find((a) => a.jobId === job.id)) {
      const newApp = {
        jobId: job.id, jobTitle: job.title, company: job.company,
        location: job.location, url: job.url || '',
        serpApiJobId: job.serpApiJobId || '', status: 'applied',
        appliedAt: new Date().toISOString(), notes: '',
      }
      await dbSet(`jh_apps_${profile.id}`, [...apps, newApp])
      const index = (await dbGet(`jh_applied_urls_${profile.id}`)) || []
      await dbSet(`jh_applied_urls_${profile.id}`, [
        ...index,
        { url: job.url || '', serpApiJobId: job.serpApiJobId || '', company: job.company, title: job.title },
      ])
    }
    setAppliedSet((prev) => {
      const next = new Set(prev)
      if (job.url) next.add(job.url)
      if (job.serpApiJobId) next.add(job.serpApiJobId)
      return next
    })
    // After animation completes, update mutations (dbSet inside updater — no stale closure)
    const jobId = job.id
    setTimeout(() => {
      setApplyingId(null)
      setMutations((prev) => {
        const existing = prev.find((m) => m.id === jobId)
        const updated = existing
          ? prev.map((m) => m.id === jobId ? { ...m, status: 'applied', appliedAt: new Date().toISOString() } : m)
          : [...prev, { id: jobId, status: 'applied', appliedAt: new Date().toISOString() }]
        dbSet(`jh_jobs_${profile.id}_${todayStr()}`, updated)
        return updated
      })
    }, 750)
  }

  const handleSkip = async (job) => {
    setJobPool((prev) => prev.filter((j) => j.id !== job.id))
    const newSkipped = [...skippedJobs, { url: job.url || '', serpApiJobId: job.serpApiJobId || '', company: job.company, title: job.title }]
    setSkippedJobs(newSkipped)
    await dbSet(`jh_skipped_${profile.id}`, newSkipped)
  }

  const handleUndoSkip = async (entry) => {
    const newSkipped = skippedJobs.filter((sk) =>
      !(sk.url && sk.url === entry.url) &&
      !(sk.serpApiJobId && sk.serpApiJobId === entry.serpApiJobId) &&
      !(sk.company === entry.company && sk.title === entry.title)
    )
    setSkippedJobs(newSkipped)
    await dbSet(`jh_skipped_${profile.id}`, newSkipped)
  }

  const noAnalysis = !profileData?.analyzedResume
  const mutationMap = Object.fromEntries(mutations.map((m) => [m.id, m]))

  const skippedSet = new Set(skippedJobs.flatMap((sk) => [sk.url, sk.serpApiJobId].filter(Boolean)))
  const isNotApplied = (j) => !appliedSet.has(j.url) && !appliedSet.has(j.serpApiJobId)
  const merged = (j) => ({ status: 'new', ...j, ...(mutationMap[j.id] || {}) })

  const visibleJobs = jobPool
    .filter((j) => isNotApplied(j) && !skippedSet.has(j.url) && !skippedSet.has(j.serpApiJobId))
    .slice(0, visibleCount)
    .map(merged)

  const filtered = (filter === 'all' ? visibleJobs : visibleJobs.filter((j) => j.status === filter))
    .slice()
    .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))

  const allMutated = jobPool.map(merged)
  const filterCounts = ['new', 'customized', 'applied'].reduce(
    (acc, st) => ({ ...acc, [st]: allMutated.filter((j) => j.status === st).length }),
    {}
  )
  const poolExhausted = jobPool.filter(isNotApplied).length <= visibleCount

  return (
    <div className={s.page}>
      {/* Page header */}
      <div className={s.header}>
        <div className={s.headerText}>
          <p className={s.headerEyebrow}>Today&apos;s Matches</p>
          <h1 className={s.headerTitle}>Jobs for You</h1>
          <p className={s.headerSub}>Search AI-matched jobs, customize your resume per role, and apply with one click</p>
        </div>
        <button className={s.btnPrimary} onClick={findJobs} disabled={loading || noAnalysis}>
          {loading ? 'Searching…' : jobPool.length > 0 ? '↻ Refresh' : 'Find jobs'}
        </button>
      </div>

      <div className={s.content}>
        {noAnalysis && (
          <div className={`${s.bannerCard} ${s.bannerWarning}`}>
            <p className={s.bannerText}>Analyze your resume first (Resume tab) to enable job matching.</p>
          </div>
        )}

        {/* Filter bar */}
        <div className={s.filterBar}>
          <div className={s.filterBarTop}>
            <button className={s.filterToggle} onClick={() => setFiltersOpen((v) => !v)}>
              {filtersOpen ? '▾ Filters' : '▸ Filters'}
            </button>
            {skippedJobs.length > 0 && (
              <button className={s.skippedToggle} onClick={() => setShowSkipList((v) => !v)}>
                {skippedJobs.length} skipped
              </button>
            )}
          </div>
          {filtersOpen && (
            <div className={s.filterFields}>
              <div className={s.filterField}>
                <label className={s.filterLabel}>Roles / keywords</label>
                <input className={s.filterInput} value={filterRoles} onChange={(e) => setFilterRoles(e.target.value)} placeholder="Data Engineer, AI Engineer" />
              </div>
              <div className={s.filterField}>
                <label className={s.filterLabel}>Location</label>
                <input className={s.filterInput} value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} placeholder="New York" />
              </div>
              <div className={s.filterFieldNarrow}>
                <label className={s.filterLabel}>Work type</label>
                <select className={s.filterInput} value={filterWorkType} onChange={(e) => setFilterWorkType(e.target.value)}>
                  <option value="any">Any</option>
                  <option value="remote">Remote</option>
                  <option value="onsite">On-site</option>
                </select>
              </div>
              <div className={s.filterFieldNarrow}>
                <label className={s.filterLabel}>Job type</label>
                <select className={s.filterInput} value={filterJobType} onChange={(e) => setFilterJobType(e.target.value)}>
                  <option value="any">Any</option>
                  <option value="fulltime">Full-time</option>
                  <option value="contractor">Contract</option>
                  <option value="parttime">Part-time</option>
                </select>
              </div>
              <div className={s.filterFieldNarrow}>
                <label className={s.filterLabel}>Date posted</label>
                <select className={s.filterInput} value={filterDateWindow} onChange={(e) => setFilterDateWindow(Number(e.target.value))}>
                  <option value={30}>Last 30 days</option>
                  <option value={60}>Last 60 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
              </div>
              <button className={s.btnPrimary} onClick={findJobs} disabled={loading || noAnalysis}>Search</button>
            </div>
          )}
          {showSkipList && skippedJobs.length > 0 && (
            <div className={s.skippedList}>
              <p className={s.skippedNote}>Skipped jobs — job will reappear in your next search after undo.</p>
              {skippedJobs.map((entry, i) => (
                <div key={i} className={s.skippedRow}>
                  <span className={s.skippedLabel}>{entry.title} · {entry.company}</span>
                  <button className={`${s.btn} ${s.btnSm}`} onClick={() => handleUndoSkip(entry)}>Undo</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className={`${s.bannerCard} ${s.bannerError}`}>
            <p className={s.bannerText}>{error}</p>
          </div>
        )}

        {scheduledStatus?.status === 'error' && !statusDismissed && (
          <div className={`${s.bannerCard} ${s.bannerWarning} ${s.bannerRow}`}>
            <p className={s.bannerText}>
              Scheduled job search failed — {scheduledStatus.error}. You can run it manually.
            </p>
            <button onClick={() => setStatusDismissed(true)} className={s.bannerDismissBtn}>✕</button>
          </div>
        )}

        {jobPool.length > 0 && (
          <div className={s.filterTabs}>
            {[['all', jobPool.length], ['new', filterCounts.new], ['customized', filterCounts.customized], ['applied', filterCounts.applied]].map(([f, count]) => (
              <button
                key={f}
                className={`${s.filterTab}${filter === f ? ` ${s.filterTabActive}` : ''}`}
                onClick={() => setFilter(f)}
              >
                {f} ({count})
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className={s.loadingCard}>
            <p className={s.loadingTitle}>Searching job boards…</p>
            <p className={s.loadingSubtext}>Scanning LinkedIn, Indeed, Greenhouse, company career pages.</p>
            {bgStatus && (
              <p className={s.loadingStatus}>
                {bgStatus === 'processing' ? '⟳ AI is searching — this can take 30–60 seconds' : bgStatus === 'done' ? '✓ Done' : `Status: ${bgStatus}`}
              </p>
            )}
          </div>
        )}

        {!loading && filtered.map((job, index) => (
          <JobCard
            key={job.id}
            job={{ ...job, _hasResume: !!profileData?.resumeText }}
            index={index}
            onApply={(j) => setApplyJob(j)}
            onCustomize={(j) => setCustomizeJob(j)}
            onTailor={(j) => setTailorJob(j)}
            onSkip={handleSkip}
            isMobile={isMobile}
            applying={applyingId === job.id}
          />
        ))}

        {/* Infinite scroll sentinel — always in DOM, invisible when pool not loaded */}
        <div ref={sentinelRef} style={{ height: 0, margin: 0 }} aria-hidden="true" />
        {poolExhausted && jobPool.length > 0 && (
          <p className={s.exhaustedMsg}>You&apos;ve seen all available jobs for today.</p>
        )}

        {!loading && jobPool.length === 0 && (
          <div className={s.emptyState}>
            <div className={s.emptyIcon}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="21" cy="21" r="14" stroke="currentColor" strokeWidth="2"/>
                <line x1="31" y1="31" x2="43" y2="43" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="16" y1="21" x2="26" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="21" y1="16" x2="21" y2="26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p className={s.emptyTitle}>No jobs found yet today</p>
            <p className={s.emptySubtext}>Click the button to search for AI-matched jobs based on your resume and preferences.</p>
            <button className={s.btnPrimary} onClick={findJobs} disabled={noAnalysis}>Find jobs</button>
          </div>
        )}

        {customizeJob && profileData && (
          <CustomizeModal
            job={customizeJob}
            profileData={profileData}
            onSave={(data) => handleCustomizeSave(customizeJob.id, data)}
            onClose={() => setCustomizeJob(null)}
            isMobile={isMobile}
          />
        )}
        {applyJob && (
          <ApplyModal
            job={applyJob}
            onConfirm={() => handleApply(applyJob)}
            onClose={() => setApplyJob(null)}
            isMobile={isMobile}
          />
        )}
        {tailorJob && profileData && (
          <TailorModal
            job={tailorJob}
            profileData={profileData}
            onSave={handleTailorSave}
            onClose={() => setTailorJob(null)}
            isMobile={isMobile}
          />
        )}
      </div>
    </div>
  )
}
