import { describe, expect, it } from 'vitest'
import { addDaysKey } from './dates.js'
import { averageBedtime, fromNightMinutes, nightMinutes, sleepScore, weekComparison } from './sleepScore.js'

const full = { fellAsleep: '23:10', wokeUp: '06:55', actualMinutes: 465, deepPct: 18, remPct: 22, lightPct: 60, quality: 10 }
const prev = ['23:00', '23:20', '23:05', '22:55']

describe('sleep score', () => {
  it('a perfect night scores 100', () => {
    const r = sleepScore(full, prev)
    expect(r.score).toBe(100)
    expect(r.parts.map((p) => [p.key, p.points])).toEqual([['duration', 40], ['stages', 30], ['regularity', 20], ['quality', 10]])
  })

  it('duration is linear below the target', () => {
    // 6 h of 7.5 h = 80 % of 40 = 32 → 92
    expect(sleepScore({ ...full, actualMinutes: 360 }, prev).score).toBe(92)
    // above target is capped
    expect(sleepScore({ ...full, actualMinutes: 600 }, prev).score).toBe(100)
  })

  it('stages: full inside the ranges, falling to 0 at 10 points away', () => {
    // deep 8 % is 5 below 13 → 0.5; REM fine → stages 0.75 × 30 = 22.5 → 92.5 → 93
    expect(sleepScore({ ...full, deepPct: 8 }, prev).score).toBe(93)
    expect(sleepScore({ ...full, deepPct: 0, remPct: 50 }, prev).parts.find((p) => p.key === 'stages').points).toBe(0)
  })

  it('regularity: ±30 min is fine, 0 at ±2 h, needs 2 earlier nights', () => {
    expect(sleepScore({ ...full, fellAsleep: '23:35' }, prev).score).toBe(100) // exactly 30 min after the 23:05 average
    expect(sleepScore({ ...full, fellAsleep: '00:45' }, prev).parts.find((p) => p.key === 'regularity').points).toBeCloseTo(4.1, 0)
    expect(sleepScore({ ...full, fellAsleep: '02:00' }, prev).parts.find((p) => p.key === 'regularity').points).toBe(0)
    expect(sleepScore(full, ['23:00']).parts.map((p) => p.key)).not.toContain('regularity')
  })

  it('missing stages: their weight goes to the others', () => {
    const noStages = { actualMinutes: 360, fellAsleep: '23:10', quality: 10 }
    // duration 32/40 + regularity 20/20 + quality 10/10 = 62 of 70 → 89
    expect(sleepScore(noStages, prev).score).toBe(89)
  })

  it('only a quality rating still gives a score; nothing gives none', () => {
    expect(sleepScore({ quality: 1 }).score).toBe(0)
    expect(sleepScore({ quality: 10 }).score).toBe(100)
    expect(sleepScore({})).toBeNull()
    expect(sleepScore(null)).toBeNull()
  })

  it('custom targets from Settings', () => {
    expect(sleepScore({ actualMinutes: 420 }, [], { targetMin: 420, deepRange: [13, 23], remRange: [20, 25] }).score).toBe(100)
  })
})

describe('bedtimes across midnight', () => {
  it('23:30 and 00:30 are an hour apart', () => {
    expect(nightMinutes('00:30') - nightMinutes('23:30')).toBe(60)
    expect(fromNightMinutes(averageBedtime(['23:30', '00:30']))).toBe('00:00')
    expect(fromNightMinutes(averageBedtime(['22:50', '23:10']))).toBe('23:00')
  })
})

describe('7-day average vs the previous 7 days', () => {
  it('compares two weeks', () => {
    const vals = []
    for (let i = 0; i < 14; i++) vals.push({ date: addDaysKey('2026-10-19', -i), value: i < 7 ? 8 : 6 })
    expect(weekComparison(vals, '2026-10-19', addDaysKey)).toEqual({ average: 8, change: 2 })
    expect(weekComparison(vals.slice(0, 3), '2026-10-19', addDaysKey)).toEqual({ average: 8, change: null })
  })
})
