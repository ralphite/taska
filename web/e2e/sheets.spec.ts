// The menus and sheets: the search's Actions, an item's menu, Put under… and Delete's second click (T529).
// guards: src/features/find/ src/features/item/ItemMenu.tsx src/features/item/ItemSheetsContainer.tsx src/ui/Pickers.tsx src/ui/Sheet.tsx src/app/page/sheets.ts src/app/items/ src/features/agents/ src/model/guide.ts
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from './seed'
import { itemMenu, menuChoice, pane, row, sheetBody, undo } from './ui'

test("F479: with an item open, words that name an action show it under the search's Actions, and it acts on the item", async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'Cmd-K is the desktop')
  const p = await project(request, LOOP)
  await open(page, p, 'T4')
  await expect(pane(page).locator('h1')).toHaveText('Write the user docs')
  await page.keyboard.press('ControlOrMeta+k')
  await page.keyboard.type('done')
  const action = page.locator('[data-part="search"] [data-action="done"]')
  await expect(action).toContainText('T4')
  await action.click()
  await expect(page.locator('[data-part="search"]')).toHaveCount(0)
  await expect.poll(async () => (await p.read('T4')).split('\n')[0]).toContain(' done ')
})

test('T529: Delete asked again soon after an Undo keeps asking for its own 3 seconds', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await page.clock.install()
  await open(page, p, 'T4')
  const del = menuChoice(page, /^Delete/)
  const ask = async () => {
    await itemMenu(page).click()
    await del.click()
    await expect(del).toHaveText(/^Delete T0?4\?$/)
  }
  // asked, then deleted with the second click, then back with Undo
  await ask()
  await del.click()
  await expect.poll(async () => p.read('items')).not.toContain('Write the user docs')
  await undo(page).click()
  await expect.poll(async () => p.read('items')).toContain('Write the user docs')
  await page.clock.fastForward(1500)
  // asked again: 3.5 s after the first question, 2 s after this one, it still asks
  await row(page, 'Write the user docs').click()
  await ask()
  await page.clock.fastForward(2000)
  await page.waitForTimeout(300)
  expect(await del.textContent()).toMatch(/^Delete T0?4\?$/)
  // and after its own 3 s it lets go
  await page.clock.fastForward(1500)
  await expect(del).toHaveText('Delete')
})

test("D115: the desktop's item menu has Status…, Priority… and Type…, each opening its choices", async ({ page, request }) => {
  test.skip(!isDesk(page), "the phone's menu shows the three fields in the sheet")
  const p = await project(request, LOOP)
  await open(page, p, 'T4')
  await itemMenu(page).click()
  await menuChoice(page, /^Priority…/).click()
  await menuChoice(page, /^P0\b/).click()
  await expect.poll(async () => (await p.read('T4')).split('\n')[0]).toContain(' P0 ')
  await itemMenu(page).click()
  await menuChoice(page, /^Status…/).click()
  await menuChoice(page, /^Done\b/).click()
  await expect.poll(async () => (await p.read('T4')).split('\n')[0]).toMatch(/\bdone\b/i)
})

test('T529, R4-5 #8: Put under… says No matches for the words when the search finds no item', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p, 'T4')
  await itemMenu(page).click()
  await menuChoice(page, /^Put under/).click()
  const sheet = sheetBody(page)
  await sheet.locator('input').fill('zzzz')
  await expect(sheet.getByRole('button', { name: /^[A-Z]\d+\b/ })).toHaveCount(0)
  await expect(sheet.getByText('No matches for “zzzz”')).toBeVisible()
  await expect(sheet.getByRole('button', { name: /^No parent/ })).toBeVisible()
})

test('F628: the agent pill opens Agents, its guide laid out; Settings has no Agents', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await page.getByRole('button', { name: 'Agents', exact: true }).filter({ visible: true }).first().click()
  const sheet = sheetBody(page)
  await expect(sheet.locator('#dlgTitle')).toHaveText('Agents')
  // the way to connect, in sight beside Close, never folded away (F768 r1300, r1305, r1309: one Copy, no command)
  await expect(page.getByRole('button', { name: 'Connect new agent' }).filter({ visible: true })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Copy command' })).toHaveCount(0)
  await sheet.getByRole('button', { name: 'What agents read' }).click()
  await expect(sheet.getByRole('heading', { name: 'READ (plain text)' })).toBeVisible()
  await expect(sheet.locator('dt', { hasText: /^curl -s BASE\/next$/ })).toBeVisible()
  await expect(sheet.locator('pre', { hasText: "<<'EOF'" })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await open(page, p, 'settings')
  await expect(page.locator('[data-part="settings"] a[href$="/agents"]')).toHaveCount(0)
})
