// The desktop's keys and panes (D20 section 4.3), and documents with comments in place (section 2.5).
// guards: src/components/ src/lib/keys.ts src/lib/events.ts src/lib/actions.ts src/lib/docs.ts src/lib/doctick.ts src/lib/rows.ts src/lib/nav.ts src/lib/go.ts src/lib/listhold.ts src/lib/markdown.ts
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

test('r45 r330: E archives the open item and Z puts it back', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await page.locator('#list [data-act="open"]').filter({ hasText: 'Write the user docs' }).click()
  await page.keyboard.press('e')
  await expect.poll(async () => p.read('items?archived=1')).toContain('Write the user docs')
  await page.keyboard.press('z')
  await expect.poll(async () => p.read('items?archived=1')).not.toContain('Write the user docs')
})

test('r447 r503: a comment on a paragraph of a document is written in the one box, which stays at the bottom (B340)', async ({
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

test("r641: a row's buttons sit side by side, with no empty room where one does not apply (T475)", async ({
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

test('a web page document is the page alone: no frame or line over it, its column wide, its comment counts in it (B492, B505)', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 html Plan page
  <!doctype html><html><body><h1>Export plan</h1><p>Ship option A today.</p></body></html>
`,
  })
  await request.post(`${p.url}api/op`, {
    data: { op: 'dc', d: 1, key: 'h:body>p:nth-child(2)', quote: 'Ship option A today.', text: 'Why not B?' },
  })
  await request.post(`${p.url}api/op`, {
    data: { op: 'dc', d: 1, key: 'doc', quote: '', text: 'And the page as a whole?' },
  })
  await open(page, p, 'D1')
  const frame = page.locator('#detailBody iframe')
  await expect(page.frameLocator('#detailBody iframe').getByText('Ship option A today.')).toBeVisible()
  expect(await frame.getAttribute('title')).toBeNull() // no tooltip over the whole page
  expect(await frame.evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe('0px')
  await expect(page.locator('#detailBody').getByText(/^on T4/)).toBeHidden()
  // B505 (#6505): the page is the column beside its item's conversation
  const pane = await page.locator('#itemTop').boundingBox(),
    f = await frame.boundingBox(),
    count = await page.locator('[data-act="doc-thread"]').filter({ visible: true }).first().boundingBox()
  if (!pane || !f || !count) throw new Error('not drawn')
  expect(f.width).toBeGreaterThan(pane.width - 100) // its column's width, not a column of text
  expect(count.x).toBeGreaterThanOrEqual(f.x)
  expect(count.x + count.width).toBeLessThanOrEqual(f.x + f.width) // in the page
  // no margins of Taska's around it: the page's own are enough (r689)
  expect(Math.abs(f.x - pane.x)).toBeLessThan(2)
  expect(Math.abs(f.y - pane.y)).toBeLessThan(2)
  // the comments on the whole page sit in its top right corner
  const whole = await page.locator('[data-act="doc-thread"][data-key="doc"]').filter({ visible: true }).boundingBox()
  if (!whole) throw new Error('no whole-page comments')
  expect(whole.y).toBeGreaterThanOrEqual(f.y)
  expect(whole.x + whole.width).toBeLessThanOrEqual(f.x + f.width)
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

test('words selected in a web page are only selected, never a comment, in Comment mode or not (B502)', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 html Plan page
  <!doctype html><html><body><h1>Export plan</h1><div style="padding:8px"><p>Save filters on the server and export from them.</p></div><p>Ship option A today.</p></body></html>
`,
  })
  await open(page, p, 'D1')
  const frame = page.frameLocator('#detailBody iframe'),
    words = frame.getByText('Save filters on the server')
  await expect(words).toBeVisible()
  const select = async () => {
    const r = await words.boundingBox()
    if (!r) throw new Error('not drawn')
    await page.mouse.move(r.x + 1, r.y + r.height / 2)
    await page.mouse.down()
    await page.mouse.move(r.x + 90, r.y + r.height / 2, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(800)
    expect(await frame.locator('body').evaluate(() => String(getSelection()).trim())).toMatch(/^Save/)
    await expect(page.locator('#scope')).toBeHidden()
    await expect(page.locator('#detailBody .ring-amber-300')).toHaveCount(0)
  }
  await select()
  await frame.locator('body').evaluate(() => getSelection()?.removeAllRanges()) // a new selection, not a drag of this one
  await page.locator('[data-act="doc-inspect"]').click()
  await select()
  // a click in Comment mode, even right on the words still selected, picks their part
  const r = await words.boundingBox()
  if (!r) throw new Error('not drawn')
  await page.mouse.click(r.x + 30, r.y + r.height / 2)
  await expect(page.locator('#scope')).toContainText('Save filters on the server')
  await expect(page.locator('#detailBody .ring-amber-300')).toHaveCount(1)
})

const TWO_PAGES = `${LOOP.then}T4 html Plan page
  <!doctype html><html><body><h1>Export plan</h1><p id="a">Ship option A today.</p><p id="b">Keep option B for later.</p></body></html>
T4 html Other page
  <!doctype html><html><body><h1>Other plan</h1><p>Nothing to see here.</p></body></html>
`

test('another document opens out of Comment mode (B500)', async ({ page, request }) => {
  const p = await project(request, { ...LOOP, then: TWO_PAGES })
  await open(page, p, 'D1')
  const mode = page.locator('[data-act="doc-inspect"]')
  await mode.click()
  await expect(mode).toHaveAttribute('aria-pressed', 'true')
  // within the page, as you go: back to the item, then its other document
  await page.locator('[data-act="doc-close"]').filter({ visible: true }).first().click()
  await page.locator('[data-act="doc-open"][data-d="2"]').filter({ visible: true }).first().click()
  await expect(page.frameLocator('#detailBody iframe').getByText('Nothing to see here.')).toBeVisible()
  await expect(page.locator('[data-act="doc-inspect"]')).toHaveAttribute('aria-pressed', 'false')
})

test('with a part picked, no other part lights or can be picked until Esc lets it go (B497)', async ({
  page,
  request,
}) => {
  const p = await project(request, { ...LOOP, then: TWO_PAGES })
  await open(page, p, 'D1')
  const frame = page.frameLocator('#detailBody iframe')
  await expect(frame.getByText('Ship option A today.')).toBeVisible()
  await page.locator('[data-act="doc-inspect"]').click()
  await frame.locator('#a').click()
  await expect(page.locator('#scope')).toContainText('Ship option A today.')
  const b = await frame.locator('#b').boundingBox()
  if (!b) throw new Error('not drawn')
  await page.mouse.move(b.x + 20, b.y + b.height / 2, { steps: 5 })
  await page.waitForTimeout(400)
  await expect(page.locator('#detailBody .ring-blue-500')).toHaveCount(0)
  await expect(page.locator('[data-act="page-pick"][data-key="h:body>p:nth-child(3)"]')).toHaveCount(0)
  // r739: the picked part keeps its two buttons
  await expect(page.locator('[data-act="page-pick"][data-key="h:body>p:nth-child(2)"]')).toBeVisible()
  await page.mouse.click(b.x + 20, b.y + b.height / 2)
  await expect(page.locator('#scope')).toContainText('Ship option A today.') // still the first
  await page.keyboard.press('Escape')
  await expect(page.locator('#scope')).toBeHidden()
  await page.mouse.move(b.x + 30, b.y + b.height / 2, { steps: 3 })
  await expect(page.locator('#detailBody .ring-blue-500')).toHaveCount(1)
})

test('a comment count outlines its part while pointed at and while open; a press anywhere else closes the comment (B503)', async ({
  page,
  request,
}) => {
  const p = await project(request, { ...LOOP, then: TWO_PAGES })
  await request.post(`${p.url}api/op`, {
    data: { op: 'dc', d: 1, key: 'h:body>p:nth-child(2)', quote: 'Ship option A today.', text: 'Why not B?' },
  })
  await open(page, p, 'D1')
  const frame = page.frameLocator('#detailBody iframe')
  await expect(frame.getByText('Ship option A today.')).toBeVisible()
  const count = page.locator('[data-act="doc-thread"]').filter({ visible: true }).first()
  const lit = page.locator('#detailBody .ring-amber-400')
  await expect(lit).toHaveCount(0)
  await count.hover()
  await expect(lit).toHaveCount(1)
  const a = await frame.locator('#a').boundingBox(),
    r = await lit.boundingBox()
  if (!a || !r) throw new Error('not drawn')
  expect(r.y).toBeLessThanOrEqual(a.y) // around the part the comment is about
  expect(r.y + r.height).toBeGreaterThanOrEqual(a.y + a.height)
  await count.click()
  const pop = page.locator('[data-thread-pop]')
  await expect(pop).toContainText('Why not B?')
  await page.mouse.move(5, 5)
  await expect(lit).toHaveCount(1) // still outlined while open
  await page.locator('#q').click() // elsewhere on the page
  await expect(pop).toHaveCount(0)
  await count.click()
  await expect(pop).toContainText('Why not B?')
  await frame.locator('#b').click({ position: { x: 3, y: 3 } }) // a press in the page closes it too (left of the comments)
  await expect(pop).toHaveCount(0)
})
