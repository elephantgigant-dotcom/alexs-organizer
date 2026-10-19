// Week schedule, Monday → Sunday: a day strip with counts, then every day's tasks.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useData } from '../../app/DataContext.jsx'
import { Fab } from '../../app/Layout.jsx'
import { addDaysKey, formatShortDate, WEEKDAYS_LONG, WEEKDAYS_SHORT, weekdayOf, weekKeys } from '../../lib/dates.js'
import { watchTasksInRange } from '../../services/tasks.js'
import { IconButton, PageTitle } from '../../ui/basics.jsx'
import { sortTasks, TaskRow } from '../tasks/TaskRow.jsx'
import { useTaskSheet } from '../tasks/TaskSheet.jsx'
import { useToday } from '../today/TodayPage.jsx'

export function WeekPage() {
  const { uid } = useData()
  const { openTask } = useTaskSheet()
  const today = useToday()
  const [offset, setOffset] = useState(0)
  const days = useMemo(() => weekKeys(addDaysKey(today, offset * 7)), [today, offset])
  const [tasks, setTasks] = useState([])
  const [selected, setSelected] = useState(null)
  const refs = useRef({})

  useEffect(() => watchTasksInRange(uid, days[0], days[6], setTasks), [uid, days])

  const byDay = useMemo(() => {
    const map = Object.fromEntries(days.map((d) => [d, []]))
    for (const t of tasks) map[t.date]?.push(t)
    for (const d of days) map[d].sort((a, b) => (a.status === b.status ? sortTasks(a, b) : a.status === 'open' ? -1 : 1))
    return map
  }, [tasks, days])

  function pick(day) {
    setSelected(day)
    refs.current[day]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const title = offset === 0 ? 'This week' : offset === 1 ? 'Next week' : offset === -1 ? 'Last week' : `Week of ${formatShortDate(days[0])}`

  return (
    <div className="flex flex-col gap-5">
      <PageTitle
        sub={`${formatShortDate(days[0])} – ${formatShortDate(days[6])}`}
        right={
          <div className="flex gap-2">
            <IconButton label="Previous week" icon="back" onClick={() => setOffset(offset - 1)} />
            <IconButton label="Next week" icon="next" onClick={() => setOffset(offset + 1)} />
          </div>
        }
      >
        {title}
      </PageTitle>
      {offset !== 0 && (
        <button type="button" onClick={() => setOffset(0)} className="-mt-3 h-11 self-start font-bold text-accent">
          Back to this week
        </button>
      )}

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const isToday = d === today
          const isSel = d === selected
          const done = byDay[d].filter((t) => t.status === 'done').length
          return (
            <button
              key={d}
              type="button"
              onClick={() => pick(d)}
              aria-label={`${WEEKDAYS_LONG[weekdayOf(d)]} ${formatShortDate(d)}, ${done} of ${byDay[d].length} tasks done`}
              className={`flex min-h-[72px] flex-col items-center justify-center gap-0.5 rounded-[14px] border ${
                isSel ? 'border-accent bg-accent text-on-accent' : isToday ? 'border-accent-soft bg-accent-soft' : 'border-line bg-surface'
              }`}
            >
              <span className="text-xs font-semibold">{WEEKDAYS_SHORT[weekdayOf(d)]}</span>
              <span className="text-lg font-extrabold">{Number(d.slice(8))}</span>
              <span className="text-[11px] font-semibold">{byDay[d].length ? `${done}/${byDay[d].length}` : '–'}</span>
            </button>
          )
        })}
      </div>

      {days.map((d) => (
        <section key={d} ref={(el) => (refs.current[d] = el)} className="flex scroll-mt-6 flex-col gap-2" aria-label={WEEKDAYS_LONG[weekdayOf(d)]}>
          <div className="flex items-baseline justify-between">
            <h2 className={`m-0 text-[17px] font-extrabold ${d === today ? 'text-accent' : ''}`}>
              {d === today ? 'Today' : WEEKDAYS_LONG[weekdayOf(d)]} {Number(d.slice(8))}
            </h2>
            <button type="button" onClick={() => openTask(null, d)} className="h-11 px-1 text-sm font-bold text-accent">
              + Add
            </button>
          </div>
          {byDay[d].map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
          {byDay[d].length === 0 && <p className="m-0 text-sm text-muted">Nothing planned.</p>}
        </section>
      ))}

      <Fab label="New task" onClick={() => openTask(null, selected || (days.includes(today) ? today : days[0]))} />
    </div>
  )
}
