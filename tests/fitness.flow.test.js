// Fitness flow, end to end on the server side: the real Cloud Function code (functions/fitness.js)
// against the Firestore emulator, minute by minute with a fast-forwarded clock.
// Done → timer → push → nag → missed → day summary, plus stars, idempotency and the
// notification's Done button (the same write the service worker makes).
// Run with: npm run test:rules

import { createRequire } from 'node:module'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runFitness } from '../functions/fitness.js'
import { atTime } from '../src/lib/fitness.js'
import { warsawParts } from '../src/lib/dates.js'

const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp, deleteApp } = require('firebase-admin/app')
const { FieldValue, getFirestore } = require('firebase-admin/firestore')

let app
let db
const DATE = '2026-10-25'
const hm = (ms) => warsawParts(new Date(ms)).time

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-alexs-organizer' }, 'fitness-flow')
  db = getFirestore(app, 'alexs-organizer')
})
afterAll(() => deleteApp(app))

async function setupUser(uid, settings = {}) {
  const ref = db.doc(`users/${uid}`)
  await ref.set({ email: 'elephantgigant@gmail.com', balance: 0, settings })
  for (const [id, name, emoji, unit, target, frequency] of [
    ['pushups', 'Push-ups', '💪', 'reps', 10, 'session'],
    ['situps', 'Sit-ups', '🔥', 'reps', 10, 'session'],
    ['water', 'Water', '💧', 'glasses', 1, 'session'],
    ['cycling', 'Cycling', '🚴', 'minutes', 30, 'daily'],
  ]) {
    await ref.collection('fitnessExercises').doc(id).set({ name, emoji, unit, customUnit: '', step: 1, frequency, enabled: true, archived: false, order: 0, targets: [{ value: target, from: '2026-10-01' }] })
  }
  return ref
}

// What the app writes when I tap Done (all counters at their targets)
async function tapDone(userRef, n, t) {
  const day = (await userRef.collection('fitnessDays').doc(DATE).get()).data()
  const exercises = Object.fromEntries(Object.entries(day.sessions[n].exercises).map(([id, x]) => [id, { done: x.target }]))
  await userRef.collection('fitnessDays').doc(DATE).set({ sessions: { [n]: { status: 'done', completedAt: t, exercises } } }, { merge: true })
}

async function runDay(userRef, { from = '07:58', to = '21:02', actions = {}, twice = false }) {
  const sent = []
  const send = async (uid, msg) => {
    sent.push({ msg })
    return { result: 'sent', sent: 1, devices: 1, errors: [] }
  }
  for (let t = atTime(DATE, from); t <= atTime(DATE, to); t += 60000) {
    if (actions[hm(t)]) await actions[hm(t)](t)
    const userDoc = await userRef.get()
    const r = await runFitness({ db, FieldValue, userDoc, now: new Date(t), send })
    if (twice) await runFitness({ db, FieldValue, userDoc: await userRef.get(), now: new Date(t), send }) // a retry / second run
    for (const p of r.pushes) sent.at(-1).at = hm(t), (sent.at(-1).kind = p.kind)
  }
  return sent.map((s) => `${s.at} ${s.msg.title} | ${s.msg.body}`)
}

describe('fitness, server flow against the database', () => {
  it('Done → 90 min timer → push → nags → missed → … → day summary at 21:00', async () => {
    const user = await setupUser('flow-1')
    const log = await runDay(user, {
      actions: {
        '08:05': (t) => tapDone(user, 1, t), // Done: next at 09:35
        // session 2: no reaction → 09:35 reminder, 09:50 + 10:05 nags, missed 10:20; session 3 due 11:05
        '11:10': (t) => tapDone(user, 3, t),
      },
      to: '12:45',
    })
    expect(log).toEqual([
      '08:00 Session 1/8 | 10 push-ups 💪, 10 sit-ups 🔥, 1 glass of water 💧',
      '09:35 Session 2/8 | 10 push-ups 💪, 10 sit-ups 🔥, 1 glass of water 💧',
      '09:50 Session 2 is waiting for you | 10 push-ups 💪, 10 sit-ups 🔥, 1 glass of water 💧',
      "10:05 Come on, you haven't done session 2 yet | 10 push-ups 💪, 10 sit-ups 🔥, 1 glass of water 💧",
      '11:05 Session 3/8 | 10 push-ups 💪, 10 sit-ups 🔥, 1 glass of water 💧',
      '12:40 Session 4/8 | 10 push-ups 💪, 10 sit-ups 🔥, 1 glass of water 💧',
    ])
    const day = (await user.collection('fitnessDays').doc(DATE).get()).data()
    expect(day.sessions['2'].status).toBe('missed')
    expect(day.sessions['3']).toMatchObject({ status: 'done', pushes: 1 })
    expect(day.sessions['1'].exercises.pushups).toEqual({ name: 'Push-ups', emoji: '💪', unit: 'reps', customUnit: '', target: 10, done: 10, order: 0 })
    expect(day.daily.cycling).toMatchObject({ name: 'Cycling', target: 30, done: 0 })
    expect(day.sessions['1'].exercises.cycling).toBeUndefined() // once-a-day exercises aren't in sessions

    // …the rest of the day: no more Done → nags, missed, and the summary at 21:00
    const rest = await runDay(user, { from: '12:46' })
    expect(rest.at(-1)).toBe('21:00 Fitness: 2/8 sessions today | 0 skipped, 6 missed · Not done yet: Cycling 30 min')
    const final = (await user.collection('fitnessDays').doc(DATE).get()).data()
    expect(final.result).toEqual({ done: 2, skipped: 0, missed: 6, sessions: 8 })
  })

  it('a retry or a second run in the same minute never sends twice', async () => {
    const user = await setupUser('flow-2')
    const log = await runDay(user, { to: '08:31', twice: true })
    expect(log.map((l) => l.slice(0, 5))).toEqual(['08:00', '08:15', '08:30'])
  })

  it('8/8 → +20 stars exactly once, with a star-history entry', async () => {
    const user = await setupUser('flow-3')
    const actions = {}
    for (let n = 1, m = 8 * 60 + 1; n <= 8; n++, m += 91) actions[`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`] = (t) => tapDone(user, n, t)
    const log = await runDay(user, { actions })
    expect(log.at(-1)).toBe('21:00 Fitness: 8/8 sessions today | Day complete! +20 stars · Not done yet: Cycling 30 min')
    expect((await user.get()).data().balance).toBe(20)
    expect((await user.collection('starEvents').doc(`fitness_${DATE}`).get()).data()).toMatchObject({ amount: 20, type: 'fitness' })
  })

  it("the notification's Done button: the same write, then the next reminder interval later", async () => {
    const user = await setupUser('flow-4')
    // The service worker writes status done + completedAt + every counter at its target (REST, as Alex)
    const log = await runDay(user, { to: '09:40', actions: { '08:02': (t) => tapDone(user, 1, t) } })
    expect(log.map((l) => l.slice(0, 5))).toEqual(['08:00', '09:32'])
  })

  it('outside the challenge (before 25 October) nothing happens', async () => {
    const user = await setupUser('flow-5')
    const r = await runFitness({ db, FieldValue, userDoc: await user.get(), now: new Date(atTime('2026-10-24', '09:00')), send: async () => ({}) })
    expect(r.pushes).toEqual([])
    expect((await user.collection('fitnessDays').doc('2026-10-24').get()).exists).toBe(false)
  })
})
