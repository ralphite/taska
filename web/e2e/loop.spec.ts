// The loop between you and your agents, as the page shows it (D20 sections 3 and 4).
// guards: src/features/list/ src/features/item/ src/features/composer/ src/ui/Markdown.tsx src/app/actions.ts src/app/items/ src/app/inputs/ src/model/items.ts server/
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from './seed'
import { box, needAct, needActs, needKind, pane, priChip, row, sheetBody, views } from './ui'

test('what needs you comes first, each with its one action', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  const names = (await views(page).allInnerTexts()).map((t) => t.replace(/\d+/g, '').trim()).filter((t) => t !== 'Archive')
  expect(names).toEqual(['Needs you', 'Active', 'All', 'Queue', 'Later', 'Finished']) // F486: Needs you first (Archive, a tab, sits after All)
  const needs = needActs(page)
  await expect(needs).toHaveCount(3)
  const kinds = (await needKind(needs)).sort()
  expect(kinds).toEqual(['accept', 'answer', 'approve'])
})

test('Accept on a row finishes the work at once', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await needAct(page, 'accept').click()
  await expect.poll(async () => (await p.read('B2')).split('\n')[0]).toMatch(/ done /)
})

test('a question is answered by picking a choice and sending it', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await needAct(page, 'answer').click()
  const where = isDesk(page) ? pane(page) : sheetBody(page)
  await where.getByRole('button', { name: 'JSON', exact: true }).click()
  await where.getByRole('button', { name: /^Send answer/ }).filter({ visible: true }).first().click()
  await expect.poll(async () => p.read('T1')).toContain('✓ JSON')
})

test('r113: a new input goes to the inbox, and a reply goes to its item', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await box(page).click()
  await page.keyboard.type('Also export to Excel')
  await page.keyboard.press('Shift+Enter')
  await expect.poll(async () => p.read('inbox')).toContain('Also export to Excel')
  await row(page, 'Write the user docs').click()
  await box(page).click()
  await page.keyboard.type('Start with the install page')
  await page.keyboard.press('Shift+Enter')
  await expect.poll(async () => p.read('T4')).toContain('Start with the install page')
})

test('the item page shows its state, and its priority button changes the priority', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await row(page, 'Write the user docs').click()
  await expect(pane(page).locator('h1')).toHaveText('Write the user docs')
  await priChip(page).click() // B358: the button opens its own short list
  await page.locator('[data-f="pri"][data-v="P0"]').filter({ visible: true }).click()
  await expect.poll(async () => (await p.read('T4')).split('\n')[0]).toContain(' P0 ')
})
