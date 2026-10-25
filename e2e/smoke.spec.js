// Sign in → add a task → finish it → stars → week view → dark theme.

import { expect, test } from '@playwright/test'

test('the main flow works', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in (test)' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Good (morning|afternoon|evening)/)
  await expect(page.getByLabel('0 stars')).toBeVisible()

  // Add a task worth 3 stars
  await page.getByRole('button', { name: 'New task' }).click()
  await page.getByLabel('Title').fill('Read 20 pages')
  await page.getByRole('button', { name: 'Health' }).click()
  await page.getByRole('button', { name: '3', exact: true }).click()
  await page.getByRole('button', { name: 'Daily' }).click()
  await page.getByRole('button', { name: 'Add task' }).click()
  await expect(page.getByText('Read 20 pages')).toBeVisible()

  // One tap done → +3 stars, next one created for tomorrow
  await page.getByRole('button', { name: 'Mark "Read 20 pages" as done' }).click()
  await expect(page.getByRole('status').filter({ hasText: '+3 stars' })).toBeVisible()
  await expect(page.getByLabel('3 stars')).toBeVisible()
  await expect(page.getByText('1 of 1 done')).toBeVisible()

  // Week view shows today's (done) and tomorrow's (new) copy; on a Sunday tomorrow is next week
  await page.getByRole('link', { name: 'Week' }).last().click()
  const sunday = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', weekday: 'long' }).format(new Date()) === 'Sunday'
  if (sunday) {
    await expect(page.getByText('Read 20 pages')).toHaveCount(1)
    await page.getByRole('button', { name: 'Next week' }).click()
    await expect(page.getByText('Read 20 pages')).toHaveCount(1)
  } else {
    await expect(page.getByText('Read 20 pages')).toHaveCount(2)
  }

  // Dark theme from Settings
  await page.getByRole('link', { name: 'More' }).last().click()
  await page.getByRole('radio', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})
