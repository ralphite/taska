// The menus and sheets: the command palette, an item's menu, Put under… and Delete's second click (T529).
// guards: src/components/Sheets.tsx src/lib/dialog.ts
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from './seed'

test('T529: with an item open, the command palette keeps its rows whole and scrolls them', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'Cmd-K is the desktop')
  const p = await project(request, LOOP)
  await open(page, p, 'T4')
  await expect(page.locator('#detailBody h1')).toHaveText('Write the user docs')
  await page.keyboard.press('ControlOrMeta+k')
  const rows = page.locator('#cpList [data-act="cp-run"]')
  await expect(rows.first()).toBeVisible()
  // the item's own commands and the page's: more than the sheet has room for
  expect(await rows.count()).toBeGreaterThan(20)
  const heights = await rows.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
  expect(new Set(heights)).toEqual(new Set([40]))
  // the last one is a scroll away: Up from the first goes to it, and it shows
  await page.keyboard.press('ArrowUp')
  await expect(rows.last()).toHaveAttribute('aria-selected', 'true')
  await expect(rows.last()).toBeInViewport()
  await expect(rows.first()).not.toBeInViewport()
})

test('T529: Delete asked again soon after an Undo keeps asking for its own 3 seconds', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await page.clock.install()
  await open(page, p, 'T4')
  const del = page.locator('#dlgBody [data-act="item-delete"]')
  const ask = async () => {
    await page.locator('#itemMenuBtn').click()
    await del.click()
    await expect(del).toHaveText(/^Delete T0?4\?$/)
  }
  // asked, then deleted with the second click, then back with Undo
  await ask()
  await del.click()
  await expect.poll(async () => p.read('items')).not.toContain('Write the user docs')
  await page.locator('#toast [data-toast]').click()
  await expect.poll(async () => p.read('items')).toContain('Write the user docs')
  await page.clock.fastForward(1500)
  // asked again: 3.5 s after the first question, 2 s after this one, it still asks
  await page.locator('#list [data-act="open"]').filter({ hasText: 'Write the user docs' }).click()
  await ask()
  await page.clock.fastForward(2000)
  await page.waitForTimeout(300)
  expect(await del.textContent()).toMatch(/^Delete T0?4\?$/)
  // and after its own 3 s it lets go
  await page.clock.fastForward(1500)
  await expect(del).toHaveText('Delete')
})

test("T529: a rule's menu has no New doc, Add subitem or Put under…, on the phone as on the desktop", async ({
  page,
  request,
}) => {
  const p = await project(request, {
    agent: 'new task P2 now Write the user docs\nnew rule P2 now Keep commits small\n',
    approve: ['T1', 'R2'],
  })
  await open(page, p, 'R2')
  await page.locator('#itemMenuBtn').click()
  const menu = page.locator('#dlgBody')
  await expect(menu.locator('[data-act="edit"]')).toBeVisible()
  await expect(menu.locator('[data-act="item-delete"]')).toBeVisible()
  for (const act of ['doc-new', 'sub-new', 'reparent']) await expect(menu.locator(`[data-act="${act}"]`)).toHaveCount(0)
})

test('T529: Put under… says Nothing matches when the search finds no item', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p, 'T4')
  await page.locator('#itemMenuBtn').click()
  await page.locator('#dlgBody [data-act="reparent"]').click()
  const sheet = page.locator('#dlgBody')
  await sheet.locator('input').fill('zzzz')
  await expect(sheet.locator('[data-act="move-to"][data-to]:not([data-to="none"])')).toHaveCount(0)
  await expect(sheet.getByText('Nothing matches')).toBeVisible()
  await expect(sheet.locator('[data-act="move-to"][data-to="none"]')).toBeVisible()
})
