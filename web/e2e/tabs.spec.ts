/// <reference lib="dom" />
// Many tabs and slow networks (T293): Taska stays quick with many tabs open, and opens again from what the browser
// kept.
// guards: src/sync/ src/app/project/ src/api/ src/worker/ server/taska/http/page_routes.py server/taska/page_api/
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from './seed'

test('many tabs in the background do not hold up the one you look at', async ({ page, context, request }) => {
  test.skip(isDesk(page), 'once is enough')
  const p = await project(request, LOOP)
  // A browser keeps at most 6 connections to one server. Seven tabs behind, each waiting for news, used to take them all.
  const behind = []
  const asked: Promise<unknown>[] = []
  for (let i = 0; i < 7; i++) {
    const tab = await context.newPage()
    await tab.addInitScript(() => {
      Object.defineProperty(document, 'hidden', { get: () => true })
      Object.defineProperty(document, 'visibilityState', { get: () => 'hidden' })
    })
    asked.push(tab.waitForRequest((r) => r.url().includes(p.url + 'api/changes?')))
    await open(tab, p)
    behind.push(tab)
  }
  await Promise.all(asked) // every tab behind has asked for news
  await open(page, p)
  const ms = await page.evaluate(async (url) => {
    const t = performance.now()
    await fetch(url + 'api/view', { cache: 'no-store' })
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
  await page.reload() // opened once more, now through the service worker
  await expect(page.locator('#list')).toContainText('Write the user docs')
  // the copy is put away a moment after the page draws (opened only once the page made it: opening it first would
  // make it without its store)
  await expect
    .poll(() =>
      page.evaluate(async (slug) => {
        if (!(await indexedDB.databases()).some((d) => d.name === 'taska-view')) return false
        return await new Promise<boolean>((ok) => {
          const r = indexedDB.open('taska-view')
          r.onerror = () => ok(false)
          r.onsuccess = () => {
            const db = r.result
            if (!db.objectStoreNames.contains('copies')) return (db.close(), ok(false))
            const q = db.transaction('copies').objectStore('copies').get(slug)
            q.onsuccess = () => (db.close(), ok(q.result != null))
            q.onerror = () => (db.close(), ok(false))
          }
        })
      }, p.name),
    )
    .toBe(true)
  await context.setOffline(true)
  try {
    await page.reload()
    await expect(page.locator('#list')).toContainText('Write the user docs', { timeout: 10_000 })
  } finally {
    await context.setOffline(false)
  }
})
