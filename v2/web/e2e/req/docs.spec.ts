// Yadong's requirements on documents (D29, "Documents"; T475, D45): each check is named by the codes of his inputs, so
// a change that breaks one is stopped before it ships with his own words.
// guards: src/components/Doc.tsx src/components/Detail.tsx src/lib/docs.ts src/lib/doctick.ts src/lib/markdown.ts
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
  const side = await (((await rail.count()) ? rail : count).first().boundingBox())
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
