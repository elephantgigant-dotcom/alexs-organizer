import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { previousWeek, weeklySummary } from './summary.js'

describe('weekly backup summary', () => {
  it('summarises the week that just ended (Monday 00:30 Warsaw → previous Monday–Sunday)', () => {
    expect(previousWeek(new Date('2026-10-26T00:30:00+01:00'))).toEqual({ from: '2026-10-19', to: '2026-10-25' })
  })

  it('compact numbers, ratings 1–10, sleep score from the shared app code', () => {
    const s = weeklySummary({
      from: '2026-10-19',
      to: '2026-10-25',
      settings: {},
      tasks: [
        { date: '2026-10-19', status: 'done' },
        { date: '2026-10-20', status: 'open' },
        { date: '2026-10-26', status: 'done' }, // next week: ignored
      ],
      checkins: [
        { type: 'morning', date: '2026-10-17', sleep: { fellAsleep: '23:00' } }, // before the week, only for regularity
        { type: 'morning', date: '2026-10-18', sleep: { fellAsleep: '23:10' } },
        { type: 'morning', date: '2026-10-19', mood: 7, energy: 6, sleep: { fellAsleep: '23:05', actualMinutes: 450, deepPct: 18, remPct: 22.5, quality: 10, deviceScore: 80, cycles: 5 } },
        { type: 'evening', date: '2026-10-19', mood: 9, energy: 6, dayRating: 8 },
      ],
      meditations: [
        { date: '2026-10-19', status: 'done', plannedMin: 10 },
        { date: '2026-10-20', status: 'cancelled', plannedMin: 10 },
      ],
      starEvents: [
        { date: '2026-10-19', amount: 5 },
        { date: '2026-10-21', amount: -500 },
      ],
    })
    expect(s.tasks).toEqual({ planned: 2, done: 1, completionRate: 50 })
    expect([s.mood, s.energy, s.dayRating]).toEqual([8, 6, 8])
    expect(s.checkins).toEqual({ morning: 1, evening: 1 })
    expect(s.sleep).toMatchObject({ nights: 1, averageMinutes: 450, averageScore: 100, averageDeviceScore: 80, averageCycles: 5, averageBedtime: '23:05' })
    expect(s.meditation).toEqual({ finished: 1, minutes: 10 })
    expect(s.stars).toEqual({ earned: 5, spent: 500 })
  })

  it('the functions use the same date and sleep-score code as the app (run npm run sync:shared)', () => {
    for (const f of ['dates.js', 'sleepScore.js', 'reminders.js', 'fitness.js']) {
      expect(fs.readFileSync(`functions/shared/${f}`, 'utf8')).toBe(fs.readFileSync(`src/lib/${f}`, 'utf8'))
    }
  })
})
