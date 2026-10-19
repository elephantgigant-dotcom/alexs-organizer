import { describe, expect, it } from 'vitest'
import { formatAverage, isRating } from './checkins.js'
import { isValidPin, hashPin, lockoutMs, verifyPin } from './pin.js'
import { autoLight, cleanSleep, formatDuration, joinMinutes, minutesBetween, splitMinutes, stagesWarning } from './sleep.js'

describe('sleep', () => {
  it('actual sleep across midnight', () => {
    expect(minutesBetween('23:10', '06:55')).toBe(465)
    expect(minutesBetween('00:30', '07:00')).toBe(390)
    expect(minutesBetween('22:00', '22:30')).toBe(30)
    expect(minutesBetween('13:00', '14:30')).toBe(90) // a nap
    expect(minutesBetween('23:59', '00:01')).toBe(2)
    expect(minutesBetween('07:00', '07:00')).toBeNull()
    expect(minutesBetween('', '07:00')).toBeNull()
    expect(minutesBetween('25:00', '07:00')).toBeNull()
  })
  it('formats "7 h 45 min"', () => {
    expect(formatDuration(465)).toBe('7 h 45 min')
    expect(formatDuration(480)).toBe('8 h')
    expect(formatDuration(40)).toBe('40 min')
    expect(formatDuration(null)).toBe('')
  })
  it('hours + minutes fields', () => {
    expect(splitMinutes(465)).toEqual({ h: 7, m: 45 })
    expect(joinMinutes(7, 45)).toBe(465)
    expect(joinMinutes('7', '')).toBe(420)
    expect(joinMinutes('', '')).toBeNull()
  })
  it('light fills itself, warns when stages do not add up', () => {
    expect(autoLight(18, 22)).toBe(60)
    expect(autoLight(70, 40)).toBe(0)
    expect(autoLight(null, null)).toBeNull()
    expect(stagesWarning({ deepPct: 18, remPct: 22, lightPct: 60 })).toBe('')
    expect(stagesWarning({ deepPct: 18, remPct: 22, lightPct: 58 })).toBe('')
    expect(stagesWarning({ deepPct: 25, remPct: 30, lightPct: 40 })).toBe('Adds up to 95%. Usually close to 100%.')
    expect(stagesWarning({})).toBe('')
  })
  it('cleans the form into stored values', () => {
    expect(cleanSleep({ fellAsleep: '23:10', wokeUp: '06:55', actualMinutes: '465', cycles: '5', deepPct: 18, remPct: 22, lightPct: 60, quality: 8 })).toEqual({
      fellAsleep: '23:10', wokeUp: '06:55', actualMinutes: 465, cycles: 5, deepPct: 18, remPct: 22, lightPct: 60, quality: 8,
    })
    expect(cleanSleep({ fellAsleep: '', cycles: 40, quality: 0, deepPct: 120, deviceScore: 140 })).toEqual({ cycles: 12, quality: 1, deepPct: 100, deviceScore: 100 })
    expect(cleanSleep({})).toEqual({})
  })
})

describe('ratings 1–10', () => {
  it('whole numbers 1 to 10 only', () => {
    expect(isRating(1)).toBe(true)
    expect(isRating(10)).toBe(true)
    expect(isRating(0)).toBe(false)
    expect(isRating(11)).toBe(false)
    expect(isRating(7.5)).toBe(false)
  })
  it('averages with one decimal', () => {
    expect(formatAverage([7, 8, 6, 8])).toBe('7.3')
    expect(formatAverage([10])).toBe('10.0')
    expect(formatAverage([])).toBe('–')
  })
})

describe('PIN', () => {
  it('4 to 6 digits', () => {
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('123456')).toBe(true)
    expect(isValidPin('123')).toBe(false)
    expect(isValidPin('12a4')).toBe(false)
  })
  it('stores a salted hash, never the PIN', async () => {
    const stored = await hashPin('2580', 1000)
    expect(JSON.stringify(stored)).not.toContain('2580')
    expect(await verifyPin('2580', stored)).toBe(true)
    expect(await verifyPin('2581', stored)).toBe(false)
    const again = await hashPin('2580', 1000)
    expect(again.hash).not.toBe(stored.hash) // different salt
  })
  it('waits after 5 wrong tries', () => {
    expect(lockoutMs(4)).toBe(0)
    expect(lockoutMs(5)).toBe(30000)
    expect(lockoutMs(10)).toBe(60000)
  })
})
