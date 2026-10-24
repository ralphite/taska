/// <reference lib="dom" />
// Many tabs and slow networks (T293): Taska stays quick with many tabs open, and opens again from what the browser
// kept.
// guards: src/sync/ src/app/project/ src/api/ src/worker/ server/taska/http/page_routes.py server/taska/page_api/
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from './seed'

test('many tabs in the background do not hold up the one you look at', async ({ page, context, request }) => {
  test.skip(isDesk(page), 'once is enough')
  // 8 pages at once: over the machine's page budget for every agent together (5, by hand too); how to check it within
  // that waits for Yadong (F581)
  test.skip(true, 'opens 8 pages at once, over the machine budget of 5: waits for Yadong (F581)')
  const p = await project(request, LOOP)
  // A browser keeps at most 6 connections to one server. Seven tabs behind, each waiting for news, used to take them all.
  const behind = []
  for (let i = 0; i < 7; i++) {
    const tab = await context.newPage()
    await tab.addInitScript(() => {
      Object.defineProperty(document, 'hidden', { get: () => true })
      Object.defineProperty(document, 'visibilityState', { get: () => 'hidden' })
    })
    await open(tab, p)
    behind.push(tab)
  }
  await page.waitForTimeout(1500) // every tab behind has asked for news by now
  await open(page, p)
  const ms = await page.evaluate(async (url) => {
    const t = performance.now()
    // the project as the page reads it (the rewrite: api/view; the old version: api/state)
    const r = await fetch(url + 'api/view', { cache: 'no-store' })
    if (r.status === 404) await fetch(url + 'api/state', { cache: 'no-store' })
    return performance.now() - t
  }, p.url)
  expect(ms).toBeLessThan(3000)
  for (const tab of behind) await tab.close()
})

test('a project opens again from what the browser kept, even with no network', async ({ page, context, request }) => {
  test.skip(isDesk(page), 'once is enough')
  const p = await project(request, LOOP)
  await open(page, p)
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15_000 })
  await page.reload() // opened once more, now through the service worker (the old app keeps the page from then on)
  await expect(page.locator('#list')).toContainText('Write the user docs')
  await page.waitForTimeout(2500) // the copy is put away a moment after the page draws
  await context.setOffline(true)
  try {
    await page.reload()
    await expect(page.locator('#list')).toContainText('Write the user docs', { timeout: 10_000 })
  } finally {
    await context.setOffline(false)
  }
})
