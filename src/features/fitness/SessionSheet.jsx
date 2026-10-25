// Edit one of today's sessions (tap its block on the Today card): change the amounts, mark it
// done or skipped (e.g. Skip tapped by mistake), or undo an early "Do it now" session.

import { useData } from '../../app/DataContext.jsx'
import { warsawParts } from '../../lib/dates.js'
import { ordered } from '../../lib/fitness.js'
import { cancelEarlySession, setSessionAmount, setSessionStatus } from '../../services/fitness.js'
import { Button } from '../../ui/basics.jsx'
import { useCelebrate } from '../../ui/Celebrate.jsx'
import { Sheet } from '../../ui/Sheet.jsx'
import { CounterRow } from './FitnessCard.jsx'
import { useFitness } from './FitnessContext.jsx'

const STATUS = { done: 'Done', skipped: 'Skipped', missed: 'Missed', pending: 'Open now' }
const clock = (ms) => (ms ? warsawParts(new Date(ms)).time : '')

export function SessionSheet({ n, onClose }) {
  const { uid } = useData()
  const { f, today, day, exercises } = useFitness()
  const { toast } = useCelebrate()
  const s = day.sessions?.[n]
  if (!s) return null
  const byId = Object.fromEntries(exercises.map((e) => [e.id, e]))
  const time = s.status === 'done' || s.status === 'skipped' ? clock(s.completedAt) : clock(s.scheduledAt)

  async function mark(status) {
    await setSessionStatus(uid, today, s, status)
    toast({ title: `Session ${n} ${status === 'done' ? 'marked done' : 'marked skipped'}` })
    onClose()
  }

  async function cancel() {
    await cancelEarlySession(uid, today, s)
    toast({ title: `Session ${n} removed`, text: 'The countdown to the next session is back.' })
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Session ${n}/${f.sessionsPerDay}`}
      footer={
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={s.status === 'done'} onClick={() => mark('done')}>
              Mark done
            </Button>
            <Button variant="outline" disabled={s.status === 'skipped'} onClick={() => mark('skipped')}>
              Mark skipped
            </Button>
          </div>
          {s.source === 'manual' && s.status === 'pending' && (
            <Button variant="ghost" onClick={cancel}>
              Undo "Do it now"
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-2">
        <p className="m-0 text-[15px] text-muted">
          <strong className="text-ink">{STATUS[s.status] || s.status}</strong>
          {time ? ` · ${time}` : ''}
          {s.source === 'manual' ? ' · started early by me' : ''}
        </p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {ordered(s.exercises).map(([id, x]) => (
            <CounterRow key={id} x={x} step={byId[id]?.step || 1} onSet={(v) => setSessionAmount(uid, today, n, id, v)} onEdit={null} />
          ))}
        </ul>
        <p className="m-0 text-[13px] text-muted">"Mark done" fills every amount up to its target. The next sessions keep their times.</p>
      </div>
    </Sheet>
  )
}
