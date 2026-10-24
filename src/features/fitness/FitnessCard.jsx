// Today's Fitness card: progress (3/8, Day 5/30), the current session with a counter per
// exercise (− / + / tick fills the target / Edit), Done (active once every counter is complete)
// and Skip; after Done a countdown ring to the next session; once-a-day exercises below;
// "Day complete" at the end. The schedule itself is the server's (see src/lib/fitness.js).

import { useState } from 'react'
import { Link } from 'react-router'
import { useData } from '../../app/DataContext.jsx'
import { formatShortDate, warsawParts } from '../../lib/dates.js'
import { counts, isComplete, nextSessionAt, ordered, pendingSession, sessionReady, targetOn, unitLabel } from '../../lib/fitness.js'
import { completeSession, setDailyAmount, setSessionAmount, skipSession, startSessionNow } from '../../services/fitness.js'
import { Button } from '../../ui/basics.jsx'
import { useCelebrate } from '../../ui/Celebrate.jsx'
import { Icon } from '../../ui/Icons.jsx'
import { useNow } from '../meditation/timerState.js'
import { useFitness } from './FitnessContext.jsx'

const clock = (ms) => warsawParts(new Date(ms)).time
const round = (v) => Math.round(v * 100) / 100

export function FitnessCard() {
  const { uid } = useData()
  const { f, today, challengeDay, exercises, day, loaded, editExercise } = useFitness()
  const { celebrate, toast } = useCelebrate()
  const now = useNow(1000)
  const [busy, setBusy] = useState(false)
  if (!loaded) return null

  if (!challengeDay) {
    const before = today < f.startDate
    return (
      <Link to="/more/fitness" className="flex min-h-14 items-center justify-between gap-3 rounded-[18px] border border-line bg-surface px-4 py-3 text-ink no-underline">
        <span className="flex flex-col">
          <span className="text-[15px] font-bold">Fitness challenge</span>
          <span className="text-[13px] text-muted">{before ? `Starts ${formatShortDate(f.startDate)} · ${f.sessionsPerDay} sessions a day` : 'Finished. See your month in Fitness challenge.'}</span>
        </span>
        <Icon name="next" size={18} className="text-muted" />
      </Link>
    )
  }

  const c = counts(day)
  const open = pendingSession(day)
  const next = nextSessionAt(day, f)
  const complete = isComplete(day, f)
  const over = !open && next == null
  const byId = Object.fromEntries(exercises.map((e) => [e.id, e]))

  async function done() {
    if (!open || busy) return
    setBusy(true)
    try {
      await completeSession(uid, today, open)
      if (c.done + 1 >= f.sessionsPerDay) toast({ title: 'Day complete!', text: `${f.sessionsPerDay}/${f.sessionsPerDay} sessions · +${f.dayStars} stars` })
      else toast({ title: `Session ${open.n} done`, text: `Next one in ${f.intervalMin} min` })
      celebrate()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Fitness" className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <Link to="/more/fitness" className="text-base font-bold text-ink no-underline">
          Fitness
        </Link>
        <span className="text-[13px] font-semibold text-muted">
          Day {challengeDay}/{f.lengthDays} · <strong className="text-ink">{c.done}/{f.sessionsPerDay}</strong> today
        </span>
      </div>
      <Dots day={day} f={f} />

      {open ? (
        <>
          <div className="text-[15px] font-bold">
            Session {open.n}/{f.sessionsPerDay}
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {ordered(open.exercises).map(([id, x]) => (
              <CounterRow
                key={id}
                x={x}
                step={byId[id]?.step || 1}
                onSet={(v) => setSessionAmount(uid, today, open.n, id, v)}
                onEdit={byId[id] ? () => editExercise(byId[id]) : null}
              />
            ))}
          </ul>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Button size="lg" onClick={done} disabled={!sessionReady(open) || busy}>
              Done
            </Button>
            <Button size="lg" variant="outline" onClick={() => skipSession(uid, today, open)}>
              Skip
            </Button>
          </div>
        </>
      ) : over ? (
        <div className="flex items-center gap-3 rounded-[16px] bg-accent-soft p-3.5" role="status">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-on-accent">
            <Icon name="check" size={22} strokeWidth={2.6} />
          </span>
          <span className="flex flex-col">
            <span className="font-bold">{complete ? 'Day complete' : 'Done for today'}</span>
            <span className="text-[13px] text-muted">
              {c.done}/{f.sessionsPerDay} sessions{complete ? ` · +${f.dayStars} stars` : ''}
            </span>
          </span>
        </div>
      ) : (
        <Countdown next={next} now={now} day={day} f={f} onStart={() => startSessionNow(uid, day, exercises)} />
      )}

      <DailyRows />
    </section>
  )
}

// 8 small segments: done / skipped / missed / open / to come, each with a text alternative
function Dots({ day, f }) {
  const byN = Object.fromEntries(Object.values(day.sessions || {}).map((s) => [s.n, s.status]))
  const label = { done: 'done', skipped: 'skipped', missed: 'missed', pending: 'now' }
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${f.sessionsPerDay}, minmax(0, 1fr))` }} aria-label="Sessions today">
      {Array.from({ length: f.sessionsPerDay }, (_, i) => {
        const st = byN[i + 1]
        const cls = st === 'done' ? 'bg-accent' : st === 'pending' ? 'bg-accent-soft ring-2 ring-accent' : st === 'skipped' || st === 'missed' ? 'bg-line' : 'bg-surface-2'
        return <span key={i} className={`h-2 rounded-full ${cls}`} title={`Session ${i + 1}: ${label[st] || 'to come'}`} aria-label={`Session ${i + 1}: ${label[st] || 'to come'}`} />
      })}
    </div>
  )
}

function CounterRow({ x, step, onSet, onEdit }) {
  const reached = (x.done ?? 0) >= x.target
  const unit = unitLabel(x, x.target)
  return (
    <li className="flex items-center gap-2">
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="text-xl" aria-hidden="true">
          {x.emoji}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold">{x.name}</span>
          <span className="block text-[13px] text-muted">
            {round(x.done ?? 0)} / {x.target} {unit}
          </span>
        </span>
      </span>
      <button type="button" aria-label={`${x.name} minus ${step}`} onClick={() => onSet(round((x.done ?? 0) - step))} className="grid size-11 place-items-center rounded-full border border-line">
        <Icon name="minus" size={18} />
      </button>
      <button type="button" aria-label={`${x.name} plus ${step}`} onClick={() => onSet(round((x.done ?? 0) + step))} className="grid size-11 place-items-center rounded-full border border-line">
        <Icon name="plus" size={18} />
      </button>
      <button
        type="button"
        aria-label={reached ? `${x.name} done` : `${x.name}: fill in the target`}
        aria-pressed={reached}
        onClick={() => onSet(reached ? 0 : x.target)}
        className={`grid size-11 place-items-center rounded-full border ${reached ? 'border-accent bg-accent text-on-accent' : 'border-line text-muted'}`}
      >
        <Icon name="check" size={20} strokeWidth={2.6} />
      </button>
      {onEdit && (
        <button type="button" aria-label={`Edit ${x.name}`} onClick={onEdit} className="grid size-11 place-items-center rounded-full text-muted">
          <Icon name="edit" size={18} />
        </button>
      )}
    </li>
  )
}

function Countdown({ next, now, day, f, onStart }) {
  const prevDone = Object.values(day.sessions || {}).sort((a, b) => b.n - a.n)[0]
  const start = prevDone ? (prevDone.status === 'missed' ? prevDone.scheduledAt : prevDone.completedAt ?? prevDone.scheduledAt) : next - 60 * 60000
  const total = Math.max(1, next - start)
  const left = Math.max(0, next - now)
  const ratio = 1 - left / total
  const mins = Math.ceil(left / 60000)
  const r = 26
  const circ = 2 * Math.PI * r
  return (
    <div className="flex items-center gap-4">
      <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`Next session in ${mins} minutes`}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${circ * ratio} ${circ}`} transform="rotate(-90 32 32)" />
      </svg>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-bold">
          Next session {Object.keys(day.sessions || {}).length + 1}/{f.sessionsPerDay} at {clock(next)}
        </span>
        <span className="text-[13px] text-muted" role="timer">
          {mins >= 60 ? `in ${Math.floor(mins / 60)} h ${mins % 60} min` : `in ${mins} min`}
        </span>
      </div>
      <Button variant="soft" size="sm" onClick={onStart}>
        Do it now
      </Button>
    </div>
  )
}

function DailyRows() {
  const { uid } = useData()
  const { exercises, day, editExercise } = useFitness()
  const list = exercises.filter((e) => e.frequency === 'daily' && e.enabled !== false && !e.archived).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  if (!list.length) return null
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <span className="text-[13px] font-semibold text-muted">Once a day</span>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {list.map((e) => {
          const saved = day.daily?.[e.id]
          const x = saved || { name: e.name, emoji: e.emoji, unit: e.unit, customUnit: e.customUnit, target: 0, done: 0 }
          const target = saved?.target ?? undefined
          return (
            <CounterRow
              key={e.id}
              x={target === undefined ? { ...x, target: targetOn(e, day.date) } : x}
              step={e.step || 1}
              onSet={(v) => setDailyAmount(uid, day, exercises, e.id, v)}
              onEdit={() => editExercise(e)}
            />
          )
        })}
      </ul>
    </div>
  )
}
