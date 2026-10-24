// Add / edit an exercise: name, emoji, unit, target, step, frequency, on/off, auto-increase,
// archive. A target change applies from today on (past days keep theirs).

import { useState } from 'react'
import { useData } from '../../app/DataContext.jsx'
import { todayKey } from '../../lib/dates.js'
import { targetOn, UNITS } from '../../lib/fitness.js'
import { addExercise, refreshToday, updateExercise, withTarget } from '../../services/fitness.js'
import { Button, Field, Group, inputClass, Segmented, Switch, TextField } from '../../ui/basics.jsx'
import { useCelebrate } from '../../ui/Celebrate.jsx'
import { ConfirmSheet, Sheet } from '../../ui/Sheet.jsx'
import { useFitness } from './FitnessContext.jsx'

export function ExerciseSheet({ exercise, onClose }) {
  const { uid } = useData()
  const { exercises, day } = useFitness()
  const { toast } = useCelebrate()
  const today = todayKey()
  const isNew = !exercise.id || exercise.new
  const [f, setF] = useState(() => ({
    name: exercise.name || '',
    emoji: exercise.emoji || '',
    unit: exercise.unit || 'reps',
    customUnit: exercise.customUnit || '',
    target: String(exercise.targets ? targetOn(exercise, today) : (exercise.target ?? 10)),
    step: String(exercise.step ?? 1),
    frequency: exercise.frequency || 'session',
    enabled: exercise.enabled !== false,
    auto: { on: false, add: 1, everyDays: 7, from: null, ...(exercise.autoIncrease || {}) },
  }))
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = (patch) => setF((x) => ({ ...x, ...patch }))
  const ok = f.name.trim() && Number(f.target) > 0 && Number(f.step) > 0 && (f.unit !== 'custom' || f.customUnit.trim())

  async function save() {
    setBusy(true)
    try {
      const auto = { on: f.auto.on, add: Number(f.auto.add) || 1, everyDays: Math.max(1, Math.round(Number(f.auto.everyDays) || 7)), from: f.auto.on ? exercise.autoIncrease?.on ? exercise.autoIncrease.from : today : null }
      const base = { name: f.name.trim(), emoji: f.emoji.trim(), unit: f.unit, customUnit: f.customUnit.trim(), step: Number(f.step), frequency: f.frequency, enabled: f.enabled, autoIncrease: auto }
      let list
      if (isNew) {
        const id = await addExercise(uid, { ...base, id: exercise.id, target: Number(f.target) }, exercises.length)
        list = [...exercises, { id, ...base, archived: false, order: exercises.length, targets: [{ value: Number(f.target), from: today }] }]
      } else {
        const changedTarget = Number(f.target) !== targetOn(exercise, today)
        const patch = { ...base, archived: false, ...(changedTarget ? { targets: withTarget(exercise, f.target, today) } : {}) }
        await updateExercise(uid, exercise.id, patch)
        list = exercises.map((e) => (e.id === exercise.id ? { ...e, ...patch } : e))
      }
      await refreshToday(uid, day, list)
      onClose()
    } catch (e) {
      toast({ title: "Couldn't save", text: e.message })
      setBusy(false)
    }
  }

  async function archive() {
    await updateExercise(uid, exercise.id, { archived: true })
    await refreshToday(uid, day, exercises.map((e) => (e.id === exercise.id ? { ...e, archived: true } : e)))
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? 'New exercise' : `Edit ${exercise.name}`}
      footer={
        <div className="flex gap-2">
          {!isNew && (
            <Button variant="danger" onClick={() => setConfirmArchive(true)}>
              Archive
            </Button>
          )}
          <Button className="flex-1" disabled={!ok || busy} onClick={save}>
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 pt-2">
        <div className="grid grid-cols-[5rem_1fr] gap-3">
          <TextField label="Emoji" value={f.emoji} onChange={(e) => set({ emoji: e.target.value.slice(0, 4) })} />
          <TextField label="Name" value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} autoFocus={isNew} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Target (from today)">
            <input type="number" inputMode="decimal" min="0" step="any" className={`${inputClass} h-12`} value={f.target} onChange={(e) => set({ target: e.target.value })} aria-label="Target" />
          </Field>
          <Field label="Step for − / +">
            <input type="number" inputMode="decimal" min="0" step="any" className={`${inputClass} h-12`} value={f.step} onChange={(e) => set({ step: e.target.value })} aria-label="Step" />
          </Field>
        </div>
        {!isNew && Number(f.target) !== targetOn(exercise, today) && <p className="m-0 -mt-3 text-[13px] text-muted">Applies from today on. Earlier days keep their target.</p>}

        <Group label="Unit">
          <div className="flex flex-wrap gap-2">
            {UNITS.map((u) => (
              <button
                key={u.value}
                type="button"
                aria-pressed={f.unit === u.value}
                onClick={() => set({ unit: u.value })}
                className={`h-11 rounded-full border px-4 text-[15px] font-semibold ${f.unit === u.value ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface'}`}
              >
                {u.value === 'custom' ? 'Custom' : u.many}
              </button>
            ))}
          </div>
        </Group>
        {f.unit === 'custom' && <TextField label="Custom unit" value={f.customUnit} onChange={(e) => set({ customUnit: e.target.value })} maxLength={20} placeholder="e.g. rounds" />}

        <Group label="How often">
          <Segmented
            label="How often"
            value={f.frequency}
            onChange={(frequency) => set({ frequency })}
            options={[
              { value: 'session', label: 'Every session' },
              { value: 'daily', label: 'Once a day' },
            ]}
          />
        </Group>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] font-semibold">Enabled</span>
          <Switch checked={f.enabled} onChange={(enabled) => set({ enabled })} label="Enabled" />
        </div>

        <div className="flex flex-col gap-3 rounded-[16px] border border-line p-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex flex-col">
              <span className="text-[15px] font-semibold">Auto-increase target</span>
              <span className="text-[13px] text-muted">Counted from the day you switch it on</span>
            </span>
            <Switch checked={f.auto.on} onChange={(on) => set({ auto: { ...f.auto, on } })} label="Auto-increase target" />
          </div>
          {f.auto.on && (
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted">
              Add
              <input type="number" inputMode="decimal" min="0" step="any" aria-label="Add" className={`${inputClass} h-11 w-20 px-2`} value={f.auto.add} onChange={(e) => set({ auto: { ...f.auto, add: e.target.value } })} />
              every
              <input type="number" inputMode="numeric" min="1" aria-label="Every how many days" className={`${inputClass} h-11 w-20 px-2`} value={f.auto.everyDays} onChange={(e) => set({ auto: { ...f.auto, everyDays: e.target.value } })} />
              days
            </div>
          )}
        </div>
      </div>
      <ConfirmSheet
        open={confirmArchive}
        title={`Archive ${exercise.name}?`}
        text="It disappears from new sessions. Everything you already did stays in your history and stats. You can bring it back in Fitness settings."
        confirmLabel="Archive"
        danger
        onConfirm={archive}
        onClose={() => setConfirmArchive(false)}
      />
    </Sheet>
  )
}
