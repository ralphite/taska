// A page left running old code after Taska got new code offers Reload while you use it, and reloads by itself once
// nobody has touched it for a minute or its tab is put away (F449, R284, B654).
// guards: src/app/project/updates.ts src/app/project/ src/sync/ src/features/feedback/ src/worker/ server/taska/http/page_routes.py server/taska/http/static.py
import { expect, test, type Page, type Route } from '@playwright/test'
import { LOOP, open, project } from './seed'
import { NEWS, newer } from './ui'

/** The project's news as Taska gives it, with no wait (a long poll would outlast the faked clock), saying Taska runs
 * newer code than this page. A first view has no query: nothing to change in its address. */
const newerNews = async (route: Route) => {
  const r = await route.fetch({ url: route.request().url().replace(/([?&])wait=\d+/, '$1wait=0') })
  await route.fulfill({ response: r, json: newer((await r.json()) as Record<string, unknown>) })
}

/** Taska says once that it runs other code than this page, as after a deploy (the page remembers it). */
const newerOnce = (page: Page) => {
  let first = true
  return page.route(NEWS, (route) => {
    if (!first) return route.continue()
    first = false
    return newerNews(route)
  })
}

const marked = async (page: Page) => {
  await page.evaluate(() => ((window as unknown as { mark: number }).mark = 1))
  return () => page.evaluate(() => (window as unknown as { mark?: number }).mark === 1)
}

test('a page on old code reloads by itself after a minute untouched, not while it is used (F449, B654)', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await page.clock.install()
  await newerOnce(page)
  await open(page, p)
  await expect(page.getByText('Taska has an update')).toBeVisible()
  const same = await marked(page)
  // used: 45 s, a key pressed (it is handled before the call returns), 45 s more: still the same page
  await page.clock.fastForward('00:45')
  await page.keyboard.press('Shift')
  await page.clock.fastForward('00:45')
  expect(await same()).toBe(true)
  // left alone past a minute: it reloads (it looks every 15 s)
  const loaded = page.waitForEvent('load')
  await page.clock.fastForward('00:35')
  await loaded
  expect(await same()).toBe(false)
})

test('a page on old code reloads by itself when its tab is put away, even just used (B654)', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await page.clock.install()
  await newerOnce(page)
  await open(page, p)
  await expect(page.getByText('Taska has an update')).toBeVisible()
  const same = await marked(page)
  await page.keyboard.press('Shift')
  const loaded = page.waitForEvent('load')
  // the tab put away (another tab in front, the phone locked)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await loaded
  expect(await same()).toBe(false)
})

test('a reload that comes back on old code goes again at once, 3 times at most, then leaves Reload to you (F449)', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await page.clock.install()
  // Taska keeps saying it has newer code than any page it gives: the new code never comes
  await page.route(NEWS, async (route) => {
    try {
      await newerNews(route)
    } catch {
      // the page reloaded while this poll was on its way (what this check makes it do): that poll is gone with it
    }
  })
  await open(page, p)
  await expect(page.getByText('Taska has an update')).toBeVisible()
  await page.getByRole('button', { name: 'Reload' }).click()
  // the reloads the page made, as it counts them in this tab (a reload can go again before the browser says the
  // last one loaded, so the browser's own events miss some)
  const reloads = () => page.evaluate(() => (JSON.parse(sessionStorage.getItem('taska.reload') || '{}') as { n?: number }).n ?? 0).catch(() => -1)
  // each page that comes back old goes again a second later
  for (let i = 0; i < 20 && (await reloads()) < 3; i++) {
    await page.waitForTimeout(400)
    await page.clock.fastForward('00:02')
  }
  await expect.poll(reloads).toBe(3)
  await expect(page.getByText('Taska has an update')).toBeVisible()
  // then it stays: no reload by itself either, however long it is left alone
  const same = await marked(page)
  await page.clock.fastForward('10:00')
  await page.waitForTimeout(500)
  expect(await same()).toBe(true)
  expect(await reloads()).toBe(3)
})
