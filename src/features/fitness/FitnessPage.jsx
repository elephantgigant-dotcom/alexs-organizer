// More → Fitness challenge: overview (day, today, streaks), month grid, daily totals per exercise,
// exercise management (add, edit, reorder, enable, archive, one-tap suggestions), settings,
// and a test reminder with the notification's Done button.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useData } from '../../app/DataContext.jsx'
import { addDaysKey, formatShortDate, WEEKDAYS_SHORT, weekdayOf } from '../../lib/dates.js'
import { counts, dayStatus, dayTotals, fitnessStreaks, SUGGESTED_EXERCISES, targetOn, unitLabel } from '../../lib/fitness.js'
import { refreshToday, saveOrder, sendFitnessTest, updateExercise, watchDays } from '../../services/fitness.js'
import { updateSettings } from '../../services/users.js'
import { Button, Card, Chip, IconButton, PageTitle, SectionTitle, Switch } from '../../ui/basics.jsx'
import { useCelebrate } from '../../ui/Celebrate.jsx'
import { Icon } from '../../ui/Icons.jsx'
import { useFitness } from './FitnessContext.jsx'

export function FitnessPage() {
  const { uid } = useData()
  const navigate = useNavigate()
  const { f, today, challengeDay, exercises, day, editExercise } = useFitness()
  const end = addDaysKey(f.startDate, f.lengthDays - 1)
  const [days, setDays] = useState({})
  useEffect(() => watchDays(uid, f.startDate, end, setDays), [uid, f.startDate, end])
  const allDays = useMemo(() => ({ ...days, [today]: day }), [days, today, day])
  const streak = fitnessStreaks(allDays, f, today)
  const c = counts(day)

  return (
    <div className="flex flex-col gap-5">
      <PageTitle right={<IconButton label="Back" icon="back" onClick={() => navigate('/more')} />}>Fitness challenge</PageTitle>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label="Challenge day" value={challengeDay ? `${challengeDay}/${f.lengthDays}` : today < f.startDate ? 'Not started' : 'Finished'} />
        <Tile label="Today" value={`${c.done}/${f.sessionsPerDay}`} />
        <Tile label="Current streak" value={`${streak.current} ${streak.current === 1 ? 'day' : 'days'}`} sub="8/8 days in a row" />
        <Tile label="Best streak" value={`${streak.best} ${streak.best === 1 ? 'day' : 'days'}`} />
      </div>

      <MonthGrid f={f} days={allDays} today={today} end={end} />
      <Totals f={f} days={allDays} today={today} end={end} exercises={exercises} />
      <Exercises exercises={exercises} onEdit={editExercise} uid={uid} day={day} />
      <Settings f={f} uid={uid} />
      <TestReminder uid={uid} />
    </div>
  )
}

function Tile({ label, value, sub }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[16px] border border-line bg-surface px-3.5 py-3">
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      <span className="text-2xl font-extrabold tracking-tight">{value}</span>
      {sub && <span className="text-xs font-semibold text-muted">{sub}</span>}
    </div>
  )
}

const STATUS = {
  complete: { cls: 'border-accent bg-accent text-on-accent', label: 'complete' },
  partial: { cls: 'border-accent bg-accent-soft text-ink', label: 'partial' },
  missed: { cls: 'border-line bg-surface-2 text-muted', label: 'missed' },
  today: { cls: 'border-accent bg-surface text-ink ring-2 ring-accent', label: 'today' },
  future: { cls: 'border-dashed border-line bg-transparent text-muted', label: 'to come' },
}

function MonthGrid({ f, days, today, end }) {
  const list = []
  for (let d = f.startDate; d <= end; d = addDaysKey(d, 1)) list.push(d)
  const lead = (weekdayOf(f.startDate) + 6) % 7 // Monday first
  return (
    <Card className="flex flex-col gap-3">
      <SectionTitle>Month</SectionTitle>
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-muted" aria-hidden="true">
        {[1, 2, 3, 4, 5, 6, 0].map((w) => (
          <span key={w}>{WEEKDAYS_SHORT[w]}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: lead }, (_, i) => (
          <span key={`x${i}`} />
        ))}
        {list.map((d) => {
          const st = d > today ? 'future' : d === today && dayStatus(days[d], f) !== 'complete' ? 'today' : dayStatus(days[d], f)
          const n = counts(days[d] || {}).done
          return (
            <div key={d} className={`flex aspect-square min-h-11 flex-col items-center justify-center rounded-[10px] border ${STATUS[st].cls}`} title={`${formatShortDate(d)}: ${STATUS[st].label}, ${n}/${f.sessionsPerDay}`} aria-label={`${formatShortDate(d)}: ${STATUS[st].label}, ${n} of ${f.sessionsPerDay}`}>
              <span className="text-[13px] font-bold leading-none">{Number(d.slice(8))}</span>
              <span className="text-[10px] font-semibold leading-tight">{d > today ? '' : `${n}/${f.sessionsPerDay}`}</span>
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-muted">
        {['complete', 'partial', 'missed'].map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`size-3 rounded-[3px] border ${STATUS[k].cls}`} aria-hidden="true" />
            {k === 'complete' ? `Complete (${f.sessionsPerDay}/${f.sessionsPerDay})` : k === 'partial' ? 'Partial' : 'Missed'}
          </span>
        ))}
      </div>
    </Card>
  )
}

function Totals({ f, days, today, end, exercises }) {
  const dates = Object.keys(days).filter((d) => d >= f.startDate && d <= end && d <= today).sort().reverse()
  const ids = [...new Set(dates.flatMap((d) => Object.keys(dayTotals(days[d]))))]
  const name = (id) => exercises.find((e) => e.id === id) || Object.values(days[dates.find((d) => dayTotals(days[d])[id] != null)]?.sessions || {})[0]?.exercises?.[id]
  if (!dates.length) return null
  return (
    <Card className="flex flex-col gap-3">
      <SectionTitle>Daily totals</SectionTitle>
      <div className="max-h-80 overflow-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-[13px] tabular-nums">
          <thead className="sticky top-0 bg-surface-2">
            <tr>
              <th className="px-2.5 py-1.5 text-left font-semibold">Day</th>
              <th className="px-2.5 py-1.5 text-left font-semibold">Sessions</th>
              {ids.map((id) => (
                <th key={id} className="px-2.5 py-1.5 text-left font-semibold">
                  {name(id)?.name || id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dates.map((d) => {
              const t = dayTotals(days[d])
              return (
                <tr key={d} className="border-t border-line">
                  <td className="px-2.5 py-1.5">{formatShortDate(d)}</td>
                  <td className="px-2.5 py-1.5">
                    {counts(days[d]).done}/{f.sessionsPerDay}
                  </td>
                  {ids.map((id) => (
                    <td key={id} className="px-2.5 py-1.5">
                      {t[id] ?? '–'}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Exercises({ exercises, onEdit, uid, day }) {
  const [showArchived, setShowArchived] = useState(false)
  const active = exercises.filter((e) => !e.archived).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const archived = exercises.filter((e) => e.archived)
  const names = new Set(exercises.filter((e) => !e.archived).map((e) => e.name.toLowerCase()))

  async function move(i, dir) {
    const list = [...active]
    const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    await saveOrder(uid, list)
    await refreshToday(uid, day, [...list.map((e, k) => ({ ...e, order: k })), ...archived])
  }
  async function toggle(e, enabled) {
    await updateExercise(uid, e.id, { enabled })
    await refreshToday(uid, day, exercises.map((x) => (x.id === e.id ? { ...x, enabled } : x)))
  }
  async function restore(e) {
    await updateExercise(uid, e.id, { archived: false })
    await refreshToday(uid, day, exercises.map((x) => (x.id === e.id ? { ...x, archived: false } : x)))
  }

  return (
    <Card className="flex flex-col gap-3">
      <SectionTitle action={<button type="button" onClick={() => onEdit({ new: true })} className="h-11 px-1 font-bold text-accent">+ Add</button>}>Exercises</SectionTitle>
      <ul className="m-0 flex list-none flex-col p-0">
        {active.map((e, i) => (
          <li key={e.id} className={`flex min-h-14 flex-wrap items-center gap-x-2 gap-y-1 py-1.5 ${i ? 'border-t border-line' : ''}`}>
            <button type="button" onClick={() => onEdit(e)} className="flex min-w-[10rem] flex-1 items-center gap-2 text-left">
              <span className="text-xl" aria-hidden="true">
                {e.emoji}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className={`font-semibold ${e.enabled === false ? 'text-muted' : ''}`}>{e.name}</span>
                <span className="text-[13px] text-muted">
                  {targetOn(e, day.date)} {unitLabel(e, targetOn(e, day.date))} · {e.frequency === 'session' ? 'every session' : 'once a day'}
                  {e.autoIncrease?.on ? ` · +${e.autoIncrease.add} every ${e.autoIncrease.everyDays} days` : ''}
                </span>
              </span>
            </button>
            <span className="ml-auto flex items-center">
              <button type="button" aria-label={`Move ${e.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="grid size-11 place-items-center text-muted disabled:opacity-30">
                <Icon name="up" size={20} />
              </button>
              <button type="button" aria-label={`Move ${e.name} down`} disabled={i === active.length - 1} onClick={() => move(i, 1)} className="grid size-11 place-items-center text-muted disabled:opacity-30">
                <Icon name="down" size={20} />
              </button>
              <button type="button" aria-label={`Edit ${e.name}`} onClick={() => onEdit(e)} className="grid size-11 place-items-center text-muted">
                <Icon name="edit" size={18} />
              </button>
              <Switch checked={e.enabled !== false} onChange={(on) => toggle(e, on)} label={`${e.name} enabled`} />
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-muted">Add in one tap</span>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_EXERCISES.filter((s) => !names.has(s.name.toLowerCase())).map((s) => (
            <Chip key={s.id} onClick={() => onEdit({ ...s, new: true })}>
              {s.emoji} {s.name}
            </Chip>
          ))}
        </div>
      </div>
      {archived.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-line pt-2">
          <button type="button" onClick={() => setShowArchived(!showArchived)} className="h-11 self-start text-sm font-bold text-accent">
            {showArchived ? 'Hide archived' : `Archived (${archived.length})`}
          </button>
          {showArchived &&
            archived.map((e) => (
              <div key={e.id} className="flex min-h-12 items-center justify-between gap-2">
                <span className="text-muted">
                  {e.emoji} {e.name}
                </span>
                <Button variant="ghost" size="sm" onClick={() => restore(e)}>
                  Bring back
                </Button>
              </div>
            ))}
        </div>
      )}
    </Card>
  )
}

const FIELDS = [
  { key: 'sessionsPerDay', label: 'Sessions per day', type: 'number', min: 1, max: 16 },
  { key: 'startTime', label: 'First reminder', type: 'time' },
  { key: 'endTime', label: 'Day window ends', type: 'time' },
  { key: 'intervalMin', label: 'Minutes between sessions (from Done)', type: 'number', min: 10, max: 600 },
  { key: 'nagMin', label: 'Repeat a reminder after (min)', type: 'number', min: 5, max: 120 },
  { key: 'maxPushes', label: 'Pushes per session at most', type: 'number', min: 1, max: 10 },
  { key: 'lengthDays', label: 'Challenge length (days)', type: 'number', min: 1, max: 366 },
  { key: 'startDate', label: 'Start date', type: 'date' },
  { key: 'dayStars', label: `Stars for a complete day`, type: 'number', min: 0, max: 1000 },
]

function Settings({ f, uid }) {
  const { toast } = useCelebrate()
  const [v, setV] = useState(f)
  useEffect(() => setV(f), [f])
  const changed = FIELDS.some((x) => String(v[x.key]) !== String(f[x.key])) || v.bell !== f.bell

  async function save() {
    const out = { bell: v.bell }
    for (const x of FIELDS) {
      const raw = v[x.key]
      if (x.type === 'number') out[x.key] = Math.max(x.min, Math.min(x.max, Math.round(Number(raw) || x.min)))
      else if (raw) out[x.key] = raw
    }
    if (out.endTime <= out.startTime) return toast({ title: 'The day window must end after the first reminder' })
    await updateSettings(uid, { fitness: out })
    toast({ title: 'Saved', text: 'Applies to the next sessions.' })
  }

  return (
    <Card className="flex flex-col gap-3">
      <SectionTitle>Settings</SectionTitle>
      {FIELDS.map((x) => (
        <label key={x.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[15px] font-semibold">
          <span className="min-w-[10rem] flex-1">{x.label}</span>
          <input
            type={x.type}
            inputMode={x.type === 'number' ? 'numeric' : undefined}
            min={x.min}
            max={x.max}
            className={`h-11 shrink-0 rounded-[12px] border border-line bg-surface px-2 text-base font-medium text-ink outline-none focus:border-accent ${x.type === 'date' ? 'w-[10.5rem]' : x.type === 'time' ? 'w-[9rem]' : 'w-[6rem]'}`}
            value={v[x.key]}
            onChange={(e) => setV({ ...v, [x.key]: e.target.value })}
          />
        </label>
      ))}
      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold">Soft bell</span>
          <span className="text-[13px] text-muted">When a reminder arrives while the app is open</span>
        </span>
        <Switch checked={v.bell} onChange={(bell) => setV({ ...v, bell })} label="Soft bell" />
      </div>
      <p className="m-0 text-[13px] text-muted">
        Changes apply to the next sessions; finished ones keep theirs. Turn the pushes on or off in More → Notifications (Fitness sessions, Fitness day summary).
      </p>
      <Button disabled={!changed} onClick={save}>
        Save settings
      </Button>
    </Card>
  )
}

function TestReminder({ uid }) {
  const [state, setState] = useState(null)
  return (
    <Card className="flex flex-col gap-3">
      <SectionTitle>Test the reminder</SectionTitle>
      <p className="m-0 text-[15px] text-muted">Sends a sample session reminder with a Done button. Tap Done on the notification itself, without opening the app.</p>
      <Button variant="outline" onClick={() => (setState({}), sendFitnessTest(uid, setState))}>
        Send a test reminder
      </Button>
      {state && (
        <p className="m-0 text-[15px]" role="status">
          {state.doneTappedAt
            ? '✓ The Done button works: the app received it without opening.'
            : state.result === 'sent'
              ? 'Sent. Now tap Done on the notification.'
              : state.result
                ? `Not delivered: ${state.result} ${(state.errors || []).map((e) => `${e.code} ${e.message}`).join('; ')}`
                : 'Sending…'}
        </p>
      )}
    </Card>
  )
}
