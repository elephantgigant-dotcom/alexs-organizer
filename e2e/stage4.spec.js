// Statistics, weekly review and the export (JSON starts with the analysis brief).

import fs from 'node:fs'
import { expect, test } from '@playwright/test'

test('stats, weekly review and export', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in (test)' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Good (morning|afternoon|evening)/)

  await page.getByRole('link', { name: 'Stats' }).last().click()
  await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible()
  for (const card of ['Sleep score', 'Task completion', 'Mood', 'Energy', 'Meditation streak', 'Check-in streak']) {
    await expect(page.getByRole('region', { name: 'Last 7 days' }).getByText(card, { exact: true })).toBeVisible()
  }
  for (const chart of ['Sleep per night', 'Sleep stages', 'Bedtime and wake-up', 'Sleep vs next-day mood and energy', 'Mood and energy', 'Tasks done']) {
    await expect(page.getByRole('region', { name: chart, exact: true })).toBeVisible()
  }
  await page.getByRole('radio', { name: '3 months' }).click()
  await page.getByRole('region', { name: 'Tasks done', exact: true }).getByRole('button', { name: 'Show numbers' }).click()
  await expect(page.getByRole('region', { name: 'Tasks done', exact: true }).getByRole('table')).toBeVisible()

  await page.getByRole('link', { name: 'Weekly review' }).click()
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'What went well' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'What slipped' })).toBeVisible()

  await page.goto('/more/export')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download JSON' }).click()])
  const json = JSON.parse(fs.readFileSync(await download.path(), 'utf8'))
  expect(Object.keys(json)[0]).toBe('analysisBrief')
  expect(json.meta.scales.mood).toBe('1-10')
  expect(json.data.checkins.some((c) => c.fellAsleep === '23:10')).toBe(true) // from the check-in test
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Check-ins (with sleep)' }).click()])
  expect(fs.readFileSync(await csv.path(), 'utf8')).toContain('deviceScore')
})
