import { describe, expect, it } from 'vitest'
import {
  bedtimeConsistency,
  buckets,
  categoryCounts,
  checkinsByDate,
  completionByWeekday,
  dayValue,
  formatChange,
  periodDays,
  sleepNights,
  sleepVsNextDay,
  streakBreaks,
  streakInfo,
  taskStats,
  weeklyReview,
} from './stats.js'
import { DEFAULT_SLEEP_TARGETS } from './sleepScore.js'

const today = '2026-10-21' // Wednesday
const t = (date, status, extra = {}) => ({ date, status, stars: 2, title: 'x', ...extra })

describe('periods and buckets', () => {
  it('week = last 7 days ending today; 3 months grouped by Monday', () => {
    expect(periodDays('week', today)).toEqual(['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21'])
    expect(periodDays('month', today)).toHaveLength(30)
    const q = buckets(periodDays('quarter', today), 'quarter')
    expect(q.at(-1)).toEqual({ key: '2026-10-19', days: ['2026-10-19', '2026-10-20', '2026-10-21'], label: '19 Oct' })
    expect(buckets(['2026-10-19'], 'week')[0].label).toBe('Mon')
  })
})

describe('tasks', () => {
  const tasks = [t('2026-10-20', 'done', { categoryId: 'h' }), t('2026-10-20', 'open'), t('2026-10-21', 'done', { categoryId: 'h' }), t('2026-10-21', 'done'), t('2026-10-01', 'done')]
  it('completion rate over tasks dated in the period', () => {
    const s = taskStats(tasks, periodDays('week', today))
    expect([s.done, s.planned]).toEqual([3, 4])
    expect(s.rate).toBe(0.75)
    expect(s.perDay.at(-1)).toEqual({ date: '2026-10-21', done: 2, planned: 2 })
    expect(taskStats([], ['2026-10-21']).rate).toBeNull()
  })
  it('per area, most first, "No area" for none', () => {
    expect(categoryCounts(tasks, periodDays('week', today), { h: { name: 'Health', color: 6 } })).toEqual([
      { id: 'h', count: 2, name: 'Health', color: 6 },
      { id: '', count: 1, name: 'No area', color: null },
    ])
  })
  it('completion by weekday, Monday first', () => {
    const rows = completionByWeekday(tasks)
    expect(rows[1]).toMatchObject({ weekday: 'Tue', done: 1, planned: 2, rate: 0.5 })
    expect(rows[0].weekday).toBe('Mon')
  })
})

describe('streaks', () => {
  const s = new Set(['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-18', '2026-10-19', '2026-10-20'])
  it('current (up to yesterday if today is open) and best', () => {
    expect(streakInfo(s, today)).toEqual({ current: 3, best: 3 })
    expect(streakInfo(new Set([...s, '2026-10-17']), today)).toEqual({ current: 7, best: 7 })
  })
  it('streak breaks of 3+ days', () => {
    expect(streakBreaks(s)).toEqual([
      { lastDay: '2026-10-16', brokenOn: '2026-10-17', length: 3 },
      { lastDay: '2026-10-20', brokenOn: '2026-10-21', length: 3 },
    ])
  })
})

describe('sleep', () => {
  const m = (date, sleep, mood, energy) => ({ type: 'morning', date, sleep, mood, energy })
  const mornings = [
    m('2026-10-19', { fellAsleep: '23:00', wokeUp: '06:45', actualMinutes: 465, deepPct: 18, remPct: 22, lightPct: 60, quality: 8 }, 8, 7),
    m('2026-10-20', { fellAsleep: '00:30', wokeUp: '06:30', actualMinutes: 360, quality: 5, deviceScore: 60 }, 5, 4),
    m('2026-10-21', { fellAsleep: '23:30', wokeUp: '07:00', actualMinutes: 450 }, 7, null),
  ]
  const evenings = [{ type: 'evening', date: '2026-10-21', mood: 9, energy: 6 }]
  const nights = sleepNights(mornings, periodDays('week', today), DEFAULT_SLEEP_TARGETS)

  it('one row per night with its score', () => {
    expect(nights.map((n) => n.date)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21'])
    expect(nights[1]).toMatchObject({ minutes: 360, deviceScore: 60, deepPct: null })
    expect(nights.every((n) => typeof n.score === 'number')).toBe(true)
  })
  it('bedtime consistency across midnight', () => {
    expect(bedtimeConsistency(nights)).toEqual({ bedtime: '23:40', wakeUp: '06:45', spreadMin: 33 })
  })
  it('the day after nights at/above vs below target (mood = average of morning and evening)', () => {
    const byDate = checkinsByDate([...mornings, ...evenings])
    expect(dayValue(byDate, '2026-10-21', 'mood')).toBe(8)
    const r = sleepVsNextDay(nights, byDate, 450)
    expect(r.above).toEqual({ nights: 2, mood: 8, energy: 6.5 })
    expect(r.below).toEqual({ nights: 1, mood: 5, energy: 4 })
  })
})

describe('weekly review', () => {
  it('what went well, what slipped, averages', () => {
    const days = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']
    const r = weeklyReview({
      days,
      today,
      tasks: [t('2026-10-19', 'done'), t('2026-10-19', 'done'), t('2026-10-20', 'open', { title: 'Taxes' }), t('2026-10-23', 'open')],
      checkins: [
        { type: 'evening', date: '2026-10-19', mood: 8, energy: 6, dayRating: 9, wentWell: 'Draft done', improve: 'Bed earlier' },
        { type: 'morning', date: '2026-10-20', mood: 6, energy: 5 },
      ],
      meditations: [{ date: '2026-10-19', status: 'done' }, { date: '2026-10-20', status: 'cancelled' }],
      events: [{ date: '2026-10-19', amount: 5 }, { date: '2026-10-19', amount: -500 }, { date: '2026-10-12', amount: 9 }],
      catById: {},
    })
    expect(r.slipped.map((x) => x.title)).toEqual(['Taxes']) // the 23rd isn't due yet
    expect(r.bestDay).toEqual({ date: '2026-10-19', done: 2, planned: 2 })
    expect(r.wentWell).toEqual([{ date: '2026-10-19', text: 'Draft done' }])
    expect(r.improve).toEqual([{ date: '2026-10-19', text: 'Bed earlier' }])
    expect([r.mood, r.energy, r.dayRating]).toEqual([7, 5.5, 9])
    expect([r.meditations, r.checkins, r.starsEarned]).toEqual([1, 2, 5])
  })
})

describe('formatting', () => {
  it('changes with arrows and one decimal', () => {
    expect(formatChange(0.43)).toBe('▲ +0.4')
    expect(formatChange(-0.3)).toBe('▼ −0.3')
    expect(formatChange(6, { decimals: 0, unit: ' points' })).toBe('▲ +6 points')
    expect(formatChange(null)).toBe('No earlier data')
  })
})
