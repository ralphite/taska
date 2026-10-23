// Yadong's requirements on the list (D29, "Lists and items"; T475, D45): each check is named by the codes of his
// inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/components/List.tsx src/lib/rows.ts src/lib/views.ts src/lib/actions.ts src/lib/listhold.ts src/lib/nav.ts
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from '../seed'

test('r494 r308: the buttons every row has show only under the pointer', async ({ page, request }) => {
  test.skip(!isDesk(page), 'the phone has no pointer: its rows swipe')
  const p = await project(request, LOOP)
  await open(page, p, '?status=every')
  const row = page.locator('#list [data-act="open"][data-n]').filter({ hasText: 'Write the user docs' }).first()
  const n = await row.getAttribute('data-n')
  const btns = page
    .locator(`#list [data-act="swipe"][data-n="${n}"], #list [data-act="reopen"][data-n="${n}"]`)
    .filter({ visible: true })
  await page.mouse.move(2, 2)
  await expect(btns).toHaveCount(0)
  await row.hover()
  await expect(btns.first()).toBeVisible()
  await page.mouse.move(2, 2)
  await expect(btns).toHaveCount(0)
})

test('r83 r133: a row opens wherever it is clicked, not only on its title', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p, '?status=every')
  const row = page.locator('#list [data-act="open"][data-n]').filter({ hasText: 'Write the user docs' }).first()
  const r = await row.boundingBox()
  if (!r) throw new Error('no row')
  // its second line, away from the title
  await page.mouse.click(r.x + r.width * 0.35, r.y + r.height * 0.75)
  await expect(page).toHaveURL(/\/T0*4(\?|$)/)
})

test('r355 r397 r399 r663: the views read Needs you, Active, All, Archive, Queue, Later, Finished; a project opens on Active', async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP)
  await open(page, p)
  const chips = page.locator('#list [data-views] button[data-views], #list [data-views] button[data-tab="archive"]')
  const names = (await chips.allInnerTexts()).map((t) => t.replace(/\d+/g, '').trim())
  expect(names).toEqual(['Needs you', 'Active', 'All', 'Archive', 'Queue', 'Later', 'Finished'])
  await expect(page.locator('#list [data-views] button[data-v="all"]')).toHaveAttribute('aria-pressed', 'true')
})
