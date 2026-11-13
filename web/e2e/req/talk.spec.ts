// Yadong's requirements on an item's talk (D29, "Lists and items"; T475, D45): each check is named by the codes of his
// inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/features/item/ src/features/composer/ src/app/voice/ src/ui/scroller.ts src/model/outgoing.ts src/app/inputs/delivered.ts src/ui/Markdown.tsx src/app/Tooltip.tsx src/app/actions.ts
import { expect, test, type Locator, type Page } from '@playwright/test'
import { isDesk, open, project, type Project } from '../seed'
import { box, boxMain, pane, recording, talk as talkOf, tip } from '../ui'

// a voice reply is recorded from the test browser's fake microphone (B770)
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } })

const lines = (n: number, what: string) => Array.from({ length: n }, (_, i) => `  ${what} line ${i + 1}`).join('\n')

test('r479: the latest message is open in full up to 50 lines; longer, it is cut with a way to show it all', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    agent: 'new task P1 now Notes from the call\n',
    approve: ['T1'],
    then: `T1 say Here is what we agreed\n${lines(39, 'Agreed')}\n`,
  })
  await open(page, p, 'T1')
  const talk = pane(page)
  await expect(talk.getByText('Agreed line 39')).toBeVisible()
  await expect(talk.getByRole('button', { name: /^Show (all|more)$/ })).toHaveCount(0)
  await p.doAs(`T1 say And the long list\n${lines(60, 'Long')}\n`)
  await expect(talk.getByText(/And the long list/)).toBeAttached()
  await expect(talk.getByRole('button', { name: /^Show (all|more)$/ }).filter({ visible: true }).last()).toHaveText(
    /Show (all|more)/,
  )
})

test('r368: a code in a message is a link to its item, and pointing at it shows the item', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    agent: 'new task P1 now Notes from the call\nnew bug P0 now Export ignores the filter\n',
    approve: ['T1', 'B2'],
    then: 'T1 say The export bug is B2, fixed next\n',
  })
  await open(page, p, 'T1')
  const code = pane(page).locator('[data-ref="B2"]').filter({ visible: true }).first()
  await expect(code).toBeVisible()
  if (isDesk(page)) {
    await code.hover()
    await expect(tip(page).and(page.locator('[data-card]'))).toContainText('Export ignores the filter')
  }
  await code.click()
  await expect(page).toHaveURL(/\/B0*2(\?|$)/)
})

// B507: how far down the talk a thing is drawn
const top = async (l: Locator) => (await l.boundingBox())?.y ?? NaN

test('r693: a card you replied on instead of deciding stays where it was, updated, and your reply comes after it; a card nothing came after is still last (B507)', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    agent: `new idea P2 now Proposed with no words
new task P2 now Some work
new idea P2 now A proposal
new task P2 now Still waits
`,
    approve: ['T2', 'T4'],
    then: 'I3 propose Do it this way.\nT2 done Finished: it works.\nT4 say Started.\n',
  })
  for (const n of [1, 2, 3]) await p.op({ op: 'input', text: 'Let us talk first', scope: n })
  await p.op({ op: 'input', text: 'Go ahead', scope: 4 })
  await p.doAs('T4 done Finished too.\n')
  const talk = talkOf(page).filter({ visible: true })
  const card = (text: string) => talk.locator('section').filter({ hasText: text }).first()
  const words = (text: string) => talk.getByText(text, { exact: true }).first()
  const above = (a: Locator, b: Locator, what: string) =>
    expect.poll(async () => (await top(a)) < (await top(b)), what).toBe(true)
  // a proposal and finished work: the card, updated, where it was; your reply after it
  // (finished work you reply on goes back to work, B607/B606: its card says Sent back)
  for (const [code, said, shown] of [
    ['I3', 'Do it this way.', 'Skipped · you replied'],
    ['T2', 'Finished: it works.', 'Sent back'],
  ]) {
    await open(page, p, code)
    await expect(card(shown)).toBeVisible()
    await expect(words('Let us talk first')).toBeAttached()
    await above(card(shown), words('Let us talk first'), `${code}: the card above your reply`)
    await above(words(said), words('Let us talk first'), `${code}: what the agent said above your reply`)
  }
  // an agent's item with no words of its own: its card heads the talk, before your reply; deciding keeps it there
  await open(page, p, 'I1')
  await expect(card('Skipped · you replied')).toBeVisible()
  await above(card('Skipped · you replied'), words('Let us talk first'), 'I1: the card above your reply')
  await card('Skipped · you replied').getByRole('button', { name: /^Approve/ }).click()
  await expect.poll(async () => p.read('I1')).toMatch(/^I0*1 \w+ P\d \w+ open/)
  await expect(card('proposed this').getByRole('button', { name: 'Approved', exact: true })).toBeVisible()
  await above(card('proposed this'), words('Let us talk first'), 'I1 approved: the card above your reply')
  // nothing said after it: the card still waits, last, after all that came before it
  await open(page, p, 'T4')
  const waits = card('Finished too.')
  await expect(waits.getByRole('button', { name: /^Accept/ })).toBeVisible()
  for (const before of ['Started.', 'Go ahead']) await above(words(before), waits, `T4: ${before} above the card`)
})

test('T589 #10486: an item opens at its latest message, and what you send and the reply to it show; the phone as the desktop', async ({
  page,
  request,
}) => {
  const steps = Array.from({ length: 8 }, (_, i) => `T1 say Step ${i + 1} done\n${lines(6, `Step ${i + 1}`)}`).join('\n')
  const p = await project(request, {
    agent: `new task P1 now Notes from the call\n${lines(30, 'Body')}\n`,
    approve: ['T1'],
    then: `${steps}\nT1 say The last word so far\n`,
  })
  await open(page, p, 'T1')
  const seen = (text: string) => expect(page.getByText(text, { exact: true }).filter({ visible: true }).last()).toBeInViewport()
  await seen('The last word so far')
  // opened at its end, not its top: in one column the title is scrolled out of sight
  if (!isDesk(page)) await expect(page.locator('[data-part=item-title]')).not.toBeInViewport()
  await box(page).fill('Friday then')
  await boxMain(page).click()
  await seen('Friday then')
  await p.doAs('T1 say Friday it is\n')
  await seen('Friday it is')
})

/** `eachFrame(look)` in the page: `look` runs as each frame is drawn, after the page's own ResizeObservers ran (they
 * keep the talk at its end) and before it is painted, for as long as it says true. An observer made after the page's,
 * of a probe resized every frame, runs then (B770: a look from a task between frames also saw the page's changes
 * before those observers ran, as frames that were never painted). */
const frames = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { eachFrame?: (look: () => boolean) => void }
    w.eachFrame ??= (look) => {
      const probe = document.createElement('div')
      probe.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;visibility:hidden;pointer-events:none'
      document.body.append(probe)
      const ro = new ResizeObserver(() => {
        if (look()) return
        ro.disconnect()
        probe.remove()
      })
      ro.observe(probe)
      let n = 0
      const tick = () => {
        if (!probe.isConnected) return
        probe.style.width = `${1 + (++n % 2)}px`
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }
  })
type Frames = { eachFrame: (look: () => boolean) => void }

// B719: what scrolls the talk, looked at as each frame is drawn: the frames it did not show its end, the most it went
// up in a frame, the most times the words sent showed
async function watchEnd(page: Page, words: string) {
  await frames(page)
  await page.evaluate((words) => {
    const talk = [...document.querySelectorAll<HTMLElement>('[data-item-talk]')].find((e) => e.getClientRects().length)
    let sc: HTMLElement | null = talk ?? null
    while (sc && !/auto|scroll/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement
    if (!talk || !sc) throw new Error('no talk')
    const s = sc
    const w = { off: 0, up: 0, shown: 0, on: true }
    Object.assign(window, { b719: w })
    let was = s.scrollTop
    ;(window as unknown as Frames).eachFrame(() => {
      if (s.scrollHeight - s.scrollTop - s.clientHeight > 4) w.off++
      w.up = Math.max(w.up, Math.round(was - s.scrollTop))
      was = s.scrollTop
      let n = 0
      const texts = document.createTreeWalker(talk, NodeFilter.SHOW_TEXT)
      while (texts.nextNode()) if (texts.currentNode.textContent?.includes(words)) n++
      w.shown = Math.max(w.shown, n)
      return w.on
    })
  }, words)
  return () =>
    page.evaluate(() => {
      const w = (window as unknown as { b719: { off: number; up: number; shown: number; on: boolean } }).b719
      w.on = false
      return { off: w.off, up: w.up, shown: w.shown }
    })
}

test('B719 r1178: replying keeps the talk at its end and it never jumps: the box shrinking, Taska’s news of the reply before its answer to the send, the agent’s reply; the phone as the desktop', async ({
  page,
  request,
}) => {
  const steps = Array.from({ length: 8 }, (_, i) => `T1 say Step ${i + 1} done\n${lines(6, `Step ${i + 1}`)}`).join('\n')
  const p = await project(request, {
    agent: `new task P1 now Notes from the call\n${lines(30, 'Body')}\n`,
    approve: ['T1'],
    then: `${steps}\nT1 say The last word so far\n`,
  })
  // Taska's answer to the send comes after its news of it, as on a slow network
  await page.route(/\/api\/commands/, async (route) => {
    const r = await route.fetch()
    await new Promise((ok) => setTimeout(ok, 800))
    await route.fulfill({ response: r })
  })
  await open(page, p, 'T1')
  await expect(page.getByText('The last word so far', { exact: true }).filter({ visible: true }).last()).toBeInViewport()
  await page.waitForTimeout(1500) // the page settled, done with its own scrolls to the end on opening
  // a reply of a few lines: the box grows as it is written (on the phone the page round the talk gets shorter)...
  const said = 'Friday then, all of it'
  const writing = await watchEnd(page, said)
  await box(page).fill(`${said}\nline two\nline three\nline four\nline five`)
  await page.waitForTimeout(500)
  // (a frame or two late at most, as the box grows by five lines at once)
  expect((await writing()).off, 'writing: at its end').toBeLessThanOrEqual(3)
  // ...and shrinks as it goes
  const sent = await watchEnd(page, said)
  await boxMain(page).click()
  await expect.poll(async () => (await p.read('T1')).includes(said)).toBe(true)
  await page.waitForTimeout(1500)
  expect(await sent(), 'after sending: at its end all along, never up, shown once').toEqual({ off: 0, up: 0, shown: 1 })
  // the agent's reply comes: at its end still
  const reply = await watchEnd(page, 'Friday it is')
  await p.doAs('T1 say Friday it is\n')
  await expect(page.getByText('Friday it is', { exact: true }).filter({ visible: true }).last()).toBeInViewport()
  await page.waitForTimeout(500)
  expect(await reply(), 'the reply: at its end all along, never up, shown once').toEqual({ off: 0, up: 0, shown: 1 })
})

/** Taska hearing a voice note as its models would (the Taska of the checks has none): every note's record is what the
 * check says (its words being worked out, its first words, its final words), in Taska's answers and as news of its
 * own when the check says it, as Taska tells the page of a record that changed. */
async function hearing(page: Page) {
  const seen = new Set<string>()
  let rec: Record<string, string> = { state: 'wait', said: '', tidied: '' }
  let told: (() => void)[] = []
  type Answer = { voices?: { f: string }[] }
  const ours = (a: Answer): Answer => {
    for (const v of a.voices || []) seen.add(v.f)
    return a.voices ? { ...a, voices: a.voices.map((v) => ({ ...v, ...rec, f: v.f })) } : a
  }
  await page.route(/\/api\/(view|changes)\b/, async (route) => {
    const url = new URL(route.request().url())
    const news = url.pathname.endsWith('/changes')
    let tell = () => {}
    const now = new Promise<'told'>((ok) => (tell = () => ok('told')))
    if (news) told.push(tell)
    const real = route.fetch().then((r) => r.json() as Promise<Answer>, () => null)
    const got = await Promise.race([real, now])
    told = told.filter((t) => t !== tell)
    if (got === 'told')
      return route.fulfill({ json: { cursor: url.searchParams.get('cursor'), full: false, voices: [...seen].map((f) => ({ f, ...rec })) } })
    if (!got) return route.abort().catch(() => {})
    return route.fulfill({ json: ours(got) })
  })
  // as on a slow network: Taska's answers to the upload and the send come after its news of them
  await page.route(/\/api\/(file|commands)\b/, async (route) => {
    const r = await route.fetch()
    await new Promise((ok) => setTimeout(ok, 800))
    await route.fulfill({ response: r })
  })
  return {
    notes: () => seen.size,
    /** the note's record is now this, and Taska says so */
    tell: (r: Record<string, string>) => {
      rec = { state: 'wait', said: '', tidied: '', ...r }
      told.splice(0).forEach((t) => t())
    },
  }
}

/** B770: a voice reply recorded and sent from the item's box, its words told by `h` as they come: the first words, then the final
 * ones in their place. */
async function voiceReply(page: Page, p: Project, h: Awaited<ReturnType<typeof hearing>>, first: string, final: string) {
  const mic = page.locator('#composer').getByRole('button', { name: 'Record a voice note', exact: true }).filter({ visible: true }).last()
  const at = await mic.boundingBox()
  if (!at) throw new Error('no mic')
  await mic.click()
  await expect(recording(page)).toBeVisible()
  await expect(recording(page)).toContainText(/\b0:0[1-9]\b/, { timeout: 15000 })
  await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2) // the same place is Stop and send
  await expect(recording(page)).toBeHidden()
  await expect.poll(() => h.notes(), { timeout: 15000 }).toBeGreaterThan(0)
  await expect.poll(async () => /voice/i.test(await p.read('T1'))).toBe(true) // Taska has it
  await page.waitForTimeout(1000) // Sent · transcribing…
  h.tell({ early: first })
  await expect(page.getByText(first, { exact: true }).filter({ visible: true }).last()).toBeVisible()
  await page.waitForTimeout(1000) // confirming
  h.tell({ state: 'done', said: final, tidied: final })
  await expect(page.getByText(final, { exact: true }).filter({ visible: true }).last()).toBeVisible()
  await page.waitForTimeout(800)
}

// the final words much as the first ones: the bubble gets a line shorter as its "confirming" goes
const FIRST = 'First words of it'
const FINAL = 'First words of it, as heard in the end'

test('B770 r1292: replying by voice at the talk’s end keeps it at its end: recording, sent, transcribing, the first words, the final words in their place; it never goes up; the phone as the desktop', async ({
  page,
  request,
}) => {
  const steps = Array.from({ length: 8 }, (_, i) => `T1 say Step ${i + 1} done\n${lines(6, `Step ${i + 1}`)}`).join('\n')
  const p = await project(request, {
    agent: `new task P1 now Notes from the call\n${lines(30, 'Body')}\n`,
    approve: ['T1'],
    then: `${steps}\nT1 say The last word so far\n`,
  })
  const h = await hearing(page)
  await open(page, p, 'T1')
  await expect(page.getByText('The last word so far', { exact: true }).filter({ visible: true }).last()).toBeInViewport()
  await page.waitForTimeout(1500) // the page settled, done with its own scrolls to the end on opening
  const w = await watchEnd(page, FINAL)
  await voiceReply(page, p, h, FIRST, FINAL)
  const got = await w()
  expect({ off: got.off, up: got.up }, 'at its end all along, never up').toEqual({ off: 0, up: 0 })
})

test('B770 r1292: scrolled up to read, replying by voice moves the talk once, down to its end where the reply is (T589), and from then on never up nor away from its end: recording, sent, transcribing, the first words, the final words; the phone as the desktop', async ({
  page,
  request,
}) => {
  const steps = Array.from({ length: 8 }, (_, i) => `T1 say Step ${i + 1} done\n${lines(6, `Step ${i + 1}`)}`).join('\n')
  const p = await project(request, {
    agent: `new task P1 now Notes from the call\n${lines(30, 'Body')}\n`,
    approve: ['T1'],
    then: `${steps}\nT1 say The last word so far\n`,
  })
  const h = await hearing(page)
  await open(page, p, 'T1')
  await expect(page.getByText('The last word so far', { exact: true }).filter({ visible: true }).last()).toBeInViewport()
  await page.waitForTimeout(1500)
  if (isDesk(page)) {
    const at = await page.locator('[data-item-talk]').filter({ visible: true }).first().boundingBox()
    await page.mouse.move(at!.x + at!.width / 2, at!.y + at!.height / 2)
    await page.mouse.wheel(0, -400)
  } else {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.synthesizeScrollGesture', { x: 196, y: 300, yDistance: 400, speed: 1500, gestureSourceType: 'touch' })
    await cdp.detach()
  }
  await page.waitForTimeout(800)
  // what scrolls the talk, as each frame is drawn: the most it went up, and the frames off its end once it got there
  await frames(page)
  await page.evaluate(() => {
    const talk = [...document.querySelectorAll<HTMLElement>('[data-item-talk]')].find((e) => e.getClientRects().length)!
    let sc: HTMLElement | null = talk
    while (sc && !/auto|scroll/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement
    if (!sc || sc.scrollHeight - sc.clientHeight - sc.scrollTop < 200) throw new Error('not scrolled up')
    const s = sc
    const w = { up: 0, offAfter: 0, reached: false, on: true }
    Object.assign(window, { b770: w })
    let was = s.scrollTop
    ;(window as unknown as Frames).eachFrame(() => {
      const atEnd = s.scrollHeight - s.scrollTop - s.clientHeight <= 4
      if (w.reached && !atEnd) w.offAfter++
      if (atEnd) w.reached = true
      w.up = Math.max(w.up, Math.round(was - s.scrollTop))
      was = s.scrollTop
      return w.on
    })
  })
  await voiceReply(page, p, h, FIRST, FINAL)
  const got = await page.evaluate(() => {
    const w = (window as unknown as { b770: { up: number; offAfter: number; reached: boolean; on: boolean } }).b770
    w.on = false
    return { up: w.up, offAfter: w.offAfter, reached: w.reached }
  })
  expect(got, 'down to its end once, then at its end all along, never up').toEqual({ up: 0, offAfter: 0, reached: true })
})

test('B721 r1183: scrolled up right after an item opens, the talk stays where you scrolled it, never pulled back to its end; the phone (a finger) as the desktop (the wheel)', async ({
  page,
  request,
}) => {
  const steps = Array.from({ length: 8 }, (_, i) => `T1 say Step ${i + 1} done\n${lines(6, `Step ${i + 1}`)}`).join('\n')
  const p = await project(request, {
    agent: `new task P1 now Notes from the call\n${lines(30, 'Body')}\n`,
    approve: ['T1'],
    then: `${steps}\nT1 say The last word so far\n`,
  })
  // how far what scrolls the talk is from its end
  const away = () =>
    page.evaluate(() => {
      const talk = [...document.querySelectorAll<HTMLElement>('[data-item-talk]')].find((e) => e.getClientRects().length)
      let sc: HTMLElement | null = talk ?? null
      while (sc && !/auto|scroll/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement
      return sc ? Math.round(sc.scrollHeight - sc.clientHeight - sc.scrollTop) : -1
    })
  for (const wait of [150, 500]) {
    await open(page, p, 'T1')
    await expect(page.getByText('The last word so far', { exact: true }).filter({ visible: true }).last()).toBeInViewport()
    await page.waitForTimeout(wait) // still settling: its own scrolls to the end on opening not all done
    if (isDesk(page)) {
      const at = await page.locator('[data-item-talk]').filter({ visible: true }).first().boundingBox()
      await page.mouse.move(at!.x + at!.width / 2, at!.y + at!.height / 2)
      await page.mouse.wheel(0, -300)
    } else {
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Input.synthesizeScrollGesture', { x: 196, y: 300, yDistance: 300, speed: 1500, gestureSourceType: 'touch' })
      await cdp.detach()
    }
    await expect.poll(away).toBeGreaterThan(100)
    const left = await away()
    const seen: number[] = []
    for (let i = 0; i < 50; i++) {
      seen.push(await away())
      await page.waitForTimeout(30)
    }
    expect(Math.min(...seen), `opened ${wait} ms before: stays scrolled up (${seen.join(',')})`).toBeGreaterThanOrEqual(left - 20)
  }
})
