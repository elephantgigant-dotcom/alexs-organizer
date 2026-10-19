// Checks that only Alex's Google account can read or write data.
// Run with: npm run test:rules   (starts a local Firestore emulator; GitHub Actions runs it on every push)

import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, increment, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import fs from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

let env
const ALEX = 'alex-uid'
const OWNER = { email: 'elephantgigant@gmail.com', email_verified: true }

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-alexs-organizer',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})

afterAll(() => env.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', ALEX), { email: OWNER.email, balance: 10 })
    await setDoc(doc(db, 'users', ALEX, 'tasks', 't1'), { title: 'Read', status: 'open' })
    await setDoc(doc(db, 'users', ALEX, 'weeklySummaries', '2026-10-12'), { tasksDone: 3 })
  })
})

const task = (extra = {}) => ({ title: 'Run', stars: 3, date: '2026-10-19', time: '18:00', status: 'open', priority: 'normal', ...extra })
const morning = (extra = {}) => ({
  type: 'morning',
  date: '2026-10-19',
  mood: 7,
  energy: 6,
  sleep: { fellAsleep: '23:10', wokeUp: '06:55', actualMinutes: 465, cycles: 5, deepPct: 18, remPct: 22, lightPct: 60, quality: 8, deviceScore: 86 },
  intentions: ['Draft', 'Gym', ''],
  ...extra,
})
const evening = (extra = {}) => ({ type: 'evening', date: '2026-10-19', mood: 8, energy: 5, dayRating: 10, wentWell: 'Draft done', ...extra })

const as = (uid, token) => env.authenticatedContext(uid, token).firestore()
const alex = () => as(ALEX, OWNER)

describe('owner', () => {
  it('Alex can read and write own data', async () => {
    await assertSucceeds(getDoc(doc(alex(), 'users', ALEX)))
    await assertSucceeds(getDoc(doc(alex(), 'users', ALEX, 'tasks', 't1')))
    await assertSucceeds(setDoc(doc(alex(), 'users', ALEX, 'tasks', 't2'), task()))
    await assertSucceeds(setDoc(doc(alex(), 'users', ALEX, 'checkins', '2026-10-19_morning'), morning()))
    await assertSucceeds(setDoc(doc(alex(), 'users', ALEX, 'categories', 'c1'), { name: 'Health', color: 6 }))
  })

  it('weekly backups are read-only for the app', async () => {
    await assertSucceeds(getDoc(doc(alex(), 'users', ALEX, 'weeklySummaries', '2026-10-12')))
    await assertFails(setDoc(doc(alex(), 'users', ALEX, 'weeklySummaries', '2026-10-12'), { tasksDone: 99 }))
  })

  it('unverified email is refused', async () => {
    await assertFails(getDoc(doc(as(ALEX, { email: OWNER.email, email_verified: false }), 'users', ALEX)))
  })
})

describe('check-ins: 1–10 ratings and sleep ranges', () => {
  const put = (id, data) => setDoc(doc(alex(), 'users', ALEX, 'checkins', id), data)

  it('valid morning and evening entries, all sleep fields optional', async () => {
    await assertSucceeds(put('2026-10-19_morning', morning()))
    await assertSucceeds(put('2026-10-19_evening', evening()))
    await assertSucceeds(put('2026-10-20_morning', { type: 'morning', date: '2026-10-20', sleep: {} }))
    await assertSucceeds(put('2026-10-21_morning', { type: 'morning', date: '2026-10-21', sleep: { actualMinutes: 0, cycles: 0, deepPct: 0, remPct: 100, quality: 10 } }))
  })

  it('one per day per type: the id must match date and type', async () => {
    await assertFails(put('2026-10-19_morning', evening()))
    await assertFails(put('2026-10-18_morning', morning()))
    await assertFails(put('2026-10-19_lunch', morning({ type: 'lunch' })))
  })

  it('ratings must be whole numbers 1–10', async () => {
    await assertFails(put('2026-10-19_morning', morning({ mood: 0 })))
    await assertFails(put('2026-10-19_morning', morning({ mood: 11 })))
    await assertFails(put('2026-10-19_morning', morning({ energy: 6.5 })))
    await assertFails(put('2026-10-19_evening', evening({ dayRating: 12 })))
    await assertFails(put('2026-10-19_morning', morning({ sleep: { quality: 0 } })))
    await assertSucceeds(put('2026-10-19_evening', evening({ mood: 1, energy: 10, dayRating: 1 })))
  })

  it('sleep: minutes 0–1440, percentages 0–100, cycles 0–12, device score 0–100, times HH:MM', async () => {
    await assertFails(put('2026-10-19_morning', morning({ sleep: { actualMinutes: 1441 } })))
    await assertFails(put('2026-10-19_morning', morning({ sleep: { actualMinutes: -1 } })))
    await assertFails(put('2026-10-19_morning', morning({ sleep: { deepPct: 101 } })))
    await assertFails(put('2026-10-19_morning', morning({ sleep: { remPct: -5 } })))
    await assertFails(put('2026-10-19_morning', morning({ sleep: { lightPct: 150 } })))
    await assertFails(put('2026-10-19_morning', morning({ sleep: { cycles: 13 } })))
    await assertFails(put('2026-10-19_morning', morning({ sleep: { fellAsleep: '25:00' } })))
    await assertFails(put('2026-10-19_morning', morning({ sleep: { wokeUp: '7:5' } })))
    await assertFails(put('2026-10-19_morning', morning({ sleep: { deviceScore: 101 } })))
    await assertFails(put('2026-10-19_morning', morning({ sleep: { deviceScore: -1 } })))
    await assertSucceeds(put('2026-10-19_morning', morning({ sleep: { actualMinutes: 1440, cycles: 12, deviceScore: 0 } })))
  })
})

describe('tasks', () => {
  const put = (data) => setDoc(doc(alex(), 'users', ALEX, 'tasks', 't9'), data)
  it('stars are effort 1–5, title and date required', async () => {
    await assertSucceeds(put(task({ stars: 5, time: null })))
    await assertFails(put(task({ stars: 6 })))
    await assertFails(put(task({ stars: 0 })))
    await assertFails(put(task({ title: '' })))
    await assertFails(put(task({ date: 'tomorrow' })))
    await assertFails(put(task({ priority: 'urgent' })))
  })
})

describe('stars can never be paid twice', () => {
  const payout = (db, id, amount = 5) => {
    const b = writeBatch(db)
    b.set(doc(db, 'users', ALEX, 'starEvents', id), { amount, type: 'meditation', refId: 'm1', note: 'Morning meditation', date: '2026-10-19' })
    b.update(doc(db, 'users', ALEX), { balance: increment(amount) })
    return b.commit()
  }

  it('the first payout works, the same payout again is rejected and the balance stays', async () => {
    const db = alex()
    await assertSucceeds(payout(db, 'meditation_m1'))
    await assertFails(payout(db, 'meditation_m1'))
    const snap = await getDoc(doc(db, 'users', ALEX))
    expect(snap.data().balance).toBe(15) // 10 + 5, not 20
  })

  it('history entries cannot be edited, only created (or deleted by undo)', async () => {
    const db = alex()
    await assertSucceeds(payout(db, 'task_t1', 3))
    await assertFails(updateDoc(doc(db, 'users', ALEX, 'starEvents', 'task_t1'), { amount: 300 }))
    await assertSucceeds(deleteDoc(doc(db, 'users', ALEX, 'starEvents', 'task_t1')))
  })

  it('star events need a sane amount, type and date', async () => {
    const put = (data) => setDoc(doc(alex(), 'users', ALEX, 'starEvents', 'x'), data)
    await assertFails(put({ amount: 5000, type: 'task', date: '2026-10-19' }))
    await assertFails(put({ amount: 5, type: 'gift', date: '2026-10-19' }))
    await assertFails(put({ amount: 2.5, type: 'checkin', date: '2026-10-19' }))
    await assertSucceeds(put({ amount: -500, type: 'redeem', note: 'Play a video game I want', date: '2026-10-19' }))
  })
})

describe('meditations, rewards, goals', () => {
  it('meditation length 5–30 minutes, known status', async () => {
    const put = (data) => setDoc(doc(alex(), 'users', ALEX, 'meditations', 'm1'), data)
    const m = { slot: 'morning', date: '2026-10-19', plannedMin: 10, startedAt: 1, endsAt: 600001, status: 'running' }
    await assertSucceeds(put(m))
    await assertFails(put({ ...m, plannedMin: 3 }))
    await assertFails(put({ ...m, plannedMin: 31 }))
    await assertFails(put({ ...m, status: 'skipped' }))
    await assertFails(put({ ...m, slot: 'noon' }))
  })
  it('rewards have a title and a whole-star price; goals a target and period', async () => {
    await assertSucceeds(setDoc(doc(alex(), 'users', ALEX, 'rewards', 'r1'), { title: 'Play a video game I want', price: 500 }))
    await assertFails(setDoc(doc(alex(), 'users', ALEX, 'rewards', 'r1'), { title: '', price: 500 }))
    await assertFails(setDoc(doc(alex(), 'users', ALEX, 'rewards', 'r1'), { title: 'Game', price: 0 }))
    await assertSucceeds(setDoc(doc(alex(), 'users', ALEX, 'goals', 'g1'), { title: 'October', target: 300, period: 'month' }))
    await assertFails(setDoc(doc(alex(), 'users', ALEX, 'goals', 'g1'), { title: 'October', target: 300, period: 'year' }))
  })
})

describe('notifications', () => {
  it('my devices are mine to register; the reminder log is written only by the server', async () => {
    await assertSucceeds(setDoc(doc(alex(), 'users', ALEX, 'devices', 'd1'), { token: 'abc', platform: 'android' }))
    await assertSucceeds(setDoc(doc(alex(), 'users', ALEX, 'pushTests', 'p1'), { createdAt: 1 }))
    await assertFails(setDoc(doc(alex(), 'users', ALEX, 'reminderLog', '2026-10-21_morningCheckin'), { outcome: 'send' }))
    await assertSucceeds(getDoc(doc(alex(), 'users', ALEX, 'reminderLog', '2026-10-21_morningCheckin')))
    const other = as('other', { email: 'someone@gmail.com', email_verified: true })
    await assertFails(setDoc(doc(other, 'users', ALEX, 'devices', 'd2'), { token: 'evil' }))
    await assertFails(setDoc(doc(other, 'users', ALEX, 'pushTests', 'p2'), { createdAt: 1 }))
  })
})

describe('everyone else', () => {
  it('another Google account sees nothing, even in its own folder', async () => {
    const other = as('other', { email: 'someone@gmail.com', email_verified: true })
    await assertFails(getDoc(doc(other, 'users', ALEX)))
    await assertFails(getDoc(doc(other, 'users', ALEX, 'tasks', 't1')))
    await assertFails(setDoc(doc(other, 'users', 'other'), { email: 'someone@gmail.com' }))
    await assertFails(setDoc(doc(other, 'users', 'other', 'tasks', 'x'), { title: 'x' }))
  })

  it('Alex email with a different uid cannot read Alex folder', async () => {
    await assertFails(getDoc(doc(as('fake', OWNER), 'users', ALEX)))
  })

  it('logged-out people see nothing', async () => {
    const anon = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(anon, 'users', ALEX)))
    await assertFails(setDoc(doc(anon, 'anything', 'x'), { a: 1 }))
  })
})
