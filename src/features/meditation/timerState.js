// When was the running timer last drawn on a visible screen? Used to tell
// "I watched it finish" (finish by itself) from "it ended while I was away" (ask first).

import { useEffect, useState } from 'react'

let lastSeenAt = null

export function markSeen(now = Date.now()) {
  lastSeenAt = now
}

export function lastSeen() {
  return lastSeenAt
}

// Re-render every `ms` (only to redraw: all timing comes from timestamps)
export function useNow(ms = 250) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

// Keep the screen on while `active` (Screen Wake Lock). The browser drops the lock when the
// app is hidden, so take it again when it comes back.
export function useWakeLock(active) {
  const [supported] = useState(() => 'wakeLock' in navigator)
  useEffect(() => {
    if (!active || !supported) return
    let lock = null
    let cancelled = false
    const request = async () => {
      try {
        if (document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen')
      } catch {
        // battery saver etc.: fine, the timer still works
      }
      if (cancelled) lock?.release()
    }
    const onVisible = () => document.visibilityState === 'visible' && request()
    request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [active, supported])
  return supported
}
