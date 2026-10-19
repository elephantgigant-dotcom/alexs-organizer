// Reminder rules, shared by the app (Settings screen) and the Cloud Function (copied to
// functions/shared by `npm run sync:shared`). Pure: no Firebase here, so it is unit-tested.
// All times are Europe/Warsaw wall-clock times ("07:30").

import { todayKey, warsawParts, weekdayOf } from './dates.js'

export const DEFAULT_NOTIFICATIONS = {
  morningCheckin: { on: true, time: '07:30' },
  eveningCheckin: { on: true, time: '21:30' },
  morningMeditation: { on: true, time: '07:45' },
  eveningMeditation: { on: true, time: '21:45' },
  weeklyReview: { on: true, time: '19:00' }, // Sundays
  taskDue: { on: true, leadMin: 15 }, // before a task's time
  meditationEnd: { on: true }, // a session ended while the app was closed
  quietHours: { on: true, start: '23:00', end: '07:00' }, // sleep hours: nothing is sent
}

export const REMINDER_TYPES = [
  { key: 'morningCheckin', label: 'Morning check-in', hasTime: true },
  { key: 'eveningCheckin', label: 'Evening check-in', hasTime: true },
  { key: 'morningMeditation', label: 'Morning meditation', hasTime: true },
  { key: 'eveningMeditation', label: 'Evening meditation', hasTime: true },
  { key: 'weeklyReview', label: 'Weekly review (Sundays)', hasTime: true },
  { key: 'taskDue', label: 'Task due', hint: 'before tasks that have a time' },
  { key: 'meditationEnd', label: 'Meditation finished', hint: 'when it ends while the app is closed' },
]

export function notificationSettings(settings) {
  const n = settings?.notifications || {}
  return Object.fromEntries(Object.entries(DEFAULT_NOTIFICATIONS).map(([k, v]) => [k, { ...v, ...(n[k] || {}) }]))
}

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// Sleep hours can cross midnight (23:00 → 07:00); the end minute itself is awake again
export function inQuietHours(q, hhmm) {
  if (!q?.on) return false
  const t = toMinutes(hhmm)
  const s = toMinutes(q.start)
  const e = toMinutes(q.end)
  if (s === e) return false
  return s < e ? t >= s && t < e : t >= s || t < e
}

// The function runs every minute; a reminder is due in the 5 minutes from its time
// (so one late or skipped run doesn't lose it). A log entry per day stops repeats.
export const WINDOW_MIN = 5

export function isDue(time, nowHHMM, windowMin = WINDOW_MIN) {
  const diff = toMinutes(nowHHMM) - toMinutes(time)
  return diff >= 0 && diff < windowMin
}

// Which daily reminders are due now, and what happens to each:
// 'send' | 'switched off' | 'quiet hours' | 'already done'
// done = { morningCheckin, eveningCheckin, morningMeditation, eveningMeditation } (booleans for today)
export function dailyReminders(settings, now, done = {}) {
  const n = notificationSettings(settings)
  const { time } = warsawParts(now)
  const today = todayKey(now)
  const out = []
  for (const key of ['morningCheckin', 'eveningCheckin', 'morningMeditation', 'eveningMeditation', 'weeklyReview']) {
    const r = n[key]
    if (!isDue(r.time, time)) continue
    if (key === 'weeklyReview' && weekdayOf(today) !== 0) continue
    let outcome = 'send'
    if (!r.on) outcome = 'switched off'
    else if (inQuietHours(n.quietHours, time)) outcome = 'quiet hours'
    else if (done[key]) outcome = 'already done'
    out.push({ type: key, date: today, outcome })
  }
  return out
}

// Tasks with a time, still open, whose reminder moment (time − lead) is within the window
export function taskReminders(settings, tasks, now) {
  const n = notificationSettings(settings)
  const lead = n.taskDue.leadMin * 60000
  const t = now.getTime()
  return tasks
    .filter((x) => x.status === 'open' && x.time && !x.notified?.due)
    .filter((x) => {
      const due = x.dueAt instanceof Date ? x.dueAt.getTime() : x.dueAt
      const at = due - lead
      return t >= at && t < at + WINDOW_MIN * 60000 && t < due
    })
    .map((x) => ({
      type: 'taskDue',
      task: x,
      outcome: !n.taskDue.on ? 'switched off' : inQuietHours(n.quietHours, warsawParts(now).time) ? 'quiet hours' : 'send',
    }))
}

// A running session whose end passed at least a minute ago (so I wasn't watching it finish
// in the app) and less than 30 minutes ago, not yet announced
export function meditationEndReminders(settings, sessions, now) {
  const n = notificationSettings(settings)
  const t = now.getTime()
  return sessions
    .filter((s) => s.status === 'running' && !s.notifiedEnd && t - s.endsAt >= 60000 && t - s.endsAt < 30 * 60000)
    .map((s) => ({
      type: 'meditationEnd',
      session: s,
      outcome: !n.meditationEnd.on ? 'switched off' : inQuietHours(n.quietHours, warsawParts(now).time) ? 'quiet hours' : 'send',
    }))
}

export const MESSAGES = {
  morningCheckin: () => ({ title: 'Morning check-in', body: 'How did you sleep? Mood, energy and three intentions.', url: '/checkin/morning' }),
  eveningCheckin: () => ({ title: 'Evening check-in', body: 'How was your day? What went well, what to improve.', url: '/checkin/evening' }),
  morningMeditation: (s) => ({ title: 'Morning meditation', body: `${s?.meditation?.morningMin || 10} minutes of calm.`, url: '/meditate' }),
  eveningMeditation: (s) => ({ title: 'Evening meditation', body: `${s?.meditation?.eveningMin || 10} minutes to wind down.`, url: '/meditate' }),
  weeklyReview: () => ({ title: 'Weekly review', body: 'See what went well this week and what slipped.', url: '/stats/review' }),
  taskDue: (task) => ({ title: task.title, body: `At ${task.time} · +${task.stars} stars`, url: '/' }),
  meditationEnd: (s) => ({ title: 'Meditation finished', body: `Your ${s.plannedMin}-minute ${s.slot} session is done. Open the app to collect your stars.`, url: '/meditate' }),
}
