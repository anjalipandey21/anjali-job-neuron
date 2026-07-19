import { useState, useEffect } from 'react'
import { dbGet } from '../lib/api'
import { todayStr, fmtDate } from '../lib/helpers'
import { Badge } from '../lib/styles'
import s from './Dashboard.module.css'

export function Dashboard({ profile, profileData, setTab }) {
  const [stats, setStats] = useState({ jobsToday: 0, totalApplied: 0, interviews: 0, offers: 0 })
  const [recentApps, setRecentApps] = useState([])
  const [upcomingTasks, setUpcomingTasks] = useState([])

  useEffect(() => {
    ;(async () => {
      // Parallelize the initial dashboard fetches
      const [appsData, todayJobsData] = await Promise.all([
        dbGet(`jh_apps_${profile.id}`),
        dbGet(`jh_jobs_pool_${profile.id}_${todayStr()}`)
      ])

      const apps = appsData || []
      const todayJobs = todayJobsData || []

      setRecentApps(apps.slice(-5).reverse())
      setStats({
        jobsToday: todayJobs.length,
        totalApplied: apps.length,
        interviews: apps.filter((a) => a.status === 'interview').length,
        offers: apps.filter((a) => a.status === 'offer').length,
      })
      // Load tasks across all applications (most recent 20)
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + 7)
      const cutoffStr = cutoff.toISOString().split('T')[0]

      // Fetch tasks concurrently instead of sequentially
      const taskArrays = await Promise.all(
        apps.map(async (app) => {
          const tasks = (await dbGet(`jh_tasks_${profile.id}_${app.jobId}`)) || []
          return tasks
            .filter((t) => !t.completed)
            .map((t) => ({ ...t, jobTitle: app.jobTitle, company: app.company }))
        })
      )

      const allTasks = taskArrays.flat()

      setUpcomingTasks(
        allTasks
          .filter((t) => t.dueDate && t.dueDate <= cutoffStr)
          .sort((a, b) => a.dueDate > b.dueDate ? 1 : -1)
          .slice(0, 8)
      )
    })()
  }, [profile.id])

  const hasResume = profileData?.resumeText?.length > 50
  const hasAnalysis = !!profileData?.analyzedResume

  const metrics = [
    { label: 'Jobs found today', val: stats.jobsToday,    accent: '#8839ef', icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4"/><line x1="11" y1="11" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
    { label: 'Total applied',    val: stats.totalApplied, accent: '#1e66f5', icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M1 5l7 5 7-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
    { label: 'Interviews',       val: stats.interviews,   accent: '#df8e1d', icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 3h12a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3"/></svg> },
    { label: 'Offers',           val: stats.offers,       accent: '#40a02b', icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1l2.1 4.3 4.7.7-3.4 3.3.8 4.7L8 11.8 3.8 14l.8-4.7L1.2 6l4.7-.7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg> },
  ]

  const quickActions = [
    { label: 'Find jobs', tab: 'jobs', icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4"/><line x1="11" y1="11" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
    { label: hasResume ? 'Update or re-analyze resume' : 'Add your resume', tab: 'resume', icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/><line x1="5" y1="5.5" x2="11" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="5" y1="8.5" x2="11" y2="8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="5" y1="11.5" x2="8" y2="11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> },
    { label: 'View all applications', tab: 'applications', icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M1 5l7 5 7-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
  ]

  return (
    <div className={s.page}>
      {/* Page header */}
      <div className={s.header}>
        <p className={s.headerEyebrow}>Overview</p>
        <h1 className={s.headerTitle}>Dashboard</h1>
        <p className={s.headerSub}>Track your metrics, upcoming tasks, and recent activity across all applications</p>
      </div>

      {/* Metrics grid */}
      <div className={s.metricsSection}>
        <div className={s.metricsGrid}>
          {metrics.map((m) => (
            <div key={m.label} className={s.metricCard}>
              <span className={s.metricAccent} style={{ background: m.accent }} />
              <div className={s.metricIcon} style={{ background: `${m.accent}1a`, color: m.accent }}>{m.icon}</div>
              <p className={s.metricLabel}>{m.label}</p>
              <p className={s.metricValue} style={{ color: m.accent }}>{m.val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className={s.content}>
        {!hasResume && (
          <div className={`${s.bannerCard} ${s.bannerWarning}`}>
            <p className={`${s.bannerTitle} ${s.bannerTitleWarning}`}>Resume missing — add yours to start</p>
            <p className={`${s.bannerText} ${s.bannerTitleWarning}`}>Upload your resume so AI can find matching jobs and tailor applications for you.</p>
            <button className={s.bannerBtn} onClick={() => setTab('resume')}>Add resume →</button>
          </div>
        )}
        {hasResume && !hasAnalysis && (
          <div className={`${s.bannerCard} ${s.bannerInfo}`}>
            <p className={`${s.bannerTitle} ${s.bannerTitleInfo}`}>Resume saved — run AI analysis to unlock job matching</p>
            <button className={s.bannerBtn} onClick={() => setTab('resume')}>Analyze now →</button>
          </div>
        )}

        <div className={s.lowerGrid}>
          <div className={s.card}>
            <p className={s.cardTitle}>Quick actions</p>
            <div className={s.actionsList}>
              {quickActions.map((a) => (
                <button key={a.tab} className={s.actionBtn} onClick={() => setTab(a.tab)}>
                  <span className={s.iconWrap}>{a.icon}</span>
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div className={s.card}>
            <p className={s.cardTitle}>Recent applications</p>
            {recentApps.length === 0 ? (
              <p className={s.emptyText}>No applications yet.</p>
            ) : (
              <div className={s.appList}>
                {recentApps.map((a) => (
                  <div key={a.jobId} className={s.appRow}>
                    <div className={s.appInfo}>
                      <p className={s.appTitle}>{a.jobTitle}</p>
                      <p className={s.appCompany}>{a.company}</p>
                    </div>
                    <Badge status={a.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {upcomingTasks.length > 0 && (
          <div className={s.tasksCard}>
            <div className={s.tasksHeader}>
              <p className={s.cardTitle} style={{ margin: 0 }}>Upcoming tasks</p>
              <button className={s.viewAllBtn} onClick={() => setTab('applications')}>View all →</button>
            </div>
            <div>
              {upcomingTasks.map((t) => {
                const overdue = t.dueDate && t.dueDate < todayStr()
                return (
                  <div key={t.id} className={s.taskRow}>
                    <div className={s.taskInfo}>
                      <p className={`${s.taskTitle}${overdue ? ` ${s['taskTitle--overdue']}` : ''}`}>
                        {t.title}
                      </p>
                      <p className={s.taskMeta}>{t.jobTitle} · {t.company}</p>
                    </div>
                    {t.dueDate && (
                      <span className={overdue ? s.taskDueOverdue : s.taskDueNormal}>
                        {overdue ? 'Overdue' : `Due ${fmtDate(t.dueDate)}`}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
