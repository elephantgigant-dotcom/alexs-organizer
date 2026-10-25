import { describe, expect, it } from 'vitest'
import { warsawParts } from './dates.js'
import {
  atTime,
  counts,
  DEFAULT_EXERCISES,
  DEFAULT_FITNESS,
  exerciseText,
  fitnessMessage,
  fitnessStreaks,
  fitnessTick,
  nextSessionAt,
  sessionReady,
  sessionSnapshot,
  targetOn,
} from './fitness.js'

const F = DEFAULT_FITNESS
const EX = DEFAULT_EXERCISES.map((e) => ({ ...e, targets: [{ value: e.target, from: '2026-10-01' }] }))
const at = (date, hhmm) => atTime(date, hhmm)
const hm = (ms) => warsawParts(new Date(ms)).time

function merge(a, b) {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a?.[k] || {}, v) : v
  return out
}

// Runs the server minute by minute; `actions` = { 'HH:MM': (day) => changes } like the app's taps
function simulate(date, { from = '07:59', to = '21:01', actions = {}, f = F, exercises = EX, start = { date, sessions: {} } } = {}) {
  let day = start
  const log = []
  for (let t = at(date, from); t <= at(date, to); t += 60000) {
    const act = actions[hm(t)]
    if (act) day = merge(day, act(day, t))
    let r = fitnessTick(day, f, t)
    if (r.needsExercises) r = fitnessTick(day, f, t, exercises)
    day = merge(day, r.updates)
    if (r.payStars) day = merge(day, { starsPaid: true })
    for (const p of r.pushes) log.push(`${hm(t)} ${p.kind}${p.n ? ` ${p.n}` : ''}${p.nag ? ` #${p.nag}` : ''}`)
    if (r.payStars) log.push(`${hm(t)} stars`)
  }
  return { day, log }
}

const done = (n) => (day, t) => ({
  sessions: { [n]: { status: 'done', completedAt: t, exercises: Object.fromEntries(Object.entries(day.sessions[n].exercises).map(([id, x]) => [id, { done: x.target }])) } },
})
const skip = (n) => (_day, t) => ({ sessions: { [n]: { status: 'skipped', completedAt: t } } })

describe('targets', () => {
  const pushups = { ...EX[0], targets: [{ value: 10, from: '2026-10-25' }, { value: 15, from: '2026-11-03' }] }
  it('changes apply from their date on; earlier days keep the old target', () => {
    expect(targetOn(pushups, '2026-11-02')).toBe(10)
    expect(targetOn(pushups, '2026-11-03')).toBe(15)
    expect(targetOn(pushups, '2026-11-20')).toBe(15)
  })
  it('auto-increase: +X every N days, counted from the day it was switched on', () => {
    const auto = { ...pushups, targets: [{ value: 10, from: '2026-10-25' }], autoIncrease: { on: true, add: 2, everyDays: 3, from: '2026-10-27' } }
    expect(targetOn(auto, '2026-10-26')).toBe(10)
    expect(targetOn(auto, '2026-10-29')).toBe(10)
    expect(targetOn(auto, '2026-10-30')).toBe(12)
    expect(targetOn(auto, '2026-11-02')).toBe(14)
    // a manual change later restarts the counting from that day
    const edited = { ...auto, targets: [...auto.targets, { value: 20, from: '2026-11-01' }] }
    expect(targetOn(edited, '2026-11-03')).toBe(20)
    expect(targetOn(edited, '2026-11-04')).toBe(22)
  })
  it('reminder text is built from the current exercises', () => {
    const s = sessionSnapshot(EX, '2026-10-25')
    expect(exerciseText(s)).toBe('10 push-ups 💪, 10 sit-ups 🔥, 1 glass of water 💧')
    expect(sessionReady({ exercises: s })).toBe(false)
    expect(sessionReady({ exercises: { a: { target: 10, done: 12 } } })).toBe(true)
  })
  it('disabled and archived exercises are left out; once-a-day ones are not in sessions', () => {
    const list = [...EX, { ...EX[0], id: 'old', archived: true }, { ...EX[1], id: 'off', enabled: false }, { ...EX[0], id: 'bike', frequency: 'daily' }]
    expect(Object.keys(sessionSnapshot(list, '2026-10-25'))).toEqual(['pushups', 'situps', 'water'])
  })
})

describe('a day, minute by minute (25 Oct 2026: the clocks go back that night)', () => {
  it('no reaction: reminder + 2 nags (3 pushes max), missed, next one interval after the first reminder', () => {
    const { log, day } = simulate('2026-10-25', { to: '10:20' })
    expect(log).toEqual(['08:00 reminder 1', '08:15 nag 1 #1', '08:30 nag 1 #2', '09:30 reminder 2', '09:45 nag 2 #1', '10:00 nag 2 #2'])
    expect(day.sessions['1']).toMatchObject({ status: 'missed', pushes: 3 })
    expect(hm(day.sessions['1'].missedAt)).toBe('08:45')
    expect(hm(day.sessions['2'].scheduledAt)).toBe('09:30')
  })

  it('after a miss the nag says so', () => {
    const { day } = simulate('2026-10-25', { to: '09:45' })
    const nag = { kind: 'nag', n: 2, nag: 1, missedToday: counts({ sessions: { 1: day.sessions['1'] } }).missed }
    expect(fitnessMessage(nag, day, F).title).toBe("You've missed 1 session today, let's catch up")
    expect(fitnessMessage({ kind: 'nag', n: 1, nag: 1, missedToday: 0 }, day, F).title).toBe('Session 1 is waiting for you')
    expect(fitnessMessage({ kind: 'nag', n: 1, nag: 2, missedToday: 0 }, day, F).title).toBe("Come on, you haven't done session 1 yet")
    expect(fitnessMessage({ kind: 'reminder', n: 2 }, day, F)).toEqual({ title: 'Session 2/8', body: '10 push-ups 💪, 10 sit-ups 🔥, 1 glass of water 💧' })
  })

  it('Done → next reminder exactly interval after the Done; no nags after Done', () => {
    const { log } = simulate('2026-10-25', { to: '11:10', actions: { '08:05': done(1), '09:40': done(2) } })
    expect(log).toEqual(['08:00 reminder 1', '09:35 reminder 2', '11:10 reminder 3'])
  })

  it('Skip also starts the interval, and counts as not done', () => {
    const { log, day } = simulate('2026-10-25', { to: '09:40', actions: { '08:10': skip(1) } })
    expect(log).toEqual(['08:00 reminder 1', '09:40 reminder 2'])
    expect(counts(day)).toMatchObject({ done: 0, skipped: 1 })
  })

  it('a double tap, a retry or a reload never doubles a push or a schedule', () => {
    const { day } = simulate('2026-10-25', { to: '08:00' })
    const again = fitnessTick(day, F, at('2026-10-25', '08:00'), EX)
    expect(again.pushes).toEqual([])
    expect(again.updates).toEqual({})
    // Done twice: same result, one next session
    const twice = simulate('2026-10-25', { to: '09:40', actions: { '08:05': done(1), '08:06': done(1) } })
    expect(twice.log).toEqual(['08:00 reminder 1', '09:36 reminder 2'])
  })

  it('late Done (40 min after each reminder) just continues at the normal interval; nothing at/after 21:00; summary', () => {
    const actions = { '08:40': done(1), '10:50': done(2), '13:00': done(3), '15:10': done(4), '17:20': done(5), '19:30': done(6) }
    const { log, day } = simulate('2026-10-25', { actions })
    expect(log.filter((l) => l.includes('reminder'))).toEqual(['08:00 reminder 1', '10:10 reminder 2', '12:20 reminder 3', '14:30 reminder 4', '16:40 reminder 5', '18:50 reminder 6'])
    expect(log.at(-1)).toBe('21:00 summary') // 19:30 + 90 min = 21:00: not scheduled
    expect(day.result).toEqual({ done: 6, skipped: 0, missed: 2, sessions: 8 })
    expect(day.starsPaid).toBeUndefined()
    expect(fitnessMessage({ kind: 'summary', result: day.result, dailyLeft: [] }, day, F).title).toBe('Fitness: 6/8 sessions today')
  })

  it('8 Done → day complete, stars once, summary says so', () => {
    const actions = {}
    let t = '08:01' // Done 1 minute after each reminder
    for (let n = 1; n <= 8; n++) {
      actions[t] = done(n)
      const [h, m] = t.split(':').map(Number)
      const next = h * 60 + m + 91
      t = `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`
    }
    const { log, day } = simulate('2026-10-25', { actions })
    expect(log.filter((l) => l.endsWith('stars'))).toEqual(['18:38 stars'])
    expect(day.result).toEqual({ done: 8, skipped: 0, missed: 0, sessions: 8 })
    const daily = { bike: { name: 'Cycling', unit: 'minutes', target: 30, done: 10 } }
    expect(fitnessMessage({ kind: 'summary', result: day.result, dailyLeft: [daily.bike] }, day, F)).toEqual({
      title: 'Fitness: 8/8 sessions today',
      body: 'Day complete! +20 stars · Not done yet: Cycling 30 min',
    })
  })

  it('an open session at 21:00 counts as missed', () => {
    const { day } = simulate('2026-10-25', { actions: { '08:10': done(1), '09:45': done(2), '11:20': done(3), '12:55': done(4), '14:30': done(5), '16:05': done(6), '17:40': done(7) } })
    // session 8 was due 19:10, nagged, missed 19:55 → nothing else; result 7 done, 1 missed
    expect(day.sessions['8'].status).toBe('missed')
    expect(day.result).toEqual({ done: 7, skipped: 0, missed: 1, sessions: 8 })
    const open = simulate('2026-10-25', { from: '20:40', start: { date: '2026-10-25', sessions: { 1: { n: 1, status: 'pending', source: 'server', scheduledAt: at('2026-10-25', '20:45'), pushes: 0, exercises: {} } } } })
    expect(open.day.sessions['1'].status).toBe('missed')
    expect(open.day.result.missed).toBe(8)
  })

  it('a session done early by hand gets no pushes, and the next one follows its Done', () => {
    const start = { date: '2026-10-25', sessions: { 1: { n: 1, status: 'pending', source: 'manual', scheduledAt: at('2026-10-25', '07:30'), pushes: 0, exercises: sessionSnapshot(EX, '2026-10-25') } } }
    const { log } = simulate('2026-10-25', { start, from: '07:30', to: '09:10', actions: { '07:40': done(1) } })
    expect(log).toEqual(['09:10 reminder 2'])
  })

  it('settings changed mid-day apply to the next sessions only', () => {
    const { day } = simulate('2026-10-25', { to: '08:10', actions: { '08:05': done(1) } })
    expect(hm(nextSessionAt(day, F))).toBe('09:35')
    expect(hm(nextSessionAt(day, { ...F, intervalMin: 60 }))).toBe('09:05')
    expect(nextSessionAt(day, { ...F, endTime: '09:00' })).toBeNull()
  })

  it('Warsaw time on the day the clocks go back and in winter (08:00 local)', () => {
    expect(new Date(at('2026-10-25', '08:00')).toISOString()).toBe('2026-10-25T07:00:00.000Z')
    expect(new Date(at('2026-10-24', '08:00')).toISOString()).toBe('2026-10-24T06:00:00.000Z')
    expect(new Date(at('2026-11-10', '21:00')).toISOString()).toBe('2026-11-10T20:00:00.000Z')
  })
})

describe('streaks (only 8/8 days count)', () => {
  const full = { sessions: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 1, { n: i + 1, status: 'done' }])) }
  const part = { sessions: { 1: { n: 1, status: 'done' } } }
  it('current and best', () => {
    const days = { '2026-10-25': full, '2026-10-26': full, '2026-10-27': part, '2026-10-28': full, '2026-10-29': full, '2026-10-30': full }
    expect(fitnessStreaks(days, F, '2026-10-30')).toEqual({ current: 3, best: 3 })
    expect(fitnessStreaks(days, F, '2026-10-31')).toEqual({ current: 3, best: 3 }) // today not finished yet
    expect(fitnessStreaks({ ...days, '2026-10-31': part }, F, '2026-11-01')).toEqual({ current: 0, best: 3 })
  })
})

describe('corrections after the evening summary', () => {
  it('a session changed to done later still completes the day and pays the stars once', () => {
    const date = '2026-10-26'
    const sessions = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [String(i + 1), { n: i + 1, status: i === 7 ? 'skipped' : 'done', completedAt: at(date, '10:00'), scheduledAt: at(date, '10:00') }]))
    const summarized = { date, sessions, result: { done: 7, skipped: 1, missed: 0, sessions: 8 }, summarySentAt: at(date, '21:00') }
    expect(fitnessTick(summarized, F, at(date, '21:30')).payStars).toBe(false)
    const fixed = { ...summarized, sessions: { ...sessions, 8: { ...sessions[8], status: 'done' } } }
    const r = fitnessTick(fixed, F, at(date, '21:31'))
    expect(r).toMatchObject({ payStars: true, pushes: [], updates: {} })
    expect(fitnessTick({ ...fixed, starsPaid: true }, F, at(date, '21:32')).payStars).toBe(false)
  })
})
