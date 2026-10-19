// Repeating tasks. Works on Warsaw date keys ("2026-10-19").
//
// recurrence = {
//   type: 'none' | 'daily' | 'weekly' | 'everyXDays' | 'monthly',
//   weekdays: [0..6],   // weekly only; 0 = Sunday (shown Monday first)
//   interval: 3,        // everyXDays only
//   dayOfMonth: 15,     // monthly only (31 → last day of shorter months)
// }
// When a repeating task is done, the next one is created (see services/tasks.js).

import { addDaysKey, daysInMonth, WEEK_ORDER, WEEKDAYS_LONG, WEEKDAYS_SHORT, weekdayOf } from './dates.js'

export const NO_REPEAT = { type: 'none' }

export function isRecurring(rec) {
  return !!rec && !!rec.type && rec.type !== 'none'
}

// One step forward from `key`
export function stepOnce(key, rec) {
  switch (rec.type) {
    case 'daily':
      return addDaysKey(key, 1)
    case 'everyXDays':
      return addDaysKey(key, Math.max(1, rec.interval || 1))
    case 'weekly': {
      const days = rec.weekdays?.length ? rec.weekdays : [weekdayOf(key)]
      for (let i = 1; i <= 7; i++) {
        const k = addDaysKey(key, i)
        if (days.includes(weekdayOf(k))) return k
      }
      return addDaysKey(key, 7)
    }
    case 'monthly': {
      const [y, m, d] = key.split('-').map(Number)
      const wanted = rec.dayOfMonth || d
      const year = m === 12 ? y + 1 : y
      const month = m === 12 ? 1 : m + 1
      const day = Math.min(wanted, daysInMonth(year, month))
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
    default:
      return null
  }
}

// The next date after finishing a task that was due on `dueKey`.
// Never lands in the past: finishing a task that is 3 days overdue gives today's one,
// not three more overdue copies.
export function nextOccurrence(dueKey, rec, today) {
  if (!isRecurring(rec) || !dueKey) return null
  let next = stepOnce(dueKey, rec)
  let guard = 0
  while (next < today && guard < 2000) {
    next = stepOnce(next, rec)
    guard++
  }
  return next
}

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// "Every day", "Every Saturday", "Mon, Wed, Fri", "Every 3 days", "Monthly on the 15th"
export function describeRecurrence(rec) {
  if (!isRecurring(rec)) return ''
  switch (rec.type) {
    case 'daily':
      return 'Every day'
    case 'everyXDays': {
      const n = rec.interval || 1
      return n === 1 ? 'Every day' : `Every ${n} days`
    }
    case 'weekly': {
      const days = rec.weekdays || []
      if (days.length === 1) return `Every ${WEEKDAYS_LONG[days[0]]}`
      if (days.length === 7) return 'Every day'
      return WEEK_ORDER.filter((d) => days.includes(d)).map((d) => WEEKDAYS_SHORT[d]).join(', ')
    }
    case 'monthly':
      return rec.dayOfMonth ? `Monthly on the ${ordinal(rec.dayOfMonth)}` : 'Monthly'
    default:
      return ''
  }
}
