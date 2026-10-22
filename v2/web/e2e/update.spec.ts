// A page left running old code after Taska got new code offers Reload while you use it, and reloads by itself once
// nobody has touched it for 5 minutes (F449, R284).
import { expect, test } from '@playwright/test'
import { LOOP, open, project } from './seed'

test('a page on old code reloads by itself after 5 minutes untouched, not while it is used (F449)', async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP)
  await page.clock.install()
  // Taska says it runs other code than this page, as after a deploy (once: the page remembers it)
  let first = true
  await page.route('**/api/poll*', async (route) => {
    if (!first) return route.continue()
    first = false
    const r = await route.fetch({ url: route.request().url().replace(/&wait=\d+|$/, '&wait=0') })
    await route.fulfill({ response: r, json: { ...((await r.json()) as object), ver: 'index-newer.js' } })
  })
  await open(page, p)
  await expect(page.getByText('Taska has an update')).toBeVisible()
  await page.evaluate(() => ((window as unknown as { mark: number }).mark = 1))
  const same = () => page.evaluate(() => (window as unknown as { mark?: number }).mark === 1)
  // used: 4 minutes, a key pressed (it is handled before the call returns), 4 more minutes: still the same page
  await page.clock.fastForward('04:00')
  await page.keyboard.press('Shift')
  await page.clock.fastForward('04:00')
  expect(await same()).toBe(true)
  // left alone past 5 minutes: it reloads
  const loaded = page.waitForEvent('load')
  await page.clock.fastForward('02:00')
  await loaded
  expect(await same()).toBe(false)
})

test('a reload that comes back on old code goes again at once, 3 times at most, then leaves Reload to you (F449)', async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP)
  await page.clock.install()
  // Taska keeps saying it has newer code than any page it gives: the new code never comes
  await page.route('**/api/poll*', async (route) => {
    const r = await route.fetch({ url: route.request().url().replace(/&wait=\d+|$/, '&wait=0') })
    await route.fulfill({ response: r, json: { ...((await r.json()) as object), ver: 'index-newer.js' } })
  })
  let loads = 0
  page.on('load', () => loads++)
  await open(page, p)
  await expect(page.getByText('Taska has an update')).toBeVisible()
  loads = 0
  await page.getByRole('button', { name: 'Reload' }).click()
  // each page that comes back old goes again a second later
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(400)
    await page.clock.fastForward('00:02')
  }
  await expect.poll(() => loads).toBe(3)
  await expect(page.getByText('Taska has an update')).toBeVisible()
  // then it stays: no reload by itself either, however long it is left alone
  await page.clock.fastForward('10:00')
  await page.waitForTimeout(500)
  expect(loads).toBe(3)
})
