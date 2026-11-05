// More of what you do every day, on the phone and the desktop (D20 sections 4 to 6).
// guards: src/features/ src/pages/ src/app/page/navigation.ts src/app/keys.ts src/app/actions.ts src/app/items/ src/app/inputs/ src/model/route.ts server/
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from './seed'
import { box, docEdit, itemMenu, menuChoice, pane, row, sheetBody, view } from './ui'


test('the phone: an item is a page of its own, and Back returns to the list', async ({ page, request }) => {
  test.skip(isDesk(page), 'phone only')
  const p = await project(request, LOOP)
  await open(page, p)
  await row(page, 'Write the user docs').click()
  await expect(page).toHaveURL(/\/T4$/)
  await expect(pane(page).locator('h1')).toHaveText('Write the user docs')
  await page.goBack()
  await expect(page.locator('#list')).toBeVisible()
  await expect(pane(page)).toHaveCount(0)
})

test("a link with words narrows the list to them (the search's link to an input not filed yet)", async ({ page, request }) => {
  test.skip(!isDesk(page), 'the phone has its own search page (F479): search.spec.ts')
  const p = await project(request, LOOP)
  await open(page, p, '?q=docs')
  await expect(page.locator('#list article[data-n]')).toHaveCount(1)
  await open(page, p, '?q=zzzz-nothing')
  await expect(page.locator('#list')).toContainText('No matches for “zzzz-nothing”')
})

test('a subitem is added under its item', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p, 'T4')
  if (isDesk(page)) await page.keyboard.press('Shift+A')
  else {
    await itemMenu(page).click()
    await menuChoice(page, /^Add subitem/).click()
  }
  await page.getByRole('textbox', { name: 'Subitem title', exact: true }).first().fill('Install page')
  await page.keyboard.press('Enter')
  await expect.poll(async () => p.read('items')).toMatch(/Install page.*\^T4/)
})

test('B666: an input can be deleted from its ⋯ (Delete asks again in place) and restored', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await box(page).click()
  await page.keyboard.type('A thought to throw away')
  await page.keyboard.press('Shift+Enter')
  await expect.poll(async () => p.read('inbox')).toContain('A thought to throw away')
  await open(page, p, 'inputs')
  if (isDesk(page)) await page.getByText('A thought to throw away').filter({ visible: true }).first().hover() // T359: its ⋯ shows where you point
  await page.getByRole('button', { name: /^More for / }).filter({ visible: true })
    .first()
    .click()
  // no Undo after sending (B666)
  await expect(page.getByRole('button', { name: 'Undo', exact: true }).filter({ visible: true })).toHaveCount(0)
  await sheetBody(page).getByRole('button', { name: /^Delete/ }).first().click()
  // asked once: it says Delete? and nothing is deleted yet
  await expect(sheetBody(page).getByRole('button', { name: 'Delete?' })).toBeVisible()
  expect(await p.read('inbox')).toContain('A thought to throw away')
  await sheetBody(page).getByRole('button', { name: 'Delete?' }).click()
  await expect.poll(async () => p.read('inbox')).not.toContain('A thought to throw away')
  await open(page, p, 'deleted')
  await page.getByRole('button', { name: /^Restore/ }).filter({ visible: true }).first().click()
  await expect.poll(async () => p.read('inbox')).toContain('A thought to throw away')
})

test('the desktop: picked rows change together', async ({ page, request }) => {
  test.skip(!isDesk(page), 'desktop only')
  const p = await project(request, LOOP)
  await open(page, p)
  const pick = (t: string) => row(page, t).first()
  await view(page, 'All').click() // the tree's Active view leaves later work out (F291)
  await pick('Write the user docs').click({ modifiers: ['Meta'] })
  await pick('Clean up old branches').click({ modifiers: ['Meta'] })
  await expect(page.locator('#list')).toContainText('2 selected')
  await page.locator('#list').getByRole('button', { name: 'Done', exact: true }).first().click()
  await expect.poll(async () => (await p.read('T4')).split('\n')[0]).toContain(' done ')
  await expect.poll(async () => (await p.read('T5')).split('\n')[0]).toContain(' done ')
})

test('the desktop: Cmd-K searches as you type and opens what it found in its pane', async ({ page, request }) => {
  test.skip(!isDesk(page), 'desktop only')
  const p = await project(request, LOOP)
  await open(page, p)
  await page.keyboard.press('ControlOrMeta+k')
  await expect(page.getByRole('textbox', { name: 'What to find' })).toBeFocused()
  await page.keyboard.type('branches')
  const found = page.locator('[data-part="search"] [data-found]').filter({ hasText: 'Clean up old branches' }).first()
  await expect(found).toBeVisible()
  await found.click()
  await expect(page.locator('[data-part="search"]')).toHaveCount(0)
  await expect(pane(page).locator('h1')).toHaveText('Clean up old branches')
  // Cmd-K again: the same words, selected, and what they found
  await page.keyboard.press('ControlOrMeta+k')
  const field = page.getByRole('textbox', { name: 'What to find' })
  await expect(field).toHaveValue('branches')
  expect(await field.evaluate((e: HTMLInputElement) => [e.selectionStart, e.selectionEnd])).toEqual([0, 8])
  await expect(page.locator('[data-part="search"] [data-found]').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-part="search"]')).toHaveCount(0)
})

test('the desktop: G then N shows the inputs, Settings opens on G S and Esc goes back', async ({ page, request }) => {
  test.skip(!isDesk(page), 'desktop only')
  const p = await project(request, LOOP)
  await open(page, p)
  await page.keyboard.press('g')
  await page.keyboard.press('n')
  await expect(page).toHaveURL(/\/new$/) // F347: what you said is under New input
  await expect(page.locator('[data-compose]').first()).toBeAttached() // the New input page (its Inputs heading shows once there is something)
  await box(page).blur() // New input puts you in its box: keys there are words
  await page.keyboard.press('g')
  await page.keyboard.press('s')
  await expect(page.locator('[data-part="settings"]').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-part="settings"]').filter({ visible: true })).toHaveCount(0)
})

test('F347 T545: on the desktop the /inputs address opens New input, and Esc from there never opens an Inputs page', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'desktop only')
  const p = await project(request, LOOP)
  await open(page, p)
  await box(page).click()
  await page.keyboard.type('A thought')
  await page.keyboard.press('Shift+Enter')
  await expect.poll(async () => p.read('inbox')).toContain('A thought')
  await open(page, p, 'inputs')
  await expect(page).toHaveURL(/\/new$/)
  await expect(page.locator('[data-compose]').first()).toBeAttached()
  await page.keyboard.press('Escape') // out of the box
  await page.keyboard.press('Escape') // out of New input
  await expect(page.locator('#list')).toBeVisible()
  await expect(page).not.toHaveURL(/\/inputs$/)
  await expect(page.locator('[data-part="inputs"]')).toHaveCount(0) // the desktop has no Inputs page (T545)
})

test('a project is renamed in place, and its address stays', async ({ page, request }) => {
  const p = await project(request, LOOP)
  const renamed = `Renamed ${p.title}`
  await open(page, p, 'projects')
  if (isDesk(page)) {
    const itsRow = page.locator('li').filter({ has: page.getByText(p.title, { exact: true }) })
    await itsRow.getByRole('button', { name: 'Rename', exact: true }).click()
  } else {
    await page.getByRole('button', { name: `More for ${p.title}`, exact: true }).click()
    await page.getByRole('button', { name: 'Rename', exact: true }).filter({ visible: true }).click()
  }
  await page.getByRole('textbox', { name: `New name for ${p.title}`, exact: true }).filter({ visible: true }).first().fill(renamed)
  await page.keyboard.press('Enter')
  await expect.poll(async () => {
    const projects = await (await request.get('/api/projects')).json() as { name: string; title: string }[]
    return projects.find((project) => project.name === p.name)?.title
  }).toBe(renamed)
  await expect(page).toHaveURL(new RegExp(p.url + 'projects$'))
})

test('a document is edited where it is read', async ({ page, request }) => {
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 doc The plan
  First part of the plan.
`,
  })
  await open(page, p, 'D1')
  await docEdit(page)
  await page.getByPlaceholder(/^Title\n/).first().fill('The plan\n\nFirst part, rewritten.')
  await page.getByRole('button', { name: 'Save', exact: true }).filter({ visible: true }).first().click()
  await expect.poll(async () => p.read('D1')).toContain('First part, rewritten.')
})
