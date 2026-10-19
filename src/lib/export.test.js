import { describe, expect, it } from 'vitest'
import { buildExport, csvFor, toCSV } from './export.js'
import { withDefaults } from './defaults.js'

const input = {
  from: '2026-10-19',
  to: '2026-10-21',
  exportedAt: '2026-10-21T20:00:00.000Z',
  settings: withDefaults({}),
  categories: [{ id: 'h', name: 'Health', color: 6 }],
  tasks: [
    { id: 't1', title: 'Gym, legs', date: '2026-10-19', time: '18:00', categoryId: 'h', stars: 4, status: 'done', completedDate: '2026-10-19', earned: 4, recurrence: { type: 'weekly', weekdays: [1, 3, 5] } },
    { id: 't2', title: 'Taxes "2026"', date: '2026-10-20', stars: 2, status: 'open', recurrence: { type: 'none' } },
  ],
  checkins: [
    { type: 'morning', date: '2026-10-20', mood: 7, energy: 6, intentions: ['Draft', '', ''], sleep: { fellAsleep: '23:10', wokeUp: '06:55', actualMinutes: 465, cycles: 5, deepPct: 18, remPct: 22, lightPct: 60, quality: 8, deviceScore: 86 } },
    { type: 'evening', date: '2026-10-20', mood: 9, energy: 6, dayRating: 8, wentWell: 'Draft done' },
  ],
  meditations: [{ date: '2026-10-20', slot: 'morning', plannedMin: 10, status: 'done' }],
  starEvents: [
    { date: '2026-10-20', amount: 5, type: 'meditation', note: 'Morning meditation' },
    { date: '2026-10-21', amount: -500, type: 'redeem', note: 'Play a video game I want' },
  ],
  rewards: [{ title: 'Play a video game I want', price: 500 }],
  goals: [],
}

describe('export JSON', () => {
  const exp = buildExport(input)

  it('starts with the analysis brief', () => {
    expect(Object.keys(exp)[0]).toBe('analysisBrief')
    const text = JSON.stringify(exp.analysisBrief)
    expect(text).toContain('1–10 scale')
    for (const topic of ['Mood vs sleep', 'Sleep stages', 'Fall-asleep time consistency', 'Sleep cycles and duration vs productivity', 'Meditation vs mood', 'by weekday', 'Streak breaks', 'Trends', 'What to improve', 'device sleep score']) {
      expect(text).toContain(topic)
    }
  })

  it('keeps every sleep field and the calculated score', () => {
    const c = exp.data.checkins.find((x) => x.type === 'morning')
    expect(c).toMatchObject({ fellAsleep: '23:10', wokeUp: '06:55', actualMinutes: 465, cycles: 5, deepPct: 18, remPct: 22, lightPct: 60, sleepQuality: 8, deviceScore: 86 })
    const n = exp.data.sleepNights[0]
    expect(n.score).toBeGreaterThan(0)
    expect(Object.keys(n.scoreParts)).toEqual(['duration', 'stages', 'quality'])
  })

  it('summary numbers', () => {
    expect(exp.summary.tasks).toEqual({ planned: 2, done: 1, completionRate: 50 })
    expect(exp.summary.mood).toBe(8)
    expect(exp.summary.stars).toEqual({ earned: 5, spent: 500 })
    expect(exp.summary.sleep).toMatchObject({ nights: 1, averageMinutes: 465, averageDeviceScore: 86, averageCycles: 5 })
    expect(exp.data.completions).toEqual([{ date: '2026-10-19', completedDate: '2026-10-19', title: 'Gym, legs', area: 'Health', stars: 4, onTime: true }])
    expect(exp.data.tasks[0].repeat).toBe('Mon, Wed, Fri')
  })

  it('never contains the PIN hash', () => {
    const withPin = buildExport({ ...input, settings: withDefaults({ pin: { hash: 'SECRETHASH', salt: 'x' } }) })
    expect(JSON.stringify(withPin)).not.toContain('SECRETHASH')
  })
})

describe('CSV', () => {
  it('quotes commas, quotes and new lines', () => {
    expect(toCSV([{ a: 'x,y', b: 'say "hi"', c: 'two\nlines', d: null, e: 3 }])).toBe('a,b,c,d,e\r\n"x,y","say ""hi""","two\nlines",,3\r\n')
    expect(toCSV([])).toBe('')
  })
  it('one file per kind, sleep score parts as columns', () => {
    const exp = buildExport(input)
    expect(csvFor(exp, 'tasks').split('\r\n')[0]).toBe('date,time,title,area,priority,stars,repeat,status,completedDate,notes')
    expect(csvFor(exp, 'sleepNights').split('\r\n')[0]).toContain('score_duration')
  })
})
