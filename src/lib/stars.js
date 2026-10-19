// Star rules, kept in one place so they're easy to change.
// The values themselves are editable in Settings (users/{uid}.settings.stars).

import { addDaysKey } from './dates.js'

export const DEFAULT_STAR_VALUES = {
  meditation: 5, // each finished meditation session
  checkin: 2, // each morning or evening check-in
  streakBonus: 10, // extra stars every time a streak reaches a multiple of…
  streakEvery: 7, // …this many days
}

export const DEFAULT_REWARDS = [{ title: 'Play a video game I want', emoji: '🎮', price: 500 }]

export function starValues(settings) {
  return { ...DEFAULT_STAR_VALUES, ...(settings?.stars || {}) }
}

// Current streak: consecutive days with activity, ending today.
// If today has nothing YET, the streak still counts up to yesterday (the day isn't over).
export function currentStreak(daySet, today) {
  const has = (k) => daySet.has(k)
  let day = has(today) ? today : addDaysKey(today, -1)
  let n = 0
  while (has(day) && n < 5000) {
    n++
    day = addDaysKey(day, -1)
  }
  return n
}

// Longest run of consecutive days in the set
export function longestStreak(daySet) {
  let best = 0
  for (const k of daySet) {
    if (daySet.has(addDaysKey(k, -1))) continue // not the start of a run
    let n = 0
    let day = k
    while (daySet.has(day)) {
      n++
      day = addDaysKey(day, 1)
    }
    best = Math.max(best, n)
  }
  return best
}

// Did reaching `streak` days just earn a bonus?
export function streakBonusDue(streak, values) {
  return values.streakEvery > 0 && values.streakBonus > 0 && streak > 0 && streak % values.streakEvery === 0
}

// Stable ids so the same thing never pays out twice (even after a double tap or offline replay)
export const starEventId = {
  task: (taskId) => `task_${taskId}`,
  checkin: (dateKey, type) => `checkin_${dateKey}_${type}`,
  meditation: (sessionId) => `meditation_${sessionId}`,
  streak: (kind, dateKey) => `streak_${kind}_${dateKey}`,
}

// A streak bonus is due when TODAY is the first activity of its kind today and the streak
// (including today) reaches a multiple of streakEvery. → { id, amount, note } or null
const STREAK_LABEL = { meditation: 'meditation', checkin: 'check-in', tasks: 'task' }

export function streakBonusFor(kind, activeDays, today, values) {
  if (activeDays.has(today)) return null
  const streak = currentStreak(new Set([...activeDays, today]), today)
  if (!streakBonusDue(streak, values)) return null
  return { id: starEventId.streak(kind, today), amount: values.streakBonus, note: `${streak}-day ${STREAK_LABEL[kind] || kind} streak` }
}
