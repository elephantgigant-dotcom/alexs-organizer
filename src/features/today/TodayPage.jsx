// Today: date, star balance, overdue tasks, today's tasks with progress.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useData } from '../../app/DataContext.jsx'
import { Fab } from '../../app/Layout.jsx'
import { formatDue, formatLongDate, todayKey, warsawParts } from '../../lib/dates.js'
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

export function useToday() {
  const [today, setToday] = useState(todayKey)
  useEffect(() => {
    const t = setInterval(() => setToday(todayKey()), 60000)
    return () => clearInterval(t)
  }, [])
  return today
}

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
