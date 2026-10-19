// Shown anywhere in the app when a meditation ended while I was away: "Did you finish?"
// Yes → stars. No → not counted.

import { useLocation } from 'react-router'
import { useData } from '../../app/DataContext.jsx'
import { endedUnseen } from '../../lib/meditation.js'
import { Button } from '../../ui/basics.jsx'
import { Sheet } from '../../ui/Sheet.jsx'
import { lastSeen, useNow } from './timerState.js'
import { useFinishMeditation } from './useFinishMeditation.js'

export function MeditationPrompt() {
  const { activeMeditation: s, values } = useData()
  const { pathname } = useLocation()
  const now = useNow(1000)
  const { finish, cancel } = useFinishMeditation()
  // On the timer screen a watched ending finishes by itself; everywhere else, ask
  const ask = s && endedUnseen(s, pathname === '/meditate' ? lastSeen() : null, now)
  if (!ask) return null
  return (
    <Sheet open compact title="Did you finish?" onClose={() => {}}>
      <p className="mt-0 text-[15px] text-muted">
        Your {s.slot} meditation ({s.plannedMin} min) ended while the app was in the background.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 pb-2">
        <Button variant="soft" onClick={() => cancel(s)}>
          No
        </Button>
        <Button onClick={() => finish(s)}>Yes · +{values.meditation}</Button>
      </div>
    </Sheet>
  )
}
