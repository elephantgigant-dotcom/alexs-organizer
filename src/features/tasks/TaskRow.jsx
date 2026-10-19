// One task: round check button (one tap = done), title, time · category · repeat, stars.

import { useData } from '../../app/DataContext.jsx'
import { slotColor } from '../../lib/colors.js'
import { describeRecurrence } from '../../lib/recurrence.js'
import { Icon } from '../../ui/Icons.jsx'
import { useTaskSheet } from './TaskSheet.jsx'
import { useCompleteTask } from './useCompleteTask.js'

export function TaskRow({ task, showDate = false, dateLabel }) {
  const { catById } = useData()
  const { complete, undo } = useCompleteTask()
  const { openTask } = useTaskSheet()
  const cat = catById[task.categoryId]
  const done = task.status === 'done'
  const meta = [
    showDate ? dateLabel : task.time,
    cat?.name,
    describeRecurrence(task.recurrence),
    task.priority === 'high' ? 'High' : task.priority === 'low' ? 'Low' : '',
  ].filter(Boolean)

  return (
    <div className="flex min-h-16 items-center gap-1 rounded-[18px] border border-line bg-surface pr-4">
      <button
        type="button"
        onClick={() => (done ? undo(task) : complete(task))}
        aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        className="grid size-14 shrink-0 place-items-center"
      >
        {done ? (
          <span className="grid size-7 place-items-center rounded-full bg-accent text-on-accent">
            <Icon name="check" size={18} strokeWidth={2.6} />
          </span>
        ) : (
          <span className="size-7 rounded-full border-2 border-muted" />
        )}
      </button>
      <button type="button" onClick={() => openTask(task)} className="flex min-w-0 flex-1 flex-col gap-0.5 py-2.5 text-left">
        <span className={`truncate text-base font-semibold ${done ? 'text-muted line-through' : ''}`}>{task.title}</span>
        {meta.length > 0 && (
          <span className="flex items-center gap-2 text-[13px] font-medium text-muted">
            {cat && <span className="size-2 shrink-0 rounded-full" style={{ background: slotColor(cat.color) }} aria-hidden="true" />}
            <span className="truncate">{meta.join(' · ')}</span>
          </span>
        )}
      </button>
      <span className={`shrink-0 text-sm font-bold ${done ? 'text-muted' : 'text-star'}`}>+{task.stars}</span>
    </div>
  )
}

// Time first (no time = end of day), then priority
const PRIORITY = { high: 0, normal: 1, low: 2 }
export function sortTasks(a, b) {
  return (
    a.date.localeCompare(b.date) ||
    (a.time || '99').localeCompare(b.time || '99') ||
    (PRIORITY[a.priority] ?? 1) - (PRIORITY[b.priority] ?? 1) ||
    a.title.localeCompare(b.title)
  )
}
