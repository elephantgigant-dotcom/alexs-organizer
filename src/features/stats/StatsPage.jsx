// Statistics: score cards (last 7 days vs the 7 before), then charts for a chosen period:
// sleep (score, duration vs target, stages, bedtime / wake-up, next-day mood and energy),
// mood and energy (1–10), tasks per day, done per area, streaks.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useData } from '../../app/DataContext.jsx'
import { slotColor } from '../../lib/colors.js'
import { addDaysKey, formatShortDate, rangeKeys, todayKey, WEEKDAYS_SHORT, weekdayOf } from '../../lib/dates.js'
import { fitnessPeriod, fitnessStreaks, ordered, unitLabel } from '../../lib/fitness.js'
import { formatDuration } from '../../lib/sleep.js'
import { averageBedtime, fromNightMinutes, HOW_CALCULATED, nightMinutes, sleepTargets } from '../../lib/sleepScore.js'
import {
  average,
  averageStages,
  bedtimeConsistency,
  buckets,
  categoryCounts,
  checkinsByDate,
  dayValue,
  fmt1,
  formatChange,
  PERIODS,
  periodDays,
  sleepNights,
  sleepVsNextDay,
  streakInfo,
  taskStats,
} from '../../lib/stats.js'
import { watchDays } from '../../services/fitness.js'
import { watchTasksInRange } from '../../services/tasks.js'
import { PageTitle, Segmented } from '../../ui/basics.jsx'
import { BarChart, ChartCard, HBars, LineChart, StackedBars } from '../../ui/charts/Charts.jsx'
import { useFitness } from '../fitness/FitnessContext.jsx'

const C = { mood: 'var(--c1)', energy: 'var(--c2)', calc: 'var(--c1)', device: 'var(--c2)', bed: 'var(--c1)', wake: 'var(--c2)' }
const STAGES = [
  { key: 'deepPct', label: 'Deep', color: 'var(--deep)' },
  { key: 'remPct', label: 'REM', color: 'var(--rem)' },
  { key: 'lightPct', label: 'Light', color: 'var(--lite)' },
]

export function StatsPage() {
  const { uid, checkins, mornings, meditationDays, checkinDays, taskDays, catById, settings } = useData()
  const today = todayKey()
  const [period, setPeriod] = useState('week')
  const [tasks, setTasks] = useState([])
  useEffect(() => watchTasksInRange(uid, addDaysKey(today, -97), today, setTasks), [uid, today])
  const fitness = useFitness()
  const [fitnessDays, setFitnessDays] = useState({})
  useEffect(() => watchDays(uid, addDaysKey(today, -97), today, setFitnessDays), [uid, today])
  const allFitnessDays = useMemo(() => ({ ...fitnessDays, [fitness.today]: fitness.day }), [fitnessDays, fitness.today, fitness.day])

  const targets = useMemo(() => sleepTargets(settings), [settings])
  const byDate = useMemo(() => checkinsByDate(checkins), [checkins])
  const allNights = useMemo(() => sleepNights(mornings, rangeKeys(addDaysKey(today, -120), today), targets), [mornings, today, targets])
  const nightByDate = useMemo(() => Object.fromEntries(allNights.map((n) => [n.date, n])), [allNights])

  const days = periodDays(period, today)
  const bks = buckets(days, period)
  const labels = bks.map((b) => b.label)
  const nights = allNights.filter((n) => n.date >= days[0])
  const per = (fn) => bks.map((b) => fn(b.days))
  const nightAvg = (field) => per((ds) => average(ds.map((d) => nightByDate[d]?.[field])))

  return (
    <div className="flex flex-col gap-5">
      <PageTitle
        right={
          <Link to="/stats/review" className="flex h-11 items-center text-[15px] font-bold text-accent no-underline">
            Weekly review
          </Link>
        }
      >
        Statistics
      </PageTitle>

      <ScoreCards today={today} tasks={tasks} byDate={byDate} nightByDate={nightByDate} meditationDays={meditationDays} checkinDays={checkinDays} />
      <p className="m-0 text-xs leading-relaxed text-muted">
        <strong className="text-ink">How the sleep score is calculated:</strong> {HOW_CALCULATED}
      </p>

      <Segmented label="Period" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} className="mt-2" />

      <h2 className="m-0 mt-1 text-xl font-extrabold">Sleep</h2>
      <SleepScoreChart labels={labels} bks={bks} calc={nightAvg('score')} device={nightAvg('deviceScore')} />
      <DurationChart labels={labels} bks={bks} minutes={nightAvg('minutes')} target={targets.targetMin} nights={nights} />
      <StagesChart labels={labels} bks={bks} nights={nights} nightByDate={nightByDate} />
      <BedtimeChart labels={labels} bks={bks} nightByDate={nightByDate} nights={nights} />
      <NextDayChart nights={nights} byDate={byDate} targetMin={targets.targetMin} />

      <h2 className="m-0 mt-1 text-xl font-extrabold">Mood and energy</h2>
      <MoodChart labels={labels} bks={bks} mood={per((ds) => average(ds.map((d) => dayValue(byDate, d, 'mood'))))} energy={per((ds) => average(ds.map((d) => dayValue(byDate, d, 'energy'))))} />

      <h2 className="m-0 mt-1 text-xl font-extrabold">Tasks</h2>
      <TasksChart labels={labels} bks={bks} tasks={tasks} days={days} />
      <AreasChart tasks={tasks} days={days} catById={catById} />

      <h2 className="m-0 mt-1 text-xl font-extrabold">Fitness challenge</h2>
      {today < fitness.f.startDate ? (
        <p className="m-0 text-[15px] text-muted">The challenge starts on {formatShortDate(fitness.f.startDate)}. Its charts appear here from then on.</p>
      ) : (
        <>
          <FitnessSessionsChart labels={labels} bks={bks} f={fitness.f} days={allFitnessDays} today={today} />
          <FitnessExercisesChart f={fitness.f} days={allFitnessDays} dates={days} today={today} exercises={fitness.exercises} />
        </>
      )}

      <Streaks today={today} taskDays={taskDays} meditationDays={meditationDays} checkinDays={checkinDays} fitness={fitnessStreaks(allFitnessDays, fitness.f, today)} />
    </div>
  )
}

// ── Score cards: last 7 days vs the 7 days before ──

function ScoreCards({ today, tasks, byDate, nightByDate, meditationDays, checkinDays }) {
  const last = periodDays('week', today)
  const prev = last.map((d) => addDaysKey(d, -7))
  const mean = (ds, fn) => average(ds.map(fn))
  const score = (ds) => mean(ds, (d) => nightByDate[d]?.score)
  const mood = (ds) => mean(ds, (d) => dayValue(byDate, d, 'mood'))
  const energy = (ds) => mean(ds, (d) => dayValue(byDate, d, 'energy'))
  const rate = (ds) => {
    const r = taskStats(tasks, ds)
    return r.rate == null ? null : r.rate * 100
  }
  const diff = (a, b) => (a == null || b == null ? null : a - b)
  const lastNight = nightByDate[today]?.score ?? null
  const t = taskStats(tasks, last)
  const med = streakInfo(meditationDays, today)
  const chk = streakInfo(checkinDays, today)
  const s7 = score(last)

  const cards = [
    {
      label: 'Sleep score',
      value: lastNight ?? (s7 == null ? '–' : Math.round(s7)),
      sub: lastNight != null ? `Last night · 7-day avg ${s7 == null ? '–' : Math.round(s7)}` : '7-day average',
      delta: formatChange(diff(s7, score(prev)), { decimals: 0 }),
    },
    { label: 'Task completion', value: t.rate == null ? '–' : `${Math.round(t.rate * 100)}%`, sub: `${t.done} of ${t.planned} tasks`, delta: formatChange(diff(rate(last), rate(prev)), { decimals: 0, unit: ' points' }) },
    { label: 'Mood', value: fmt1(mood(last)), sub: '7-day average, 1–10', delta: formatChange(diff(mood(last), mood(prev))) },
    { label: 'Energy', value: fmt1(energy(last)), sub: '7-day average, 1–10', delta: formatChange(diff(energy(last), energy(prev))) },
    { label: 'Meditation streak', value: `${med.current} ${med.current === 1 ? 'day' : 'days'}`, sub: `Best ${med.best} ${med.best === 1 ? 'day' : 'days'}`, delta: '' },
    { label: 'Check-in streak', value: `${chk.current} ${chk.current === 1 ? 'day' : 'days'}`, sub: `Best ${chk.best} ${chk.best === 1 ? 'day' : 'days'}`, delta: '' },
  ]

  return (
    <section aria-label="Last 7 days" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <h2 className="m-0 text-lg font-extrabold">Last 7 days</h2>
        <span className="text-xs font-semibold text-muted">vs the 7 days before</span>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {cards.map((k) => (
          <div key={k.label} className="flex flex-col gap-0.5 rounded-[16px] border border-line bg-surface px-3.5 py-3">
            <span className="text-[13px] font-semibold text-muted">{k.label}</span>
            <span className="text-[26px] font-extrabold tracking-tight">{k.value}</span>
            <span className="text-xs font-semibold text-muted">{k.sub}</span>
            {k.delta && <span className="text-xs font-bold">{k.delta}</span>}
          </div>
        ))}
      </div>
    </section>
  )
}

const bucketName = (b) => (b.days.length > 1 ? `Week of ${b.label}` : `${WEEKDAYS_SHORT[weekdayOf(b.key)]} ${formatShortDate(b.key)}`)
const r0 = (v) => (v == null ? '–' : Math.round(v))
const hm = (v) => (v == null ? '–' : formatDuration(Math.round(v)))

function SleepScoreChart({ labels, bks, calc, device }) {
  const [active, setActive] = useState(null)
  const has = calc.some((v) => v != null) || device.some((v) => v != null)
  const avgCalc = average(calc)
  return (
    <ChartCard
      title="Sleep score"
      summary={avgCalc == null ? 'No sleep data yet' : `Average ${Math.round(avgCalc)}`}
      legend={[
        { label: 'Calculated', color: C.calc },
        { label: 'Device', color: C.device },
      ]}
      readout={active != null ? `${bucketName(bks[active])}: calculated ${r0(calc[active])} · device ${r0(device[active])}` : has ? 'Tap a day for its numbers.' : 'Fill in sleep in the morning check-in.'}
      table={{ columns: ['Night', 'Calculated', 'Device'], rows: bks.map((b, i) => [bucketName(b), r0(calc[i]), r0(device[i])]) }}
    >
      <LineChart
        labels={labels}
        series={[
          { label: 'Calculated', color: C.calc, values: calc },
          { label: 'Device', color: C.device, values: device },
        ]}
        min={0}
        max={100}
        ticks={[
          { v: 0, label: '0' },
          { v: 50, label: '50' },
          { v: 100, label: '100' },
        ]}
        active={active}
        onActive={setActive}
        ariaLabel="Sleep score per night, calculated and from the device, 0 to 100"
      />
    </ChartCard>
  )
}

function DurationChart({ labels, bks, minutes, target, nights }) {
  const [active, setActive] = useState(null)
  const hours = minutes.map((m) => (m == null ? 0 : m / 60))
  const max = Math.max(10, ...hours.map(Math.ceil))
  const avgMin = average(nights.map((n) => n.minutes))
  return (
    <ChartCard
      title="Sleep per night"
      summary={avgMin == null ? '' : `Average ${formatDuration(Math.round(avgMin))}`}
      readout={active != null ? `${bucketName(bks[active])}: ${hm(minutes[active])}` : `Target ${formatDuration(target)}, the dashed line.`}
      table={{ columns: ['Night', 'Sleep'], rows: bks.map((b, i) => [bucketName(b), hm(minutes[i])]) }}
    >
      <BarChart
        labels={labels}
        values={hours}
        max={max}
        ticks={[
          { v: 0, label: '0' },
          { v: max / 2, label: `${max / 2} h` },
          { v: max, label: `${max} h` },
        ]}
        target={{ value: target / 60, label: `Target ${formatDuration(target)}` }}
        active={active}
        onActive={setActive}
        ariaLabel="Hours of sleep per night, with the target as a dashed line"
      />
    </ChartCard>
  )
}

function StagesChart({ labels, bks, nights, nightByDate }) {
  const [active, setActive] = useState(null)
  const stack = (ds) => {
    const rows = ds.map((d) => nightByDate[d]).filter((n) => n && (n.deepPct != null || n.remPct != null))
    if (!rows.length) return null
    return STAGES.map((s) => ({ color: s.color, value: average(rows.map((n) => n[s.key])) || 0 }))
  }
  const stacks = bks.map((b) => stack(b.days))
  const avgs = averageStages(nights)
  const fmtPct = (v) => (v == null ? '–' : `${Math.round(v)}%`)
  return (
    <ChartCard
      title="Sleep stages"
      legend={STAGES.map((s) => ({ label: `${s.label} ${fmtPct(avgs[s.key])}`, color: s.color, square: true }))}
      readout={
        active != null
          ? stacks[active]
            ? `${bucketName(bks[active])}: ${STAGES.map((s, j) => `${s.label} ${fmtPct(stacks[active][j].value)}`).join(' · ')}`
            : `${bucketName(bks[active])}: no stages`
          : stacks.some(Boolean)
            ? 'Percent of actual sleep. Tap a night for its split.'
            : 'Add sleep stages in the morning check-in.'
      }
      table={{ columns: ['Night', 'Deep', 'REM', 'Light'], rows: bks.map((b, i) => [bucketName(b), ...(stacks[i] ? stacks[i].map((g) => fmtPct(g.value)) : ['–', '–', '–'])]) }}
    >
      <StackedBars labels={labels} stacks={stacks} active={active} onActive={setActive} ariaLabel="Deep, REM and light sleep as percent of each night" />
    </ChartCard>
  )
}

function BedtimeChart({ labels, bks, nightByDate, nights }) {
  const [active, setActive] = useState(null)
  const timeOf = (ds, field) => averageBedtime(ds.map((d) => nightByDate[d]?.[field]))
  const bed = bks.map((b) => timeOf(b.days, 'fellAsleep'))
  const wake = bks.map((b) => timeOf(b.days, 'wokeUp'))
  const all = [...bed, ...wake].filter((v) => v != null)
  const c = bedtimeConsistency(nights)
  // Night axis (minutes from noon): pad to whole hours, a line every 2 hours
  const lo = all.length ? Math.floor((Math.min(...all) - 30) / 60) * 60 : nightMinutes('22:00')
  const hi = all.length ? Math.ceil((Math.max(...all) + 30) / 60) * 60 : nightMinutes('08:00')
  const step = hi - lo > 360 ? 120 : 60
  const ticks = []
  for (let v = lo; v <= hi; v += step) ticks.push({ v, label: fromNightMinutes(v) })
  const t = (v) => (v == null ? '–' : fromNightMinutes(v))
  return (
    <ChartCard
      title="Bedtime and wake-up"
      summary={c.spreadMin == null ? '' : `Bedtime varies ±${c.spreadMin} min`}
      legend={[
        { label: `Fell asleep${c.bedtime ? ` · avg ${c.bedtime}` : ''}`, color: C.bed },
        { label: `Woke up${c.wakeUp ? ` · avg ${c.wakeUp}` : ''}`, color: C.wake },
      ]}
      readout={active != null ? `${bucketName(bks[active])}: fell asleep ${t(bed[active])} · woke up ${t(wake[active])}` : 'Flatter lines = a steadier rhythm.'}
      table={{ columns: ['Night', 'Fell asleep', 'Woke up'], rows: bks.map((b, i) => [bucketName(b), t(bed[i]), t(wake[i])]) }}
    >
      <LineChart
        labels={labels}
        series={[
          { label: 'Fell asleep', color: C.bed, values: bed },
          { label: 'Woke up', color: C.wake, values: wake },
        ]}
        min={lo}
        max={hi}
        ticks={ticks}
        invert
        height={170}
        active={active}
        onActive={setActive}
        ariaLabel="Fell asleep and woke up times per night"
      />
    </ChartCard>
  )
}

function NextDayChart({ nights, byDate, targetMin }) {
  const r = sleepVsNextDay(nights, byDate, targetMin)
  const row = (label, v, color) => ({ label, value: v, display: fmt1(v), color })
  const group = (title, g) => (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold">
        {title} ({g.nights})
      </span>
      <HBars rows={[row('Mood', g.mood, C.mood), row('Energy', g.energy, C.energy)]} max={10} />
    </div>
  )
  return (
    <ChartCard
      title="Sleep vs next-day mood and energy"
      legend={[
        { label: 'Mood', color: C.mood },
        { label: 'Energy', color: C.energy },
      ]}
      readout="Scale 1–10. A simple comparison over this period, not a cause."
    >
      <div className="flex flex-col gap-3">
        {group(`After nights at or above ${formatDuration(targetMin)}`, r.above)}
        {group('After nights below target', r.below)}
      </div>
    </ChartCard>
  )
}

function MoodChart({ labels, bks, mood, energy }) {
  const [active, setActive] = useState(null)
  return (
    <ChartCard
      title="Mood and energy"
      summary={`Averages ${fmt1(average(mood))} / ${fmt1(average(energy))}`}
      legend={[
        { label: 'Mood', color: C.mood },
        { label: 'Energy', color: C.energy },
      ]}
      readout={active != null ? `${bucketName(bks[active])}: mood ${fmt1(mood[active])} · energy ${fmt1(energy[active])}` : 'Average of the morning and evening check-in, 1–10.'}
      table={{ columns: ['Day', 'Mood', 'Energy'], rows: bks.map((b, i) => [bucketName(b), fmt1(mood[i]), fmt1(energy[i])]) }}
    >
      <LineChart
        labels={labels}
        series={[
          { label: 'Mood', color: C.mood, values: mood },
          { label: 'Energy', color: C.energy, values: energy },
        ]}
        min={1}
        max={10}
        ticks={[
          { v: 1, label: '1' },
          { v: 5, label: '5' },
          { v: 10, label: '10' },
        ]}
        active={active}
        onActive={setActive}
        ariaLabel="Mood and energy per day, scale 1 to 10"
      />
    </ChartCard>
  )
}

function TasksChart({ labels, bks, tasks, days }) {
  const [active, setActive] = useState(null)
  const per = bks.map((b) => taskStats(tasks, b.days))
  const all = taskStats(tasks, days)
  const max = Math.max(4, ...per.map((p) => p.done))
  return (
    <ChartCard
      title="Tasks done"
      summary={all.rate == null ? 'Nothing planned' : `${Math.round(all.rate * 100)}% of ${all.planned} done`}
      readout={active != null ? `${bucketName(bks[active])}: ${per[active].done} of ${per[active].planned} done` : 'Tap a bar for the numbers.'}
      table={{ columns: ['Day', 'Done', 'Planned'], rows: bks.map((b, i) => [bucketName(b), per[i].done, per[i].planned]) }}
    >
      <BarChart
        labels={labels}
        values={per.map((p) => p.done)}
        max={max}
        ticks={[
          { v: 0, label: '0' },
          { v: Math.round(max / 2), label: String(Math.round(max / 2)) },
          { v: max, label: String(max) },
        ]}
        active={active}
        onActive={setActive}
        ariaLabel="Tasks done per day"
      />
    </ChartCard>
  )
}

function AreasChart({ tasks, days, catById }) {
  const rows = categoryCounts(tasks, days, catById)
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <ChartCard title="Done per area of life" readout={rows.length ? '' : 'Nothing done in this period yet.'}>
      <HBars rows={rows.map((r) => ({ label: r.name, value: r.count, color: r.color ? slotColor(r.color) : 'var(--muted)' }))} max={max} />
    </ChartCard>
  )
}

function Streaks({ today, taskDays, meditationDays, checkinDays, fitness }) {
  const rows = [
    ['Tasks', streakInfo(taskDays, today)],
    ['Meditation', streakInfo(meditationDays, today)],
    ['Check-ins', streakInfo(checkinDays, today)],
    ['Fitness (8/8 days)', fitness],
  ]
  return (
    <ChartCard title="Streaks" readout="Days in a row with at least one (fitness: only complete days).">
      <div className="flex flex-col">
        {rows.map(([label, s], i) => (
          <div key={label} className={`flex min-h-12 items-center justify-between ${i ? 'border-t border-line' : ''}`}>
            <span className="font-semibold">{label}</span>
            <span className="text-sm text-muted">
              <strong className="text-base text-ink">{s.current}</strong> now · best {s.best}
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}

// ── Fitness challenge ──

function FitnessSessionsChart({ labels, bks, f, days, today }) {
  const [active, setActive] = useState(null)
  // Per bucket: sessions done per challenge day (a day bucket = that day, a week = its average)
  const per = bks.map((b) => {
    const p = fitnessPeriod(days, b.days, f, today)
    return { ...p, value: p.days.length ? p.done / p.days.length : null }
  })
  const all = fitnessPeriod(days, bks.flatMap((b) => b.days), f, today)
  const max = f.sessionsPerDay
  const name = (i) => `${bucketName(bks[i])}: ${per[i].days.length ? `${fmt1(per[i].value)} of ${f.sessionsPerDay} sessions${bks[i].days.length > 1 ? ' a day' : ''}` : 'not a challenge day'}`
  return (
    <ChartCard
      title="Sessions done"
      summary={all.days.length ? `${all.done} of ${all.planned} · ${all.complete} complete ${all.complete === 1 ? 'day' : 'days'}` : 'No challenge days in this period'}
      readout={active != null ? name(active) : 'Tap a bar for the numbers. The line is a complete day.'}
      table={{
        columns: ['Day', 'Done', 'Skipped', 'Missed'],
        rows: bks.flatMap((b) => fitnessPeriod(days, b.days, f, today).days.map((d) => [`${WEEKDAYS_SHORT[weekdayOf(d.date)]} ${formatShortDate(d.date)}`, d.done, d.skipped, d.missed])),
      }}
    >
      <BarChart
        labels={labels}
        values={per.map((p) => p.value)}
        max={max}
        target={{ value: f.sessionsPerDay, label: `${f.sessionsPerDay}/${f.sessionsPerDay}` }}
        ticks={[
          { v: 0, label: '0' },
          { v: Math.round(max / 2), label: String(Math.round(max / 2)) },
          { v: max, label: String(max) },
        ]}
        active={active}
        onActive={setActive}
        ariaLabel="Fitness sessions done per day"
      />
    </ChartCard>
  )
}

function FitnessExercisesChart({ f, days, dates, today, exercises }) {
  const { totals } = fitnessPeriod(days, dates, f, today)
  const byId = Object.fromEntries(exercises.map((e) => [e.id, e]))
  const rows = ordered(Object.fromEntries(Object.keys(totals).map((id) => [id, { order: 99, ...byId[id], name: byId[id]?.name || id, total: totals[id] }])))
    .map(([, r]) => r)
    .filter((r) => r.total > 0)
    .map((r, i) => ({
      label: `${r.emoji || ''} ${r.name}`.trim(),
      value: r.total,
      display: String(r.total),
      unit: r.unit ? unitLabel(r, r.total) : '',
      color: `var(--c${(i % 8) + 1})`,
    }))
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ChartCard
      title="Per exercise"
      readout={rows.length ? 'Total in this period (sessions and once a day together).' : 'Nothing done in this period yet.'}
      table={rows.length ? { columns: ['Exercise', 'Total', 'Unit'], rows: rows.map((r) => [r.label, r.value, r.unit]) } : undefined}
    >
      <HBars rows={rows} max={max} />
    </ChartCard>
  )
}
