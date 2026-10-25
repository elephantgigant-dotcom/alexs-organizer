// Daily Fitness Challenge: exercises, targets and the session schedule.
// Pure (no Firebase), shared by the app and the Cloud Function (copied to functions/shared by
// `npm run sync:shared`), and unit-tested. All times are Europe/Warsaw.
//
// A day: fitnessDays/{date} = {
//   date, challengeDay,
//   sessions: { "1": { n, status: 'pending'|'done'|'skipped'|'missed', source: 'server'|'manual',
//                      scheduledAt, pushes, lastPushAt, completedAt, missedAt,
//                      exercises: { [id]: { name, emoji, unit, customUnit, target, done } } }, … },
//   daily: { [id]: { name, emoji, unit, customUnit, target, done, completedAt } },
//   result: { done, skipped, missed, sessions }, summarySentAt, starsPaid
// }
//
// Rules (agreed):
//  • First session at the start time (08:00). The next one = Done / Skip time + interval (90 min).
//  • Not reacted to: reminder + nags every 15 min, at most `maxPushes` (3) pushes; one nag
//    interval after the last push the session is MISSED, and the next one is due
//    interval after the missed session's first reminder.
//  • Nothing is scheduled at or after the end of the window (21:00). At the end, an open
//    session is missed, the summary is sent and the day's result stored.
//  • 8 Done (skips don't count) → the day is complete → +20 stars once. Once-a-day exercises
//    are not required; they are only mentioned in the evening summary.
//  • Late Done just continues at the normal interval (no squeezing in all 8).

import { addDaysKey, daysBetween, warsawToDate } from './dates.js'

export const DEFAULT_FITNESS = {
  sessionsPerDay: 8,
  startTime: '08:00',
  endTime: '21:00',
  intervalMin: 90,
  nagMin: 15,
  maxPushes: 3,
  lengthDays: 30,
  startDate: '2026-10-25',
  bell: true,
  dayStars: 20,
}

export function fitnessSettings(settings) {
  return { ...DEFAULT_FITNESS, ...(settings?.fitness || {}) }
}

// ── Exercises ──

export const UNITS = [
  { value: 'reps', one: 'rep', many: 'reps' },
  { value: 'glasses', one: 'glass', many: 'glasses' },
  { value: 'ml', one: 'ml', many: 'ml' },
  { value: 'minutes', one: 'min', many: 'min' },
  { value: 'km', one: 'km', many: 'km' },
  { value: 'custom', one: '', many: '' },
]

export function unitLabel(ex, amount) {
  if (ex.unit === 'custom') return ex.customUnit || ''
  const u = UNITS.find((x) => x.value === ex.unit) || UNITS[0]
  return amount === 1 ? u.one : u.many
}

const ex = (id, name, emoji, unit, target, step, frequency, order) => ({
  id,
  name,
  emoji,
  unit,
  customUnit: '',
  step,
  frequency,
  enabled: true,
  archived: false,
  order,
  target,
})

export const DEFAULT_EXERCISES = [ex('pushups', 'Push-ups', '💪', 'reps', 10, 1, 'session', 0), ex('situps', 'Sit-ups', '🔥', 'reps', 10, 1, 'session', 1), ex('water', 'Water', '💧', 'glasses', 1, 1, 'session', 2)]

// One-tap suggestions in Settings
export const SUGGESTED_EXERCISES = [
  ex('squats', 'Squats', '🦵', 'reps', 10, 1, 'session', 0),
  ex('plank', 'Plank', '🧱', 'minutes', 1, 1, 'session', 0),
  ex('cycling', 'Cycling', '🚴', 'minutes', 30, 5, 'daily', 0),
  ex('cycling-km', 'Cycling (distance)', '🚴', 'km', 10, 1, 'daily', 0),
  ex('stretching', 'Stretching', '🧘', 'minutes', 10, 5, 'daily', 0),
  ex('walking', 'Walking', '🚶', 'km', 3, 0.5, 'daily', 0),
]

const round = (v) => Math.round(v * 100) / 100

// The target on a given date: the newest target entry that started on or before it, plus the
// optional auto-increase (add X every N days, counted from the day it was switched on, or from
// a later manual target change).
export function targetOn(exercise, date) {
  const list = [...(exercise.targets || [])].sort((a, b) => a.from.localeCompare(b.from))
  if (!list.length) return exercise.target ?? 0
  const base = [...list].reverse().find((t) => t.from <= date) || list[0]
  let value = base.value
  const a = exercise.autoIncrease
  if (a?.on && a.add > 0 && a.everyDays > 0 && a.from) {
    const from = a.from > base.from ? a.from : base.from
    if (date >= from) value += a.add * Math.floor(daysBetween(from, date) / a.everyDays)
  }
  return round(value)
}

export function activeExercises(exercises, frequency) {
  return exercises
    .filter((e) => e.enabled !== false && !e.archived && e.frequency === frequency)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
}

// `order` is kept in the snapshot: the database doesn't keep the order of map keys
function snap(e, date, done = 0, order = 0) {
  return { name: e.name, emoji: e.emoji || '', unit: e.unit, customUnit: e.customUnit || '', target: targetOn(e, date), done, order }
}

// The exercises of a session, with today's targets (done amounts kept if given)
export function sessionSnapshot(exercises, date, previous = {}) {
  return Object.fromEntries(activeExercises(exercises, 'session').map((e, i) => [e.id, snap(e, date, previous[e.id]?.done ?? 0, i)]))
}

export function dailySnapshot(exercises, date, previous = {}) {
  return Object.fromEntries(
    activeExercises(exercises, 'daily').map((e, i) => [e.id, { ...snap(e, date, previous[e.id]?.done ?? 0, i), completedAt: previous[e.id]?.completedAt ?? null }]),
  )
}

// A snapshot map → its entries in the saved order: [[id, x], …]
export function ordered(map) {
  return Object.entries(map || {}).sort(([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
}

export function sessionReady(session) {
  const list = Object.values(session?.exercises || {})
  return list.every((x) => (x.done ?? 0) >= x.target)
}

// "10 push-ups 💪, 10 sit-ups 🔥, 1 glass of water 💧"
export function exerciseText(exs) {
  return ordered(exs)
    .map(([, x]) => {
      const what = x.unit === 'reps' ? `${x.target} ${x.name.toLowerCase()}` : `${x.target} ${unitLabel(x, x.target)} of ${x.name.toLowerCase()}`.replace(/\s+/g, ' ')
      return x.emoji ? `${what} ${x.emoji}` : what
    })
    .join(', ')
}

// ── Days and sessions ──

export function challengeDay(date, f) {
  const n = daysBetween(f.startDate, date) + 1
  return n >= 1 && n <= f.lengthDays ? n : null
}

export function atTime(date, hhmm) {
  return warsawToDate(date, hhmm).getTime()
}

export function sessionList(day) {
  return Object.values(day?.sessions || {}).sort((a, b) => a.n - b.n)
}

export function pendingSession(day) {
  return sessionList(day).find((s) => s.status === 'pending') || null
}

export function counts(day) {
  const list = sessionList(day)
  return {
    done: list.filter((s) => s.status === 'done').length,
    skipped: list.filter((s) => s.status === 'skipped').length,
    missed: list.filter((s) => s.status === 'missed').length,
    started: list.length,
  }
}

// When the next session is due (ms), or null if no more today
export function nextSessionAt(day, f) {
  const list = sessionList(day)
  if (list.length >= f.sessionsPerDay) return null
  let t
  if (!list.length) t = atTime(day.date, f.startTime)
  else {
    const last = list[list.length - 1]
    if (last.status === 'pending') return null
    const base = last.status === 'missed' ? last.scheduledAt : last.completedAt ?? last.scheduledAt
    t = base + f.intervalMin * 60000
  }
  return t < atTime(day.date, f.endTime) ? t : null
}

export function isComplete(day, f) {
  return counts(day).done >= f.sessionsPerDay
}

// ── The server's minute-by-minute decision ──
// → { updates: nested changes to merge into the day doc, pushes: [...], payStars, needsExercises }
// Calling it again with the updated day (same minute, a retry, a second instance) yields nothing new:
// that is what makes the schedule idempotent.
export function fitnessTick(day, f, now, exercises = null) {
  const out = { updates: {}, pushes: [], payStars: false, needsExercises: false }
  if (!day?.date) return out
  // After the summary only a later correction (a session changed to done) can still pay the stars
  if (day.result) {
    out.payStars = isComplete(day, f) && !day.starsPaid
    return out
  }
  const end = atTime(day.date, f.endTime)
  const sessions = Object.fromEntries(sessionList(day).map((s) => [String(s.n), { ...s }]))
  const set = (n, patch) => {
    sessions[n] = { ...sessions[n], ...patch }
    out.updates.sessions = { ...(out.updates.sessions || {}), [n]: { ...(out.updates.sessions?.[n] || {}), ...patch } }
  }
  const state = () => ({ ...day, sessions })

  // End of the window: open session → missed, store the result, send the summary
  if (now >= end) {
    for (const s of Object.values(sessions)) if (s.status === 'pending') set(String(s.n), { status: 'missed', missedAt: now })
    const c = counts(state())
    out.updates.result = { done: c.done, skipped: c.skipped, missed: c.missed + (f.sessionsPerDay - c.started), sessions: f.sessionsPerDay }
    out.updates.summarySentAt = now
    const dailyLeft = Object.entries(day.daily || {})
      .filter(([, d]) => (d.done ?? 0) < d.target)
      .map(([, d]) => d)
    out.pushes.push({ kind: 'summary', result: out.updates.result, dailyLeft })
    out.payStars = c.done >= f.sessionsPerDay && !day.starsPaid
    return out
  }

  // An open session: reminder, nags, then missed
  const open = pendingSession(state())
  if (open && open.source !== 'manual') {
    const key = String(open.n)
    const pushes = open.pushes || 0
    if (pushes === 0 && now >= open.scheduledAt) {
      set(key, { pushes: 1, lastPushAt: now })
      out.pushes.push({ kind: 'reminder', n: open.n })
    } else if (pushes > 0 && pushes < f.maxPushes && now >= open.lastPushAt + f.nagMin * 60000) {
      set(key, { pushes: pushes + 1, lastPushAt: now })
      out.pushes.push({ kind: 'nag', n: open.n, nag: pushes, missedToday: counts(state()).missed })
    } else if (pushes >= f.maxPushes && now >= open.lastPushAt + f.nagMin * 60000) {
      set(key, { status: 'missed', missedAt: now })
    }
  }

  // No open session: start the next one when it's due
  if (!pendingSession(state())) {
    const next = nextSessionAt(state(), f)
    if (next != null && now >= next) {
      if (!exercises) {
        out.needsExercises = true
        return out
      }
      const n = String(sessionList(state()).length + 1)
      set(n, { n: Number(n), status: 'pending', source: 'server', scheduledAt: next, pushes: 1, lastPushAt: now, completedAt: null, missedAt: null, exercises: sessionSnapshot(exercises, day.date) })
      out.pushes.push({ kind: 'reminder', n: Number(n) })
      // Today's once-a-day exercises too (added only if missing: amounts already entered stay)
      const daily = dailySnapshot(exercises, day.date)
      const missing = Object.fromEntries(Object.entries(daily).filter(([id]) => !day.daily?.[id]))
      if (Object.keys(missing).length) out.updates.daily = missing
    }
  }

  out.payStars = isComplete(state(), f) && !day.starsPaid
  return out
}

// Push texts, built from the session's own exercise list and targets
export function fitnessMessage(push, day, f) {
  const s = day.sessions?.[String(push.n)]
  const list = exerciseText(s?.exercises)
  if (push.kind === 'reminder') return { title: `Session ${push.n}/${f.sessionsPerDay}`, body: list || 'Time to move.' }
  if (push.kind === 'nag') {
    const title =
      push.missedToday > 0
        ? `You've missed ${push.missedToday} ${push.missedToday === 1 ? 'session' : 'sessions'} today, let's catch up`
        : push.nag === 1
          ? `Session ${push.n} is waiting for you`
          : `Come on, you haven't done session ${push.n} yet`
    return { title, body: list }
  }
  const r = push.result
  const left = push.dailyLeft.map((d) => `${d.name} ${d.target} ${unitLabel(d, d.target)}`.trim())
  const parts = [r.done >= r.sessions ? `Day complete! +${f.dayStars} stars` : `${r.skipped} skipped, ${r.missed} missed`]
  if (left.length) parts.push(`Not done yet: ${left.join(', ')}`)
  return { title: `Fitness: ${r.done}/${r.sessions} sessions today`, body: parts.join(' · ') }
}

// ── Streaks and month view ──

export function dayStatus(day, f) {
  if (!day) return 'missed'
  const c = counts(day)
  if (c.done >= f.sessionsPerDay) return 'complete'
  return c.done > 0 ? 'partial' : 'missed'
}

// Current and best streak of COMPLETE (8/8) days. Today counts once it's complete.
export function fitnessStreaks(daysByDate, f, today) {
  const dates = Object.keys(daysByDate).filter((d) => dayStatus(daysByDate[d], f) === 'complete')
  const set = new Set(dates)
  const prev = (d) => {
    const x = new Date(`${d}T12:00:00Z`)
    x.setUTCDate(x.getUTCDate() - 1)
    return x.toISOString().slice(0, 10)
  }
  let day = set.has(today) ? today : prev(today)
  let current = 0
  while (set.has(day)) {
    current++
    day = prev(day)
  }
  let best = 0
  for (const d of set) {
    if (set.has(prev(d))) continue
    let n = 0
    let x = d
    while (set.has(x)) {
      n++
      const y = new Date(`${x}T12:00:00Z`)
      y.setUTCDate(y.getUTCDate() + 1)
      x = y.toISOString().slice(0, 10)
    }
    best = Math.max(best, n)
  }
  return { current, best }
}

// Totals per exercise for a day (sessions + once-a-day), keyed by exercise id
export function dayTotals(day) {
  const t = {}
  for (const s of sessionList(day)) for (const [id, x] of Object.entries(s.exercises || {})) t[id] = round((t[id] || 0) + (x.done || 0))
  for (const [id, x] of Object.entries(day?.daily || {})) t[id] = round((t[id] || 0) + (x.done || 0))
  return t
}

// Stats / export over a list of dates (only challenge days count; future days are left out).
// → { days: [{ date, done, skipped, missed }], done, planned, complete, totals: { exerciseId: amount } }
export function fitnessPeriod(daysByDate, dates, f, today) {
  const end = addDaysKey(f.startDate, f.lengthDays - 1)
  const inChallenge = dates.filter((d) => d >= f.startDate && d <= end && d <= today)
  const out = { days: [], done: 0, planned: 0, complete: 0, totals: {} }
  for (const date of inChallenge) {
    const day = daysByDate[date]
    const c = counts(day)
    out.days.push({ date, done: c.done, skipped: c.skipped, missed: c.missed })
    out.done += c.done
    out.planned += f.sessionsPerDay
    if (dayStatus(day, f) === 'complete') out.complete++
    for (const [id, v] of Object.entries(dayTotals(day))) out.totals[id] = round((out.totals[id] || 0) + v)
  }
  return out
}
