// The desktop's keys and panes (D20 section 4.3), and documents with comments in place (section 2.5).
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from './seed'

test.beforeEach(({ page }) => {
  test.skip(!isDesk(page), 'desktop only')
})

test('J opens the next item, the dot opens its menu, Esc steps back, ? shows the keys', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await page.keyboard.press('j')
  await expect(page.locator('#detailBody h1')).toBeVisible()
  await page.keyboard.press('.')
  await expect(page.locator('#overlay')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('#overlay')).toBeHidden()
  await page.keyboard.press('?')
  await expect(page.locator('#dlgTitle')).toHaveText('Keyboard shortcuts')
})

test('E archives the open item and Z puts it back', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await page.locator('#list [data-act="open"]').filter({ hasText: 'Write the user docs' }).click()
  await page.keyboard.press('e')
  await expect.poll(async () => p.read('items?archived=1')).toContain('Write the user docs')
  await page.keyboard.press('z')
  await expect.poll(async () => p.read('items?archived=1')).not.toContain('Write the user docs')
})

test('a comment on a paragraph of a document is written in the one box, which stays at the bottom (B340)', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 doc The plan
  First part of the plan.

  Second part of the plan.
`,
  })
  await open(page, p, 'D1')
  const para = page.locator('#docBlocks section[data-key]').filter({ hasText: 'Second part' })
  await para.hover()
  await para.locator('[data-pick-btn]').click()
  await expect(page.locator('#docBlocks #composer')).toHaveCount(0) // the text never moves: the box stays where it is
  await expect(page.locator('#foot #composer')).toBeVisible()
  await page.keyboard.type('Say who reviews it')
  await page.keyboard.press('Shift+Enter')
  await expect.poll(async () => p.read('D1')).toContain('Say who reviews it')
  await expect(page.locator('aside[aria-label="Comments"]')).toContainText('Say who reviews it') // beside the text
})
