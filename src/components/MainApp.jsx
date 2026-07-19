import { useState, useEffect, useCallback } from 'react'
import { dbGet, dbSet } from '../lib/api'
import { todayStr } from '../lib/helpers'
import { useBreakpoint } from '../lib/hooks'
import { TopNav } from './TopNav'
import { BottomNav } from './BottomNav'
import { Dashboard } from './Dashboard'
import { Resume } from './Resume'
import { Jobs } from './Jobs'
import { Applications } from './Applications'
import { Settings } from './Settings'
import s from './MainApp.module.css'

const VALID_TABS = ['dashboard', 'resume', 'jobs', 'applications', 'settings']
const tabFromHash = () => {
  const h = window.location.hash.replace('#', '')
  return VALID_TABS.includes(h) ? h : null
}

// ─── WelcomeModal ────────────────────────────────────────────────────────────
function WelcomeModal({ onDismiss, onGetStarted }) {
  const steps = [
    {
      icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="4" y="2" width="20" height="24" rx="3" stroke="currentColor" strokeWidth="1.6"/><line x1="9" y1="9" x2="19" y2="9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><line x1="9" y1="13" x2="19" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><line x1="9" y1="17" x2="14" y2="17" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
      title: 'Upload Resume',
      desc: 'Upload your PDF or paste text. AI analyzes skills, experience, and gives you an ATS score.',
    },
    {
      icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6"/><line x1="18" y1="18" x2="25" y2="25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
      title: 'Search Jobs',
      desc: 'Find AI-matched jobs from Google Jobs. Each is scored 0-100% against your resume.',
    },
    {
      icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="2" y="6" width="24" height="16" rx="3" stroke="currentColor" strokeWidth="1.6"/><path d="M2 10l12 7 12-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
      title: 'Apply',
      desc: 'Generate tailored cover letters, customize your resume, and apply with one click.',
    },
    {
      icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="3" y="3" width="22" height="22" rx="4" stroke="currentColor" strokeWidth="1.6"/><polyline points="8,15 12,19 20,10" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      title: 'Track Progress',
      desc: 'Monitor applications from applied through interview to offer, with tasks and notes.',
    },
  ]

  return (
    <div className={s.welcomeOverlay}>
      <div className={s.welcomeModal}>
        <div className={s.welcomeHeader}>
          <div className={s.welcomeEyebrow}>Welcome to Job Neuron</div>
          <div className={s.welcomeTitle}>Your AI-Powered Job Search</div>
          <div className={s.welcomeSub}>Here is how to get the most out of Job Neuron in 4 simple steps</div>
        </div>
        <div className={s.stepsGrid}>
          {steps.map((step, i) => (
            <div key={i} className={s.step}>
              <div className={s.stepIcon}>{step.icon}</div>
              <div className={s.stepTitle}>
                <span className={s.stepNum}>{i + 1}.</span>{step.title}
              </div>
              <div className={s.stepDesc}>{step.desc}</div>
            </div>
          ))}
        </div>
        <div className={s.welcomeActions}>
          <button onClick={onDismiss} className={s.welcomeBtnGhost}>Skip</button>
          <button onClick={onGetStarted} className={s.welcomeBtnPrimary}>Get Started</button>
        </div>
      </div>
    </div>
  )
}

export function MainApp({ profile, onSwitch, onLogout, userEmail, isAdmin, onOpenAdmin }) {
  const [tab, setTabRaw] = useState(() => tabFromHash() || sessionStorage.getItem('jh_active_tab') || 'dashboard')
  const [profileData, setProfileData] = useState(null)
  const [todayJobCount, setTodayJobCount] = useState(0)
  const [openAppCount, setOpenAppCount] = useState(0)
  const [showWelcome, setShowWelcome] = useState(false)
  // sidebarCollapsed state REMOVED

  // Push a history entry then update state — pushState must live outside the
  // state updater so React 18 concurrent mode cannot double-invoke it.
  const setTab = useCallback((t) => {
    if (window.location.hash !== `#${t}`) {
      window.history.pushState({ tab: t }, '', `#${t}`)
    }
    setTabRaw(t)
  }, [])

  // PRESERVE: listen for browser back/forward
  useEffect(() => {
    const onPopState = (e) => {
      const t = e.state?.tab || tabFromHash()
      if (t && VALID_TABS.includes(t)) setTabRaw(t)
    }
    window.addEventListener('popstate', onPopState)
    if (!tabFromHash()) window.history.replaceState({ tab }, '', `#${tab}`)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // PRESERVE: profile data fetch
  useEffect(() => {
    dbGet(`jh_p_${profile.id}`).then((d) =>
      setProfileData(d || { ...profile, resumeText: '', analyzedResume: null, preferences: { locations: 'United States', roles: '' } })
    )
  }, [profile.id])

  // PRESERVE: counts for badge display
  useEffect(() => {
    ;(async () => {
      const [todayJobs, apps] = await Promise.all([
        dbGet(`jh_jobs_pool_${profile.id}_${todayStr()}`),
        dbGet(`jh_apps_${profile.id}`),
      ])
      setTodayJobCount((todayJobs || []).length)
      setOpenAppCount((apps || []).filter(a => !['rejected', 'offer'].includes(a.status)).length)
    })()
  }, [profile.id])

  // PRESERVE: sessionStorage active tab
  useEffect(() => { sessionStorage.setItem('jh_active_tab', tab) }, [tab])

  // PRESERVE: welcome modal check
  useEffect(() => {
    dbGet(`jh_welcomed_${profile.id}`).then((v) => { if (!v) setShowWelcome(true) })
  }, [profile.id])

  const { isMobile, isTablet } = useBreakpoint()

  // PRESERVE: updateProfile helper unchanged
  const updateProfile = async (updater) => {
    return new Promise((resolve) => {
      setProfileData((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        dbSet(`jh_p_${profile.id}`, next).then(resolve).catch((e) => { console.error(e); resolve() })
        return next
      })
    })
  }

  if (!profileData) return (
    <div className={`${s.layout} ${s.layoutCentered}`}>
      <p className={s.loadingText}>Loading profile…</p>
    </div>
  )

  return (
    <div className={s.layout}>
      <a href="#main-content" className={s.skipLink}>Skip to main content</a>
      <TopNav
        tab={tab} setTab={setTab} profile={profile} onSwitch={onSwitch}
        onLogout={onLogout} userEmail={userEmail} isAdmin={isAdmin}
        onOpenAdmin={onOpenAdmin} todayJobCount={todayJobCount}
        openAppCount={openAppCount}
      />
      <main className={s.main} id="main-content">
        {tab === 'dashboard'    && <Dashboard    profile={profile} profileData={profileData} setTab={setTab} isMobile={isMobile} isTablet={isTablet} />}
        {tab === 'resume'       && <Resume        profile={profile} profileData={profileData} onUpdate={updateProfile} isMobile={isMobile} />}
        {tab === 'jobs'         && <Jobs          profile={profile} profileData={profileData} isMobile={isMobile} />}
        {tab === 'applications' && <Applications  profile={profile} profileData={profileData} isMobile={isMobile} />}
        {tab === 'settings'     && <Settings      profile={profile} profileData={profileData} onUpdate={updateProfile} onSwitch={onSwitch} onLogout={onLogout} isMobile={isMobile} isTablet={isTablet} isAdmin={isAdmin} onOpenAdmin={onOpenAdmin} />}
      </main>
      <BottomNav tab={tab} setTab={setTab} todayJobCount={todayJobCount} openAppCount={openAppCount} isMobile={isMobile} />
      {showWelcome && (
        <WelcomeModal
          onDismiss={() => { setShowWelcome(false); dbSet(`jh_welcomed_${profile.id}`, true) }}
          onGetStarted={() => { setShowWelcome(false); dbSet(`jh_welcomed_${profile.id}`, true); setTab('resume') }}
        />
      )}
    </div>
  )
}
