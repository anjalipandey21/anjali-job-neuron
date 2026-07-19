import { useState, useEffect } from 'react'

export function useBreakpoint() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 480px)').matches : false
  )
  const [isTablet, setIsTablet] = useState(
    () => typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(min-width: 481px) and (max-width: 768px)').matches : false
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mqMobile = window.matchMedia('(max-width: 480px)')
    const mqTablet = window.matchMedia('(min-width: 481px) and (max-width: 768px)')
    // Sync in case viewport changed between lazy init and effect attachment
    setIsMobile(mqMobile.matches)
    setIsTablet(mqTablet.matches)
    const onMobile = (e) => setIsMobile(e.matches)
    const onTablet = (e) => setIsTablet(e.matches)
    mqMobile.addEventListener('change', onMobile)
    mqTablet.addEventListener('change', onTablet)
    return () => {
      mqMobile.removeEventListener('change', onMobile)
      mqTablet.removeEventListener('change', onTablet)
    }
  }, [])

  return { isMobile, isTablet }
}
