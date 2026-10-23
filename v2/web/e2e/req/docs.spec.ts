// Yadong's requirements on documents (D29, "Documents"; T475, D45): each check is named by the codes of his inputs, so
// a change that breaks one is stopped before it ships with his own words.
// guards: src/components/Doc.tsx src/components/Detail.tsx src/components/WebPage.tsx src/components/Shell.tsx src/lib/docs.ts src/lib/doctick.ts src/lib/markdown.ts
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from '../seed'

test('r447 r467: the text of a document stays where it is when a comment comes, the comment beside it', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'on the phone a comment opens under its paragraph')
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 doc The plan
  First part of the plan, long enough to fill a line of the page with words.

  Second part of the plan.
`,
  })
  await open(page, p, 'D1')
  const para = page.locator('#docBlocks section[data-key]').filter({ hasText: 'First part' })
  const before = await para.boundingBox()
  const key = await para.getAttribute('data-key')
  await request.post(`${p.url}api/op`, {
    data: { op: 'dc', d: 1, key, quote: '', text: 'Who signs it off?' },
  })
  const count = para.locator('[data-act="doc-thread"]:visible')
  const rail = page.locator('aside[aria-label="Comments"]')
  await expect(rail.or(count).first()).toBeVisible()
  const after = await para.boundingBox()
  expect(after?.x).toBe(before?.x)
  expect(after?.width).toBe(before?.width)
  // on its right: the comment column, or the count beside the paragraph
  const side = await ((await rail.count()) ? rail : count).first().boundingBox()
  const text = await para.locator('p, li').first().boundingBox()
  if (!side || !text) throw new Error('not drawn')
  expect(side.x).toBeGreaterThanOrEqual(text.x + text.width - 1)
})

test('r473 r500: each item of a list has its own two buttons, the voice one first, reached by moving the pointer across', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'the phone picks a list item with a tap')
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 doc Bakes
  - Apple pie
  - Banana bread
  - Cherry tart
`,
  })
  await open(page, p, 'D1')
  const li = page.locator('#docBlocks li').filter({ hasText: 'Banana bread' })
  await li.hover()
  const say = page.locator('[data-act="doc-say"]').filter({ visible: true }),
    pick = page.locator('[data-pick-btn]').filter({ visible: true })
  await expect(say).toHaveCount(1) // only the item under the pointer
  await expect(pick).toHaveCount(1)
  const s = await say.boundingBox(),
    c = await pick.boundingBox(),
    t = await li.boundingBox()
  if (!s || !c || !t) throw new Error('not drawn')
  expect(s.x).toBeLessThan(c.x) // the voice one first
  expect(Math.abs(s.y - c.y)).toBeLessThan(2) // side by side
  // across from the item to the comment button: they stay, and it is this item that is picked
  await page.mouse.move(t.x + t.width - 4, s.y + s.height / 2)
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 12 })
  await pick.click()
  await expect(page.locator('#scope')).toContainText('Banana bread')
})

test('r524: choices in a document are ticked on the page and wait; the box says how many, and Send sends them together', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 doc Pick the fruit
  - [ ] Apples
  - [ ] Pears
  - [ ] Plums
`,
  })
  await open(page, p, 'D1')
  for (const f of ['Apples', 'Plums'])
    await page.locator('[data-act="doc-tick"]').filter({ hasText: f }).filter({ visible: true }).first().click()
  await expect(page.locator('#scope')).toContainText('2 choices not sent')
  expect(await p.read('D1')).not.toMatch(/\[x\] Apples/i) // waiting on the page, not sent one by one
  await page.locator('#text').click()
  await page.keyboard.press('Shift+Enter')
  await expect.poll(() => p.read('D1')).toMatch(/\[x\] Apples/i)
  expect(await p.read('D1')).toMatch(/\[x\] Plums/i)
  expect(await p.read('D1')).not.toMatch(/\[x\] Pears/i)
})

test('r420: a sent form is greyed and Submitted, plainly showing what was picked; Modify makes it a form again', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 doc Pick the fruit
  - ( ) Apples
  - ( ) Pears
`,
  })
  await open(page, p, 'D1')
  await page.locator('[data-act="doc-tick"]').filter({ hasText: 'Apples' }).filter({ visible: true }).first().click()
  await page.locator('#text').click()
  await page.keyboard.press('Shift+Enter')
  await expect.poll(() => p.read('D1')).toMatch(/\(x\) Apples/i)
  const form = page.locator('#docBlocks [role="group"]').filter({ hasText: 'Pears' }).filter({ visible: true }).first()
  await expect(form).toContainText('Submitted')
  await expect(form.locator('button[data-act="doc-tick"]')).toHaveCount(0) // not clickable: sent
  const row = (f: string) => form.locator('[aria-pressed]').filter({ hasText: f })
  await expect(row('Apples')).toHaveAttribute('aria-pressed', 'true')
  await expect(row('Pears')).toHaveAttribute('aria-pressed', 'false')
  // the pick stands out from the rest, all of it quieter than a form waiting to be sent
  const fg = (f: string) => row(f).evaluate((el) => getComputedStyle(el).color)
  const dark = (c: string) => (c.match(/\d+/g) || []).slice(0, 3).reduce((a, x) => a + Number(x), 0)
  expect(dark(await fg('Apples'))).toBeLessThan(dark(await fg('Pears')))
  // Modify: a form again; another pick goes the same way
  await form.hover()
  await form.locator('[data-act="doc-tick-edit"]').click()
  await page.locator('[data-act="doc-tick"]').filter({ hasText: 'Pears' }).filter({ visible: true }).first().click()
  await page.locator('#text').click()
  await page.keyboard.press('Shift+Enter')
  await expect.poll(() => p.read('D1')).toMatch(/\(x\) Pears/i)
})

test('r280 B340: on the phone a comment needs no place picked: it is on the whole document', async ({
  page,
  request,
}) => {
  // on the desktop, Yadong decided later (B340, D24 #6): nothing picked, the box replies to the item the document is on
  test.skip(isDesk(page), 'the desktop replies to the item when nothing is picked (B340)')
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 doc The plan
  First part of the plan.

  Second part of the plan.
`,
  })
  await open(page, p, 'D1')
  const box = page.locator('#text')
  await expect(box).toHaveAttribute('placeholder', 'Comment on D1…')
  await box.fill('Looks fine overall')
  await box.press('Shift+Enter')
  await expect.poll(async () => p.read('D1')).toMatch(/¶0[\s\S]*Looks fine overall/)
})

test("r292 r298: any comment on a document can be deleted, yours and an agent's", async ({ page, request }) => {
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 doc The plan
  First part of the plan.

  Second part of the plan.
D1 reply ¶2 An agent note to delete
`,
  })
  await open(page, p, 'D1')
  const para = page.locator('#docBlocks section[data-key]').filter({ hasText: 'First part' })
  await request.post(`${p.url}api/op`, {
    data: { op: 'dc', d: 1, key: await para.getAttribute('data-key'), quote: '', text: 'My note in the wrong place' },
  })
  await expect.poll(async () => p.read('D1')).toContain('My note in the wrong place')
  // the open page has both comments (it hears of the new one a moment later; later still on a slow machine)
  const rail = page.locator('aside[aria-label="Comments"]')
  await expect
    .poll(async () => {
      if (await rail.count()) return (await rail.innerText()).match(/wrong place|agent note to delete/g)?.length ?? 0
      const ns = await page.locator('[data-act="doc-thread"]:visible').allInnerTexts()
      return ns.reduce((a, t) => a + (Number(t.match(/\d+/)?.[0]) || 0), 0)
    })
    .toBe(2)
  for (const words of ['My note in the wrong place', 'An agent note to delete']) {
    const card = page
      .locator('.group')
      .filter({ hasText: words })
      .filter({ has: page.locator('[data-act="dc-delete"]') })
      .last()
    // the page shows the comment: in the comment column, or (a narrow page) behind a count beside its paragraph; wait
    // for one of them, then open the thread if it is behind a count
    const counts = page.locator('[data-act="doc-thread"]:visible')
    await expect(card.or(counts).first()).toBeVisible()
    if (!(await card.isVisible()))
      for (const c of await counts.all()) {
        await c.click()
        const open = await card.waitFor({ timeout: 5000 }).then(
          () => true,
          () => false,
        )
        if (open) break
      }
    await expect(card).toBeVisible()
    await card.scrollIntoViewIfNeeded()
    await card.hover()
    await card.locator('[data-act="dc-delete"]').click()
    await expect.poll(async () => p.read('D1')).not.toContain(words)
  }
})

test("r691 #6505: a document open on the desktop is a column of its own beside its item's conversation, which holds its comments (B505)", async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'the phone shows a document in a sheet')
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 doc The plan
  First part of the plan, long enough to fill a line of the page with words.

  Second part of the plan.
`,
  })
  await open(page, p, 'D1')
  const para = page.locator('#docBlocks section[data-key]').filter({ hasText: 'First part' })
  const key = await para.getAttribute('data-key')
  await request.post(`${p.url}api/op`, { data: { op: 'dc', d: 1, key, quote: '', text: 'Who signs it off?' } })
  await expect(page.locator('#app')).toHaveAttribute('data-duo', '')
  const talk = page.locator('#itemTalk')
  await expect(talk).toContainText('Who signs it off?') // the comment is in the conversation
  const t = await para.boundingBox(),
    c = await talk.boundingBox(),
    box = await page.locator('#composer').boundingBox()
  if (!t || !c || !box) throw new Error('not drawn')
  expect(c.x).toBeGreaterThanOrEqual(t.x + t.width) // the conversation on the right of the text, never over it
  expect(box.x).toBeGreaterThanOrEqual(c.x - 1) // the box under the conversation
  await expect(page.locator('aside[aria-label="Comments"]')).toHaveCount(0) // no fifth column of comments
})
