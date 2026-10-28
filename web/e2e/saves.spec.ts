// A change goes to the project it was made in, however long it waits (B527): what you add to an input while its
// screenshot is still going up lands there, though you went to another project meanwhile; and one Taska refused says
// what it carried and where it belongs, as a link there.
// guards: src/app/inputs/ src/app/docs/ src/stores/outbox.ts src/app/page/toasts.ts src/model/saidOf.ts src/features/composer/ src/features/project/NotSaved.tsx src/pages/Header.tsx src/app/actions.ts
import { expect, test, type Page } from '@playwright/test'
import { LOOP, isDesk, open, project } from './seed'
import { blockPick, box, boxLine, docBlock, fileInput, refuseComments, sheetBody } from './ui'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

/** Send an input, then begin adding to it from its row in what you said lately (desktop). */
async function addingTo(page: Page, words: string) {
  await box(page).fill(words)
  await page.keyboard.press('Shift+Enter')
  const row = page.getByText(words).first()
  await row.hover()
  await page.getByRole('button', { name: /^More for / }).filter({ visible: true }).first().click()
  await sheetBody(page).getByRole('button', { name: /^Add more/ }).filter({ visible: true }).first().click()
}

test('what you add to an input goes to its own project, though you went to another while its screenshot went up (B527)', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'the desktop lists what you said lately beside the box')
  const p = await project(request, LOOP),
    other = await project(request, LOOP)
  await open(page, p)
  await addingTo(page, 'Buy milk for the office')
  // the screenshot takes a while to go up
  await page.route('**/api/file**', async (route) => {
    await new Promise((r) => setTimeout(r, 3000))
    await route.continue()
  })
  await fileInput(page).setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: PNG })
  await box(page).fill('and eggs')
  await page.keyboard.press('Shift+Enter')
  await page.locator(`a[href="${other.url}"]`).filter({ visible: true }).first().click()
  await expect(page).toHaveURL(new RegExp(other.url))
  await expect.poll(() => p.read('r1'), { timeout: 15000 }).toContain('and eggs')
  await page.waitForTimeout(500)
  await expect(page.getByText(/not saved/)).toHaveCount(0)
})

test('a change Taska refused says the words it carried and links to where it belongs (B527)', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'the desktop writes a comment beside its paragraph')
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 doc The plan
  First part of the plan.
`,
  })
  await refuseComments(page, 'err that paragraph is gone')
  await open(page, p, 'D1')
  const para = docBlock(page, 'First part')
  await para.hover()
  await para.locator(blockPick(page)).click()
  await page.keyboard.type('Who signs it off?')
  await page.keyboard.press('Shift+Enter')
  await page.locator(`a[href="${p.url}T4"]`).or(page.getByRole('button', { name: /^T0*4\b/ })).filter({ visible: true }).first().click() // elsewhere now
  await page.getByRole('button', { name: /not saved$/ }).filter({ visible: true }).first().click()
  const link = page.getByRole('link', { name: /your comment on D1/ }).first()
  await expect(link).toHaveText(/your comment on D1/)
  await expect(sheetBody(page)).toContainText('“Who signs it off?”')
  await link.click()
  await expect(page.locator('[role="dialog"]').filter({ visible: true })).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(p.url + 'D1'))
})

test('D83 #3 (T550): a comment Taska refused comes back to the box with its paragraph picked again, so Send comments there again', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'the desktop writes a comment beside its paragraph')
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 doc The plan
  First part of the plan.
`,
  })
  await refuseComments(page, 'err that paragraph is gone')
  await open(page, p, 'D1')
  const para = docBlock(page, 'First part')
  await para.hover()
  await para.locator(blockPick(page)).click()
  await page.keyboard.type('Who signs it off?')
  await page.keyboard.press('Shift+Enter')
  await expect(box(page)).toHaveValue(/Who signs it off\?/)
  await expect(boxLine(page)).toContainText('Comment on D1')
  await page.unrouteAll()
  await box(page).focus()
  await page.keyboard.press('Shift+Enter')
  await expect.poll(async () => p.read('D1')).toContain('Who signs it off?')
})

test('D83 #1 (T550): your comment says Sending… beside its paragraph until Taska has it', async ({ page, request }) => {
  test.skip(!isDesk(page), 'the desktop writes a comment beside its paragraph')
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 doc The plan
  First part of the plan.
`,
  })
  let release = () => {}
  const held = new Promise<void>((ok) => (release = ok))
  await page.route(/\/api\/commands\b/, async (route) => {
    const o = route.request().postDataJSON() as { commands: { op: string }[] }
    if (!o.commands.some((x) => x.op === 'dc')) return route.continue()
    await held
    await route.continue()
  })
  await open(page, p, 'D1')
  const para = docBlock(page, 'First part')
  await para.hover()
  await para.locator(blockPick(page)).click()
  await page.keyboard.type('Who signs it off?')
  await page.keyboard.press('Shift+Enter')
  const mine = page.locator('[data-dc]').filter({ hasText: 'Who signs it off?' }).filter({ visible: true }).first()
  await expect(mine).toContainText('Sending…')
  release()
  await expect.poll(async () => p.read('D1')).toContain('Who signs it off?')
  await expect(mine).not.toContainText('Sending…')
})
