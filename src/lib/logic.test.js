import { describe, expect, it } from 'vitest'
import { addDaysKey, formatDue, formatLongDate, todayKey, warsawToDate, weekKeys, weekStartKey } from './dates.js'
import { describeRecurrence, nextOccurrence, stepOnce } from './recurrence.js'
import { currentStreak, longestStreak, streakBonusDue, DEFAULT_STAR_VALUES } from './stars.js'

describe('dates (Europe/Warsaw, Monday weeks)', () => {
  it('today is the Warsaw date, whatever the device time zone', () => {
    // 23:30 UTC on 18 Oct is already 01:30 on 19 Oct in Warsaw (summer time)
    expect(todayKey(new Date('2026-10-18T23:30:00Z'))).toBe('2026-10-19')
  })
  it('week starts on Monday', () => {
    expect(weekStartKey('2026-10-19')).toBe('2026-10-19') // Monday
    expect(weekStartKey('2026-10-25')).toBe('2026-10-19') // Sunday → previous Monday
    expect(weekKeys('2026-10-21')).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'])
  })
  it('adds days across month, year and DST changes', () => {
    expect(addDaysKey('2026-10-24', 2)).toBe('2026-10-26') // clocks go back on 25 Oct
    expect(addDaysKey('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('Warsaw wall time → real moment, summer and winter', () => {
    expect(warsawToDate('2026-10-19', '07:30').toISOString()).toBe('2026-10-19T05:30:00.000Z')
    expect(warsawToDate('2026-12-01', '07:30').toISOString()).toBe('2026-12-01T06:30:00.000Z')
    expect(warsawToDate('2026-12-01', '').toISOString()).toBe('2026-12-01T22:59:00.000Z')
  })
  it('friendly labels', () => {
    expect(formatDue('2026-10-19', '18:00', '2026-10-19')).toBe('Today 18:00')
    expect(formatDue('2026-10-20', '', '2026-10-19')).toBe('Tomorrow')
    expect(formatDue('2026-10-26', '10:00', '2026-10-19')).toBe('Mon 26 Oct 10:00')
    expect(formatLongDate('2026-10-19')).toBe('Monday, 19 October')
  })
})

describe('recurrence', () => {
  it('daily / every X days', () => {
    expect(stepOnce('2026-10-19', { type: 'daily' })).toBe('2026-10-20')
    expect(stepOnce('2026-10-19', { type: 'everyXDays', interval: 3 })).toBe('2026-10-22')
  })
  it('weekly on chosen days', () => {
    // Monday → next Wednesday or Friday → Wednesday
    expect(stepOnce('2026-10-19', { type: 'weekly', weekdays: [3, 5] })).toBe('2026-10-21')
    expect(stepOnce('2026-10-23', { type: 'weekly', weekdays: [3, 5] })).toBe('2026-10-28')
    expect(stepOnce('2026-10-19', { type: 'weekly', weekdays: [1] })).toBe('2026-10-26')
  })
  it('monthly keeps the day, clamps short months', () => {
    expect(stepOnce('2026-01-31', { type: 'monthly', dayOfMonth: 31 })).toBe('2026-02-28')
    expect(stepOnce('2026-02-28', { type: 'monthly', dayOfMonth: 31 })).toBe('2026-03-31')
    expect(stepOnce('2026-12-15', { type: 'monthly', dayOfMonth: 15 })).toBe('2027-01-15')
  })
  it('next one never lands in the past', () => {
    expect(nextOccurrence('2026-10-16', { type: 'daily' }, '2026-10-19')).toBe('2026-10-19') // overdue → today
    expect(nextOccurrence('2026-10-19', { type: 'daily' }, '2026-10-19')).toBe('2026-10-20') // on time → tomorrow
    expect(nextOccurrence('2026-10-19', { type: 'none' }, '2026-10-19')).toBeNull()
  })
  it('describes rules in English, Monday first', () => {
    expect(describeRecurrence({ type: 'weekly', weekdays: [6] })).toBe('Every Saturday')
    expect(describeRecurrence({ type: 'weekly', weekdays: [0, 3, 1] })).toBe('Mon, Wed, Sun')
    expect(describeRecurrence({ type: 'everyXDays', interval: 5 })).toBe('Every 5 days')
    expect(describeRecurrence({ type: 'monthly', dayOfMonth: 22 })).toBe('Monthly on the 22nd')
  })
})

describe('streaks', () => {
  const set = new Set(['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-10'])
  it('counts back from today, or yesterday if today is not done yet', () => {
    expect(currentStreak(set, '2026-10-19')).toBe(4)
    expect(currentStreak(new Set([...set, '2026-10-19']), '2026-10-19')).toBe(5)
    expect(currentStreak(set, '2026-10-20')).toBe(0)
  })
  it('longest run', () => {
    expect(longestStreak(set)).toBe(4)
  })
  it('bonus every 7 days by default', () => {
    expect(streakBonusDue(7, DEFAULT_STAR_VALUES)).toBe(true)
    expect(streakBonusDue(8, DEFAULT_STAR_VALUES)).toBe(false)
    expect(streakBonusDue(14, DEFAULT_STAR_VALUES)).toBe(true)
  })
})
