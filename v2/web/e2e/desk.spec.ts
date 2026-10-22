// The desktop's keys and panes (D20 section 4.3), and documents with comments in place (section 2.5).
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from './seed'

test.beforeEach(({ page }) => {
  test.skip(!isDesk(page), 'desktop only')
})

test('J opens the next item, the dot opens its menu, Esc steps back, ? shows the keys', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await page.keyboard.press('j')
  await expect(page.locator('#detailBody h1')).toBeVisible()
  await page.keyboard.press('.')
  await expect(page.locator('#overlay')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('#overlay')).toBeHidden()
  await page.keyboard.press('?')
  await expect(page.locator('#dlgTitle')).toHaveText('Keyboard shortcuts')
})

test('E archives the open item and Z puts it back', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await page.locator('#list [data-act="open"]').filter({ hasText: 'Write the user docs' }).click()
  await page.keyboard.press('e')
  await expect.poll(async () => p.read('items?archived=1')).toContain('Write the user docs')
  await page.keyboard.press('z')
  await expect.poll(async () => p.read('items?archived=1')).not.toContain('Write the user docs')
})

test('a comment on a paragraph of a document is written in the one box, which stays at the bottom (B340)', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 doc The plan
  First part of the plan.

  Second part of the plan.
`,
  })
  await open(page, p, 'D1')
  const para = page.locator('#docBlocks section[data-key]').filter({ hasText: 'Second part' })
  await para.hover()
  await para.locator('[data-pick-btn]').click()
  await expect(page.locator('#docBlocks #composer')).toHaveCount(0) // the text never moves: the box stays where it is
  await expect(page.locator('#foot #composer')).toBeVisible()
  await page.keyboard.type('Say who reviews it')
  await page.keyboard.press('Shift+Enter')
  await expect.poll(async () => p.read('D1')).toContain('Say who reviews it')
  // beside the text: in the comment column when the pane is wide, else behind the count beside its paragraph (B349)
  const rail = page.locator('aside[aria-label="Comments"]')
  // the first comment brings the column (or the count) with the answer: wait for one of them before choosing
  await expect(rail.or(para.locator('[data-act="doc-thread"]:visible')).first()).toBeVisible()
  if (await rail.count()) await expect(rail).toContainText('Say who reviews it')
  else {
    // a comment you just posted opens beside its paragraph; otherwise its count opens it
    if (!(await para.innerText()).includes('Say who reviews it'))
      await para.locator('[data-act="doc-thread"]:visible').click()
    await expect(para).toContainText('Say who reviews it')
  }
})

test('two places picked in one paragraph keep two threads; an answer goes to the one still waiting (B469)', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 doc The plan
  The plan

  - item one is about apples
  - item two is about pears
`,
  })
  for (const quote of ['apples', 'pears'])
    await request.post(`${p.url}api/op`, { data: { op: 'dc', d: 1, para: 2, quote, text: `About ${quote}` } })
  await p.doAs('D1 reply ¶2 The apples answer')
  await open(page, p, 'D1')
  const counts = page.locator('[data-act="doc-thread"][data-key*="#"]').filter({ visible: true })
  await expect(counts).toHaveCount(2)
  await counts.first().click()
  const thread = page.locator('[data-thread]').filter({ visible: true })
  await expect(thread).toHaveCount(1)
  await expect(thread).toContainText('About apples')
  await expect(thread).toContainText('The apples answer')
  await expect(thread).not.toContainText('About pears')
})

test("a row's buttons sit side by side, with no empty room where one does not apply (T475)", async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP)
  await open(page, p, '?status=all')
  for (const row of await page.locator('#list [data-act="open"]').filter({ visible: true }).all()) {
    await row.hover()
    const xs = await page
      .locator('#list [data-act="swipe"], #list [data-act="reopen"]')
      .filter({ visible: true })
      .evaluateAll((bs) => bs.map((b) => [b.getBoundingClientRect().left, b.getBoundingClientRect().right]))
    for (let i = 1; i < xs.length; i++) expect(xs[i][0] - xs[i - 1][1]).toBeLessThan(8)
  }
})

test('a web page document opens as its page; in Comment mode a click on a part makes it what you comment on (F432)', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 html Plan page
  <!doctype html><html><body><h1>Export plan</h1><p>Ship option A today.</p></body></html>
`,
  })
  await open(page, p, 'D1')
  const frame = page.frameLocator('#detailBody iframe')
  await expect(frame.getByText('Ship option A today.')).toBeVisible()
  await page.locator('[data-act="doc-inspect"]').click()
  await frame.getByText('Ship option A today.').click()
  await expect(page.locator('#scope')).toContainText('Ship option A today.')
})

test('the buttons of a part of a web page stay while the pointer goes to them; Esc drops the pick, then leaves Comment mode (D56, B484)', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 html Plan page
  <!doctype html><html><body><h1>Export plan</h1><div id="bars" style="padding:8px"><div>Read list 720 ms</div><div>Apply filter 180 ms</div><div>Write CSV 410 ms</div></div><p>Ship option A today.</p></body></html>
`,
  })
  await open(page, p, 'D1')
  const frame = page.frameLocator('#detailBody iframe'),
    mode = page.locator('[data-act="doc-inspect"]')
  await expect(frame.getByText('Write CSV 410 ms')).toBeVisible()
  await mode.click()
  const bars = await frame.locator('#bars').boundingBox()
  if (!bars) throw new Error('no bars')
  await page.mouse.move(bars.x + bars.width / 3, bars.y + bars.height - 6)
  const btn = page.locator('[data-act="page-pick"]')
  await expect(btn).toBeVisible()
  const b = await btn.boundingBox()
  if (!b) throw new Error('no button')
  // across the first row, out of the page, onto the button: it stays, for the whole part
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 25 })
  await btn.click()
  await expect(page.locator('#scope')).toContainText('Write CSV')
  await page.keyboard.press('Escape')
  await expect(page.locator('#scope')).toBeHidden()
  await expect(mode).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(mode).toHaveAttribute('aria-pressed', 'false')
})
