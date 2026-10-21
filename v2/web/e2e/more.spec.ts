// More of what you do every day, on the phone and the desktop (D20 sections 4 to 6).
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, needsView, open, project } from './seed'

test('the phone: an item is a page of its own, and Back returns to the list', async ({ page, request }) => {
  test.skip(isDesk(page), 'phone only')
  const p = await project(request, LOOP)
  await open(page, p)
  await page.locator('#list [data-act="open"]').filter({ hasText: 'Write the user docs' }).click()
  await expect(page).toHaveURL(/\/T4$/)
  await expect(page.locator('#detailBody h1')).toHaveText('Write the user docs')
  await page.goBack()
  await expect(page.locator('#list')).toBeVisible()
  await expect(page.locator('#detailView')).toBeHidden()
})

test('the phone: Go through steps from card to card', async ({ page, request }) => {
  test.skip(isDesk(page), 'phone only')
  const p = await project(request, LOOP)
  await open(page, p)
  await needsView(page)
  await page.locator('[data-act="go-through"]').click()
  const title = page.locator('#dlgBody h2')
  const first = await title.textContent()
  await page.locator('#dlgFoot [data-act="go-next"]').click()
  await expect(title).not.toHaveText(first || '')
})

test('search narrows the list and says where else the words are', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  if (!isDesk(page)) await page.locator('#searchBtn').click()
  await page.locator('#q').fill('docs')
  await expect(page.locator('#list [data-act="open"]')).toHaveCount(1)
  await page.locator('#q').fill('zzzz-nothing')
  await expect(page.locator('#list')).toContainText('No matching items')
})

test('a subitem is added under its item', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p, 'T4')
  if (isDesk(page)) await page.keyboard.press('Shift+A')
  else {
    await page.locator('#itemMenuBtn').click()
    await page.locator('#dlgBody [data-act="sub-new"]').click()
  }
  await page.locator('#subTitle').fill('Install page')
  await page.keyboard.press('Enter')
  await expect.poll(async () => p.read('items')).toMatch(/Install page.*\^T4/)
})

test('an input can be deleted and restored', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await page.locator('#text').click()
  await page.keyboard.type('A thought to throw away')
  await page.keyboard.press('Shift+Enter')
  await expect.poll(async () => p.read('inbox')).toContain('A thought to throw away')
  await open(page, p, 'inputs')
  if (isDesk(page)) await page.locator('#foot li:has([data-act="input-more"])').first().hover() // T359: its ⋯ shows where you point
  await page
    .locator(
      isDesk(page) ? '#foot [data-act="input-more"]:visible' : '#inputsView [data-act="input-more"]:visible', // F347: under New input
    )
    .first()
    .click()
  await page.locator('#dlgBody [data-pick="input-delete"]').click()
  await expect.poll(async () => p.read('inbox')).not.toContain('A thought to throw away')
  await open(page, p, 'deleted')
  await page.locator('[data-act="input-restore"]').first().click()
  await expect.poll(async () => p.read('inbox')).toContain('A thought to throw away')
})

test('the desktop: picked rows change together', async ({ page, request }) => {
  test.skip(!isDesk(page), 'desktop only')
  const p = await project(request, LOOP)
  await open(page, p)
  const row = (t: string) => page.locator('#list [data-act="open"]').filter({ hasText: t })
  const all = page.locator('#list [data-views] [data-v="every"]')
  if (await all.count()) await all.click() // the tree's Active view leaves later work out (F291)
  await row('Write the user docs').click({ modifiers: ['Meta'] })
  await row('Clean up old branches').click({ modifiers: ['Meta'] })
  await expect(page.locator('#list')).toContainText('2 selected')
  await page.locator('[data-act="sel-do"]').filter({ hasText: 'Done' }).click()
  await expect.poll(async () => (await p.read('T4')).split('\n')[0]).toContain(' done ')
  await expect.poll(async () => (await p.read('T5')).split('\n')[0]).toContain(' done ')
})

test('the desktop: Cmd-K finds an item and opens it', async ({ page, request }) => {
  test.skip(!isDesk(page), 'desktop only')
  const p = await project(request, LOOP)
  await open(page, p)
  await page.keyboard.press('Meta+k')
  await page.keyboard.type('branches')
  await page.keyboard.press('ArrowDown')
  await page.locator('#cpList [data-n]').first().click()
  await expect(page.locator('#detailBody h1')).toHaveText('Clean up old branches')
})

test('the desktop: G then N shows the inputs, Settings opens on G S and Esc goes back', async ({ page, request }) => {
  test.skip(!isDesk(page), 'desktop only')
  const p = await project(request, LOOP)
  await open(page, p)
  await page.keyboard.press('g')
  await page.keyboard.press('n')
  await expect(page).toHaveURL(/\/new$/) // F347: what you said is under New input
  await expect(page.getByRole('heading', { name: 'You said' })).toBeVisible()
  await page.locator('#text').blur() // New input puts you in its box: keys there are words
  await page.keyboard.press('g')
  await page.keyboard.press('s')
  await expect(page.locator('#projectView')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('#projectView')).toBeHidden()
})

test('a project is renamed in place, and its address stays', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p, 'projects')
  if (isDesk(page)) await page.locator(`[data-act="p-rename"][data-slug="${p.name}"]`).click()
  else {
    await page.locator(`[data-act="p-more"][data-key="${p.name}"]`).click()
    await page.locator(`[data-act="p-rename"][data-slug="${p.name}"]`).click()
  }
  await page.locator('#pRename').fill('Renamed project')
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await request.get('/api/projects')).text()).toContain('Renamed project')
})

test('a document is edited where it is read', async ({ page, request }) => {
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 doc The plan
  First part of the plan.
`,
  })
  await open(page, p, 'D1')
  if (isDesk(page)) await page.keyboard.press('i')
  else await page.locator('#dlgBody [data-act="doc-edit"]').click()
  await page.locator('#docMd').fill('The plan\n\nFirst part, rewritten.')
  await page.locator('[data-act="doc-done"]').click()
  await expect.poll(async () => p.read('D1')).toContain('First part, rewritten.')
})
