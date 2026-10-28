// Yadong's requirements on documents (D29, "Documents"; T475, D45): each check is named by the codes of his inputs, so
// a change that breaks one is stopped before it ships with his own words.
// guards: src/features/docs/ src/features/composer/ src/features/item/ src/app/docs/ src/model/docs.ts src/model/boxFoot.ts src/pages/DetailContainer.tsx src/pages/ProjectPageContainer.tsx src/ui/PaneFrame.tsx
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from '../seed'
import { blockPick, blockSay, box, boxAux, boxLine, boxMain, choice, commentRail, docBlock, docBlocks, docCard, duo, form, sendChoices, talk, threadCounts } from '../ui'

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
  const para = docBlock(page, 'First part')
  const before = await para.boundingBox()
  const key = await para.getAttribute('data-key')
  await p.op({ op: 'dc', d: 1, key, quote: '', text: 'Who signs it off?' })
  const count = para.locator(threadCounts(page))
  const rail = commentRail(page)
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
  const li = docBlocks(page).locator('li').filter({ hasText: 'Banana bread' })
  await li.hover()
  const say = blockSay(page),
    pick = blockPick(page)
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
  await expect(boxLine(page)).toContainText('Banana bread')
})

test("r524: choices in a document are ticked on the page and wait; the box's line says how many, and its Send choices sends them together", async ({
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
  for (const f of ['Apples', 'Plums']) await choice(page, f).click()
  await expect(boxLine(page)).toContainText('2 choices not sent')
  expect(await p.read('D1')).not.toMatch(/\[x\] Apples/i) // waiting on the page, not sent one by one
  await sendChoices(page).click() // B524 (r736): the line's own button, not the box's
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
  await choice(page, 'Apples').click()
  await sendChoices(page).click()
  await expect.poll(() => p.read('D1')).toMatch(/\(x\) Apples/i)
  const sent = form(page, 'Pears')
  await expect(sent).toContainText('Submitted')
  await expect(sent.getByRole('button', { name: /Apples|Pears/ })).toHaveCount(0) // not clickable: sent
  const row = (f: string) => sent.locator('[aria-pressed]').filter({ hasText: f })
  await expect(row('Apples')).toHaveAttribute('aria-pressed', 'true')
  await expect(row('Pears')).toHaveAttribute('aria-pressed', 'false')
  // the pick stands out from the rest, all of it quieter than a form waiting to be sent
  const fg = (f: string) => row(f).evaluate((el) => getComputedStyle(el).color)
  const dark = (c: string) => (c.match(/\d+/g) || []).slice(0, 3).reduce((a, x) => a + Number(x), 0)
  expect(dark(await fg('Apples'))).toBeLessThan(dark(await fg('Pears')))
  // Modify: a form again; another pick goes the same way
  await sent.hover()
  await sent.getByRole('button', { name: 'Modify' }).click()
  await choice(page, 'Pears').click()
  await sendChoices(page).click()
  await expect.poll(() => p.read('D1')).toMatch(/\(x\) Pears/i)
})

test("r736 r722: ticks wait, the box's mic stays the mic; Send choices is in the line above the box, and the document's top and its card on the item say what is not sent", async ({
  page,
  request,
}) => {
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 doc Pick the fruit
  - [ ] Apples
  - [ ] Pears
`,
  })
  await open(page, p, 'D1')
  const main = boxMain(page),
    line = boxLine(page)
  const at = async () => (await main.isVisible()) && (await main.boundingBox())
  const before = await at()
  await choice(page, 'Apples').click()
  // the box's round button is still the mic, where it was (B524: reaching for it sent the choices)
  await expect(line).toContainText('1 choice not sent')
  await expect(main).toBeVisible()
  await expect(main).toHaveAccessibleName('Record a voice note')
  await expect(boxAux(page)).toBeHidden() // the mic did not move aside
  if (before) expect(await main.boundingBox()).toEqual(before)
  // Send choices is a button of its own, in the line that says how many wait
  await expect(sendChoices(page)).toBeVisible()
  await expect(sendChoices(page)).toHaveText('Send choices')
  // the document says it at its top, over its text
  const doc = docBlocks(page).locator('xpath=..')
  const top = doc.getByText('1 choice not sent', { exact: true })
  await expect(top).toBeVisible()
  const t = await top.boundingBox(),
    first = await docBlocks(page).locator('section[data-key]').first().boundingBox()
  expect(t && first && t.y < first.y).toBe(true)
  expect(await p.read('D1')).not.toMatch(/\[x\] Apples/i) // nothing sent yet
  // on the item, the document's card says it too, after a reload
  await open(page, p, 'T4')
  const card = docCard(page, 'Pick the fruit')
  await expect(card).toContainText('1 choice not sent')
  // open it from the card; the line's button sends the choices, and every notice goes
  await card.click()
  await expect(sendChoices(page)).toBeVisible()
  await sendChoices(page).click()
  await expect.poll(() => p.read('D1')).toMatch(/\[x\] Apples/i)
  expect(await p.read('D1')).not.toMatch(/\[x\] Pears/i)
  await expect.poll(() => p.read('T4')).toContain('Answered in D1')
  await expect(sendChoices(page)).toHaveCount(0)
  await expect(page.getByText('1 choice not sent', { exact: true }).filter({ visible: true })).toHaveCount(0)
  await open(page, p, 'T4')
  await expect(docCard(page, 'Pick the fruit')).not.toContainText('not sent')
})

test('r736 #6754: what is written in the box goes with Send choices as their note, and the box is empty after (B524)', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 doc Pick the fruit
  - [ ] Apples
  - [ ] Pears
`,
  })
  await open(page, p, 'D1')
  await choice(page, 'Pears').click()
  await expect(boxLine(page)).toContainText('1 choice not sent')
  await box(page).fill('Ripe ones only, please')
  await sendChoices(page).click()
  // one reply on the item: the choices, then the note
  await expect.poll(() => p.read('T4')).toMatch(/Answered in D1:[\s\S]*Pears[\s\S]*Ripe ones only, please/)
  await expect(box(page)).toHaveValue('')
  await expect.poll(() => p.read('D1')).toMatch(/\[x\] Pears/i)
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
  const field = box(page)
  await expect(field).toHaveAttribute('placeholder', 'Comment on D1…')
  await field.fill('Looks fine overall')
  await field.press('Shift+Enter')
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
  const para = docBlock(page, 'First part')
  await p.op({ op: 'dc', d: 1, key: await para.getAttribute('data-key'), quote: '', text: 'My note in the wrong place' })
  await expect.poll(async () => p.read('D1')).toContain('My note in the wrong place')
  // the open page has both comments (it hears of the new one a moment later; later still on a slow machine)
  const rail = commentRail(page)
  await expect
    .poll(async () => {
      if (await rail.count()) return (await rail.innerText()).match(/wrong place|agent note to delete/g)?.length ?? 0
      const ns = await threadCounts(page).allInnerTexts()
      return ns.reduce((a, t) => a + (Number(t.match(/\d+/)?.[0]) || 0), 0)
    })
    .toBe(2)
  for (const words of ['My note in the wrong place', 'An agent note to delete']) {
    const remove = page.getByRole('button', { name: 'Delete', exact: true })
    const card = page.locator('.group').filter({ hasText: words }).filter({ has: remove }).last()
    // the page shows the comment: in the comment column, or (a narrow page) behind a count beside its paragraph; wait
    // for one of them, then open the thread if it is behind a count
    const counts = threadCounts(page)
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
    await card.locator(remove).click()
    await expect.poll(async () => p.read('D1')).not.toContain(words)
  }
})

test("r691 #6505: a document open on the desktop is a column of its own beside its item's conversation, which holds its comments, once the pane is wide enough for two columns (B505, B557)", async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'the phone shows a document in a sheet')
  await page.setViewportSize({ width: 1920, height: 900 }) // r783: four columns only where an item would have them too
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 doc The plan
  First part of the plan, long enough to fill a line of the page with words.

  Second part of the plan.
`,
  })
  await open(page, p, 'D1')
  const para = docBlock(page, 'First part')
  const key = await para.getAttribute('data-key')
  await p.op({ op: 'dc', d: 1, key, quote: '', text: 'Who signs it off?' })
  await expect(duo(page)).toHaveCount(1)
  const conversation = talk(page)
  await expect(conversation).toContainText('Who signs it off?') // the comment is in the conversation
  const t = await para.boundingBox(),
    c = await conversation.boundingBox(),
    composer = await page.locator('#composer').boundingBox()
  if (!t || !c || !composer) throw new Error('not drawn')
  expect(c.x).toBeGreaterThanOrEqual(t.x + t.width) // the conversation on the right of the text, never over it
  expect(composer.x).toBeGreaterThanOrEqual(c.x - 1) // the box under the conversation
  await expect(commentRail(page)).toHaveCount(0) // no fifth column of comments
})

test('r783: at 1440 wide a document on the desktop is one column, the document alone: the four columns come only where an item would have two in its pane too (B557)', async ({
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
  await expect(docBlocks(page)).toContainText('First part')
  await expect(duo(page)).toHaveCount(0)
  await expect(talk(page)).toHaveCount(0)
  // wide enough, it is beside its conversation; narrow again, alone again
  await page.setViewportSize({ width: 1920, height: 900 })
  await expect(duo(page)).toHaveCount(1)
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(duo(page)).toHaveCount(0)
})

test('r824 r837 r849 (B584): selecting words in a document changes nothing in the box; only its Comment makes them what the box comments on', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'the desktop selects words with the pointer')
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 doc The plan
  First part of the plan, long enough to fill a line of the page with words.
`,
  })
  await open(page, p, 'D1')
  const para = docBlock(page, 'First part')
  await expect(para).toBeVisible()
  const before = (await boxLine(page).count()) ? await boxLine(page).innerText() : ''
  // select a few words with the pointer, as a person does
  const r = await para.boundingBox()
  if (!r) throw new Error('not drawn')
  await page.mouse.move(r.x + 2, r.y + 12)
  await page.mouse.down()
  await page.mouse.move(r.x + 120, r.y + 12, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(600)
  expect(await page.evaluate(() => String(getSelection()).trim().length)).toBeGreaterThan(2)
  const after = (await boxLine(page).count()) ? await boxLine(page).innerText() : ''
  expect(after, 'selecting words leaves the box as it was').toBe(before)
  expect(after).not.toContain('Comment on D1')
  // Comment on the bar over the words: now the box comments on them
  await page.getByLabel('On the selected text').getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(boxLine(page)).toContainText('Comment on D1')
  await expect(boxLine(page)).toContainText('First part')
})

test('D83 #4 (r767 r774): choices ticked and then a paragraph picked: the box says both, and Send choices still sends the choices', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 doc Pick the fruit
  Which fruit for the pie?

  - [ ] Apples
  - [ ] Pears
`,
  })
  await open(page, p, 'D1')
  await choice(page, 'Apples').click()
  // a paragraph picked to comment on: on the desktop its Comment, on the phone a tap
  const para = docBlock(page, 'Which fruit')
  if (isDesk(page)) {
    await para.hover()
    await blockPick(page).click()
  } else await para.click()
  const composer = page.locator('#composer')
  await expect(composer).toContainText('Comment on D1')
  await expect(composer).toContainText('1 choice not sent')
  await composer.getByRole('button', { name: 'Send choices' }).click()
  await expect.poll(() => p.read('D1')).toMatch(/\[x\] Apples/i)
  await expect(composer).toContainText('Comment on D1') // the paragraph is still what a comment goes to
})
