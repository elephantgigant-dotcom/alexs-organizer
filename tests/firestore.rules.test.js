// Checks that only Alex's Google account can read or write data.
// Run with: npm run test:rules   (starts a local Firestore emulator; GitHub Actions runs it on every push)

import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import fs from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

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

const as = (uid, token) => env.authenticatedContext(uid, token).firestore()
const alex = () => as(ALEX, OWNER)

describe('owner', () => {
  it('Alex can read and write own data', async () => {
    await assertSucceeds(getDoc(doc(alex(), 'users', ALEX)))
    await assertSucceeds(getDoc(doc(alex(), 'users', ALEX, 'tasks', 't1')))
    await assertSucceeds(setDoc(doc(alex(), 'users', ALEX, 'tasks', 't2'), { title: 'Run', status: 'open' }))
    await assertSucceeds(setDoc(doc(alex(), 'users', ALEX, 'checkins', '2026-10-19_morning'), { mood: 4 }))
  })

  it('weekly backups are read-only for the app', async () => {
    await assertSucceeds(getDoc(doc(alex(), 'users', ALEX, 'weeklySummaries', '2026-10-12')))
    await assertFails(setDoc(doc(alex(), 'users', ALEX, 'weeklySummaries', '2026-10-12'), { tasksDone: 99 }))
  })

  it('unverified email is refused', async () => {
    await assertFails(getDoc(doc(as(ALEX, { email: OWNER.email, email_verified: false }), 'users', ALEX)))
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
