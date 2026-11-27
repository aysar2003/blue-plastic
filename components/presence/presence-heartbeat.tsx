'use client'

import { useEffect, useRef } from 'react'

import { PRESENCE_HEARTBEAT_MS } from '@/lib/presence'

/**
 * While the desk is open, ping /api/presence/heartbeat so admins can see
 * who is online. Pauses when the tab is hidden; fires on focus / visibility.
 */
export function PresenceHeartbeat() {
  const inFlight = useRef(false)

  useEffect(() => {
    let cancelled = false

    const beat = async () => {
      if (cancelled || inFlight.current) return
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      inFlight.current = true
      try {
        await fetch('/api/presence/heartbeat', {
          method: 'POST',
          credentials: 'same-origin',
          keepalive: true,
        })
      } catch {
        // Offline / transient — next interval retries.
      } finally {
        inFlight.current = false
      }
    }

    void beat()
    const timer = window.setInterval(() => void beat(), PRESENCE_HEARTBEAT_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') void beat()
    }
    const onFocus = () => void beat()

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return null
}
