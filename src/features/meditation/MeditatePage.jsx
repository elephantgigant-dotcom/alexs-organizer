// Meditation: choose morning / evening and the length (5–30 min), then a big calm timer.
// Timestamp-based, soft bell at start and end, the screen stays on (Wake Lock).

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useData } from '../../app/DataContext.jsx'
import { todayKey, warsawParts } from '../../lib/dates.js'
import { clampMinutes, endedUnseen, formatClock, isOver, MAX_MINUTES, MIN_MINUTES, progress, remainingMs, slotFor } from '../../lib/meditation.js'
import { pauseMeditation, resumeMeditation, startMeditation } from '../../services/meditations.js'
import { Button, IconButton, Segmented } from '../../ui/basics.jsx'
import { useCelebrate } from '../../ui/Celebrate.jsx'
import { ConfirmSheet } from '../../ui/Sheet.jsx'
import { playBell, unlockBell } from './bell.js'
import { lastSeen, markSeen, useNow, useWakeLock } from './timerState.js'
import { useFinishMeditation } from './useFinishMeditation.js'

export function MeditatePage() {
  const { activeMeditation } = useData()
  const navigate = useNavigate()
  const [justFinished, setJustFinished] = useState(null)
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-8" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)' }}>
      {justFinished ? (
        <Finished session={justFinished} onDone={() => navigate('/')} />
      ) : activeMeditation ? (
        <Timer session={activeMeditation} onFinished={setJustFinished} />
      ) : (
        <Setup />
      )}
    </div>
  )
}

function Setup() {
  const { uid, settings, values, meditations } = useData()
  const navigate = useNavigate()
  const { toast } = useCelebrate()
  const today = todayKey()
  const [slot, setSlot] = useState(() => slotFor(warsawParts().hh))
  const [minutes, setMinutes] = useState(() => settings.meditation[`${slotFor(warsawParts().hh)}Min`])
  const doneToday = meditations.some((m) => m.date === today && m.slot === slot && m.status === 'done')

  function pickSlot(s) {
    setSlot(s)
    setMinutes(settings.meditation[`${s}Min`])
  }

  async function start() {
    unlockBell()
    playBell()
    try {
      await startMeditation(uid, { slot, date: today, plannedMin: clampMinutes(minutes) })
    } catch (e) {
      toast({ title: "Couldn't start", text: e.message })
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex items-center justify-between">
        <IconButton label="Close" icon="close" onClick={() => navigate('/')} className="border-0 bg-surface-2" />
        <span className="text-[13px] font-semibold text-muted">+{values.meditation} stars when you finish</span>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-8">
        <h1 className="m-0 text-center text-[28px] font-extrabold tracking-tight">Meditate</h1>
        <Segmented
          label="Session"
          value={slot}
          onChange={pickSlot}
          options={[
            { value: 'morning', label: 'Morning' },
            { value: 'evening', label: 'Evening' },
          ]}
        />
        <div className="flex items-center justify-center gap-6" role="group" aria-label="Length">
          <IconButton label="Shorter" icon="minus" onClick={() => setMinutes(clampMinutes(minutes - 1))} disabled={minutes <= MIN_MINUTES} className="size-14 disabled:opacity-40" />
          <div className="flex w-28 flex-col items-center">
            <span className="text-6xl font-light tabular-nums" aria-live="polite">
              {minutes}
            </span>
            <span className="text-sm font-semibold text-muted">minutes</span>
          </div>
          <IconButton label="Longer" icon="plus" onClick={() => setMinutes(clampMinutes(minutes + 1))} disabled={minutes >= MAX_MINUTES} className="size-14 disabled:opacity-40" />
        </div>
        {doneToday && <p className="m-0 text-center text-sm text-muted">You already did your {slot} session today. Another one is fine too.</p>}
      </div>
      <Button size="lg" onClick={start}>
        Start
      </Button>
    </div>
  )
}

function Timer({ session: s, onFinished }) {
  const now = useNow(250)
  const { uid } = useData()
  const { finish, cancel } = useFinishMeditation()
  const [confirmEnd, setConfirmEnd] = useState(false)
  const wakeLock = useWakeLock(s.status === 'running')
  const left = remainingMs(s, now)
  const over = isOver(s, now)
  const unseen = endedUnseen(s, lastSeen(), now)

  // Watched it finish → bell + stars. Ended while away → the "Did you finish?" prompt handles it.
  useEffect(() => {
    if (over && !unseen) {
      playBell()
      onFinished(s) // show "Done" right away; saving continues (also offline)
      finish(s)
    }
    if (!over && document.visibilityState === 'visible') markSeen(now)
  }, [over, unseen, now]) // eslint-disable-line react-hooks/exhaustive-deps

  const size = 280
  const r = 128
  const c = 2 * Math.PI * r
  const ends = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' }).format(new Date(s.status === 'paused' ? now + left : s.endsAt))

  return (
    <div className="flex flex-1 flex-col justify-between gap-8">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-muted">{wakeLock ? 'Screen stays on' : ''}</span>
        <span className="text-[13px] font-semibold text-muted">{s.slot === 'morning' ? 'Morning' : 'Evening'} meditation</span>
      </div>
      <div className="flex flex-col items-center gap-9">
        <div className="text-center text-[22px] font-bold">{s.status === 'paused' ? 'Paused' : 'Breathe in, breathe out'}</div>
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
            <circle cx={140} cy={140} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
            <circle
              cx={140}
              cy={140}
              r={r}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${c * progress(s, now)} ${c}`}
              transform="rotate(-90 140 140)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <div className="text-[64px] font-light tabular-nums tracking-tight" role="timer" aria-label={`${Math.ceil(left / 60000)} minutes left`}>
              {formatClock(left)}
            </div>
            <div className="text-sm font-semibold text-muted">
              of {s.plannedMin} min{s.status === 'running' ? ` · ends ${ends}` : ''}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {s.status === 'paused' ? (
          <Button size="lg" onClick={() => resumeMeditation(uid, s)}>
            Resume
          </Button>
        ) : (
          <Button size="lg" variant="outline" onClick={() => pauseMeditation(uid, s)} disabled={over}>
            Pause
          </Button>
        )}
        <Button variant="ghost" onClick={() => setConfirmEnd(true)}>
          End early
        </Button>
      </div>
      <ConfirmSheet
        open={confirmEnd}
        title="End this session?"
        text="An unfinished session doesn't earn stars."
        confirmLabel="End"
        onConfirm={async () => {
          setConfirmEnd(false)
          await cancel(s)
        }}
        onClose={() => setConfirmEnd(false)}
      />
    </div>
  )
}

function Finished({ session, onDone }) {
  const { values } = useData()
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <h1 className="m-0 text-[28px] font-extrabold">Done</h1>
      <p className="m-0 text-muted">
        {session.plannedMin} minutes of calm · +{values.meditation} stars
      </p>
      <Button size="lg" className="w-full" onClick={onDone}>
        Back to Today
      </Button>
    </div>
  )
}
