// Yadong's requirements on the page's layout (D29; T475, D45): each check is named by the codes of his inputs, so a
// change that breaks one is stopped before it ships with his own words.
// guards: src/pages/ src/ui/PaneFrame.tsx src/ui/Sheet.tsx src/features/sidebar/ src/features/item/ItemPage.tsx src/features/docs/ src/stores/ui.ts src/app/page/navigation.ts src/app/panes.tsx src/index.css
import { expect, test, type Page } from '@playwright/test'
import { LOOP, isDesk, open, project } from '../seed'
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
  await page.waitForTimeout(150)
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
  // wide again: the document where it was, the sidebar as it was
  for (const w of [800, 1100, 1440]) await width(page, w)
  await expect(page).toHaveURL(/\/D1$/)
  await expect(text).toBeVisible()
  await expect(sheet(page)).toBeHidden()
  await expect(sidebar(page)).toBeVisible()
})

test('r683: the sidebar you folded stays folded at every width, and opens only when you open it (B496)', async ({
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
  await page.keyboard.press('[')
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
  await page.waitForTimeout(300)
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
      await page.waitForTimeout(400)
      want[w] = await shape(page)
    }
    // the same widths walked to, down across the phone's and up again: the same page at each
    await page.setViewportSize({ width: WALK[0], height: 900 })
    await open(page, p, path)
    await page.waitForTimeout(400)
    for (const w of WALK) {
      await width(page, w)
      await page.waitForTimeout(250)
      expect(await shape(page), `at ${w}px`).toEqual(want[w])
    }
  })
