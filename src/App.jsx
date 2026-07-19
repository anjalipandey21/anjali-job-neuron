import { useState, useEffect } from 'react'
import JobHunterApp from './JobHunterApp'
import AdminPanel from './components/AdminPanel'
import { getMyRole } from './lib/api'
import { GlobalStyles } from './lib/styles'
import s from './App.module.css'

const ni = () => window.netlifyIdentity

export default function App() {
  const [user, setUser]       = useState(null)
  const [role, setRole]       = useState(null)   // 'admin' | 'user' | null
  const [view, setView]       = useState(() => sessionStorage.getItem('jh_active_view') || 'app')
  const [loading, setLoading] = useState(true)

  const resolveRole = async (u) => {
    if (!u) { setRole(null); setLoading(false); return }
    const r = await getMyRole()
    setRole(r)
    setLoading(false)
  }

  useEffect(() => {
    sessionStorage.setItem('jh_active_view', view)
  }, [view])

  useEffect(() => {
    // The init event passes the user directly — use it instead of currentUser()
    const onInit = async (u) => {
      if (u) {
        try {
          await u.jwt() // Verify token is valid and refreshable before trusting the session
        } catch {
          // Token is expired and cannot be refreshed — treat as logged out
          setUser(null); setRole(null); setLoading(false)
          return
        }
      }
      setUser(u || null)
      resolveRole(u || null)
    }
    const onLogin = (u) => { setUser(u); ni().close(); resolveRole(u) }
    const onLogout = () => {
      setUser(null)
      setRole(null)
      setView('app')
      // Don't clear jh_active_profile here — Identity fires 'logout' during normal
      // token refresh before re-firing 'init' with a valid user. Clearing it would
      // cause the profile picker to reappear on every refresh. The stored profile
      // is cleared only when the user explicitly switches profiles (handleSwitch).
      sessionStorage.removeItem('jh_active_view')
      sessionStorage.removeItem('jh_active_tab')
      sessionStorage.removeItem('jh_resume_tab')
      sessionStorage.removeItem('jh_admin_tab')
      try { localStorage.removeItem('jh_role_cache') } catch {}
    }

    const wireUp = () => {
      ni().on('init', onInit)
      ni().on('login', onLogin)
      ni().on('logout', onLogout)
      ni().init({ APIUrl: 'https://jobneuron.netlify.app/.netlify/identity' })
    }

    if (ni()) {
      wireUp()
    } else {
      // Identity widget script not loaded yet — retry until it is (up to 5s)
      let attempts = 0
      const poll = setInterval(() => {
        attempts++
        if (ni()) {
          clearInterval(poll)
          wireUp()
        } else if (attempts >= 25) {
          clearInterval(poll)
          setLoading(false) // give up — show login screen
        }
      }, 200)
    }

    return () => { ni()?.off?.('init', onInit) }
  }, [])

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
}

function Splash() {
  return (
    <div className={s.center}>
      <Logo />
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 12 }}>Loading…</p>
    </div>
  )
}

function LoginScreen() {
  return (
    <div className={s.center}>
      <div className={s.loginCard}>
        <Logo />
        <p className={s.subtext}>
          Your AI-powered daily job search.<br />Sign in to access your dashboard.
        </p>
        <button onClick={() => ni()?.open('login')} className={s.btnPrimary}>
          Sign in
        </button>
        <button onClick={() => ni()?.open('signup')} className={s.btnSecondary}>
          Create account
        </button>
        <p className={s.inviteNote}>Access is by invitation only.</p>
      </div>
    </div>
  )
}

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, justifyContent: 'center' }}>
      <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #8839ef, #7c3aed)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(136,57,239,0.35)' }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="white"><circle cx="9" cy="6.5" r="3.5"/><path d="M2 16c0-3.5 3.1-5.5 7-5.5s7 2 7 5.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
      </div>
      <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>Job Neuron</span>
    </div>
  )
}

