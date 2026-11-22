// The menus and sheets: the search's Actions, a task's menu, Put under… and Delete's second click (T529).
// guards: src/features/find/ src/features/task/TaskMenu.tsx src/features/task/TaskSheetsContainer.tsx src/ui/Pickers.tsx src/ui/Sheet.tsx src/app/page/sheets.ts src/app/tasks/ src/features/agents/ src/model/guide.ts
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from './seed'
import { taskMenu, menuChoice, pane, row, sheetBody, undo } from './ui'

test("T479: with a task open, words that name an action show it under the search's Actions, and it acts on the task", async ({
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
    await taskMenu(page).click()
    await del.click()
    await expect(del).toHaveText(/^Delete T0?4\?$/)
  }
  // asked, then deleted with the second click, then back with Undo
  await ask()
  await del.click()
  await expect.poll(async () => p.read('tasks')).not.toContain('Write the user docs')
  await undo(page).click()
  await expect.poll(async () => p.read('tasks')).toContain('Write the user docs')
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

test("D115 T855: the desktop's task menu has Status…, Priority… and Tags…, each opening its choices; a new tag is typed in its field", async ({ page, request }) => {
  test.skip(!isDesk(page), "the phone's menu shows the three fields in the sheet")
  const p = await project(request, LOOP)
  const first = async () => (await p.read('T4')).split('\n')[0]
  await open(page, p, 'T4')
  await taskMenu(page).click()
  await menuChoice(page, /^Priority…/).click()
  await menuChoice(page, /^P0\b/).click()
  await expect.poll(first).toContain(' P0 ')
  await taskMenu(page).click()
  await menuChoice(page, /^Status…/).click()
  await menuChoice(page, /^Done\b/).click()
  await expect.poll(first).toMatch(/\bdone\b/i)
  // Tags…: the project's tags (T2's #bug) put on by a click, a new one typed in "#new tag" and put on with Enter
  await taskMenu(page).click()
  await menuChoice(page, /Tags…/).click()
  await menuChoice(page, /^#bug$/).click()
  await expect.poll(first).toMatch(/ #bug\b/)
  const field = sheetBody(page).getByPlaceholder('#new tag')
  await field.fill('#Docs')
  await field.press('Enter')
  await expect.poll(first).toMatch(/ #bug #docs\b/)
  await expect(field).toHaveValue('')
  await expect(menuChoice(page, /^#docs$/)).toHaveAttribute('aria-pressed', 'true')
  // clicked again it comes off
  await menuChoice(page, /^#bug$/).click()
  await expect.poll(first).not.toContain('#bug')
  await expect.poll(first).toContain('#docs')
})

test('T529, R4-5 #8: Put under… says No matches for the words when the search finds no task', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p, 'T4')
  await taskMenu(page).click()
  await menuChoice(page, /^Put under/).click()
  const sheet = sheetBody(page)
  await sheet.locator('input').fill('zzzz')
  await expect(sheet.getByRole('button', { name: /^[A-Z]\d+\b/ })).toHaveCount(0)
  await expect(sheet.getByText('No matches for “zzzz”')).toBeVisible()
  await expect(sheet.getByRole('button', { name: /^No parent/ })).toBeVisible()
})

test('T628: the agent pill opens Agents, its guide laid out; Settings has no Agents', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await page.getByRole('button', { name: 'Agents', exact: true }).filter({ visible: true }).first().click()
  const sheet = sheetBody(page)
  await expect(sheet.locator('#dlgTitle')).toHaveText('Agents')
  // the way to connect, in sight beside Close, never folded away (T768 r1300, r1305, r1309: one Copy, no command)
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
