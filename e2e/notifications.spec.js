// More → Notifications: layout at phone and desktop width (light + dark), and the
// "Send test notification" button end to end through the Cloud Function (emulator).

import { expect, test } from '@playwright/test'

const LABELS = ['Morning check-in', 'Evening check-in', 'Morning meditation', 'Evening meditation', 'Weekly review (Sundays)', 'Task due', 'Meditation finished', 'Sleep hours']

async function openNotifications(page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in (test)' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Good (morning|afternoon|evening)/)
  await page.goto('/more/notifications')
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()
}

const overlaps = (a, b) => a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1

for (const width of [360, 1280]) {
  for (const theme of ['light', 'dark']) {
    test(`layout: no squeezed labels or overlaps at ${width}px, ${theme}`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 1400 })
      await openNotifications(page)
      await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme)

      for (const label of LABELS) {
        const text = page.getByText(label, { exact: true }).first()
        const box = await text.boundingBox()
        // The label has real width and isn't wrapped letter by letter (at most 2 lines)
        expect(box.width, `${label} width`).toBeGreaterThan(Math.min(110, label.length * 6))
        expect(box.height, `${label} height`).toBeLessThan(48)
        // …and nothing sits on top of it
        const sw = await page.getByRole('switch', { name: label }).boundingBox()
        expect(overlaps(box, sw), `${label} vs its switch`).toBe(false)
        const time = page.getByLabel(`${label} time`)
        if (await time.count()) expect(overlaps(box, await time.boundingBox()), `${label} vs its time`).toBe(false)
      }
      for (const name of ['Sleep hours from', 'Sleep hours to']) {
        const b = await page.getByLabel(name).boundingBox()
        expect(b.x + b.width).toBeLessThanOrEqual(width - 16)
      }
      // No sideways scrolling
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await info.attach(`notifications-${width}-${theme}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
    })
  }
}

test('send test notification: device saved in the database → Cloud Function → answer on screen', async ({ page }) => {
  await openNotifications(page)
  await expect(page.getByRole('button', { name: 'Send test notification' })).toBeVisible()

  // A device as the app would save it (a real push token can't be made in a test browser)
  const uid = await page.evaluate(() => window.__organizerUid)
  const res = await page.request.patch(
    `http://127.0.0.1:8080/v1/projects/demo-alexs-organizer/databases/alexs-organizer/documents/users/${uid}/devices/test-device`,
    { headers: { Authorization: 'Bearer owner' }, data: { fields: { token: { stringValue: 'not-a-real-token' }, name: { stringValue: 'Test phone' } } } },
  )
  expect(res.ok()).toBe(true)
  await expect(page.getByText('Registered: Test phone')).toBeVisible()

  await page.getByRole('button', { name: 'Send test notification' }).click()
  // The function answered: with a fake token FCM refuses, and the exact error is shown
  await expect(page.getByRole('status').filter({ hasText: /Not delivered|Sent to/ })).toBeVisible({ timeout: 30000 })
  await expect(page.getByText(/Test phone: |expired token deleted|messaging\//)).toBeVisible()
})
