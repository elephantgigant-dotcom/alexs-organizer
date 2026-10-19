// The weekly backup: a compact summary of one week (Monday–Sunday), written by the
// scheduled function in index.js to users/{uid}/weeklySummaries/{monday}.
// Pure (no Firebase), so it is unit-tested. Uses the app's own date and sleep-score code
// (functions/shared, copied from src/lib by `npm run sync:shared`).

import { addDaysKey, rangeKeys, todayKey, weekStartKey } from './shared/dates.js'
import { averageBedtime, DEFAULT_SLEEP_TARGETS, fromNightMinutes, sleepScore } from './shared/sleepScore.js'

const avg = (xs) => {
  const v = xs.filter((x) => typeof x === 'number')
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null
}

// The week that ended before `now` (run on Monday night → the Monday a week earlier)
export function previousWeek(now = new Date()) {
  const from = weekStartKey(addDaysKey(todayKey(now), -1))
  return { from, to: addDaysKey(from, 6) }
}

// checkins may include the 8 days before the week (for the regularity part of the sleep score)
export function weeklySummary({ from, to, tasks, checkins, meditations, starEvents, settings }) {
  const days = new Set(rangeKeys(from, to))
  const targets = { ...DEFAULT_SLEEP_TARGETS, ...(settings?.sleep || {}) }
  const weekTasks = tasks.filter((t) => days.has(t.date))
  const done = weekTasks.filter((t) => t.status === 'done').length
  const mornings = checkins.filter((c) => c.type === 'morning').sort((a, b) => a.date.localeCompare(b.date))
  const weekCheckins = checkins.filter((c) => days.has(c.date))
  const nights = mornings
    .filter((c) => days.has(c.date) && c.sleep)
    .map((c) => {
      const prev = mornings.filter((m) => m.date < c.date && m.sleep?.fellAsleep).slice(-7).map((m) => m.sleep.fellAsleep)
      return { ...c.sleep, score: sleepScore(c.sleep, prev, targets)?.score ?? null }
    })
  const bed = averageBedtime(nights.map((n) => n.fellAsleep))

  return {
    week: { from, to },
    tasks: { planned: weekTasks.length, done, completionRate: weekTasks.length ? Math.round((done / weekTasks.length) * 1000) / 10 : null },
    mood: avg(weekCheckins.map((c) => c.mood)),
    energy: avg(weekCheckins.map((c) => c.energy)),
    dayRating: avg(weekCheckins.filter((c) => c.type === 'evening').map((c) => c.dayRating)),
    checkins: { morning: weekCheckins.filter((c) => c.type === 'morning').length, evening: weekCheckins.filter((c) => c.type === 'evening').length },
    sleep: {
      nights: nights.length,
      averageMinutes: avg(nights.map((n) => n.actualMinutes)),
      averageScore: avg(nights.map((n) => n.score)),
      averageDeviceScore: avg(nights.map((n) => n.deviceScore)),
      averageCycles: avg(nights.map((n) => n.cycles)),
      averageDeepPct: avg(nights.map((n) => n.deepPct)),
      averageRemPct: avg(nights.map((n) => n.remPct)),
      averageQuality: avg(nights.map((n) => n.quality)),
      averageBedtime: bed == null ? null : fromNightMinutes(bed),
    },
    meditation: {
      finished: meditations.filter((m) => days.has(m.date) && m.status === 'done').length,
      minutes: meditations.filter((m) => days.has(m.date) && m.status === 'done').reduce((s, m) => s + (m.plannedMin || 0), 0),
    },
    stars: {
      earned: starEvents.filter((e) => days.has(e.date) && e.amount > 0).reduce((s, e) => s + e.amount, 0),
      spent: -starEvents.filter((e) => days.has(e.date) && e.amount < 0).reduce((s, e) => s + e.amount, 0),
    },
  }
}
