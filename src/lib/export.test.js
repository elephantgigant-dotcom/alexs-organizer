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
    { type: 'evening', date: '2026-10-20', mood: 9, energy: 6, dayRating: 8, wentWell: 'Draft done', note: 'Calm evening, a bit tired.' },
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

  it('the Morning / Evening log is exported as "log" and explained in the brief', () => {
    expect(exp.data.checkins.find((x) => x.type === 'evening').log).toBe('Calm evening, a bit tired.')
    expect(JSON.stringify(exp.analysisBrief)).toContain('Morning log')
    expect(csvFor(exp, 'checkins').split('\r\n')[0]).toContain(',log,')
    expect(csvFor(exp, 'checkins')).toContain('Calm evening, a bit tired.')
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

describe('fitness in the export', () => {
  const at = (hhmm) => new Date(`2026-10-26T${hhmm}:00+01:00`).getTime() // Warsaw winter time
  const ex = { name: 'Push-ups', emoji: '💪', unit: 'reps', customUnit: '', target: 10, order: 0 }
  const session = (n, status, time, done) => ({ n, status, source: 'server', scheduledAt: at(time), completedAt: status === 'done' ? at(time) + 600000 : null, pushes: 1, exercises: { pushups: { ...ex, done } } })
  const day = (date, sessions) => ({ date, sessions: Object.fromEntries(sessions.map((s) => [s.n, s])) })
  const full = Array.from({ length: 8 }, (_, i) => session(i + 1, 'done', `${String(8 + i).padStart(2, '0')}:00`, 10))
  const exp = buildExport({
    ...input,
    from: '2026-10-25',
    to: '2026-10-26',
    exportedAt: '2026-10-26T20:00:00.000Z',
    fitnessDays: [
      { ...day('2026-10-25', full), starsPaid: true },
      { ...day('2026-10-26', [session(1, 'done', '08:00', 12), session(2, 'skipped', '09:40', 0), session(3, 'missed', '11:20', 0)]), daily: { cycling: { name: 'Cycling', emoji: '🚴', unit: 'minutes', target: 30, done: 20, order: 0 } } },
    ],
    fitnessExercises: [
      { id: 'pushups', ...ex, frequency: 'session', targets: [{ value: 10, from: '2026-10-25' }, { value: 12, from: '2026-10-26' }] },
      { id: 'cycling', name: 'Cycling', emoji: '🚴', unit: 'minutes', frequency: 'daily', order: 1, targets: [{ value: 30, from: '2026-10-25' }] },
    ],
  })

  it('summary: sessions, complete days, streak, totals per exercise', () => {
    expect(exp.summary.fitness).toMatchObject({ challengeDays: 2, sessionsDone: 9, sessionsPlanned: 16, completionRate: 56.3, skipped: 1, missed: 1, completeDays: 1, streak: { current: 1, best: 1 } })
    expect(exp.summary.fitness.totals).toEqual([
      { exercise: 'Push-ups', unit: 'reps', total: 92 },
      { exercise: 'Cycling', unit: 'min', total: 20 },
    ])
  })

  it('one row per session and exercise, Warsaw clock times', () => {
    const rows = exp.data.fitnessSessions.filter((r) => r.date === '2026-10-26')
    expect(rows).toEqual([
      { date: '2026-10-26', challengeDay: 2, session: 1, status: 'done', startedBy: 'reminder', scheduledAt: '08:00', completedAt: '08:10', pushes: 1, exercise: 'Push-ups', unit: 'reps', target: 10, done: 12 },
      { date: '2026-10-26', challengeDay: 2, session: 2, status: 'skipped', startedBy: 'reminder', scheduledAt: '09:40', completedAt: '', pushes: 1, exercise: 'Push-ups', unit: 'reps', target: 10, done: 0 },
      { date: '2026-10-26', challengeDay: 2, session: 3, status: 'missed', startedBy: 'reminder', scheduledAt: '11:20', completedAt: '', pushes: 1, exercise: 'Push-ups', unit: 'reps', target: 10, done: 0 },
    ])
    expect(exp.data.fitnessDays).toEqual([
      { date: '2026-10-25', challengeDay: 1, done: 8, skipped: 0, missed: 0, complete: true, starsPaid: true },
      { date: '2026-10-26', challengeDay: 2, done: 1, skipped: 1, missed: 1, complete: false, starsPaid: false },
    ])
    expect(exp.data.fitnessDaily).toEqual([{ date: '2026-10-26', exercise: 'Cycling', unit: 'min', target: 30, done: 20, reached: false }])
  })

  it('exercises with their target history; CSV files and the brief', () => {
    expect(exp.data.fitnessExercises[0]).toMatchObject({ name: 'Push-ups', frequency: 'every session', currentTarget: 12, targetHistory: '10 from 2026-10-25; 12 from 2026-10-26' })
    expect(csvFor(exp, 'fitnessSessions').split('\r\n')[0]).toBe('date,challengeDay,session,status,startedBy,scheduledAt,completedAt,pushes,exercise,unit,target,done')
    expect(csvFor(exp, 'fitnessExercises')).toContain('10 from 2026-10-25; 12 from 2026-10-26')
    expect(JSON.stringify(exp.analysisBrief)).toContain('Fitness: sessions done per day vs mood')
  })

  it('an export without fitness data still works', () => {
    const plain = buildExport(input)
    expect(plain.summary.fitness).toMatchObject({ challengeDays: 0, sessionsDone: 0, completionRate: null })
    expect(csvFor(plain, 'fitnessSessions')).toBe('')
  })
})
