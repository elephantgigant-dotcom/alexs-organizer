// Notifications settings, and the installable / offline app (built version with the service worker).

import { expect, test } from '@playwright/test'

test('notification settings: one switch and time per reminder, sleep hours, saved', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in (test)' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Good (morning|afternoon|evening)/)
  await page.getByRole('link', { name: 'More' }).last().click()
  await page.getByRole('button', { name: /Notifications/ }).click()

  for (const label of ['Morning check-in', 'Evening check-in', 'Morning meditation', 'Evening meditation', 'Weekly review (Sundays)', 'Task due', 'Meditation finished', 'Sleep hours']) {
    await expect(page.getByRole('switch', { name: label })).toBeVisible()
  }
  await expect(page.getByLabel('Morning check-in time')).toHaveValue('07:30')
  await expect(page.getByLabel('Evening check-in time')).toHaveValue('21:30')
  await expect(page.getByLabel('Sleep hours from')).toHaveValue('23:00')
  await expect(page.getByLabel('Sleep hours to')).toHaveValue('07:00')

  await page.getByLabel('Morning check-in time').fill('06:45')
  await expect(page.getByLabel('Morning check-in time')).toHaveValue('06:45')
  await page.getByRole('switch', { name: 'Evening meditation' }).click()
  await expect(page.getByRole('switch', { name: 'Evening meditation' })).toHaveAttribute('aria-checked', 'false')
  await page.waitForTimeout(500) // let the save reach the database
  await page.reload()
  await expect(page.getByLabel('Morning check-in time')).toHaveValue('06:45')
  await expect(page.getByRole('switch', { name: 'Evening meditation' })).toHaveAttribute('aria-checked', 'false')
  // Not asked yet → an Allow button; blocked (some test browsers) → how to unblock it
  const permission = await page.evaluate(() => Notification.permission)
  if (permission === 'denied') await expect(page.getByText('Notifications are blocked for this app')).toBeVisible()
  else await expect(page.getByRole('button', { name: 'Allow notifications' })).toBeVisible()
})

test.describe('installable app (built, with service worker)', () => {
  test.use({ baseURL: 'http://127.0.0.1:4173' })

  test('manifest, icons, service worker, opens offline', async ({ page, context }) => {
    await page.goto('/')
    const manifest = await (await page.request.get('/manifest.webmanifest')).json()
    expect(manifest).toMatchObject({ name: "Alex's Organizer", display: 'standalone', start_url: '/', id: '/' })
    for (const icon of manifest.icons) expect((await page.request.get(icon.src)).ok()).toBe(true)
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true)

    // The service worker takes control
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
    await expect(page.getByRole('heading', { name: "Alex's Organizer" })).toBeVisible()

    // No internet: the app still opens from the saved copy
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { name: "Alex's Organizer" })).toBeVisible()
    await context.setOffline(false)
  })
})
