// Export: one JSON file (it STARTS with an analysis brief for Claude) and CSV files.
// Pure functions; the database reads live in src/services/export.js.

import { rangeKeys } from './dates.js'
import { describeRecurrence } from './recurrence.js'
import { HOW_CALCULATED } from './sleepScore.js'
import {
  averageStages,
  bedtimeConsistency,
  categoryCounts,
  checkinsByDate,
  completionByWeekday,
  dayValue,
  sleepNights,
  sleepVsNextDay,
  streakBreaks,
  streakInfo,
  taskStats,
} from './stats.js'

export const ANALYSIS_BRIEF = {
  purpose:
    "This is a personal export from Alex's Organizer (tasks, morning/evening check-ins, sleep, meditation, stars). " +
    'Please analyse it and give me clear, practical insights. I am not a developer; write plainly.',
  readFirst: [
    'All dates are local dates (YYYY-MM-DD) in Europe/Warsaw. Weeks start on Monday.',
    'Mood, energy, sleep quality and day rating are whole numbers on a 1–10 scale (10 = best). Show averages with one decimal.',
    'Task stars are effort on a 1–5 scale, not a rating.',
    'Check-ins have a free-text "log": the Morning log (how I feel, what is on my mind) or the Evening log. Optional; use it for themes and context.',
    'Sleep is stored on the morning check-in of the WAKE-UP date. "Next-day" mood/energy for a night = that same date\'s check-ins.',
    'actualMinutes excludes time awake at night. deepPct / remPct / lightPct are percentages of actual sleep (may not add up to exactly 100).',
    `sleepScore (0–100) is calculated by the app: ${HOW_CALCULATED} deviceScore is what a watch or phone showed.`,
    'summary holds precomputed numbers for the whole range; data holds every record, so you can check or recompute anything.',
  ],
  analyse: [
    'Mood vs sleep: duration, quality, sleep score and next-day mood / energy.',
    'Recurring themes in the Morning and Evening logs, and how they line up with mood, energy and sleep.',
    'Sleep stages (deep %, REM %) vs next-day mood and energy.',
    'Fall-asleep time consistency vs mood (and vs sleep score).',
    'Sleep cycles and duration vs productivity (tasks completed that day, completion rate).',
    'Calculated sleep score vs device sleep score: do they agree? Where not?',
    'Meditation vs mood and energy: days with a finished session vs days without.',
    'Task completion by weekday and by area of life; what tends to slip (open past tasks).',
    'Streak breaks (tasks, meditation, check-ins): what happened in the days before a break?',
    'Trends over time: improving, flat or getting worse — for mood, energy, sleep and completion.',
    'What to improve: 3 concrete, small, testable suggestions for the next 2 weeks, based on the data.',
  ],
  answerFormat: [
    'Start with the 3 most important findings, each with the numbers behind it.',
    'Then one short section per question above. Say clearly when there is too little data to tell.',
    'Correlation is not cause: say "goes together with", not "causes".',
    'End with the 3 suggestions and how I can tell in 2 weeks whether they worked.',
  ],
}

export function buildExport({ from, to, exportedAt, settings, tasks, checkins, meditations, starEvents, categories, rewards, goals }) {
  const days = rangeKeys(from, to)
  const catById = Object.fromEntries(categories.map((c) => [c.id, c]))
  const mornings = checkins.filter((c) => c.type === 'morning')
  const byDate = checkinsByDate(checkins)
  const nights = sleepNights(mornings, days, settings.sleep)
  const t = taskStats(tasks, days)
  const done = tasks.filter((x) => x.status === 'done')
  const taskDays = new Set(done.map((x) => x.completedDate).filter(Boolean))
  const medDays = new Set(meditations.filter((m) => m.status === 'done').map((m) => m.date))
  const checkinDays = new Set(checkins.map((c) => c.date))
  const avg = (xs) => {
    const v = xs.filter((x) => typeof x === 'number')
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null
  }
  const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10)

  return {
    analysisBrief: ANALYSIS_BRIEF,
    meta: {
      app: "Alex's Organizer",
      exportedAt,
      range: { from, to, days: days.length },
      timezone: 'Europe/Warsaw',
      weekStartsOn: 'Monday',
      scales: { mood: '1-10', energy: '1-10', sleepQuality: '1-10', dayRating: '1-10', taskStars: '1-5 (effort)', sleepScore: '0-100', deviceScore: '0-100' },
      settings: { stars: settings.stars, sleepTargets: settings.sleep, meditationMinutes: settings.meditation },
    },
    summary: {
      tasks: { planned: t.planned, done: t.done, completionRate: t.rate == null ? null : Math.round(t.rate * 1000) / 10 },
      completionByWeekday: completionByWeekday(tasks.filter((x) => days.includes(x.date))).map((r) => ({ ...r, rate: r.rate == null ? null : Math.round(r.rate * 1000) / 10 })),
      doneByArea: categoryCounts(tasks, days, catById).map(({ name, count }) => ({ area: name, done: count })),
      mood: avg(days.map((d) => dayValue(byDate, d, 'mood'))),
      energy: avg(days.map((d) => dayValue(byDate, d, 'energy'))),
      dayRating: avg(checkins.filter((c) => c.type === 'evening').map((c) => c.dayRating)),
      sleep: {
        nights: nights.length,
        averageMinutes: avg(nights.map((n) => n.minutes)),
        averageScore: avg(nights.map((n) => n.score)),
        averageDeviceScore: avg(nights.map((n) => n.deviceScore)),
        averageCycles: avg(nights.map((n) => n.cycles)),
        stages: Object.fromEntries(Object.entries(averageStages(nights)).map(([k, v]) => [k, round1(v)])),
        ...bedtimeConsistency(nights),
        nextDayByTarget: sleepVsNextDay(nights, byDate, settings.sleep.targetMin),
      },
      meditation: { finished: medDays.size ? meditations.filter((m) => m.status === 'done').length : 0, daysWithMeditation: medDays.size },
      streaks: {
        tasks: { ...streakInfo(taskDays, to), breaks: streakBreaks(taskDays) },
        meditation: { ...streakInfo(medDays, to), breaks: streakBreaks(medDays) },
        checkins: { ...streakInfo(checkinDays, to), breaks: streakBreaks(checkinDays) },
      },
      stars: {
        earned: starEvents.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0),
        spent: -starEvents.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0),
      },
    },
    data: {
      tasks: tasks.map((x) => taskRow(x, catById)),
      completions: done.map((x) => completionRow(x, catById)),
      checkins: checkins.map(checkinRow).sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type)),
      sleepNights: nights.map(({ scoreParts, ...n }) => ({ ...n, scoreParts: Object.fromEntries(scoreParts.map((p) => [p.key, `${p.points}/${p.max}`])) })),
      meditations: meditations.map((m) => ({ date: m.date, slot: m.slot, plannedMin: m.plannedMin, status: m.status })),
      starEvents: starEvents.map((e) => ({ date: e.date, amount: e.amount, type: e.type, note: e.note || '' })).sort((a, b) => a.date.localeCompare(b.date)),
      areas: categories.map((c) => c.name),
      rewards: rewards.map((r) => ({ title: r.title, price: r.price })),
      goals: goals.map((g) => ({ title: g.title, target: g.target, period: g.period })),
    },
  }
}

function taskRow(x, catById) {
  return {
    date: x.date,
    time: x.time || '',
    title: x.title,
    area: catById[x.categoryId]?.name || '',
    priority: x.priority || 'normal',
    stars: x.stars,
    repeat: describeRecurrence(x.recurrence) || '',
    status: x.status,
    completedDate: x.completedDate || '',
    notes: x.notes || '',
  }
}

function completionRow(x, catById) {
  return {
    date: x.date,
    completedDate: x.completedDate || '',
    title: x.title,
    area: catById[x.categoryId]?.name || '',
    stars: x.earned ?? x.stars,
    onTime: x.completedDate ? x.completedDate <= x.date : null,
  }
}

function checkinRow(c) {
  const s = c.sleep || {}
  return {
    date: c.date,
    type: c.type,
    mood: c.mood ?? null,
    energy: c.energy ?? null,
    dayRating: c.dayRating ?? null,
    intentions: (c.intentions || []).filter(Boolean).join(' | '),
    wentWell: c.wentWell || '',
    improve: c.improve || '',
    gratitude: c.gratitude || '',
    log: c.note || '',
    fellAsleep: s.fellAsleep || '',
    wokeUp: s.wokeUp || '',
    actualMinutes: s.actualMinutes ?? null,
    cycles: s.cycles ?? null,
    deepPct: s.deepPct ?? null,
    remPct: s.remPct ?? null,
    lightPct: s.lightPct ?? null,
    sleepQuality: s.quality ?? null,
    deviceScore: s.deviceScore ?? null,
  }
}

// ── CSV ──

function cell(v) {
  if (v == null) return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(rows) {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n'
}

export const CSV_FILES = [
  { key: 'tasks', label: 'Tasks' },
  { key: 'completions', label: 'Completions' },
  { key: 'checkins', label: 'Check-ins (with sleep)' },
  { key: 'sleepNights', label: 'Sleep nights (with scores)' },
  { key: 'meditations', label: 'Meditation sessions' },
  { key: 'starEvents', label: 'Star history' },
]

export function csvFor(exp, key) {
  if (key === 'sleepNights') return toCSV(exp.data.sleepNights.map(({ scoreParts, ...n }) => ({ ...n, ...Object.fromEntries(Object.entries(scoreParts).map(([k, v]) => [`score_${k}`, v])) })))
  return toCSV(exp.data[key])
}
