// Goals: earn N stars in a period ('week' Monday–Sunday, 'month', or 'total' since the goal was made).
// Progress counts stars EARNED (positive star events), so spending in the shop doesn't undo it.

import { weekKeys } from './dates.js'

export function periodRange(goal, today) {
  if (goal.period === 'week') {
    const w = weekKeys(today)
    return { from: w[0], to: w[6] }
  }
  if (goal.period === 'month') return { from: `${today.slice(0, 7)}-01`, to: `${today.slice(0, 7)}-31` }
  return { from: goal.from || '0000-00-00', to: '9999-12-31' }
}

export function goalProgress(goal, events, today) {
  const { from, to } = periodRange(goal, today)
  const earned = events.filter((e) => e.amount > 0 && e.date >= from && e.date <= to).reduce((s, e) => s + e.amount, 0)
  return { earned, target: goal.target, ratio: goal.target > 0 ? Math.min(1, earned / goal.target) : 0, done: earned >= goal.target }
}

// The earliest date any goal needs, so we load only the star events we need
export function earliestNeeded(goals, today) {
  return goals.reduce((min, g) => {
    const { from } = periodRange(g, today)
    return from < min ? from : min
  }, weekKeys(today)[0] < `${today.slice(0, 7)}-01` ? weekKeys(today)[0] : `${today.slice(0, 7)}-01`)
}

export function describePeriod(period) {
  return period === 'week' ? 'this week' : period === 'month' ? 'this month' : 'in total'
}
