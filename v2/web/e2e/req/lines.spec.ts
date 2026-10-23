// Yadong's requirements on the lines you drag (D29, "Details"; R267; T475, D45): each check is named by the codes of his
// inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/components/Detail.tsx src/components/Shell.tsx src/lib/events.ts src/lib/dims.ts
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { LOOP, isDesk, open, project } from '../seed'

test.beforeEach(({ page }) => test.skip(!isDesk(page), 'the lines you drag are on the desktop'))

const lit = (g: Locator) =>
  g
    .locator('span')
    .first()
    .evaluate((el) => Number(getComputedStyle(el).opacity))
const mid = async (g: Locator) => {
  const b = await g.boundingBox()
  if (!b) throw new Error('not drawn')
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
/** Where a line is once the page has stopped moving it (a slow machine lays the page out late): the same twice. */
const settled = async (g: Locator) => {
  let last = ''
  await expect
    .poll(async () => {
      const m = JSON.stringify(await mid(g))
      const same = m === last
      last = m
      return same
    })
    .toBe(true)
  return JSON.parse(last) as { x: number; y: number }
}
const grips = (page: Page) => page.locator('[data-grip]').filter({ visible: true })

test('r448 r476: a line you can drag shows no handle until pointed at, and every one lights the same way', async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP)
  await open(page, p, 'T1')
  await page.mouse.move(2, 2)
  const all = await grips(page).all()
  expect(all.length).toBeGreaterThanOrEqual(2)
  const looks = new Set<string>()
  for (const g of all) {
    // at rest: nothing drawn on it but the thin line itself
    await expect.poll(() => lit(g)).toBe(0)
    const kids = await g.evaluate(
      (el) => [...el.querySelectorAll('*')].filter((k) => getComputedStyle(k).opacity !== '0').length,
    )
    expect(kids, `${await g.getAttribute('data-grip')}: no handle at rest`).toBe(0)
    // pointed at: the same blue line, as thick across, whichever way it runs
    const at = await settled(g)
    await page.mouse.move(at.x, at.y)
    await expect.poll(() => lit(g)).toBe(1)
    looks.add(
      await g
        .locator('span')
        .first()
        .evaluate((el) => {
          const s = getComputedStyle(el),
            r = el.getBoundingClientRect()
          return `${s.backgroundColor} ${Math.min(r.width, r.height)}`
        }),
    )
    await page.mouse.move(2, 2)
    await expect.poll(() => lit(g)).toBe(0)
  }
  expect([...looks]).toHaveLength(1)
})

test('r491: dragging one line lights only that one', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p, 'T1')
  const list = page.locator('[data-grip="list"]')
  const at = await settled(list)
  await page.mouse.move(at.x, at.y)
  await page.mouse.down()
  await page.mouse.move(at.x + 40, at.y, { steps: 4 })
  await expect.poll(() => lit(list)).toBe(1)
  for (const g of await grips(page).all())
    if ((await g.getAttribute('data-grip')) !== 'list')
      expect(await lit(g), (await g.getAttribute('data-grip')) || '').toBe(0)
  await page.mouse.up()
})

test('r448 r458 r464 r470: a line goes wherever it is dragged, and stays there from item to item', async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP)
  await open(page, p, 'T1')
  const top = page.locator('[data-grip="top"], [data-grip="duo"]').filter({ visible: true }).first()
  const across = (await top.getAttribute('data-grip')) === 'top'
  const at = await settled(top)
  const view = page.viewportSize() || { width: 1440, height: 900 }
  // far toward the edge: no limit stops it on the way
  const to = across ? { x: at.x, y: view.height - 60 } : { x: view.width - 80, y: at.y }
  await page.mouse.move(at.x, at.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
  const got = await settled(top)
  if (across) expect(Math.abs(got.y - to.y)).toBeLessThan(12)
  else expect(Math.abs(got.x - to.x)).toBeLessThan(12)
  // another item: the line has not moved
  await page.keyboard.press('j')
  await expect(page).not.toHaveURL(/\/T0*1(\?|$)/)
  const next = page.locator('[data-grip="top"], [data-grip="duo"]').filter({ visible: true }).first()
  await expect(page.locator('#detailBody').filter({ visible: true }).first()).toBeVisible()
  const there = await settled(next)
  if (across) expect(Math.abs(there.y - got.y)).toBeLessThan(2)
  else expect(Math.abs(there.x - got.x)).toBeLessThan(2)
})
