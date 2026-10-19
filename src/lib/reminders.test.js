import { describe, expect, it } from 'vitest'
import { dailyReminders, inQuietHours, isDue, meditationEndReminders, notificationSettings, taskReminders } from './reminders.js'

// Warsaw is UTC+2 in summer (until 25 Oct 2026), UTC+1 in winter
const summer = (hhmm, day = '2026-10-21') => new Date(`${day}T${hhmm}:00+02:00`)
const winter = (hhmm, day = '2026-11-04') => new Date(`${day}T${hhmm}:00+01:00`)

describe('time window and sleep hours', () => {
  it('a reminder is due in the 5 minutes from its time', () => {
    expect(isDue('07:30', '07:30')).toBe(true)
    expect(isDue('07:30', '07:34')).toBe(true)
    expect(isDue('07:30', '07:35')).toBe(false)
    expect(isDue('07:30', '07:29')).toBe(false)
  })
  it('sleep hours cross midnight; the end minute is awake', () => {
    const q = { on: true, start: '23:00', end: '07:00' }
    expect(inQuietHours(q, '23:00')).toBe(true)
    expect(inQuietHours(q, '02:15')).toBe(true)
    expect(inQuietHours(q, '06:59')).toBe(true)
    expect(inQuietHours(q, '07:00')).toBe(false)
    expect(inQuietHours(q, '22:59')).toBe(false)
    expect(inQuietHours({ ...q, on: false }, '02:15')).toBe(false)
    expect(inQuietHours({ on: true, start: '13:00', end: '14:00' }, '13:30')).toBe(true)
  })
  it('defaults: 07:30, 21:30, sleep hours 23:00–07:00', () => {
    const n = notificationSettings({})
    expect([n.morningCheckin.time, n.eveningCheckin.time, n.quietHours.start, n.quietHours.end]).toEqual(['07:30', '21:30', '23:00', '07:00'])
    expect(notificationSettings({ notifications: { morningCheckin: { time: '06:45' } } }).morningCheckin).toEqual({ on: true, time: '06:45' })
  })
})

describe('daily reminders (Europe/Warsaw)', () => {
  it('uses Warsaw time, in summer and in winter', () => {
    expect(dailyReminders({}, summer('07:31'))).toEqual([{ type: 'morningCheckin', date: '2026-10-21', outcome: 'send' }])
    expect(dailyReminders({}, winter('07:31'))).toEqual([{ type: 'morningCheckin', date: '2026-11-04', outcome: 'send' }])
    // 05:31 UTC is 07:31 in summer but 06:31 in winter
    expect(dailyReminders({}, new Date('2026-11-04T05:31:00Z'))).toEqual([])
  })
  it('skips what is already done today', () => {
    expect(dailyReminders({}, summer('21:30'), { eveningCheckin: true })).toEqual([{ type: 'eveningCheckin', date: '2026-10-21', outcome: 'already done' }])
    expect(dailyReminders({}, summer('07:45'), { morningMeditation: true })[0].outcome).toBe('already done')
  })
  it('respects the switches and the sleep hours', () => {
    expect(dailyReminders({ notifications: { morningCheckin: { on: false } } }, summer('07:30'))[0].outcome).toBe('switched off')
    const late = { notifications: { eveningCheckin: { time: '23:15' } } }
    expect(dailyReminders(late, summer('23:15'))[0].outcome).toBe('quiet hours')
  })
  it('weekly review only on Sunday (25 Oct = the day clocks go back)', () => {
    expect(dailyReminders({}, summer('19:00', '2026-10-21'))).toEqual([])
    expect(dailyReminders({}, winter('19:00', '2026-10-25'))).toEqual([{ type: 'weeklyReview', date: '2026-10-25', outcome: 'send' }])
  })
})

describe('task and meditation-end reminders', () => {
  const task = { status: 'open', time: '18:00', title: 'Gym', stars: 4, dueAt: summer('18:00') }
  it('15 minutes before a task with a time, once', () => {
    expect(taskReminders({}, [task], summer('17:45'))).toHaveLength(1)
    expect(taskReminders({}, [task], summer('17:44'))).toHaveLength(0)
    expect(taskReminders({}, [task], summer('17:50'))).toHaveLength(0)
    expect(taskReminders({}, [{ ...task, notified: { due: true } }], summer('17:46'))).toHaveLength(0)
    expect(taskReminders({}, [{ ...task, status: 'done' }], summer('17:46'))).toHaveLength(0)
    expect(taskReminders({}, [{ ...task, time: null }], summer('17:46'))).toHaveLength(0)
  })
  it('meditation end: a minute after the end, only if still running', () => {
    const s = { status: 'running', endsAt: summer('07:40').getTime(), plannedMin: 10, slot: 'morning' }
    expect(meditationEndReminders({}, [s], summer('07:40'))).toHaveLength(0) // maybe watching it finish
    expect(meditationEndReminders({}, [s], summer('07:41'))[0].outcome).toBe('send')
    expect(meditationEndReminders({}, [{ ...s, status: 'done' }], summer('07:41'))).toHaveLength(0)
    expect(meditationEndReminders({}, [{ ...s, notifiedEnd: true }], summer('07:41'))).toHaveLength(0)
    expect(meditationEndReminders({}, [s], summer('08:20'))).toHaveLength(0) // too old
    expect(meditationEndReminders({}, [{ ...s, endsAt: summer('23:20').getTime() }], summer('23:21'))[0].outcome).toBe('quiet hours')
  })
})
