// Today: date, star balance, overdue tasks, today's tasks with progress.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useData } from '../../app/DataContext.jsx'
import { Fab } from '../../app/Layout.jsx'
import { checkinId, previousBedtimes } from '../../lib/checkins.js'
import { addDaysKey, formatDue, formatLongDate, todayKey, warsawParts } from '../../lib/dates.js'
import { formatClock, remainingMs } from '../../lib/meditation.js'
import { formatDuration } from '../../lib/sleep.js'
import { sleepScore, sleepTargets, weekComparison } from '../../lib/sleepScore.js'
import { useNow } from '../meditation/timerState.js'
import { useToday } from '../../app/useToday.js'
import { FitnessCard } from '../fitness/FitnessCard.jsx'
import { watchTasksInRange } from '../../services/tasks.js'
import { EmptyState, PageTitle, SectionTitle } from '../../ui/basics.jsx'
import { Icon } from '../../ui/Icons.jsx'
import { sortTasks, TaskRow } from '../tasks/TaskRow.jsx'
import { useTaskSheet } from '../tasks/TaskSheet.jsx'

function greeting(hour) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export { useToday }

export function TodayPage() {
  const { uid, openTasks, balance } = useData()
  const { openTask } = useTaskSheet()
  const today = useToday()
  const [todays, setTodays] = useState([])
  useEffect(() => watchTasksInRange(uid, today, today, setTodays), [uid, today])

  const overdue = useMemo(() => openTasks.filter((t) => t.date < today).sort(sortTasks), [openTasks, today])
  const list = useMemo(() => {
    const open = todays.filter((t) => t.status === 'open').sort(sortTasks)
    const done = todays.filter((t) => t.status === 'done').sort(sortTasks)
    return [...open, ...done]
  }, [todays])
  const doneCount = todays.filter((t) => t.status === 'done').length
  const evening = warsawParts().hh >= 17

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        sub={formatLongDate(today)}
        right={
          <Link
            to="/stars"
            className="flex h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 font-bold text-ink no-underline"
            aria-label={`${balance} stars`}
          >
            <span className="text-star">
              <Icon name="star" size={18} />
            </span>
            {balance}
          </Link>
        }
      >
        {greeting(warsawParts().hh)}
      </PageTitle>

      <FitnessCard />
      <ActiveMeditation />
      <DayCards today={today} evening={evening} />
      <SleepScoreCard today={today} />

      {overdue.length > 0 && (
        <section className="flex flex-col gap-2.5" aria-label="Overdue">
          <SectionTitle>Overdue</SectionTitle>
          {overdue.map((t) => (
            <TaskRow key={t.id} task={t} showDate dateLabel={formatDue(t.date, t.time, today)} />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2.5" aria-label="Today's tasks">
        <SectionTitle action={todays.length > 0 && <span className="text-sm font-semibold text-muted">{doneCount} of {todays.length} done</span>}>Tasks</SectionTitle>
        {todays.length > 0 && (
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={todays.length} aria-valuenow={doneCount} aria-label="Today's progress">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(doneCount / todays.length) * 100}%` }} />
          </div>
        )}
        {list.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
        {todays.length === 0 && <EmptyState title="Nothing planned for today">Tap + to add a task.</EmptyState>}
      </section>

      <Fab label="New task" onClick={() => openTask(null, today)} />
    </div>
  )
}

// Morning: check-in + morning meditation. From 17:00: evening check-in + evening meditation.
function DayCards({ today, evening }) {
  const { checkinById, meditations, settings, values } = useData()
  const navigate = useNavigate()
  const slot = evening ? 'evening' : 'morning'
  const checkin = checkinById[checkinId(today, slot)]
  const meditated = meditations.some((m) => m.date === today && m.slot === slot && m.status === 'done')
  const other = evening ? checkinById[checkinId(today, 'morning')] : null
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => navigate(`/checkin/${slot}`)}
          className="flex flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-4 text-left"
        >
          <span className="text-accent">
            <Icon name={evening ? 'moon' : 'sun'} />
          </span>
          <span className="text-base font-bold">{evening ? 'Evening check-in' : 'Morning check-in'}</span>
          <span className="text-sm text-muted">
            {checkin ? `Done${checkin.mood ? ` · mood ${checkin.mood}` : ''} · edit` : evening ? `Day rating, reflections · +${values.checkin}` : `Mood, sleep, 3 intentions · +${values.checkin}`}
          </span>
        </button>
        <button type="button" onClick={() => navigate('/meditate')} className="flex flex-col gap-2.5 rounded-[20px] bg-accent-soft p-4 text-left">
          <span className="text-accent">
            <Icon name="clock" />
          </span>
          <span className="text-base font-bold">Meditate</span>
          <span className="text-sm text-muted">
            {meditated ? `Done · ${slot}` : `${evening ? 'Evening' : 'Morning'} · ${settings.meditation[`${slot}Min`]} min · +${values.meditation}`}
          </span>
        </button>
      </div>
      {evening && !other && (
        <button type="button" onClick={() => navigate('/checkin/morning')} className="h-11 self-start text-sm font-bold text-accent">
          Morning check-in not filled in · add it
        </button>
      )}
    </div>
  )
}

function SleepScoreCard({ today }) {
  const { mornings, settings } = useData()
  const navigate = useNavigate()
  const targets = sleepTargets(settings)
  const scoreOf = (c) => sleepScore(c.sleep, previousBedtimes(mornings, c.date), targets)?.score ?? null
  const last = mornings.find((c) => c.date === today && c.sleep)
  const lastScore = last ? scoreOf(last) : null
  if (lastScore == null) return null
  const recent = mornings.filter((c) => c.date >= addDaysKey(today, -13) && c.sleep).map((c) => ({ date: c.date, value: scoreOf(c) }))
  const { average } = weekComparison(recent, today, addDaysKey)
  return (
    <button
      type="button"
      onClick={() => navigate('/checkin/morning')}
      className="flex min-h-14 items-center justify-between gap-3 rounded-[18px] border border-line bg-surface px-4 py-2.5 text-left"
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-muted">Last night's sleep score</span>
        <span className="text-sm font-semibold">
          {[last.sleep.actualMinutes != null && formatDuration(last.sleep.actualMinutes), average != null && `7-day avg ${Math.round(average)}`].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="text-[28px] font-extrabold tracking-tight">{lastScore}</span>
    </button>
  )
}

function ActiveMeditation() {
  const { activeMeditation: s } = useData()
  const now = useNow(1000)
  if (!s) return null
  return (
    <Link to="/meditate" className="flex min-h-14 items-center justify-between rounded-[18px] bg-accent px-4 font-bold text-on-accent no-underline">
      <span>{s.status === 'paused' ? 'Meditation paused' : 'Meditation in progress'}</span>
      <span className="tabular-nums">{formatClock(remainingMs(s, now))}</span>
    </Link>
  )
}
