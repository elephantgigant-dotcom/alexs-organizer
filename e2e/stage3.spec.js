// Check-in with sleep → stars; meditation (clock fast-forwarded) → stars, never twice;
// reward shop: add, redeem.

import { expect, test } from '@playwright/test'

async function signIn(page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in (test)' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Good (morning|afternoon|evening)/)
}

// The balance once it has settled (the server's value can arrive a moment after the cached one)
async function balance(page) {
  await page.getByRole('link', { name: 'Stars' }).last().click()
  const read = async () => Number(await page.getByLabel(/^\d+ stars$/).first().textContent())
  let last = await read()
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(400)
    const now = await read()
    if (now === last) return now
    last = now
  }
  return last
}

test('morning check-in with sleep pays once, edits pay nothing', async ({ page }) => {
  await signIn(page)
  const before = await balance(page)
  await page.goto('/checkin/morning')
  await page.getByRole('button', { name: 'Mood 7 of 10' }).click()
  await page.getByRole('button', { name: 'Energy 6 of 10' }).click()
  await page.getByLabel('Fell asleep').fill('23:10')
  await page.getByLabel('Woke up').fill('06:55')
  await expect(page.getByText('7 h 45 min')).toBeVisible() // across midnight
  await page.getByRole('button', { name: 'Sleep quality 8 of 10' }).click()
  await page.getByRole('button', { name: 'Add sleep stages' }).click()
  await page.getByRole('spinbutton', { name: /^Deep/ }).fill('18')
  await page.getByRole('spinbutton', { name: /^REM/ }).fill('22')
  await expect(page.getByRole('spinbutton', { name: /^Light/ })).toHaveValue('60') // auto-filled
  await page.getByLabel('Intention 1').fill('Finish the draft')
  const log = page.getByRole('textbox', { name: 'Morning log' })
  await expect(log).toHaveAttribute('placeholder', "How do I feel, what's on my mind…")
  const small = (await log.boundingBox()).height
  await log.fill('Slept well.\nA bit nervous about the review.\nWant a calm, focused morning.\nGym later.\nCall mum.')
  expect((await log.boundingBox()).height).toBeGreaterThan(small) // grows as I type
  await page.getByRole('button', { name: /Save · \+2 stars/ }).click()
  await expect(page.getByRole('status').filter({ hasText: '+2 stars' })).toBeVisible()
  expect(await balance(page)).toBe(before + 2)

  // Edit: no new stars
  await page.goto('/checkin/morning')
  await expect(page.getByText('editing')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Morning log' })).toHaveValue(/A bit nervous about the review/)
  await page.getByRole('button', { name: 'Mood 8 of 10' }).click()
  await page.getByRole('button', { name: 'Save changes' }).click()
  expect(await balance(page)).toBe(before + 2)

  // The Journal shows the log
  await page.goto('/journal')
  await expect(page.getByText('Morning log:')).toBeVisible()

  // Today shows last night's sleep score
  await page.getByRole('link', { name: 'Today' }).last().click()
  await expect(page.getByText("Last night's sleep score")).toBeVisible()
})

test('meditation: watched to the end → stars; ended while away → "Did you finish?"', async ({ page }) => {
  await page.clock.install()
  await signIn(page)
  const before = await balance(page)

  await page.goto('/meditate')
  for (let i = 0; i < 25; i++) {
    const shorter = page.getByRole('button', { name: 'Shorter' })
    if (await shorter.isDisabled()) break
    await shorter.click()
  }
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByRole('timer')).toBeVisible()
  await page.clock.runFor('05:02') // every redraw happens: the end is watched
  await expect(page.getByRole('heading', { name: 'Done' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to Today' }).click()
  expect(await balance(page)).toBe(before + 5)

  // Second session, then "leave": jump past the end without redraws
  await page.goto('/meditate')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByRole('timer')).toBeVisible()
  await page.goto('/')
  await page.clock.fastForward('31:00')
  await expect(page.getByRole('dialog', { name: 'Did you finish?' })).toBeVisible()
  await page.getByRole('button', { name: /Yes/ }).click()
  await expect(page.getByRole('dialog', { name: 'Did you finish?' })).toBeHidden()
  expect(await balance(page)).toBe(before + 10)
})

test('reward shop: add a reward and redeem it', async ({ page }) => {
  await signIn(page)
  const before = await balance(page)
  await expect(page.getByText('Play a video game I want')).toHaveCount(1) // default reward, exactly once
  await page.getByRole('button', { name: 'Add reward' }).click()
  await page.getByRole('textbox', { name: 'Reward' }).fill('Coffee out')
  await page.getByLabel('Price in stars').fill('2')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: 'Redeem Coffee out for 2 stars' }).click()
  await page.getByRole('button', { name: 'Redeem', exact: true }).click()
  await expect(page.getByLabel(`${before - 2} stars`)).toBeVisible()
  await expect(page.getByText('Coffee out').last()).toBeVisible() // in history
})
