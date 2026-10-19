// One tap done: stars, a small celebration, and Undo.

import { useRef } from 'react'
import { useData } from '../../app/DataContext.jsx'
import { formatDue } from '../../lib/dates.js'
import { completeTask, undoTask } from '../../services/tasks.js'
import { useCelebrate } from '../../ui/Celebrate.jsx'

export function useCompleteTask() {
  const { uid, taskDays, values } = useData()
  const { toast, celebrate } = useCelebrate()
  const busy = useRef(new Set()) // no double pay on a double tap

  async function complete(task) {
    if (task.status !== 'open' || busy.current.has(task.id)) return
    busy.current.add(task.id)
    celebrate()
    try {
      const { earned, bonus, nextDate, nextId } = await completeTask(uid, task, { taskDays, values })
      toast({
        title: bonus ? `+${earned} stars · +${bonus} streak bonus` : `+${earned} stars`,
        text: nextDate ? `Next one: ${formatDue(nextDate, task.time)}` : task.title,
        actionLabel: 'Undo',
        onAction: () => undoTask(uid, { ...task, earned, nextId }),
      })
    } catch (e) {
      toast({ title: "Couldn't save", text: e.message })
    } finally {
      busy.current.delete(task.id)
    }
  }

  async function undo(task) {
    try {
      await undoTask(uid, task)
    } catch (e) {
      toast({ title: "Couldn't undo", text: e.message })
    }
  }

  return { complete, undo }
}
