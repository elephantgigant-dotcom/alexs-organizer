// Today's Warsaw date key, refreshed every minute (so the app rolls over at midnight).

import { useEffect, useState } from 'react'
import { todayKey } from '../lib/dates.js'

export function useToday() {
  const [today, setToday] = useState(todayKey)
  useEffect(() => {
    const t = setInterval(() => setToday(todayKey()), 60000)
    return () => clearInterval(t)
  }, [])
  return today
}
