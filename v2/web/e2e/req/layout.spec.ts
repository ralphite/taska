// Yadong's requirements on the page's layout (D29; T475, D45): each check is named by the codes of his inputs, so a
// change that breaks one is stopped before it ships with his own words.
// guards: src/lib/events.ts src/lib/state.ts src/lib/nav.ts src/lib/docs.ts src/lib/dialog.ts src/components/Shell.tsx src/components/Detail.tsx
import { expect, test, type Page } from '@playwright/test'
import { LOOP, isDesk, open, project } from '../seed'

const DOC = {
  ...LOOP,
  then: `${LOOP.then}T4 doc The plan
  First part of the plan, long enough to fill a line of the page with words.

  Second part of the plan.
`,
}
const sidebar = (page: Page) => page.locator('#drawer')
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
  const text = page.locator('#detailBody').getByText('Second part of the plan.')
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
  await expect(page.locator('#overlay').getByText('Second part of the plan.')).toBeVisible()
  // wide again: the document where it was, the sidebar as it was
  for (const w of [800, 1100, 1440]) await width(page, w)
  await expect(page).toHaveURL(/\/D1$/)
  await expect(text).toBeVisible()
  await expect(page.locator('#overlay')).toBeHidden()
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
  await expect(page.locator('#detailBody h1')).toBeVisible()
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
  const app = page.locator('#app')
  await expect(app).toHaveAttribute('data-duo', '')
  // a short item, which alone would be one column
  await page.locator('#list [data-act="open"]').filter({ hasText: 'Pick the export format' }).click()
  await expect(page.locator('#detailBody h1')).toContainText('Pick the export format')
  await page.waitForTimeout(300)
  await expect(app).toHaveAttribute('data-duo', '')
  // only a pane too narrow for two columns makes it one
  await width(page, 1100)
  await expect(app).not.toHaveAttribute('data-duo', '')
})
