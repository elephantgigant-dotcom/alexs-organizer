// Fitness challenge: settings, the Today card (counters, Edit, Done → countdown), the Fitness
// page, and the notification's Done button in the service worker (built app).
// The server's schedule is tested in tests/fitness.flow.test.js; here a session is put into the
// database the way the server would write it.

import { expect, test } from '@playwright/test'

const DB = 'http://127.0.0.1:8080/v1/projects/demo-alexs-organizer/databases/alexs-organizer/documents'
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date())
const str = (v) => ({ stringValue: v })
const int = (v) => ({ integerValue: String(v) })

async function signIn(page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in (test)' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Good (morning|afternoon|evening)/)
  return page.evaluate(() => window.__organizerUid)
}

// A session as the server creates it (src/lib/fitness.js fitnessTick)
async function putSession(page, uid, n, targets) {
  const exercises = Object.fromEntries(
    Object.entries(targets).map(([id, [name, target, order, unit]]) => [id, { mapValue: { fields: { name: str(name), emoji: str(''), unit: str(unit), customUnit: str(''), target: int(target), done: int(0), order: int(order) } } }]),
  )
  const session = { n: int(n), status: str('pending'), source: str('server'), scheduledAt: int(Date.now()), pushes: int(1), lastPushAt: int(Date.now()), exercises: { mapValue: { fields: exercises } } }
  const res = await page.request.patch(`${DB}/users/${uid}/fitnessDays/${today}?updateMask.fieldPaths=date&updateMask.fieldPaths=${encodeURIComponent(`sessions.\`${n}\``)}`, {
    headers: { Authorization: 'Bearer owner' },
    data: { fields: { date: str(today), sessions: { mapValue: { fields: { [n]: { mapValue: { fields: session } } } } } } },
  })
  expect(res.ok(), await res.text()).toBe(true)
}

async function sessionStatus(page, uid, n) {
  const res = await page.request.get(`${DB}/users/${uid}/fitnessDays/${today}`, { headers: { Authorization: 'Bearer owner' } })
  const s = (await res.json()).fields?.sessions?.mapValue?.fields?.[n]?.mapValue?.fields
  return s ? { status: s.status.stringValue, done: Object.fromEntries(Object.entries(s.exercises.mapValue.fields).map(([id, e]) => [id, Number(e.mapValue.fields.done.integerValue ?? e.mapValue.fields.done.doubleValue)])) } : null
}

test('fitness: settings, Today card counters, Edit target, Done → countdown, Fitness page', async ({ page }) => {
  const uid = await signIn(page)

  // More → Fitness challenge sits between "Stars, meditation, sleep" and "Export"
  await page.goto('/more')
  await expect(page.getByRole('button', { name: /Fitness challenge/ })).toBeVisible()
  const rows = await page.getByRole('button').allInnerTexts()
  const at = (t) => rows.findIndex((r) => r.includes(t))
  expect(at('Stars, meditation, sleep')).toBeLessThan(at('Fitness challenge'))
  expect(at('Fitness challenge')).toBeLessThan(at('Export'))
  await page.getByRole('button', { name: /Fitness challenge/ }).click()
  await expect(page.getByRole('heading', { name: 'Fitness challenge' })).toBeVisible()

  // Start the challenge today, all day long (so the test doesn't depend on the clock)
  await page.getByLabel('Start date').fill(today)
  await page.getByLabel('First reminder').fill('00:00')
  await page.getByLabel('Day window ends').fill('23:59')
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByText('Saved')).toBeVisible()

  // The server sends session 1 (the three default exercises)
  await putSession(page, uid, 1, { pushups: ['Push-ups', 10, 0, 'reps'], situps: ['Sit-ups', 10, 1, 'reps'], water: ['Water', 1, 2, 'glasses'] })
  await page.goto('/')
  const card = page.getByRole('region', { name: 'Fitness' })
  await expect(card.getByText('Session 1/8')).toBeVisible()
  await expect(card.getByText(/Day 1\/30/)).toBeVisible()
  const done = card.getByRole('button', { name: 'Done', exact: true })
  await expect(done).toBeDisabled()

  // Counters: + twice, − once, then the tick fills the target
  await card.getByRole('button', { name: 'Push-ups plus 1' }).click()
  await card.getByRole('button', { name: 'Push-ups plus 1' }).click()
  await card.getByRole('button', { name: 'Push-ups minus 1' }).click()
  await expect(card.getByText('1 / 10 reps')).toBeVisible()
  await card.getByRole('button', { name: 'Push-ups: fill in the target' }).click()
  await expect(card.getByText('10 / 10 reps')).toBeVisible()
  await expect(done).toBeDisabled() // sit-ups still missing

  // Edit sit-ups: the new target applies from today, including this open session
  await card.getByRole('button', { name: 'Edit Sit-ups' }).click()
  await page.getByLabel('Target', { exact: true }).fill('4')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(card.getByText('0 / 4 reps')).toBeVisible()
  await card.getByRole('button', { name: 'Sit-ups: fill in the target' }).click()
  await expect(done).toBeDisabled() // water still missing
  await card.getByRole('button', { name: 'Water: fill in the target' }).click()

  // Done → saved, countdown ring to the next session
  await expect(done).toBeEnabled()
  await done.click()
  await expect(card.getByRole('img', { name: /Next session in 9\d minutes/ })).toBeVisible()
  await expect(card.getByText(/Next session 2\/8 at \d\d:\d\d/)).toBeVisible()
  await expect(card.getByText(/1\/8/)).toBeVisible()
  await expect.poll(() => sessionStatus(page, uid, 1)).toEqual({ status: 'done', done: { pushups: 10, situps: 4, water: 1 } })

  // Tap a block to correct a session: done → skipped → done again
  await card.getByRole('button', { name: 'Session 1: done. Edit' }).click()
  await page.getByRole('button', { name: 'Mark skipped' }).click()
  await expect.poll(async () => (await sessionStatus(page, uid, 1)).status).toBe('skipped')
  await card.getByRole('button', { name: 'Session 1: skipped. Edit' }).click()
  await page.getByRole('button', { name: 'Mark done' }).click()
  await expect.poll(() => sessionStatus(page, uid, 1)).toEqual({ status: 'done', done: { pushups: 10, situps: 4, water: 1 } })

  // "Do it now" can be undone: the countdown comes back
  await card.getByRole('button', { name: 'Do it now' }).click()
  await expect(card.getByText('Session 2/8')).toBeVisible()
  await card.getByRole('button', { name: 'Undo "Do it now"' }).click()
  await expect(card.getByText(/Next session 2\/8 at/)).toBeVisible()
  await expect.poll(() => sessionStatus(page, uid, 2)).toBeNull()

  // The Fitness page: today in the month grid, totals
  await page.goto('/more/fitness')
  await expect(page.getByText('Challenge day')).toBeVisible()
  await expect(page.getByLabel(/: today, 1 of 8$/)).toBeVisible()

  // Stats: the fitness section with sessions and the per-exercise breakdown
  await page.goto('/stats')
  await expect(page.getByRole('heading', { name: 'Fitness challenge' })).toBeVisible()
  await expect(page.getByText('Sessions done')).toBeVisible()
  await expect(page.getByText('1 of 8 · 0 complete days')).toBeVisible()
  await expect(page.getByText('Per exercise')).toBeVisible()

  // If the notification's Done can't write by itself it opens /?fitnessDone=date:n
  await putSession(page, uid, 2, { pushups: ['Push-ups', 10, 0, 'reps'] })
  await page.goto(`/?fitnessDone=${today}:2`)
  await expect(page.getByText('Session 2 done')).toBeVisible()
  await expect.poll(() => sessionStatus(page, uid, 2)).toEqual({ status: 'done', done: { pushups: 10 } })
  await expect(page).toHaveURL(/\/$/)

  // Notifications: the two fitness switches exist
  await page.goto('/more/notifications')
  await expect(page.getByRole('switch', { name: 'Fitness sessions' })).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Fitness day summary' })).toBeVisible()
})

test.describe('notification Done button (built app, service worker)', () => {
  test.use({ baseURL: 'http://127.0.0.1:4173' })

  test('Done on the notification marks the session done without the app', async ({ page }) => {
    const uid = await signIn(page)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await putSession(page, uid, 3, { pushups: ['Push-ups', 10, 0, 'reps'], situps: ['Sit-ups', 4, 1, 'reps'] })

    // Exactly what a tap on "Done" runs (a test browser can't tap a real notification)
    await page.evaluate((date) => navigator.serviceWorker.ready.then((r) => r.active.postMessage({ type: 'test-notification-done', data: { kind: 'fitness', date, n: '3' } })), today)
    await expect.poll(() => sessionStatus(page, uid, 3), { timeout: 15000 }).toEqual({ status: 'done', done: { pushups: 10, situps: 4 } })
  })
})
