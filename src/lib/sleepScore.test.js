import { describe, expect, it } from 'vitest'
import { addDaysKey } from './dates.js'
import { averageBedtime, durationFit, fromNightMinutes, nightMinutes, qualityFit, rangeFit, regularityFit, sleepScore, weekComparison } from './sleepScore.js'

const prev = ['23:00', '23:20', '23:05', '22:55'] // average 23:05
const perfect = { fellAsleep: '23:05', actualMinutes: 480, deepPct: 18, remPct: 22.5, quality: 10 }
const points = (r, key) => r.parts.find((p) => p.key === key)?.points

describe('sleep score: strict curves, same weights', () => {
  it('a perfect night scores 100 (40 + 30 + 20 + 10)', () => {
    const r = sleepScore(perfect, prev)
    expect(r.score).toBe(100)
    expect(r.parts.map((p) => [p.key, p.points])).toEqual([['duration', 40], ['stages', 30], ['regularity', 20], ['quality', 10]])
  })

  it('a typical decent night lands around 75–85', () => {
    const decent = { actualMinutes: 435, deepPct: 16, remPct: 20, fellAsleep: '23:25', quality: 7 } // 7 h 15, 20 min late
    const decent2 = { actualMinutes: 440, deepPct: 17, remPct: 21, fellAsleep: '22:55', quality: 8 }
    expect(sleepScore(decent, prev).score).toBe(74)
    expect(sleepScore(decent2, prev).score).toBe(86)
  })

  it('a great night is 90+, a poor one far below', () => {
    expect(sleepScore({ actualMinutes: 480, deepPct: 19, remPct: 23, fellAsleep: '23:05', quality: 9 }, prev).score).toBe(95)
    expect(sleepScore({ actualMinutes: 365, deepPct: 11, remPct: 18, fellAsleep: '00:40', quality: 5 }, prev).score).toBe(22)
  })

  it('duration: full at the target, a curve down to 0 at 5 h', () => {
    expect(durationFit(450, 450)).toBe(1)
    expect(durationFit(600, 450)).toBe(1)
    expect(durationFit(420, 450)).toBeCloseTo(0.64) // 7 h → 25.6 of 40
    expect(durationFit(375, 450)).toBeCloseTo(0.25) // 6 h 15
    expect(durationFit(300, 450)).toBe(0)
    expect(durationFit(200, 450)).toBe(0)
  })

  it('stages: full in the middle of the range, half at its edges, 0 at 8 points outside', () => {
    expect(rangeFit(18, [13, 23])).toBe(1)
    expect(rangeFit(13, [13, 23])).toBe(0.5)
    expect(rangeFit(23, [13, 23])).toBe(0.5)
    expect(rangeFit(9, [13, 23])).toBeCloseTo(0.25)
    expect(rangeFit(5, [13, 23])).toBe(0)
    expect(rangeFit(40, [20, 25])).toBe(0)
  })

  it('regularity: full within ±10 min, 70 % at ±30 min, 0 at ±90 min, needs 2 earlier nights', () => {
    expect(regularityFit(10)).toBe(1)
    expect(regularityFit(30)).toBeCloseTo(0.7)
    expect(regularityFit(60)).toBeCloseTo(0.35)
    expect(regularityFit(90)).toBe(0)
    expect(points(sleepScore({ ...perfect, fellAsleep: '23:35' }, prev), 'regularity')).toBe(14)
    expect(points(sleepScore({ ...perfect, fellAsleep: '00:45' }, prev), 'regularity')).toBe(0)
    expect(sleepScore(perfect, ['23:00']).parts.map((p) => p.key)).not.toContain('regularity')
  })

  it('quality: a curve, so an 8 is not almost full', () => {
    expect(qualityFit(10)).toBe(1)
    expect(qualityFit(1)).toBe(0)
    expect(qualityFit(8)).toBeCloseTo(0.686, 2)
  })

  it('missing stages: their weight goes to the others', () => {
    // duration 25.6/40 + regularity 20/20 + quality 10/10 = 55.6 of 70 → 79
    expect(sleepScore({ actualMinutes: 420, fellAsleep: '23:10', quality: 10 }, prev).score).toBe(79)
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
