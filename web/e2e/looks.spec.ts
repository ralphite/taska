// D84 (T522): what a part looks like under the pointer, from the keyboard, pressed, picked or dragged: each look says
// one thing, and two different things never look the same.
// guards: src/features/list/ src/features/find/ src/features/settings/ src/features/sidebar/ src/features/home/ src/pages/Header.tsx src/app/keys.ts src/index.css
import { expect, test } from '@playwright/test'
import { isDesk, open, project } from './seed'
import { needAct, sheetBody } from './ui'

/** a row's own part that a click opens (the old version's [data-act="open"], the rewrite's row inside its article) */
const HIT = (n: number | string) => `#list [data-act="open"][data-n="${n}"], #list article[data-n="${n}"] .group.cursor-pointer`
/** the buttons a row shows under the pointer */
const ACTS = '[data-act="swipe"], [data-row-acts] button'

test.beforeEach(({ page }) => test.skip(!isDesk(page), 'a pointer and a keyboard: the desktop'))
const SEED = {
  agent: 'new task P2 now First\nnew task P2 now Second\nnew task P2 now Third\nnew idea P2 now An idea\n',
  approve: ['T1', 'T2', 'T3'],
}

test('D84 #2: a row dragged over another shows where it would go, drawn over that row', async ({ page, request }) => {
  const p = await project(request, SEED)
  await open(page, p)
  const mark = await page.evaluate(async (pattern) => {
    const hit = (n: number) => pattern.replaceAll('{n}', String(n))
    const row = (n: number) => document.querySelector<HTMLElement>(hit(n))!
    const at = (el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      return { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }
    }
    const from = row(3),
      to = row(1),
      dataTransfer = new DataTransfer()
    from.dispatchEvent(new PointerEvent('pointerdown', { ...at(from), pointerType: 'mouse', button: 0, buttons: 1 }))
    from.dispatchEvent(new DragEvent('dragstart', { ...at(from), dataTransfer }))
    await new Promise((ok) => setTimeout(ok, 50))
    to.dispatchEvent(new DragEvent('dragover', { ...at(to), dataTransfer }))
    await new Promise((ok) => setTimeout(ok, 100))
    const a = to.closest('article')!
    return { drop: a.dataset.drop, over: getComputedStyle(a, '::after').boxShadow }
  }, HIT('{n}'))
  expect(mark.drop).toBe('into')
  expect(mark.over).toMatch(/rgb|oklch/) // a ring drawn on the layer over the row, not under its own colour
})

test("D84 #3: in Go to or do, the keyboard's row and the pointer's row never look the same", async ({
  page,
  request,
}) => {
  const p = await project(request, SEED)
  await open(page, p)
  await page.keyboard.press('Meta+k')
  const rows = sheetBody(page).locator('[aria-selected]')
  await expect(rows.nth(1)).toBeVisible()
  await rows.nth(1).hover()
  expect(await sheetBody(page).locator('[aria-selected="true"]').first().evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe(
    await rows.nth(1).evaluate((e) => getComputedStyle(e).backgroundColor),
  )
})

test('D84 #1 #9: a picked row stays blue while pressed, and its buttons darken it rather than lay a grey square on it', async ({
  page,
  request,
}) => {
  const p = await project(request, SEED)
  await open(page, p)
  const row = page.locator(HIT(2)).first()
  await row.click({ modifiers: ['Meta'] })
  await expect(row).toHaveAttribute('data-sel', '')
  const picked = await row.evaluate((e) => getComputedStyle(e).backgroundColor)
  const pressed = await row.evaluate((e) => {
    e.setAttribute('data-pressed', '')
    return getComputedStyle(e).backgroundColor
  })
  const plain = await page.locator(HIT(3)).first().evaluate((e) => {
    e.setAttribute('data-pressed', '')
    return getComputedStyle(e).backgroundColor
  })
  expect(pressed).not.toBe(plain) // not the grey of an unpicked row pressed
  expect(pressed).not.toBe('rgba(0, 0, 0, 0)')
  expect(picked).not.toBe(plain)
  await row.hover()
  const btn = row.locator(ACTS).first()
  await btn.hover()
  expect(await btn.evaluate((e) => getComputedStyle(e).backgroundColor)).toMatch(
    /\/ 0\.0[0-9]+\)|, 0\.0[0-9]+\)|oklab|color-mix/,
  ) // see-through
})

test('D84 #4: Tab on Approve rings the round pill, not a square around it', async ({ page, request }) => {
  const p = await project(request, SEED)
  await open(page, p)
  const pill = needAct(page, 'approve').first()
  await pill.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  expect(await pill.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('none')
  expect(
    await pill
      .locator('span')
      .first()
      .evaluate((e) => getComputedStyle(e).outlineStyle),
  ).toBe('solid')
})

test("D84 #5: under the pointer a row's title fades out under its buttons, never cut through a word", async ({
  page,
  request,
}) => {
  const p = await project(request, SEED)
  await open(page, p)
  const row = page.locator(HIT(1)).first()
  await row.hover()
  const layer = row.locator(ACTS).first().locator('xpath=..')
  expect(await layer.evaluate((e) => getComputedStyle(e).maskImage || getComputedStyle(e).webkitMaskImage)).toContain(
    'gradient',
  )
})

test('D84 #7 #8: Settings tells the open section from the one under the pointer; Filters has one name', async ({
  page,
  request,
}) => {
  const p = await project(request, SEED)
  await open(page, p, 'agents')
  const cur = page.locator('[data-act="psec"][aria-current="page"], [data-part="settings"] a[aria-current="page"]').filter({ visible: true }).first()
  const other = page.locator('[data-act="psec"]:not([aria-current]), [data-part="settings"] a:not([aria-current])').filter({ visible: true }).first()
  await other.hover()
  expect(await cur.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe(
    await other.evaluate((e) => getComputedStyle(e).backgroundColor),
  )
  await open(page, p)
  await expect(page.locator('[data-act="filters"]').or(page.getByRole('button', { name: 'Filters', exact: true })).filter({ visible: true }).first()).toHaveAttribute(
    'title',
    /^Filters/,
  )
})
