// Yadong's requirements on web page documents (F432; D29, "Documents"; T475, D45): each check is named by the codes of
// his inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/features/docs/ src/app/docs/ src/app/voice/ src/model/docs.ts src/model/voiceComments.ts src/app/actions.ts src/app/keys.ts
import { expect, test, type Page } from '@playwright/test'
import { LOOP, isDesk, open, project } from '../seed'
import {
  PAGE_COUNTS,
  box,
  boxLine,
  boxMain,
  commentMode,
  foot,
  pageCount,
  pane,
  partPick,
  partRing,
  partSay,
  partSayFor,
  partStop,
  sayCancel,
  slowComments,
  threadPop,
  typeInstead,
} from '../ui'

// a microphone that hears a tone, so recording runs as it does for him
test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } })

const PAGE = `${LOOP.then}T4 html Plan page
  <!doctype html><html><body style="margin:0;padding:24px"><h1>Export plan</h1><p id="a" style="padding:8px">Ship option A today.</p><p id="b" style="padding:8px">Keep option B for later.</p><p id="c" style="padding:8px;margin-top:240px">Ask again next week.</p></body></html>
`
const A = 'h:body>p:nth-child(2)'

test('r688: a comment shows the part it is on: under the pointer and open; a click anywhere else closes it (B503)', async ({
  page,
  request,
}) => {
  const p = await project(request, { ...LOOP, then: PAGE })
  await p.op({ op: 'dc', d: 1, key: A, quote: 'Ship option A today.', text: 'Why today?' })
  await open(page, p, 'D1')
  const frame = page.frameLocator('iframe').first()
  await expect(frame.getByText('Ship option A today.')).toBeVisible()
  const count = pageCount(page, A),
    ring = partRing(page, A),
    thread = page.locator('[data-thread]').filter({ visible: true })
  await expect(count).toBeVisible()
  await expect(ring).toHaveCount(0)
  if (isDesk(page)) {
    await count.hover()
    await expect(ring).toHaveCount(1) // pointing at the count outlines its part
  }
  await count.click()
  await expect(thread).toHaveCount(1)
  await expect(thread).toContainText('Why today?')
  await expect(ring).toHaveCount(1) // open, its part stays outlined
  // the comments sit right under their part
  const a = await frame.locator('#a').boundingBox(),
    t = await thread.boundingBox()
  if (!a || !t) throw new Error('not drawn')
  expect(t.y).toBeGreaterThan(a.y + a.height - 2)
  expect(t.y).toBeLessThan(a.y + a.height + 40)
  await thread.click({ position: { x: 30, y: 12 } }) // a click in it keeps it
  await expect(thread).toHaveCount(1)
  // a click in the page elsewhere closes it, and only closes it
  await frame.locator('#c').click()
  await expect(thread).toHaveCount(0)
  await expect(partSay(page)).toHaveCount(0) // nothing picked
  await page.mouse.move(0, 0)
  await expect(partRing(page)).toHaveCount(0)
  if (!isDesk(page)) return
  // a click outside the page closes it too (the document's name over it)
  await count.click()
  await expect(thread).toHaveCount(1)
  await page.getByText('Plan page', { exact: true }).filter({ visible: true }).first().click()
  await expect(thread).toHaveCount(0)
})

test('r562: in Comment mode a click picks the part even before the page has heard the mode is on (F432)', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'Comment mode is for the pointer')
  const p = await project(request, { ...LOOP, then: PAGE })
  await open(page, p, 'D1')
  const frame = pane(page).frameLocator('iframe')
  await expect(frame.getByText('Ship option A today.')).toBeVisible()
  await commentMode(page).click()
  // a slow page: it still thinks Comment mode is off when the click comes
  await frame.locator('body').evaluate(() => window.postMessage({ taska: 1, mode: false, keys: [], picked: '' }, '*'))
  await frame.locator('#a').click()
  await expect(boxLine(page)).toContainText('Ship option A today.')
  await expect(partRing(page)).toHaveCount(1)
})

// nested parts, as in an app page: a board, its columns, their cards with buttons
const APP = `${LOOP.then}T4 html App page
  <!doctype html><html><body style="margin:0;padding:24px;font:14px sans-serif"><div id="board" style="display:flex;gap:12px;padding:12px;border:1px solid #ccc"><div id="todo" style="flex:1;padding:8px;border:1px solid #ddd"><h3>To do</h3><div id="card1" style="padding:8px;border:1px solid #eee">Sketch the onboarding <button>Move</button></div><div id="card2" style="padding:8px;border:1px solid #eee;margin-top:8px">Write the notes <button>Move</button></div></div><div id="done" style="flex:1;padding:8px;border:1px solid #ddd"><h3>Done</h3><div id="card3" style="padding:8px;border:1px solid #eee">Fix the search <button>Move</button></div></div></div></body></html>
`

test('r684 r739: a part picked in nested HTML keeps its two buttons, reached across other parts; Esc lets another be picked (B497)', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'Comment mode is for the pointer')
  const p = await project(request, { ...LOOP, then: APP })
  await open(page, p, 'D1')
  const frame = pane(page).frameLocator('iframe')
  await expect(frame.getByText('Sketch the onboarding')).toBeVisible()
  await commentMode(page).click()
  const card1 = await frame.locator('#card1').boundingBox()
  if (!card1) throw new Error('not drawn')
  // point at the card, then click it: it is the one picked
  await page.mouse.move(card1.x + 20, card1.y + card1.height / 2, { steps: 5 })
  await page.mouse.click(card1.x + 20, card1.y + card1.height / 2)
  await expect(boxLine(page)).toContainText('Sketch the onboarding')
  const say = partSay(page),
    cmt = partPick(page)
  await expect(say).toHaveCount(1)
  await expect(cmt).toHaveCount(1)
  const key = await say.getAttribute('data-key')
  await expect(cmt).toHaveAttribute('data-key', key || '')
  // across the column, the board and the other cards to the buttons: they stay, for the same part
  const c = await cmt.boundingBox()
  if (!c) throw new Error('no button')
  const card2 = await frame.locator('#card2').boundingBox(),
    card3 = await frame.locator('#card3').boundingBox()
  if (!card2 || !card3) throw new Error('not drawn')
  await page.mouse.move(card2.x + 30, card2.y + 10, { steps: 6 })
  await page.mouse.move(card3.x + 30, card3.y + 10, { steps: 6 })
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 12 })
  await page.waitForTimeout(400)
  await expect(pane(page).locator('.ring-blue-500')).toHaveCount(0)
  await expect(cmt).toHaveAttribute('data-key', key || '')
  await cmt.click()
  await expect(box(page)).toBeFocused()
  await expect(boxLine(page)).toContainText('Sketch the onboarding')
  // a click on another card does not take its place
  await page.mouse.click(card3.x + 20, card3.y + 10)
  await expect(boxLine(page)).toContainText('Sketch the onboarding')
  // Esc lets it go; then pointing lights another card and a click picks it
  await box(page).blur()
  await page.keyboard.press('Escape')
  await expect(say).toHaveCount(0)
  await page.mouse.move(card3.x + 24, card3.y + 12, { steps: 4 })
  await expect(pane(page).locator('.ring-blue-500')).toHaveCount(1)
  await page.mouse.click(card3.x + 24, card3.y + 12)
  await expect(boxLine(page)).toContainText('Fix the search')
  await expect(cmt).toHaveCount(1)
})

test('r685: the mic of a part records right there: it turns into Stop, the part stays the one; Esc drops it (B498)', async ({
  page,
  request,
}) => {
  const p = await project(request, { ...LOOP, then: PAGE })
  await page.context().grantPermissions(['microphone'])
  await open(page, p, 'D1')
  const frame = page.frameLocator('iframe').first()
  await expect(frame.getByText('Ship option A today.')).toBeVisible()
  // the part #a, whatever its key is written as: its mic says what it quotes
  const micA = partSayFor(page, 'Ship option A today.'),
    stop = partStop(page)
  let key = ''
  const say = async () => {
    if (isDesk(page)) {
      await commentMode(page).click()
      const a = await frame.locator('#a').boundingBox()
      if (!a) throw new Error('not drawn')
      await page.mouse.move(a.x + 40, a.y + a.height / 2, { steps: 4 })
      const m = await micA.boundingBox()
      if (!m) throw new Error('no mic')
      await page.mouse.move(m.x + m.width / 2, m.y + m.height / 2, { steps: 10 })
      key = (await micA.getAttribute('data-key')) || ''
      await micA.click()
    } else {
      await frame.locator('#a').click()
      key = (await micA.getAttribute('data-key')) || ''
      await micA.click()
    }
    await expect(stop).toHaveCount(1)
    await expect(stop).toHaveAttribute('data-key', key)
    await expect(partRing(page, key)).toHaveCount(1)
  }
  await say()
  if (isDesk(page)) {
    // the stop is where the mic was, and pointing at another part changes nothing
    const b = await frame.locator('#b').boundingBox()
    if (!b) throw new Error('not drawn')
    await page.mouse.move(b.x + 40, b.y + b.height / 2, { steps: 5 })
    await page.waitForTimeout(400)
    await expect(page.locator('.ring-blue-500')).toHaveCount(0)
    await expect(stop).toHaveCount(1)
    await page.keyboard.press('Escape') // Esc drops the recording first
    await expect(stop).toHaveCount(0)
    // a part picked keeps its mic right there: no going down to the box to speak
    await frame.locator('#a').click()
    await expect(boxLine(page)).toContainText('Ship option A today.')
    await micA.click()
    await expect(stop).toHaveCount(1)
    await expect(stop).toHaveAttribute('data-key', key)
    await page.keyboard.press('Escape')
  } else {
    await expect(page.locator('[data-rec-time]').filter({ visible: true })).toBeVisible()
    await sayCancel(page).click()
  }
  await expect(stop).toHaveCount(0)
})

// ---------------------------------------------------------------- r799: a comment is where you made it, at once

// short rows close together (as in D56's bars), and a part far below them
const ROWS = `${LOOP.then}T4 html Rows page
  <!doctype html><html><body style="margin:0;padding:24px;font:15px/1.4 sans-serif"><h1>Export plan</h1><div id="bars"><div id="r1" style="padding:2px 0">Read list 720 ms</div><div id="r2" style="padding:2px 0">Apply filter 180 ms</div><div id="r3" style="padding:2px 0">Write CSV 410 ms</div></div><p id="low" style="margin-top:320px;padding:8px">Ask again next week.</p></body></html>
`
const page1 = (page: Page) => page.frameLocator('iframe').first()
/** the comment counts at the top right corner of the part `sel` of the page (its own counts, not another part's): level
 * with its top, at most half over its right edge (D83 #5) */
async function countsOn(page: Page, sel: string) {
  const p = await page1(page).locator(sel).boundingBox()
  if (!p) throw new Error('no part ' + sel)
  const all = await page
    .locator(PAGE_COUNTS)
    .filter({ visible: true })
    .evaluateAll((bs) =>
      bs.map((b) => {
        const r = b.getBoundingClientRect()
        return { x: r.x, y: r.y, w: r.width, n: b.textContent || '', draft: b.hasAttribute('data-draft') }
      }),
    )
  return all.filter(
    (c) => c.y >= p.y - 2 && c.y <= p.y + Math.max(p.height, 28) && c.x >= p.x && c.x + c.w <= p.x + p.width + c.w / 2 + 2,
  )
}
/** comment on a part as you do: the desktop points at it in Comment mode and presses its comment button; the phone
 * taps it and Aa (a tap that only closes open comments first, B503) */
async function commentOn(page: Page, sel: string, words: string) {
  if (isDesk(page)) {
    const r = await page1(page).locator(sel).boundingBox()
    if (!r) throw new Error('not drawn')
    await page.mouse.move(r.x + 30, r.y + r.height / 2, { steps: 4 })
    const btn = partPick(page)
    const b = await btn.boundingBox()
    if (!b) throw new Error('no comment button')
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 })
    await btn.click()
    await box(page).fill(words)
    await page.keyboard.press('Shift+Enter')
    return
  }
  if (await threadPop(page).count()) await page1(page).locator(sel).click()
  await page1(page).locator(sel).click()
  await typeInstead(page).click()
  await box(page).fill(words)
  await boxMain(page).click()
}
/** close the comments open in the page: a click on the document's name over it (desktop), a tap in the page (phone:
 * it only closes them, B503) */
async function closeComments(page: Page, title: string) {
  if (isDesk(page)) await page.getByText(title, { exact: true }).filter({ visible: true }).first().click()
  else
    await page1(page)
      .locator('body')
      .click({ position: { x: 4, y: 4 } })
  await expect(threadPop(page)).toHaveCount(0)
}

test('r799: a comment made from a part lands on that part at once, beside it, whatever parts had comments before', async ({
  page,
  request,
}) => {
  const p = await project(request, { ...LOOP, then: ROWS })
  await open(page, p, 'D1')
  await expect(page1(page).getByText('Write CSV')).toBeVisible()
  if (isDesk(page)) await commentMode(page).click()
  // first a part low on the page, then one above it: each count beside its own part, without a reload
  await commentOn(page, '#low', 'Ask whom?')
  await expect.poll(() => countsOn(page, '#low').then((c) => c.length), { timeout: 1500 }).toBe(1)
  await commentOn(page, '#r1', 'Why so slow?')
  await expect.poll(() => countsOn(page, '#r1').then((c) => c.length), { timeout: 1500 }).toBe(1)
  expect(await countsOn(page, '#low')).toHaveLength(1)
  // and after a reload, the same
  await expect.poll(async () => (await p.read('D1')).match(/part of the page/g)?.length ?? 0).toBe(2)
  await page.reload()
  await expect(page1(page).getByText('Write CSV')).toBeVisible()
  await expect.poll(() => countsOn(page, '#r1').then((c) => c.length)).toBe(1)
  expect(await countsOn(page, '#low')).toHaveLength(1)
})

test('r799: a second comment on a part joins its count while it is saved: no second count that jumps', async ({
  page,
  request,
}) => {
  const p = await project(request, { ...LOOP, then: ROWS })
  await p.op({ op: 'dc', d: 1, key: "h:[id='r2']", quote: 'Apply filter 180 ms', text: 'Why 180?' })
  // Taska takes its time to answer
  await slowComments(page, 3000)
  await open(page, p, 'D1')
  await expect(page1(page).getByText('Write CSV')).toBeVisible()
  if (isDesk(page)) await commentMode(page).click()
  await commentOn(page, '#r2', 'And on the phone?')
  await expect
    .poll(() => countsOn(page, '#r2').then((c) => c.map((x) => x.n.trim()).join()), { timeout: 1500 })
    .toBe('2')
  await page.waitForTimeout(3500) // saved: still the one count
  expect((await countsOn(page, '#r2')).map((x) => x.n.trim())).toEqual(['2'])
})

test("r799: a part's speak and comment buttons are never under the count of the part above it", async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'Comment mode is for the pointer')
  const p = await project(request, { ...LOOP, then: ROWS })
  await p.op({ op: 'dc', d: 1, key: "h:[id='r1']", quote: 'Read list 720 ms', text: 'Slow?' })
  await open(page, p, 'D1')
  await expect(page1(page).getByText('Apply filter')).toBeVisible()
  await expect.poll(() => countsOn(page, '#r1').then((c) => c.length)).toBe(1)
  await commentMode(page).click()
  const r = await page1(page).locator('#r2').boundingBox()
  if (!r) throw new Error('not drawn')
  await page.mouse.move(r.x + 30, r.y + r.height / 2, { steps: 4 })
  for (const [act, button] of [
    ['speak', partSay(page)],
    ['comment', partPick(page)],
  ] as const) {
    const b = await button.boundingBox()
    if (!b) throw new Error('no ' + act)
    // what a click there reaches is the button itself
    const top = await page.evaluate(
      ([x, y]) => {
        const at = document.elementFromPoint(x, y)?.closest('button')
        return at?.matches('[data-act="page-say"], [data-part-say]') ? 'speak' : at?.matches('[data-act="page-pick"], [data-part-pick]') ? 'comment' : null
      },
      [b.x + b.width / 2, b.y + b.height / 2],
    )
    expect(top).toBe(act)
  }
  const btn = partPick(page)
  const b = await btn.boundingBox()
  if (!b) throw new Error('no comment button')
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 })
  await btn.click()
  await expect(boxLine(page)).toContainText('Apply filter')
})

test('r799 r685: a spoken comment is on its part at once; on the phone the stop under the part posts it, the box open or not', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000) // with no speech model here, its words are tried for a while before it is saved
  const p = await project(request, { ...LOOP, then: ROWS })
  await page.context().grantPermissions(['microphone'])
  // Taska takes its time to answer: the comment shows meanwhile
  await slowComments(page, 4000)
  await open(page, p, 'D1')
  await expect(page1(page).getByText('Write CSV')).toBeVisible()
  const stop = partStop(page)
  if (isDesk(page)) {
    await commentMode(page).click()
    const r = await page1(page).locator('#r3').boundingBox()
    if (!r) throw new Error('not drawn')
    await page.mouse.move(r.x + 30, r.y + r.height / 2, { steps: 4 })
    const mic = partSay(page)
    const m = await mic.boundingBox()
    if (!m) throw new Error('no mic')
    await page.mouse.move(m.x + m.width / 2, m.y + m.height / 2, { steps: 8 })
    await mic.click()
    await expect(stop).toHaveCount(1)
    await page.waitForTimeout(1200)
    await stop.click() // stopped right there
    // not sent yet: it waits beside its part (as beside a paragraph), and the box says so
    await expect.poll(() => countsOn(page, '#r3').then((c) => c.filter((x) => x.draft).length)).toBe(1)
    await box(page).focus()
    await page.keyboard.press('Shift+Enter')
  } else {
    await page1(page).locator('#r3').click()
    await typeInstead(page).click() // the box is open too
    await partSay(page).click()
    await expect(stop).toHaveCount(1)
    await page.waitForTimeout(1200)
    await stop.click() // tap again: posted
  }
  // on its part at once, while Taska is still to answer; the box empty
  await expect
    .poll(() => countsOn(page, '#r3').then((c) => c.filter((x) => !x.draft).length), { timeout: 2500 })
    .toBe(1)
  await expect(box(page)).toHaveValue('')
  await expect
    .poll(async () => (await p.read('D1')).includes('part of the page: Write CSV'), { timeout: 60000 })
    .toBe(true)
  expect(await countsOn(page, '#r3')).toHaveLength(1)
})

// ---------------------------------------------------------------- r672: any page, an app too

test('r672: a page as tall as its window (an app) fills what the pane shows, and does not grow without end', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    ...LOOP,
    then: `${LOOP.then}T4 html App page
  <!doctype html><html><body style="margin:0;min-height:100vh;display:flex;flex-direction:column;font:15px sans-serif"><header style="padding:12px">Release planner</header><main style="flex:1;padding:12px">Three cards are waiting.</main><footer id="foot" style="padding:12px">Footer</footer></body></html>
`,
  })
  await open(page, p, 'D1')
  await expect(page1(page).getByText('Footer')).toBeVisible()
  const frame = page.locator('iframe').first()
  await page.waitForTimeout(800)
  const one = await frame.boundingBox()
  await page.waitForTimeout(2000)
  const two = await frame.boundingBox()
  if (!one || !two) throw new Error('not drawn')
  expect(two.height).toBe(one.height)
  // the app's footer is at the bottom of what the pane shows, in view: above the input box when the box is under it
  const strip = await foot(page).filter({ visible: true }).boundingBox()
  let end = page.viewportSize()?.height || 0
  if (strip && strip.y > one.y && strip.x < one.x + one.width && strip.x + strip.width > one.x) end = Math.min(end, strip.y)
  expect(one.y + one.height).toBeLessThanOrEqual(end + 1)
  expect(one.y + one.height).toBeGreaterThan(end - 140)
  await expect(page1(page).getByText('Footer')).toBeInViewport()
})

// a board the page draws itself: a button moves the first card to the other column, another hides the board
const BOARD = `${LOOP.then}T4 html Board page
  <!doctype html><html><body style="margin:0;padding:20px;font:15px sans-serif"><button id="move">Move the first card</button> <button id="hide">Hide the board</button><div id="board" style="display:flex;gap:12px;margin-top:12px"><div id="todo" style="flex:1;border:1px solid #ccc;padding:8px;min-height:140px"></div><div id="done" style="flex:1;border:1px solid #ccc;padding:8px;min-height:140px"></div></div><script>
  let at = 'todo'
  const draw = () => { for (const c of ['todo', 'done']) document.getElementById(c).innerHTML = (c === at ? '<div class="card" data-id="7" style="padding:8px;border:1px solid #999">Sketch the onboarding</div>' : '') + '<div class="card" data-id="' + (c === 'todo' ? 8 : 9) + '" style="padding:8px;border:1px solid #999;margin-top:8px">Card in ' + c + '</div>' }
  draw()
  document.getElementById('move').onclick = () => { at = 'done'; draw() }
  document.getElementById('hide').onclick = () => { document.getElementById('board').style.display = 'none' }
  </script></body></html>
`

test("r672 r799: a comment stays with its part when the page's own script moves it, and hides with it; the page's buttons work on the phone too", async ({
  page,
  request,
}) => {
  const p = await project(request, { ...LOOP, then: BOARD })
  await open(page, p, 'D1')
  const card = '[data-id="7"]'
  await expect(page1(page).locator(card)).toBeVisible()
  if (isDesk(page)) await commentMode(page).click()
  await commentOn(page, card, 'Who draws it?')
  await expect.poll(() => countsOn(page, card).then((c) => c.length), { timeout: 1500 }).toBe(1)
  await closeComments(page, 'Board page')
  if (isDesk(page)) await commentMode(page).click() // reading again: the page's buttons are its own
  const before = await page1(page).locator(card).boundingBox()
  await page1(page).locator('#move').click()
  await expect.poll(async () => (await page1(page).locator(card).boundingBox())?.x).not.toBe(before?.x) // moved
  await expect.poll(() => countsOn(page, card).then((c) => c.length), { timeout: 1500 }).toBe(1)
  expect(await countsOn(page, '[data-id="8"]')).toHaveLength(0) // not left on the card now where it was
  await page1(page).locator('#hide').click()
  await expect(page.locator(PAGE_COUNTS).filter({ visible: true })).toHaveCount(0)
  // and it can still be read: under the page (a desktop wide enough has it in the conversation beside instead)
  await expect(page.getByText('Not on the page now')).toBeVisible()
  await expect(page.getByText('Who draws it?').filter({ visible: true }).first()).toBeVisible()
})

test('r562: a resolved thread on a web page looks done, as beside a paragraph (B12)', async ({ page, request }) => {
  const p = await project(request, { ...LOOP, then: ROWS })
  for (const [id, quote] of [
    ['r1', 'Read list 720 ms'],
    ['r3', 'Write CSV 410 ms'],
  ])
    await p.op({ op: 'dc', d: 1, key: `h:[id='${id}']`, quote, text: 'Why?' })
  await open(page, p, 'D1')
  await expect.poll(() => countsOn(page, '#r1').then((c) => c.length)).toBe(1)
  const count = (id: string) => pageCount(page, `h:[id='${id}']`)
  await count('r1').click()
  await threadPop(page).getByRole('button', { name: 'Resolve', exact: true }).click()
  const bg = (id: string) => count(id).evaluate((b) => getComputedStyle(b).backgroundColor)
  await expect.poll(async () => (await bg('r1')) !== (await bg('r3'))).toBe(true) // the open one stays amber
})

test('r687: on the phone the line under a web page asks for a tap on a part: words selected there are only selected (B502)', async ({
  page,
  request,
}) => {
  test.skip(isDesk(page), 'the line is under the page on the phone')
  const p = await project(request, { ...LOOP, then: ROWS })
  await open(page, p, 'D1')
  await expect(page1(page).getByText('Write CSV')).toBeVisible()
  await expect(page.getByText('Tap a part of the page to comment on it')).toBeVisible()
  await expect(page.getByText(/select text or circle/)).toHaveCount(0)
})

const TILES = `${LOOP.then}T4 html Orders page
  <!doctype html><html><body style="margin:0;padding:24px;font:15px sans-serif"><h1>Orders</h1><div style="display:flex;gap:12px"><div id="t1" style="width:130px;padding:8px;border:1px solid #ddd">Avg. order value</div><div id="t2" style="width:130px;padding:8px;border:1px solid #ddd">Orders this week</div></div></body></html>
`
test("D83 #5 (r767 r774): a comment's count sits on its part's corner, half over its edge as a badge, not over a narrow part's words", async ({ page, request }) => {
  const p = await project(request, { ...LOOP, then: TILES })
  await p.op({ op: 'dc', d: 1, key: 'h:#t1', quote: 'Avg. order value', text: 'Per week?' })
  await open(page, p, 'D1')
  const count = pageCount(page, 'h:#t1')
  await expect(count).toBeVisible()
  const part = await page.frameLocator('iframe').first().locator('#t1').boundingBox(),
    c = await count.boundingBox()
  if (!part || !c) throw new Error('not drawn')
  expect(c.y).toBeGreaterThanOrEqual(part.y - 2) // level with the part's top
  expect(c.x + c.width).toBeGreaterThan(part.x + part.width) // half over its right edge
  expect(c.x).toBeGreaterThan(part.x + part.width - c.width) // covering only its corner
})
