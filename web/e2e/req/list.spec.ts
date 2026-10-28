// Yadong's requirements on the list (D29, "Lists and items"; T475, D45): each check is named by the codes of his
// inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/features/list/ src/model/actions.ts src/model/items.ts src/app/page/navigation.ts src/app/actions.ts src/app/keys.ts
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from '../seed'
import { row, rowActs, view, views } from '../ui'

test('r494 r308: the buttons every row has show only under the pointer', async ({ page, request }) => {
  test.skip(!isDesk(page), 'the phone has no pointer: its rows swipe')
  const p = await project(request, LOOP)
  await open(page, p, '?status=every')
  const it = row(page, 'Write the user docs').first()
  const n = await it.getAttribute('data-n')
  const btns = rowActs(page, n)
  await page.mouse.move(2, 2)
  await expect(btns).toHaveCount(0)
  await it.hover()
  await expect(btns.first()).toBeVisible()
  await page.mouse.move(2, 2)
  await expect(btns).toHaveCount(0)
})

test('r83 r133: a row opens wherever it is clicked, not only on its title', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p, '?status=every')
  const r = await row(page, 'Write the user docs').first().boundingBox()
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
  const names = (await views(page).allInnerTexts()).map((t) => t.replace(/\d+/g, '').trim())
  expect(names).toEqual(['Needs you', 'Active', 'All', 'Archive', 'Queue', 'Later', 'Finished'])
  await expect(view(page, 'Active')).toHaveAttribute('aria-pressed', 'true')
})

test('r445 r451 R337: archiving an item takes its finished subitems with it; one still open stays out', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'E is the desktop key; the phone archives from the menu')
  const p = await project(request, {
    agent: 'new task P1 now Plan the launch\nnew task P2 now parent=T1 Book the venue\nnew task P2 now parent=T1 Print the posters\n',
    approve: ['T1', 'T2', 'T3'],
  })
  await p.op({ op: 'set', ref: 'T2', f: { status: 'done' } })
  await open(page, p, 'T1')
  await page.keyboard.press('e')
  await expect.poll(() => p.read('items?status=all&archived=1')).toContain('Plan the launch')
  expect(await p.read('items?status=all&archived=1')).toContain('Book the venue')
  expect(await p.read('items?status=all&archived=1')).not.toContain('Print the posters')
})
