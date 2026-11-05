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

test("r355 r397 r399 r663 D110: the views read Needs you, Active, All, Archive, Open, Later, Done, Won't do; a project opens on Active", async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP)
  await open(page, p)
  const names = (await views(page).allInnerTexts()).map((t) => t.replace(/\d+/g, '').trim())
  // D110: Open, Done and Won't do in place of Queue and Finished
  expect(names).toEqual(['Needs you', 'Active', 'All', 'Archive', 'Open', 'Later', 'Done', "Won't do"])
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

test('D115 #21: Later offers Tomorrow, Next week, a day picked; the row then says which day', async ({ page, request }) => {
  const p = await project(request, { agent: 'new task P1 now Ship the export\n', approve: ['T1'] })
  await open(page, p, 'T1')
  await page.getByRole('button', { name: /^Now/ }).filter({ visible: true }).first().click()
  const sheet = page.locator('[role="dialog"]').filter({ visible: true }).last()
  await expect(sheet.getByRole('button', { name: /Tomorrow/ })).toBeVisible()
  await sheet.getByRole('button', { name: /Next week/ }).click()
  await expect.poll(async () => p.read('T1')).toMatch(/later until \d{4}-\d{2}-\d{2}/)
  await expect(page.getByRole('button', { name: /^Later · (Mon|[A-Z][a-z]{2} \d+)/ }).filter({ visible: true }).first()).toBeVisible()
  await open(page, p)
  await view(page, 'Later').click()
  await expect(row(page, 'Ship the export').first()).toContainText(/Later · (Mon|[A-Z][a-z]{2} \d+)/)
})

test('D115 #30: work in progress says on its row what its agent last said and how long ago', async ({ page, request }) => {
  const p = await project(request, { agent: 'new task P1 now Ship the export\n', approve: ['T1'], then: 'T1 doing\nT1 progress Testing with three filters\n' })
  await open(page, p)
  const r = row(page, 'Ship the export').first()
  await expect(r).toContainText('Testing with three filters')
  await expect(r).toContainText(/· (now|\d+ min)/)
})

test('D115 #20: an empty project shows its first steps, each ticked by itself once done', async ({ page, request }) => {
  const p = await project(request)
  await open(page, p)
  const steps = page.getByRole('list', { name: 'First steps' }).filter({ visible: true })
  const say = steps.getByRole('button', { name: 'Say your first input' })
  await expect(steps.getByRole('button', { name: 'Connect an agent' })).toBeEnabled()
  await expect(say).toBeEnabled()
  expect((await p.op({ op: 'input', text: 'A first thought' })).ok).toBe(true)
  await expect(say).toBeDisabled()
})
