// New / edit task, in a bottom sheet that any screen can open:
//   const { openTask } = useTaskSheet();  openTask()  |  openTask(task)  |  openTask(null, '2026-10-21')

import { createContext, useContext, useState } from 'react'
import { useData } from '../../app/DataContext.jsx'
import { slotColor } from '../../lib/colors.js'
import { todayKey, WEEK_ORDER, WEEKDAYS_SHORT, weekdayOf } from '../../lib/dates.js'
import { describeRecurrence } from '../../lib/recurrence.js'
import { addTask, deleteTask, updateTask } from '../../services/tasks.js'
import { Button, Chip, Field, Group, inputClass, Segmented, TextField } from '../../ui/basics.jsx'
import { useCelebrate } from '../../ui/Celebrate.jsx'
import { ConfirmSheet, Sheet } from '../../ui/Sheet.jsx'

const TaskSheetContext = createContext(null)

export function TaskSheetProvider({ children }) {
  const [state, setState] = useState(null) // { task, date }
  const openTask = (task = null, date = null) => setState({ task, date, key: Date.now() })
  return (
    <TaskSheetContext.Provider value={{ openTask }}>
      {children}
      {state && <TaskSheet key={state.key} task={state.task} date={state.date} onClose={() => setState(null)} />}
    </TaskSheetContext.Provider>
  )
}

export function useTaskSheet() {
  return useContext(TaskSheetContext)
}

const REPEATS = [
  { value: 'none', label: 'No repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'everyXDays', label: 'Every X days' },
  { value: 'monthly', label: 'Monthly' },
]

function TaskSheet({ task, date, onClose }) {
  const { uid, categories } = useData()
  const { toast } = useCelebrate()
  const editing = !!task
  const startDate = task?.date || date || todayKey()
  const [f, setF] = useState(() => ({
    title: task?.title || '',
    notes: task?.notes || '',
    categoryId: task?.categoryId || null,
    date: startDate,
    time: task?.time || '',
    priority: task?.priority || 'normal',
    stars: task?.stars || 2,
    recurrence: task?.recurrence || { type: 'none' },
  }))
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (patch) => setF((x) => ({ ...x, ...patch }))
  const rec = f.recurrence
  const setRec = (patch) => set({ recurrence: { ...rec, ...patch } })

  function chooseRepeat(type) {
    const base = { type }
    if (type === 'weekly') base.weekdays = rec.weekdays?.length ? rec.weekdays : [weekdayOf(f.date)]
    if (type === 'everyXDays') base.interval = rec.interval || 2
    if (type === 'monthly') base.dayOfMonth = rec.dayOfMonth || Number(f.date.slice(8, 10))
    set({ recurrence: base })
  }

  function toggleWeekday(d) {
    const days = rec.weekdays || []
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d]
    if (next.length) setRec({ weekdays: next })
  }

  async function save() {
    if (!f.title.trim() || !f.date) return
    setBusy(true)
    try {
      if (editing) await updateTask(uid, task.id, f)
      else await addTask(uid, f)
      onClose()
    } catch (e) {
      toast({ title: "Couldn't save", text: e.message })
      setBusy(false)
    }
  }

  async function remove() {
    await deleteTask(uid, task.id)
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={editing ? 'Edit task' : 'New task'}
      footer={
        <div className="flex gap-2">
          {editing && (
            <Button variant="danger" onClick={() => setConfirmDelete(true)} aria-label="Delete task">
              Delete
            </Button>
          )}
          <Button className="flex-1" onClick={save} disabled={busy || !f.title.trim()}>
            {editing ? 'Save' : 'Add task'}
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-5 pt-2"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <TextField label="Title" value={f.title} onChange={(e) => set({ title: e.target.value })} autoFocus={!editing} maxLength={200} enterKeyHint="done" />

        <Group label="Area of life">
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            <Chip active={!f.categoryId} onClick={() => set({ categoryId: null })}>
              None
            </Chip>
            {categories.map((c) => (
              <Chip key={c.id} active={f.categoryId === c.id} dot={slotColor(c.color)} onClick={() => set({ categoryId: c.id })}>
                {c.name}
              </Chip>
            ))}
          </div>
        </Group>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" className={`${inputClass} h-12`} value={f.date} onChange={(e) => e.target.value && set({ date: e.target.value })} required />
          </Field>
          <Field label="Time (optional)">
            <input type="time" className={`${inputClass} h-12`} value={f.time} onChange={(e) => set({ time: e.target.value })} />
          </Field>
        </div>

        <Group label="Priority">
          <Segmented
            label="Priority"
            value={f.priority}
            onChange={(priority) => set({ priority })}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'normal', label: 'Normal' },
              { value: 'high', label: 'High' },
            ]}
          />
        </Group>

        <Group label="Stars (effort)">
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={f.stars === n}
                onClick={() => set({ stars: n })}
                className={`h-12 rounded-[14px] border text-lg font-bold ${f.stars === n ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface'}`}
              >
                {n}
              </button>
            ))}
          </div>
        </Group>

        <Group label="Repeat">
          <div className="flex flex-wrap gap-2">
            {REPEATS.map((r) => (
              <Chip key={r.value} active={rec.type === r.value} onClick={() => chooseRepeat(r.value)}>
                {r.label}
              </Chip>
            ))}
          </div>
        </Group>
        {rec.type === 'weekly' && (
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Days of the week">
            {WEEK_ORDER.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={rec.weekdays?.includes(d)}
                onClick={() => toggleWeekday(d)}
                className={`h-11 rounded-[12px] border text-sm font-bold ${rec.weekdays?.includes(d) ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface'}`}
              >
                {WEEKDAYS_SHORT[d]}
              </button>
            ))}
          </div>
        )}
        {rec.type === 'everyXDays' && (
          <Field label="Every how many days?">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              className={`${inputClass} h-12`}
              value={rec.interval}
              onChange={(e) => setRec({ interval: Math.max(1, Math.min(365, Number(e.target.value) || 1)) })}
            />
          </Field>
        )}
        {rec.type === 'monthly' && (
          <Field label="Day of the month" hint="31 = the last day in shorter months">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              className={`${inputClass} h-12`}
              value={rec.dayOfMonth}
              onChange={(e) => setRec({ dayOfMonth: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })}
            />
          </Field>
        )}
        {rec.type !== 'none' && <p className="m-0 -mt-2 text-[13px] text-muted">{describeRecurrence(rec)}. The next one is created when you finish this one.</p>}

        <TextField label="Notes" multiline value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
      </form>

      <ConfirmSheet
        open={confirmDelete}
        title="Delete this task?"
        text={task?.recurrence?.type !== 'none' && task ? 'Only this one is deleted. Earlier finished ones stay in your history.' : 'This cannot be undone.'}
        confirmLabel="Delete"
        danger
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </Sheet>
  )
}
