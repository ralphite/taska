// Yadong's requirements on the page's layout (D29; T475, D45): each check is named by the codes of his inputs, so a
// change that breaks one is stopped before it ships with his own words.
// guards: src/pages/ src/ui/PaneFrame.tsx src/ui/Sheet.tsx src/features/sidebar/ src/features/item/ItemPage.tsx src/features/docs/ src/stores/ui.ts src/app/page/navigation.ts src/app/panes.tsx src/index.css
import { expect, test, type Page } from '@playwright/test'
import { LOOP, isDesk, open, project, settled } from '../seed'
import { FOOT, TALK, duo, pane, row } from '../ui'

const DOC = {
  ...LOOP,
  then: `${LOOP.then}T4 doc The plan
  First part of the plan, long enough to fill a line of the page with words.

  Second part of the plan.
`,
}
const sidebar = (page: Page) => page.locator('#drawer')
/** the phone's sheet over the page */
const SHEET = '[data-part="sheet"]'
const sheet = (page: Page) => page.locator(SHEET).first()
const width = async (page: Page, w: number) => {
  await page.setViewportSize({ width: w, height: 900 })
  await settled(page)
}

test('r683: the window made narrow and wide again closes nothing: the document stays open, the sidebar stays (B496)', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'it starts on the desktop and goes through the phone itself')
  const p = await project(request, DOC)
  await open(page, p, 'D1')
  const text = pane(page).getByText('Second part of the plan.')
  await expect(text).toBeVisible()
  await expect(sidebar(page)).toBeVisible()
  // narrower, still the desktop: the sidebar is not folded by the width
  for (const w of [1300, 1200, 1100, 1024]) {
    await width(page, w)
    await expect(sidebar(page)).toBeVisible()
    await expect(page.locator('#rail')).toBeHidden()
    await expect(text).toBeVisible()
  }
  // the phone: the same document, in its sheet
  await width(page, 393)
  await expect(sheet(page).getByText('Second part of the plan.')).toBeVisible()
  // Drag back through the breakpoint without settling at each width; delayed phone cleanup must not hide the sidebar.
  for (const w of [800, 1023, 1024, 1100, 1440]) await page.setViewportSize({ width: w, height: 900 })
  await page.waitForTimeout(500) // beyond the phone drawer's 240 ms closing timer: its delayed cleanup must not hide the sidebar
  await expect(page).toHaveURL(/\/D1$/)
  await expect(text).toBeVisible()
  await expect(sheet(page)).toBeHidden()
  await expect(sidebar(page)).toBeVisible()
})

test('r683: the desktop sidebar and phone drawer keep their own state across widths (B496)', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'the desktop sidebar')
  const p = await project(request, LOOP)
  await open(page, p, 'T1')
  await page.keyboard.press('[')
  await expect(page.locator('#rail')).toBeVisible()
  for (const w of [1100, 393, 1440, 1920]) await width(page, w)
  await expect(page.locator('#rail')).toBeVisible()
  await expect(pane(page).locator('h1')).toBeVisible()
  // Opening and closing the phone drawer does not unfold the desktop sidebar.
  await open(page, p)
  await width(page, 393)
  const projects = page.getByRole('button', { name: 'Projects and settings', exact: true })
  const shade = page.locator('[aria-label="Close projects"]').filter({ visible: true })
  await projects.click()
  await expect(sidebar(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(shade).toHaveCount(0)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForTimeout(500) // beyond the phone drawer's 240 ms closing timer
  await expect(sidebar(page)).toBeHidden()
  await expect(page.locator('#rail')).toBeVisible()
  await page.keyboard.press('[')
  await expect(sidebar(page)).toBeVisible()
  await expect(page.locator('#rail')).toBeHidden()
  // A phone drawer left open survives a trip to the desktop, without folding its sidebar.
  await width(page, 393)
  await projects.click()
  await expect(shade).toHaveCount(1)
  for (const w of [1023, 1024, 1440]) await page.setViewportSize({ width: w, height: 900 })
  await expect(sidebar(page)).toBeVisible()
  await expect(page.locator('#rail')).toBeHidden()
  await width(page, 393)
  await expect(sidebar(page)).toBeVisible()
  await expect(shade).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(shade).toHaveCount(0)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForTimeout(500) // beyond the phone drawer's 240 ms closing timer
  await expect(sidebar(page)).toBeVisible()
  await expect(page.locator('#rail')).toBeHidden()
})

test('r743: once an item is in two columns it stays so: another item that would fit in one does not take it back (B539)', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'the desktop pane')
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}${Array.from({ length: 40 }, (_, i) => `T4 say Progress note ${i + 1}, long enough to take a whole line of the talk here`).join('\n')}\n`,
  })
  await page.setViewportSize({ width: 1920, height: 900 })
  await open(page, p, 'T4')
  await expect(duo(page)).toHaveCount(1)
  // a short item, which alone would be one column
  await row(page, 'Pick the export format').click()
  await expect(pane(page).locator('h1')).toContainText('Pick the export format')
  await settled(page)
  await expect(duo(page)).toHaveCount(1)
  // only a pane too narrow for two columns makes it one; the same width again is two columns again (r749)
  await width(page, 1100)
  await expect(duo(page)).toHaveCount(0)
  await width(page, 1920)
  await expect(duo(page)).toHaveCount(1)
})

// r749: what the page is at one width: each part shown or not, and where (to 4px), whether two columns, what floats
// Each part is located by its current page marker.
const PARTS: [string, string][] = [
  ['drawer', '#drawer'],
  ['rail', '#rail'],
  ['projBar', 'nav[aria-label="This project"]'],
  ['mainHead', '[data-part="list-head"]'],
  ['tabs', '[data-part="tabs"]'],
  ['itemsView', '[data-part="items"]'],
  ['inputsView', '[data-part="inputs"]'],
  ['detailView', '[data-part="pane"]'],
  ['itemTop', '[data-item-top]'],
  ['itemTalk', TALK],
  ['docBlocks', '[data-doc-blocks]'],
  ['projectView', '[data-part="settings"]'],
  ['foot', FOOT],
  ['composer', '#composer'],
  ['overlay', SHEET],
]
const shape = (page: Page) =>
  page.evaluate((parts) => {
    const at = (n: number) => Math.round(n / 4) * 4
    const out: Record<string, string> = { duo: String(!!document.querySelector('[data-duo]')) }
    for (const [name, sel] of parts) {
      const e = document.querySelector<HTMLElement>(sel)
      const r = e?.getBoundingClientRect()
      out[name] =
        !e || !r || !e.offsetParent || r.width === 0 ? 'hidden' : `${at(r.x)},${at(r.y)} ${at(r.width)}x${at(r.height)}`
    }
    return out
  }, PARTS)
const WALK = [1440, 1300, 1100, 1024, 1023, 800, 393, 800, 1023, 1024, 1100, 1300, 1440]
for (const [name, path, fold] of [
  ['an item open', 'T4', false],
  ['a document open', 'D1', false],
  ['the sidebar folded, an item open', 'T4', true],
  ['the list alone', '', false],
] as const)
  test(`r749 #6525: at any width the page is the same however the width got there, only the width changing: ${name} (B496)`, async ({
    page,
    request,
  }) => {
    test.skip(!isDesk(page), 'it walks the widths itself, from the desktop')
    const p = await project(request, DOC)
    // each width straight away: what the page is there
    const want: Record<number, Record<string, string>> = {}
    for (const w of [...new Set(WALK)]) {
      await page.setViewportSize({ width: w, height: 900 })
      await open(page, p, path)
      await page.evaluate((f) => {
        try {
          localStorage.setItem('taska.sideHidden', f ? '1' : '')
        } catch {
          /* no storage */
        }
      }, fold)
      await open(page, p, path)
      await settled(page)
      want[w] = await shape(page)
    }
    // the same widths walked to, down across the phone's and up again: the same page at each
    await page.setViewportSize({ width: WALK[0], height: 900 })
    await open(page, p, path)
    await settled(page)
    for (const w of WALK) {
      await width(page, w)
      expect(await shape(page), `at ${w}px`).toEqual(want[w])
    }
  })

test('B669 r1065: the list\'s views row and the pane\'s bar are one height, their bottom borders one line (New input, Inputs, an item, a document)', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'the list beside the pane is the desktop\u2019s')
  const p = await project(request, DOC)
  for (const path of ['new', 'inputs', 'T1', 'D1']) {
    await open(page, p, path)
    const viewsRow = page.locator('#list [data-views]').filter({ visible: true }).first()
    const bar = page.locator('[data-part="pane-column"] header').filter({ visible: true }).first()
    await expect(viewsRow).toBeVisible()
    await expect(bar).toBeVisible()
    await settled(page)
    const v = await viewsRow.boundingBox()
    const b = await bar.boundingBox()
    if (!v || !b) throw new Error('not drawn')
    if (process.env.TASKA_SHOTS) await page.screenshot({ path: `${process.env.TASKA_SHOTS}-${path}.png`, clip: { x: 0, y: 0, width: page.viewportSize()?.width ?? 1440, height: 200 } })
    expect(Math.abs(v.height - b.height), `${path}: the same height`).toBeLessThan(0.5)
    expect(Math.abs(v.y + v.height - (b.y + b.height)), `${path}: the bottoms on one line`).toBeLessThan(0.5)
  }
})

test('F670 r1065: on the desktop Filters is first in the views row; ⌄ at its end opens it onto all its lines, ⌃ closes it, and it stays so after a reload', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'the phone\u2019s views row swipes, its edges fade')
  const p = await project(request, LOOP)
  await open(page, p)
  const viewsRow = page.locator('#list [data-views]').filter({ visible: true }).first()
  const chips = viewsRow.locator('[data-views-open]')
  const filters = viewsRow.getByRole('button', { name: 'Filters', exact: true })
  const first = await chips.locator('button').first().boundingBox()
  const f = await filters.boundingBox()
  if (!first || !f) throw new Error('not drawn')
  expect(f.x, 'Filters before the first view').toBeLessThan(first.x)
  // no arrow on the desktop list: ⌄ opens it onto all its lines
  await expect(viewsRow.getByRole('button', { name: 'More views' })).toHaveCount(0)
  await viewsRow.getByRole('button', { name: 'All views' }).click()
  await expect(chips).toHaveAttribute('data-views-open', 'true')
  const last = chips.locator('button').last()
  const lb = await last.boundingBox()
  const rb = await viewsRow.boundingBox()
  if (!lb || !rb) throw new Error('not drawn')
  expect(lb.y, 'the last view on a line of its own under the first').toBeGreaterThan(first.y + 10)
  expect(lb.x + lb.width, 'the last view inside the row').toBeLessThanOrEqual(rb.x + rb.width)
  // kept in this browser
  await page.reload()
  await expect(chips).toHaveAttribute('data-views-open', 'true')
  await viewsRow.getByRole('button', { name: 'One line of views' }).click()
  await expect(chips).toHaveAttribute('data-views-open', 'false')
  await expect((await viewsRow.boundingBox())?.height).toBeLessThan(57)
})

test('r1052: what the pane shows never moves the list: on the New input page the views sit right under the bar and the filters, as with an item open (B663)', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'the list beside the pane is the desktop’s')
  const p = await project(request, LOOP)
  /** from the bottom of the project's bar to the top of the list's views */
  const gap = async (path: string) => {
    await open(page, p, path)
    const viewsRow = page.locator('#list [data-views]').filter({ visible: true }).first()
    await expect(viewsRow).toBeVisible()
    await settled(page)
    const bar = await page.locator('nav[aria-label="This project"]').filter({ visible: true }).first().boundingBox()
    const views = await viewsRow.boundingBox()
    if (!bar || !views) throw new Error('not drawn')
    return views.y - (bar.y + bar.height)
  }
  for (const filters of ['', '?type=task']) {
    const withItem = await gap('T1' + filters)
    if (!filters) expect(Math.abs(withItem), 'nothing between the bar and the views').toBeLessThan(1)
    else expect(withItem, 'the filters between them').toBeGreaterThan(20)
    for (const path of ['', 'new']) {
      const here = await gap(path + filters)
      expect(Math.abs(here - withItem), `${path || 'the list'}${filters}: the views where an item open has them`).toBeLessThan(1)
    }
  }
})
