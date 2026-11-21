// Guards for the B802 changes (requirements lost in the 10-24 rewrite, found by T795): a picked choice and the box's words go as one answer
// (B145), the phone keeps the answered card in view, a web page's comment leaves its part when the words change (F432).
// guards: src/features/item/ src/features/composer/ src/app/inputs/ src/app/items/ src/features/docs/
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from '../seed'
import { box, boxMain, pane, pageCount } from '../ui'

const SHOTS = process.env.QA_SHOTS || '/private/tmp/claude-501/-Users-yadong--claude-spares-spare-eIHkOr/c91cd215-e414-46bd-8e2a-2b6592fb6b97/scratchpad/shots/'

for (const via of ['card', 'box'] as const) {
  test(`B145: picked choice and box words go as one answer, sent with the ${via}`, async ({ page, request }, info) => {
    const p = await project(request, LOOP)
    await open(page, p, 'T1')
    const where = pane(page)
    await where.getByRole('button', { name: /^JSON(?:\s+2)?$/ }).click()
    await box(page).fill('with a header row')
    await page.screenshot({ path: `${SHOTS}3-${via}-${info.project.name}-before.png` })
    if (via === 'card') await where.getByRole('button', { name: /^Send answer/ }).filter({ visible: true }).first().click()
    else await boxMain(page).click()
    await expect.poll(async () => p.read('T1')).toContain('✓ JSON')
    const t = await p.read('T1')
    console.log(`[${via}/${info.project.name}] T1:\n` + t)
    expect(t.match(/✓ JSON/g)).toHaveLength(1)
    // one input: the tick line and the words in the same message
    expect(t).toMatch(/✓ JSON[\s\S]{0,40}with a header row/)
    await expect(box(page)).toHaveValue('')
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${SHOTS}3-${via}-${info.project.name}-after.png` })
    const inbox = await p.read('inbox')
    console.log(`[${via}/${info.project.name}] inbox:\n` + inbox)
  })
}

test('B802: on the phone, Send answer keeps the answered card in view (no jump to the bottom)', async ({ page, request }) => {
  test.skip(isDesk(page), 'phone layout only')
  const notes = Array.from({ length: 12 }, (_, i) => `T1 progress Step ${i + 1}: ${'a long line of progress '.repeat(5)}`).join('\n')
  const p = await project(request, {
    agent: 'new P1 now Pick the export format\n',
    approve: ['T1'],
    then: `${notes}
T1 ask Which format should the export use?
  - ( ) CSV
  - ( ) JSON
T1 progress After: one short note.
`,
  })
  await open(page, p, 'T1')
  const card = pane(page).locator('section').filter({ hasText: 'asks you' }).filter({ visible: true }).first()
  await page.waitForTimeout(800)
  expect((await card.boundingBox())!.y).toBeGreaterThan(0) // the card starts in view
  await card.getByRole('button', { name: /^JSON(?:\s+2)?$/ }).click()
  const vh = page.viewportSize()!.height
  const top0 = (await card.boundingBox())!.y
  await page.screenshot({ path: `${SHOTS}6-before.png` })
  await card.getByRole('button', { name: /^Send answer/ }).click()
  for (const ms of [100, 600, 1500]) {
    await page.waitForTimeout(ms)
    const b = (await card.boundingBox())!
    console.log(`after ${ms}ms: card y=${Math.round(b.y)} h=${Math.round(b.height)} (before y=${Math.round(top0)}, vh=${vh})`)
    expect(b.y + b.height).toBeGreaterThan(0)
    expect(b.y).toBeLessThan(vh)
    expect(Math.abs(b.y - top0)).toBeLessThan(60)
  }
  await page.screenshot({ path: `${SHOTS}6-after.png` })
})

const PAGE = `${LOOP.then}T4 html Plan page
  <!doctype html><html><body style="margin:0;padding:24px"><h1>Export plan</h1><p id="a" style="padding:8px">Ship option A today.</p><p id="b" style="padding:8px">Keep option B for later.</p></body></html>
`
const NEWER = `D1 html Plan page
  <!doctype html><html><body style="margin:0;padding:24px"><h1>Export plan</h1><p id="a" style="padding:8px">Wait for the review of option A first.</p><p id="b" style="padding:8px">Keep option B for later.</p></body></html>
`
test('F432: a comment leaves its part when the part now says something else: under "Its words changed"', async ({ page, request }, info) => {
  const p = await project(request, { ...LOOP, then: PAGE })
  await p.op({ op: 'dc', d: 1, key: 'h:body>p:nth-child(2)', quote: 'Ship option A today.', text: 'Why today?' })
  await p.op({ op: 'dc', d: 1, key: 'h:body>p:nth-child(3)', quote: 'Keep option B for later.', text: 'Why later?' })
  await open(page, p, 'D1')
  await expect(page.frameLocator('iframe').first().getByText('Ship option A today.')).toBeVisible()
  await expect(pageCount(page, 'h:body>p:nth-child(2)')).toBeVisible()
  await expect(pageCount(page, 'h:body>p:nth-child(3)')).toBeVisible()
  await expect(page.getByText('Its words changed')).toHaveCount(0)
  await page.screenshot({ path: `${SHOTS}7-${info.project.name}-before.png`, fullPage: false })
  const out = await p.doAs(NEWER)
  console.log('agent:', out)
  await expect(page.frameLocator('iframe').first().getByText('Wait for the review of option A first.')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Its words changed').filter({ visible: true }).first()).toBeVisible()
  await expect(pageCount(page, 'h:body>p:nth-child(2)')).toHaveCount(0)
  await expect(pageCount(page, 'h:body>p:nth-child(3)')).toBeVisible() // the untouched part keeps its comment
  await expect(page.getByText('Why today?').filter({ visible: true }).first()).toBeVisible()
  await page.getByText('Its words changed').filter({ visible: true }).first().scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${SHOTS}7-${info.project.name}-after.png` })
})
