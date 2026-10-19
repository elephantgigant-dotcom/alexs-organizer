// Statistics, as pure functions (no database here, so they're easy to test).
// Days are Warsaw date keys; ratings are 1–10; averages are shown with one decimal.

import { previousBedtimes } from './checkins.js'
import { addDaysKey, formatShortDate, WEEKDAYS_SHORT, weekdayOf } from './dates.js'
import { averageBedtime, fromNightMinutes, nightMinutes, sleepScore } from './sleepScore.js'

export const PERIODS = [
  { value: 'week', label: 'Week', days: 7 },
  { value: 'month', label: 'Month', days: 30 },
  { value: 'quarter', label: '3 months', days: 91 },
]

export function periodDays(period, today) {
  const n = PERIODS.find((p) => p.value === period)?.days || 7
  return Array.from({ length: n }, (_, i) => addDaysKey(today, i - n + 1))
}

const avg = (xs) => {
  const v = xs.filter((x) => typeof x === 'number' && !Number.isNaN(x))
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}
export { avg as average }

// Chart buckets: one per day for a week or a month, one per week (Monday) for 3 months
export function buckets(days, period) {
  if (period !== 'quarter') {
    return days.map((d) => ({ key: d, days: [d], label: period === 'week' ? WEEKDAYS_SHORT[weekdayOf(d)] : String(Number(d.slice(8))) }))
  }
  const out = []
  for (const d of days) {
    const monday = addDaysKey(d, -((weekdayOf(d) + 6) % 7))
    let b = out[out.length - 1]
    if (!b || b.key !== monday) out.push((b = { key: monday, days: [], label: formatShortDate(monday) }))
    b.days.push(d)
  }
  return out
}

// ── Check-ins ──

export function checkinsByDate(checkins) {
  const map = {}
  for (const c of checkins) (map[c.date] ||= {})[c.type] = c
  return map
}

// A day's mood / energy: the average of the morning and evening check-in (whichever exist)
export function dayValue(byDate, date, field) {
  const d = byDate[date]
  return d ? avg([d.morning?.[field], d.evening?.[field]]) : null
}

// ── Tasks ──

export function taskStats(tasks, days) {
  const inRange = new Set(days)
  const perDay = Object.fromEntries(days.map((d) => [d, { date: d, done: 0, planned: 0 }]))
  for (const t of tasks) {
    if (!inRange.has(t.date)) continue
    perDay[t.date].planned++
    if (t.status === 'done') perDay[t.date].done++
  }
  const list = days.map((d) => perDay[d])
  const done = list.reduce((s, d) => s + d.done, 0)
  const planned = list.reduce((s, d) => s + d.planned, 0)
  return { perDay: list, done, planned, rate: planned ? done / planned : null }
}

export function categoryCounts(tasks, days, catById) {
  const inRange = new Set(days)
  const counts = {}
  for (const t of tasks) if (t.status === 'done' && inRange.has(t.date)) counts[t.categoryId || ''] = (counts[t.categoryId || ''] || 0) + 1
  return Object.entries(counts)
    .map(([id, count]) => ({ id, count, name: catById[id]?.name || 'No area', color: catById[id]?.color || null }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

// Done by weekday (Mon–Sun): rate per weekday over the given tasks
export function completionByWeekday(tasks) {
  const rows = [1, 2, 3, 4, 5, 6, 0].map((wd) => ({ weekday: WEEKDAYS_SHORT[wd], done: 0, planned: 0 }))
  for (const t of tasks) {
    const r = rows[(weekdayOf(t.date) + 6) % 7]
    r.planned++
    if (t.status === 'done') r.done++
  }
  return rows.map((r) => ({ ...r, rate: r.planned ? r.done / r.planned : null }))
}

// ── Streaks ──

export function streakInfo(daySet, today) {
  const has = (k) => daySet.has(k)
  let day = has(today) ? today : addDaysKey(today, -1)
  let current = 0
  while (has(day) && current < 5000) {
    current++
    day = addDaysKey(day, -1)
  }
  let best = 0
  for (const k of daySet) {
    if (has(addDaysKey(k, -1))) continue
    let n = 0
    let d = k
    while (has(d)) {
      n++
      d = addDaysKey(d, 1)
    }
    best = Math.max(best, n)
  }
  return { current, best }
}

// Streak breaks: the days a streak of at least `min` days ended (for the analysis brief)
export function streakBreaks(daySet, min = 3) {
  const out = []
  for (const k of daySet) {
    if (daySet.has(addDaysKey(k, 1))) continue
    let n = 0
    let d = k
    while (daySet.has(d)) {
      n++
      d = addDaysKey(d, -1)
    }
    if (n >= min) out.push({ lastDay: k, brokenOn: addDaysKey(k, 1), length: n })
  }
  return out.sort((a, b) => a.lastDay.localeCompare(b.lastDay))
}

// ── Sleep ──

// One row per night (the morning check-in of the wake-up date), with its sleep score
export function sleepNights(mornings, days, targets) {
  const set = new Set(days)
  return mornings
    .filter((c) => set.has(c.date) && c.sleep && Object.keys(c.sleep).length)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((c) => {
      const s = c.sleep
      const scored = sleepScore(s, previousBedtimes(mornings, c.date), targets)
      return {
        date: c.date,
        minutes: s.actualMinutes ?? null,
        fellAsleep: s.fellAsleep ?? null,
        wokeUp: s.wokeUp ?? null,
        cycles: s.cycles ?? null,
        deepPct: s.deepPct ?? null,
        remPct: s.remPct ?? null,
        lightPct: s.lightPct ?? null,
        quality: s.quality ?? null,
        deviceScore: s.deviceScore ?? null,
        score: scored?.score ?? null,
        scoreParts: scored?.parts ?? [],
      }
    })
}

// Average bedtime / wake-up, and how much bedtime varies (average distance from the average)
export function bedtimeConsistency(nights) {
  const beds = nights.map((n) => n.fellAsleep).filter(Boolean)
  const wakes = nights.map((n) => n.wokeUp).filter(Boolean)
  const bedAvg = averageBedtime(beds)
  const wakeAvg = averageBedtime(wakes)
  const spread = bedAvg == null ? null : Math.round(avg(beds.map((t) => Math.abs(nightMinutes(t) - bedAvg))))
  return {
    bedtime: bedAvg == null ? null : fromNightMinutes(bedAvg),
    wakeUp: wakeAvg == null ? null : fromNightMinutes(wakeAvg),
    spreadMin: spread,
  }
}

// Nights at/above the sleep target vs below: the same day's mood and energy (1–10)
export function sleepVsNextDay(nights, byDate, targetMin) {
  const group = (rows) => ({
    nights: rows.length,
    mood: avg(rows.map((n) => dayValue(byDate, n.date, 'mood'))),
    energy: avg(rows.map((n) => dayValue(byDate, n.date, 'energy'))),
  })
  const withMinutes = nights.filter((n) => n.minutes != null)
  return {
    above: group(withMinutes.filter((n) => n.minutes >= targetMin)),
    below: group(withMinutes.filter((n) => n.minutes < targetMin)),
  }
}

// Weighted average stage split over nights that have stages
export function averageStages(nights) {
  const rows = nights.filter((n) => n.deepPct != null || n.remPct != null)
  return {
    deepPct: avg(rows.map((n) => n.deepPct)),
    remPct: avg(rows.map((n) => n.remPct)),
    lightPct: avg(rows.map((n) => n.lightPct)),
  }
}

// ── Weekly review ──

export function weeklyReview({ days, today, tasks, checkins, meditations, events, catById }) {
  const t = taskStats(tasks, days)
  const byDate = checkinsByDate(checkins.filter((c) => days.includes(c.date)))
  const slipped = tasks
    .filter((x) => days.includes(x.date) && x.status === 'open' && x.date < today)
    .sort((a, b) => a.date.localeCompare(b.date))
  const best = t.perDay.filter((d) => d.done > 0).sort((a, b) => b.done - a.done || a.date.localeCompare(b.date))[0] || null
  const evenings = days.map((d) => byDate[d]?.evening).filter(Boolean)
  return {
    tasks: t,
    slipped,
    bestDay: best,
    perCategory: categoryCounts(tasks, days, catById),
    wentWell: evenings.filter((e) => e.wentWell).map((e) => ({ date: e.date, text: e.wentWell })),
    improve: evenings.filter((e) => e.improve).map((e) => ({ date: e.date, text: e.improve })),
    gratitude: evenings.filter((e) => e.gratitude).map((e) => ({ date: e.date, text: e.gratitude })),
    mood: avg(days.map((d) => dayValue(byDate, d, 'mood'))),
    energy: avg(days.map((d) => dayValue(byDate, d, 'energy'))),
    dayRating: avg(evenings.map((e) => e.dayRating)),
    meditations: meditations.filter((m) => days.includes(m.date) && m.status === 'done').length,
    checkins: days.reduce((s, d) => s + (byDate[d]?.morning ? 1 : 0) + (byDate[d]?.evening ? 1 : 0), 0),
    starsEarned: events.filter((e) => days.includes(e.date) && e.amount > 0).reduce((s, e) => s + e.amount, 0),
  }
}

export function fmt1(v) {
  return v == null ? '–' : v.toFixed(1)
}

// "+0.4", "−0.3", "+6 points"
export function formatChange(change, { decimals = 1, unit = '' } = {}) {
  if (change == null) return 'No earlier data'
  const r = Number(change.toFixed(decimals))
  if (r === 0) return 'No change'
  return `${r > 0 ? '▲ +' : '▼ −'}${Math.abs(r).toFixed(decimals)}${unit}`
}
