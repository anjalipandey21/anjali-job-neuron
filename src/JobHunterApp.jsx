import { useState } from 'react'
import { ProfileSelect } from './components/ProfileSelect'
import { MainApp } from './components/MainApp'

export default function JobHunterApp({ user, onLogout, isAdmin, onOpenAdmin }) {
  const saved = (() => {
    try { return JSON.parse(sessionStorage.getItem('jh_active_profile')) } catch { return null }
  })()
  const [view, setView] = useState(saved ? 'app' : 'profiles')
  const [activeProfile, setActiveProfile] = useState(saved)
  const [switching, setSwitching] = useState(false)
  const userEmail = user?.email || ''

  const handleSelect = (p) => {
    setActiveProfile(p)
    setView('app')
    setSwitching(false)
    try { sessionStorage.setItem('jh_active_profile', JSON.stringify(p)) } catch {}
  }

  const handleSwitch = () => {
    setSwitching(true)
    setActiveProfile(null)
    setView('profiles')
    sessionStorage.removeItem('jh_active_profile')
  }

  return (
    <>
      {view === 'profiles'
        ? <ProfileSelect onSelect={handleSelect} onLogout={onLogout} user={user} forcePicker={switching} />
        : <MainApp profile={activeProfile} onSwitch={handleSwitch} onLogout={onLogout} userEmail={userEmail} isAdmin={isAdmin} onOpenAdmin={onOpenAdmin} />}
    </>
  )
}
