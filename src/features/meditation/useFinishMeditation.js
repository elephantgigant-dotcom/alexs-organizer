// Finish / cancel a session, with stars and a small celebration.

import { useRef } from 'react'
import { useData } from '../../app/DataContext.jsx'
import { cancelMeditation, finishMeditation } from '../../services/meditations.js'
import { useCelebrate } from '../../ui/Celebrate.jsx'

export function useFinishMeditation() {
  const { uid, values, meditationDays } = useData()
  const { toast, celebrate } = useCelebrate()
  const busy = useRef(false)

  async function finish(session) {
    if (busy.current) return
    busy.current = true
    try {
      const { paid } = await finishMeditation(uid, session, { values, meditationDays })
      celebrate()
      toast({ title: paid ? `+${paid} stars` : 'Meditation done', text: 'Well done. Take that calm with you.' })
    } catch (e) {
      toast({ title: "Couldn't save", text: e.message })
    } finally {
      busy.current = false
    }
  }

  async function cancel(session) {
    await cancelMeditation(uid, session)
  }

  return { finish, cancel }
}
