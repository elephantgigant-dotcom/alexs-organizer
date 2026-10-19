import { describe, expect, it } from 'vitest'
import { previousBedtimes, toCheckinDoc } from './checkins.js'
import { goalProgress, periodRange } from './goals.js'
import { clampMinutes, endedUnseen, formatClock, isOver, newSession, pauseSession, remainingMs, resumeSession, slotFor } from './meditation.js'
import { cleanSleep } from './sleep.js'
import { DEFAULT_STAR_VALUES, streakBonusFor } from './stars.js'

const T0 = Date.UTC(2026, 9, 19, 5, 0) // 07:00 Warsaw

describe('meditation timer (timestamp-based)', () => {
  it('ends exactly plannedMin after the start, whatever happens in between', () => {
    const s = newSession({ slot: 'morning', date: '2026-10-19', plannedMin: 10 }, T0)
    expect(s.endsAt - s.startedAt).toBe(600000)
    expect(remainingMs(s, T0 + 4 * 60000)).toBe(360000)
    expect(isOver(s, T0 + 600000)).toBe(true)
    expect(remainingMs(s, T0 + 999999)).toBe(0)
  })
  it('length is 5–30 minutes', () => {
    expect(clampMinutes(3)).toBe(5)
    expect(clampMinutes(45)).toBe(30)
    expect(clampMinutes('12')).toBe(12)
  })
  it('pause keeps the remaining time; resume moves the end', () => {
    const s = newSession({ plannedMin: 10 }, T0)
    const paused = { ...s, ...pauseSession(s, T0 + 60000) }
    expect(paused.remainingMs).toBe(540000)
    expect(remainingMs(paused, T0 + 3600000)).toBe(540000) // time stands still while paused
    expect(isOver(paused, T0 + 3600000)).toBe(false)
    const resumed = { ...paused, ...resumeSession(paused, T0 + 300000) }
    expect(resumed.endsAt).toBe(T0 + 300000 + 540000)
  })
  it('asks "Did you finish?" only when the end passed unseen', () => {
    const s = newSession({ plannedMin: 10 }, T0)
    const end = s.endsAt
    expect(endedUnseen(s, end - 500, end + 200)).toBe(false) // watching: finishes by itself
    expect(endedUnseen(s, end - 120000, end + 60000)).toBe(true) // came back later
    expect(endedUnseen(s, null, end + 1)).toBe(true) // app reopened
    expect(endedUnseen(s, null, end - 1)).toBe(false) // not over yet
  })
  it('clock text and morning / evening', () => {
    expect(formatClock(412000)).toBe('06:52')
    expect(formatClock(400)).toBe('00:01')
    expect(formatClock(0)).toBe('00:00')
    expect(slotFor(7)).toBe('morning')
    expect(slotFor(21)).toBe('evening')
  })
})

describe('streak bonus', () => {
  const days = (...ds) => new Set(ds)
  it('pays when today completes a 7-day streak, once', () => {
    const six = days('2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18')
    expect(streakBonusFor('meditation', six, '2026-10-19', DEFAULT_STAR_VALUES)).toEqual({
      id: 'streak_meditation_2026-10-19',
      amount: 10,
      note: '7-day meditation streak',
    })
    // second session the same day: already active today → no bonus
    expect(streakBonusFor('meditation', new Set([...six, '2026-10-19']), '2026-10-19', DEFAULT_STAR_VALUES)).toBeNull()
    // 6-day streak → nothing yet
    expect(streakBonusFor('checkin', days('2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'), '2026-10-19', DEFAULT_STAR_VALUES)).toBeNull()
  })
  it('custom values from Settings', () => {
    expect(streakBonusFor('tasks', days('2026-10-18', '2026-10-17'), '2026-10-19', { streakBonus: 4, streakEvery: 3 }).amount).toBe(4)
    expect(streakBonusFor('tasks', days('2026-10-18'), '2026-10-19', { streakBonus: 0, streakEvery: 2 })).toBeNull()
  })
})

describe('goals', () => {
  const events = [
    { date: '2026-10-19', amount: 5 },
    { date: '2026-10-18', amount: 3 }, // last week (Sunday)
    { date: '2026-10-02', amount: 10 },
    { date: '2026-10-19', amount: -500 }, // a reward: doesn't reduce progress
    { date: '2026-09-30', amount: 7 },
  ]
  it('weeks start on Monday, months on the 1st', () => {
    expect(periodRange({ period: 'week' }, '2026-10-21')).toEqual({ from: '2026-10-19', to: '2026-10-25' })
    expect(goalProgress({ period: 'week', target: 10 }, events, '2026-10-21')).toMatchObject({ earned: 5, ratio: 0.5, done: false })
    expect(goalProgress({ period: 'month', target: 18 }, events, '2026-10-21')).toMatchObject({ earned: 18, done: true })
    expect(goalProgress({ period: 'total', from: '2026-09-30', target: 100 }, events, '2026-10-21').earned).toBe(25)
  })
})

describe('check-in documents', () => {
  it('morning: 1–10 ratings, 3 intentions, cleaned sleep', () => {
    const doc = toCheckinDoc('morning', '2026-10-19', { mood: 7, energy: 11, intentions: [' Draft ', 'Gym'], note: '', sleep: { fellAsleep: '23:10', actualMinutes: '465', quality: 8, deviceScore: '86' } }, cleanSleep)
    expect(doc).toEqual({
      type: 'morning',
      date: '2026-10-19',
      mood: 7,
      note: '',
      intentions: ['Draft', 'Gym', ''],
      sleep: { fellAsleep: '23:10', actualMinutes: 465, quality: 8, deviceScore: 86 },
    })
  })
  it('evening: day rating and reflections', () => {
    expect(toCheckinDoc('evening', '2026-10-19', { mood: 8, energy: 5, dayRating: 10, wentWell: 'Draft done ', improve: '', gratitude: 'Sun' }, cleanSleep)).toEqual({
      type: 'evening', date: '2026-10-19', mood: 8, energy: 5, note: '', dayRating: 10, wentWell: 'Draft done', improve: '', gratitude: 'Sun',
    })
  })
  it('previous bedtimes for the sleep score: up to 7 earlier nights, oldest first', () => {
    const mornings = ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19'].map((d) => ({ date: `2026-10-${d}`, sleep: { fellAsleep: `23:${d}` } }))
    expect(previousBedtimes(mornings, '2026-10-19')).toEqual(['23:11', '23:12', '23:13', '23:14', '23:15', '23:16', '23:17', '23:18'].slice(-7))
  })
})
