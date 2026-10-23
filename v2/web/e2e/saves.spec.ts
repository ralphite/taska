// A change goes to the project it was made in, however long it waits (B527): what you add to an input while its
// screenshot is still going up lands there, though you went to another project meanwhile; and one Taska refused says
// what it carried and where it belongs, as a link there.
// guards: src/lib/data.ts src/lib/outbox.ts src/lib/docs.ts src/lib/voice.ts src/lib/toast.ts src/lib/actions.ts src/components/Sheets.tsx src/components/Inputs.tsx
import { expect, test, type Page } from '@playwright/test'
import { LOOP, isDesk, open, project } from './seed'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

/** Send an input, then begin adding to it from its row in what you said lately (desktop). */
async function addingTo(page: Page, words: string) {
  await page.locator('#text').fill(words)
  await page.keyboard.press('Shift+Enter')
  const row = page.getByText(words).first()
  await row.hover()
  await page.locator('[data-act="input-more"]').filter({ visible: true }).first().click()
  await page.locator('[data-act="input-pick"][data-pick="input-append"]').filter({ visible: true }).click()
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
  await page.locator('#fileInput').setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: PNG })
  await page.locator('#text').fill('and eggs')
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
  await page.route('**/api/op**', async (route) => {
    const o = route.request().postDataJSON() as { op?: string }
    if (o?.op !== 'dc') return route.continue()
    await route.fulfill({ json: { ok: false, res: ['err that paragraph is gone'] } })
  })
  await open(page, p, 'D1')
  const para = page.locator('#docBlocks section[data-key]').filter({ hasText: 'First part' })
  await para.hover()
  await para.locator('[data-pick-btn]').click()
  await page.keyboard.type('Who signs it off?')
  await page.keyboard.press('Shift+Enter')
  await page.locator(`a[href="${p.url}T4"], [data-act="goto"]`).filter({ visible: true }).first().click() // elsewhere now
  await page.locator('[data-act="failed-open"]').filter({ visible: true }).first().click()
  const link = page.locator('[data-act="failed-go"]')
  await expect(link).toHaveText(/your comment on D1/)
  await expect(page.locator('#dlgBody')).toContainText('“Who signs it off?”')
  await link.click()
  await expect(page.locator('#dlgBody')).toBeHidden()
  await expect(page).toHaveURL(new RegExp(p.url + 'D1'))
})
