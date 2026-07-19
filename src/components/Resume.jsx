import { useState, useEffect, useRef } from 'react'
import * as mammoth from 'mammoth'
import { callAI, callAIBackground, callSemanticAnalyze } from '../lib/api'
import { parseJSON } from '../lib/helpers'
import s from './Resume.module.css'

// ─── PDF extraction (pdf.js via script-tag UMD) ───────────────────────────────
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib)
  return new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    el.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      resolve(window.pdfjsLib)
    }
    el.onerror = () => reject(new Error('Failed to load pdf.js'))
    document.head.appendChild(el)
  })
}

async function extractPdfText(file) {
  const lib = await loadPdfJs()
  const buf = await file.arrayBuffer()
  const pdf = await lib.getDocument({ data: new Uint8Array(buf) }).promise
  const pages = await Promise.all(
    Array.from({ length: pdf.numPages }, (_, i) =>
      pdf.getPage(i + 1).then((p) => p.getTextContent()).then((tc) => tc.items.map((it) => it.str).join(' '))
    )
  )
  return pages.join('\n\n')
}

export function Resume({ profile, profileData, onUpdate }) {
  const [text, setText] = useState(profileData?.resumeText || '')
  const [parsing, setParsing] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [atsLoading, setAtsLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [semanticResult, setSemanticResult] = useState(profileData?.semanticAnalysis || null)
  const [resumeTab, setResumeTab] = useState(() => sessionStorage.getItem('jh_resume_tab') || 'profile')
  const [fileInfo, setFileInfo] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef()

  useEffect(() => { if (profileData?.resumeText) setText(profileData.resumeText) }, [profileData?.resumeText])

  useEffect(() => { sessionStorage.setItem('jh_resume_tab', resumeTab) }, [resumeTab])

  const handleFile = async (e) => {
    const f = e.target.files[0]; if (!f) return
    e.target.value = ''
    setError(''); setParsing(true); setFileInfo('')
    try {
      const ext = f.name.split('.').pop().toLowerCase()
      let extracted = ''
      if (ext === 'pdf') {
        extracted = await extractPdfText(f)
      } else if (ext === 'docx' || ext === 'doc') {
        const buf = await f.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer: buf })
        extracted = result.value
      } else {
        const r = new FileReader()
        extracted = await new Promise((res, rej) => { r.onload = (ev) => res(ev.target.result); r.onerror = rej; r.readAsText(f) })
      }
      if (!extracted.trim()) throw new Error('Could not extract text. Try pasting instead.')
      setText(extracted)
      setFileInfo(`${f.name} · ~${Math.round(extracted.length / 4)} words extracted`)
    } catch (err) {
      setError(err.message || 'Failed to read file.')
    }
    setParsing(false)
  }

  const analyze = async () => {
    if (!text.trim()) return
    setAnalyzing(true); setError('')
    try {
      const safeText = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ').slice(0, 4000)
      const res = await callAI([{ role: 'user', content: `Analyze this resume. Return ONLY valid JSON:\n{"summary":"2 sentence summary","skills":["skill1"],"targetRoles":["Role1"],"experience":[{"title":"","company":"","period":""}],"education":[{"degree":"","institution":""}],"locations":["Remote"]}\n\nRESUME:\n${safeText}` }], { tokens: 4000 })
      const parsed = parseJSON(res)
      if (!parsed) throw new Error('Could not parse AI response. Try again.')
      onUpdate((prev) => ({ ...prev, resumeText: text, analyzedResume: parsed }))
    } catch (e) { setError(e.message) }
    setAnalyzing(false)
  }

  const runAts = async () => {
    if (!text.trim()) return
    setAtsLoading(true); setError('')
    try {
      const safeText = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ').slice(0, 4000)
      const [res, sem] = await Promise.all([
        callAIBackground(
          [{ role: 'user', content: `You are an ATS expert. Analyze this resume as a modern ATS would. Return ONLY valid JSON:\n{\n"overallScore":74,\n"scoreLabel":"Good",\n"categories":[\n{"name":"Contact & Header","score":90,"status":"pass","detail":"Name, email, phone present"},\n{"name":"Keywords & Skills","score":60,"status":"warn","detail":"Missing industry keywords"},\n{"name":"Work Experience","score":80,"status":"pass","detail":"Clear titles and dates"},\n{"name":"Quantified Achievements","score":50,"status":"warn","detail":"Only 2 of 8 bullets use numbers"},\n{"name":"Education","score":100,"status":"pass","detail":"Degree clearly listed"},\n{"name":"Formatting & Parsability","score":70,"status":"warn","detail":"Possible columns may confuse ATS"},\n{"name":"Resume Length","score":80,"status":"pass","detail":"1-2 pages is ideal"},\n{"name":"Section Headings","score":90,"status":"pass","detail":"Standard headings detected"}\n],\n"issues":[\n{"severity":"high","title":"No measurable impact","detail":"Add numbers/percentages to at least 5 bullets"},\n{"severity":"medium","title":"Missing keywords","detail":"Add: Docker, CI/CD, Agile, REST APIs"}\n],\n"topKeywordsFound":["Python","AWS","SQL"],\n"suggestedKeywords":["Docker","Kubernetes","CI/CD"],\n"quickWins":["Add LinkedIn URL","Use standard section names","Spell out acronyms"]\n}\n\nRESUME:\n${safeText}` }],
          { tokens: 6000, type: 'ats_scan', onStatus: (st) => console.error('[ats]', st) }
        ),
        callSemanticAnalyze({ resumeText: safeText, jobText: '' }).catch(() => null),
      ])
      const parsed = parseJSON(res)
      if (!parsed) throw new Error('Could not parse ATS response. Try again.')
      setSemanticResult(sem)
      onUpdate((prev) => ({ ...prev, resumeText: text, atsAnalysis: parsed, semanticAnalysis: sem }))
      setResumeTab('ats')
    } catch (e) { setError(e.message) }
    setAtsLoading(false)
  }

  const save = async () => {
    await onUpdate((prev) => ({ ...prev, resumeText: text }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const a = profileData?.analyzedResume
  const ats = profileData?.atsAnalysis

  const scoreColor = (sc) => sc >= 80 ? 'var(--text-success)' : sc >= 60 ? 'var(--text-warning)' : 'var(--text-error)'
  const scoreBg   = (sc) => sc >= 80 ? 'var(--bg-success)'   : sc >= 60 ? 'var(--bg-warning)'   : 'var(--bg-error)'
  const statusIcon = (st) => st === 'pass' ? '✓' : st === 'warn' ? '!' : '✕'
  const statusColor = (st) => st === 'pass' ? 'var(--text-success)' : st === 'warn' ? 'var(--text-warning)' : 'var(--text-error)'
  const statusBg    = (st) => st === 'pass' ? 'var(--bg-success)'   : st === 'warn' ? 'var(--bg-warning)'   : 'var(--bg-error)'
  const sevColor = (sv) => sv === 'high' ? 'var(--text-error)' : sv === 'medium' ? 'var(--text-warning)' : 'var(--text-muted)'
  const sevBg    = (sv) => sv === 'high' ? 'var(--bg-error)'   : sv === 'medium' ? 'var(--bg-warning)'   : 'var(--bg-metric)'

  return (
    <div className={s.page}>
      {/* Page header */}
      <div className={s.header}>
        <p className={s.headerEyebrow}>AI Analysis</p>
        <h1 className={s.headerTitle}>Your Resume</h1>
        <p className={s.headerSub}>Upload your resume for AI analysis, ATS scoring, and keyword optimization</p>
      </div>

      <div className={s.content}>
        {/* Upload zone / text editor */}
        {!text.trim() ? (
          <div className={s.uploadZone}>
            <div className={s.uploadIcon}>
              <svg width="32" height="32" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.2"/><line x1="5" y1="5.5" x2="11" y2="5.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/><line x1="5" y1="8.5" x2="11" y2="8.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/><line x1="5" y1="11.5" x2="8" y2="11.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>
            </div>
            <p className={s.uploadTitle}>Drop your resume PDF here or click to upload</p>
            <p className={s.uploadSub}>Supports PDF, Word, and plain text files</p>
            <button className={`${s.btn} ${s.btnSm}`} onClick={() => fileRef.current.click()} disabled={parsing}>
              {parsing ? 'Reading file…' : 'Upload PDF / Word / TXT'}
            </button>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.md" className={s.hidden} onChange={handleFile} aria-label="Upload resume file" />
            {error && <p className={s.errorText}>{error}</p>}
          </div>
        ) : (
          <div className={s.textArea}>
            <div className={s.textAreaHeader}>
              <p className={s.textAreaLabel}>Resume text</p>
              <button className={`${s.btn} ${s.btnSm}`} onClick={() => fileRef.current.click()} disabled={parsing}>
                {parsing ? 'Reading file…' : 'Upload PDF / Word / TXT'}
              </button>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.md" className={s.hidden} onChange={handleFile} aria-label="Upload resume file" />
            </div>
            {fileInfo && !parsing && <p className={s.fileInfo}>✓ {fileInfo}</p>}
            <textarea
              className={s.textarea}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your full resume here, or upload a PDF / Word / .txt file above…"
            />
            {error && <p className={s.errorText}>{error}</p>}
            <div className={s.actionRow}>
              <button className={s.btnPrimary} onClick={analyze} disabled={analyzing || !text.trim()}>
                {analyzing ? 'Analyzing…' : 'Analyze profile'}
              </button>
              <button className={s.btn} onClick={runAts} disabled={atsLoading || !text.trim()}>
                {atsLoading ? 'Running ATS scan…' : 'ATS score check'}
              </button>
              <button className={s.btn} onClick={save} disabled={!text.trim() || saved}>
                {saved ? 'Saved ✓' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {(a || ats) && (
          <>
            {/* Tab bar */}
            <div className={s.tabBar}>
              {[{ id: 'profile', label: 'Profile', show: !!a }, { id: 'ats', label: 'ATS Score', show: !!ats }].filter((t) => t.show).map((t) => (
                <button
                  key={t.id}
                  className={`${s.tabBtn}${resumeTab === t.id ? ` ${s.tabBtnActive}` : ''}`}
                  onClick={() => setResumeTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Profile tab */}
            {resumeTab === 'profile' && a && (
              <div className={s.profileGrid}>
                <div className={s.card}>
                  <p className={s.cardLabel}><span className={s.cardLabelDot} />SUMMARY</p>
                  <p className={s.cardText}>{a.summary}</p>
                </div>
                <div className={s.card}>
                  <p className={s.cardLabel}><span className={s.cardLabelDot} />TARGET ROLES</p>
                  <div className={s.pillList}>
                    {(a.targetRoles || []).map((r) => <span key={r} className={s.pillInfo}>{r}</span>)}
                  </div>
                </div>
                <div className={s.card}>
                  <p className={s.cardLabel}><span className={s.cardLabelDot} />SKILLS</p>
                  <div className={s.pillList}>
                    {(a.skills || []).map((sk) => <span key={sk} className={s.pill}>{sk}</span>)}
                  </div>
                </div>
                <div className={s.colStack}>
                  <div className={s.card}>
                    <p className={s.cardLabel}><span className={s.cardLabelDot} />EXPERIENCE</p>
                    <div className={s.entryList}>
                      {(a.experience || []).map((e, i) => (
                        <div key={i}>
                          <p className={s.entryTitle}>{e.title}</p>
                          <p className={s.entrySub}>{e.company}{e.period ? ` · ${e.period}` : ''}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={s.card}>
                    <p className={s.cardLabel}><span className={s.cardLabelDot} />EDUCATION</p>
                    <div className={s.entryList}>
                      {(a.education || []).map((e, i) => (
                        <div key={i}>
                          <p className={s.entryTitle}>{e.degree}</p>
                          <p className={s.entrySub}>{e.institution}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ATS tab */}
            {resumeTab === 'ats' && ats && (
              <div className={s.atsStack}>
                {/* Score card */}
                <div className={s.atsScoreCard}>
                  <div className={s.atsScoreCircle} style={{ background: scoreBg(ats.overallScore) }}>
                    <span className={s.atsScoreNum}>{ats.overallScore}</span>
                    <span className={s.atsScoreDen} style={{ color: scoreColor(ats.overallScore) }}>/ 100</span>
                  </div>
                  <div>
                    <p className={s.atsScoreLabel}>ATS score: {ats.scoreLabel}</p>
                    <p className={s.atsScoreDesc}>
                      {ats.overallScore >= 80 ? 'Well-optimized. Address remaining issues for maximum visibility.' : ats.overallScore >= 60 ? 'Passes most checks but has room to improve. Focus on high-severity issues first.' : 'May be filtered out before a human sees it. Tackle high-severity issues urgently.'}
                    </p>
                    <button className={`${s.btn} ${s.btnSm}`} onClick={runAts} disabled={atsLoading || !text.trim()}>
                      {atsLoading ? 'Re-scanning…' : '↻ Re-scan'}
                    </button>
                  </div>
                </div>

                {/* Category breakdown */}
                <div className={s.categoriesCard}>
                  <p className={s.cardLabel}>CATEGORY BREAKDOWN</p>
                  <div className={s.categoryList}>
                    {(ats.categories || []).map((cat) => (
                      <div key={cat.name}>
                        <div className={s.categoryRow}>
                          <div className={s.categoryName}>
                            <span className={s.statusBadge} style={{ background: statusBg(cat.status), color: statusColor(cat.status) }}>
                              {statusIcon(cat.status)}
                            </span>
                            <span className={s.categoryNameText}>{cat.name}</span>
                          </div>
                          <span className={s.categoryScore} style={{ color: scoreColor(cat.score) }}>{cat.score}</span>
                        </div>
                        <div className={s.progressTrack}>
                          <div className={s.progressFill} style={{ width: `${cat.score}%` }} />
                        </div>
                        <p className={s.categoryDetail}>{cat.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Issues */}
                {(ats.issues || []).length > 0 && (
                  <div className={s.card}>
                    <p className={s.cardLabel}>ISSUES FOUND</p>
                    <div className={s.colList}>
                      {ats.issues.map((issue, i) => (
                        <div key={i} className={s.issueItem} style={{ borderLeftColor: sevColor(issue.severity) }}>
                          <span className={s.issueSev} style={{ background: sevBg(issue.severity), color: sevColor(issue.severity) }}>{issue.severity}</span>
                          <div>
                            <p className={s.issueTitle}>{issue.title}</p>
                            <p className={s.issueDetail}>{issue.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Keywords */}
                <div className={s.twoColGrid}>
                  {(ats.topKeywordsFound || []).length > 0 && (
                    <div className={s.card}>
                      <p className={s.cardLabel}>KEYWORDS DETECTED</p>
                      <div className={s.pillList}>
                        {ats.topKeywordsFound.map((k) => <span key={k} className={s.pillSuccess}>✓ {k}</span>)}
                      </div>
                    </div>
                  )}
                  {(ats.suggestedKeywords || []).length > 0 && (
                    <div className={s.card}>
                      <p className={s.cardLabel}>MISSING KEYWORDS TO ADD</p>
                      <div className={s.pillList}>
                        {ats.suggestedKeywords.map((k) => <span key={k} className={s.pillError}>+ {k}</span>)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick wins */}
                {(ats.quickWins || []).length > 0 && (
                  <div className={s.card}>
                    <p className={s.cardLabel}>QUICK WINS</p>
                    <div className={s.colListSm}>
                      {ats.quickWins.map((w, i) => (
                        <div key={i} className={s.quickWinRow}>
                          <span className={s.quickWinNum}>0{i + 1}</span>
                          <p className={s.quickWinText}>{w}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Semantic analysis */}
                {semanticResult && (
                  <>
                    <div className={s.semCard}>
                      <div className={s.semHeader}>
                        <p className={s.semTitle}>Semantic keyword analysis</p>
                        <div className={s.semRate}>
                          <span className={s.semRateLabel}>Keyword match rate</span>
                          <span className={s.semRateValue}>{semanticResult.matchRate}%</span>
                        </div>
                      </div>
                      <p className={s.semDesc}>
                        TF-IDF vector similarity score: <strong>{Math.round((semanticResult.similarity || 0) * 100)}%</strong> — measures how semantically close your resume language is to typical job descriptions for your target roles.
                      </p>
                    </div>

                    <div className={s.twoColGrid}>
                      {(semanticResult.matchedKeywords || []).length > 0 && (
                        <div className={s.card}>
                          <p className={s.cardLabel}>STRONG SEMANTIC MATCHES</p>
                          <div className={s.pillList}>
                            {semanticResult.matchedKeywords.map((k) => <span key={k} className={s.pillSuccess}>✓ {k}</span>)}
                          </div>
                        </div>
                      )}
                      {(semanticResult.missingKeywords || []).length > 0 && (
                        <div className={s.card}>
                          <p className={s.cardLabel}>SEMANTIC GAPS TO FILL</p>
                          <div className={s.pillList}>
                            {semanticResult.missingKeywords.map((k) => <span key={k} className={s.pillError}>+ {k}</span>)}
                          </div>
                        </div>
                      )}
                    </div>

                    {(semanticResult.sectionScores || []).length > 0 && (
                      <div className={s.card}>
                        <p className={s.cardLabel}>RESUME SECTION STRENGTH</p>
                        <div className={s.colList}>
                          {semanticResult.sectionScores.map((sec) => (
                            <div key={sec.name}>
                              <div className={s.sectionScoreRow}>
                                <span className={s.sectionScoreName}>{sec.name}</span>
                                <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'monospace', color: sec.score >= 70 ? 'var(--text-success)' : sec.score >= 40 ? 'var(--text-warning)' : 'var(--text-error)' }}>{sec.score}</span>
                              </div>
                              <div className={s.progressTrack}>
                                <div className={s.progressFill} style={{ width: `${sec.score}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
