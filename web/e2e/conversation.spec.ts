// An item's conversation, where the Storybook review found it wrong (T529): message headers, a kept decision, agents'
// marks and names, the line under a comment on a document, and the original words of a moved input's voice note.
// guards: src/features/item/ src/ui/bits.tsx src/ui/Files.tsx src/model/agents.ts src/model/talk.ts
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Locator } from '@playwright/test'
import { LOOP, isDesk, open, project, type Project } from './seed'
import { pane } from './ui'

/** Agent commands as `by`, in its session `ses` when given. */
const doAs = async (request: APIRequestContext, p: Project, by: string, commands: string, ses = '') => {
  const out = await (
    await request.post(`${p.url}do?by=${by}${ses ? `&session=${ses}` : ''}`, {
      data: commands,
      headers: { 'Content-Type': 'text/plain' },
    })
  ).text()
  if (/^err/m.test(out)) throw new Error(out)
}
const op = async (_request: APIRequestContext, p: Project, data: Record<string, unknown>) => {
  const r = await p.op(data)
  if (!r.ok) throw new Error(r.res.join('\n'))
  return r.res[0]
}
/** A message of the open item's conversation, by words in it. */
const message = (page: Parameters<typeof open>[0], words: string) =>
  pane(page).locator('.group\\/msg').filter({ hasText: words }).filter({ visible: true }).first()
/** How many lines each part's words take (its words only, not the buttons in it). */
const linesOf = (parts: Locator) =>
  parts.evaluateAll((els) =>
    els.map((el) => {
      const tops = new Set<number>(),
        walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const r = document.createRange()
        r.selectNodeContents(n)
        for (const x of r.getClientRects()) if (x.width > 0) tops.add(Math.round(x.top))
      }
      return { text: (el.textContent || '').trim(), lines: tops.size }
    }),
  )

test('T529: on the phone a message header wraps between its parts, never inside one', async ({ page, request }) => {
  test.skip(isDesk(page), 'the phone is where the header has too little room')
  const p = await project(request, { agent: 'new task P2 now Ship the export\n', approve: ['T1'] })
  await doAs(request, p, 'claude-code', 'T1 decide @manager CSV first, JSON next week\n', 'worker')
  await open(page, p, 'T1')
  // the header's words are in its first part; More stands apart at its end (D115 #4)
  const head = message(page, 'CSV first').locator('> div').first().locator('> div').first()
  await expect(head).toContainText('Claude Code')
  await expect(head).toContainText('worker')
  await expect(head).toContainText('manager')
  const parts = await linesOf(head.locator('> span').filter({ hasText: /\S/ }))
  expect(parts.map((x) => x.text)).toEqual(expect.arrayContaining(['Claude Code', '· worker', '→ manager']))
  for (const x of parts) expect(x, `"${x.text}" stays on one line`).toMatchObject({ lines: 1 })
  // its More is pinned at the header's right end, over the bubble's edge, wherever the words end (D115 #4)
  const more = await message(page, 'CSV first').getByRole('button', { name: 'More for this message' }).boundingBox()
  const bubble = await message(page, 'CSV first').locator('> div').nth(1).boundingBox()
  expect(Math.abs(more!.x + more!.width - (bubble!.x + bubble!.width))).toBeLessThan(8)
})

test("T529: a decision kept on an answered question's card shows that choice's own icon, not a tick", async ({
  page,
  request,
}) => {
  const p = await project(request, {
    agent: 'new task P2 now Some work\nnew idea P2 now A proposal\n',
    approve: ['T1'],
    then: `T1 done Finished: it works.
T1 ask Ship it today?
  - ( ) Yes
  - ( ) Next week
I2 ask Worth doing?
  - ( ) Yes
  - ( ) No
`,
  })
  // answered, then decided: Not yet on the finished work, Won't do on the proposal
  await op(request, p, { op: 'input', text: '✓ Next week', scope: 1 })
  await op(request, p, { op: 'input', text: '✓ No', scope: 2 })
  await op(request, p, { op: 'set', ref: 'T1', f: { status: 'open' } })
  await op(request, p, { op: 'set', ref: 'I2', f: { status: 'dropped' } })
  const icon = async (code: string, label: string) => {
    await open(page, p, code)
    // by its name (its button holds its other words unseen, to keep its width: R4-2 #1)
    const kept = pane(page).getByRole('button', { name: label, exact: true, disabled: true })
    await expect(kept.filter({ visible: true })).toHaveCount(1)
    return kept
      .filter({ visible: true })
      .locator('svg')
      .evaluate((s) => s.innerHTML)
  }
  const tick = 'M20 6 9 17l-5-5'
  // said in the past tense once chosen (R3-4 #1): Sent back, Declined
  const notYet = await icon('T1', 'Sent back')
  expect(notYet).toContain('M3 3v5h5') // the reopen arrow, as on its button
  expect(notYet).not.toContain(tick)
  const wontDo = await icon('I2', 'Declined')
  expect(wontDo).toContain('m4.9 4.9 14.2 14.2') // the ban sign, as on its button
  expect(wontDo).not.toContain(tick)
})

test('D77 #10 r1003 r1007: finished work sent back with Not yet keeps both buttons where they were, greyed and not to be pressed', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    agent: 'new task P2 now Some work\n',
    approve: ['T1'],
    then: 'T1 done Finished: it works.\n',
  })
  await op(request, p, { op: 'set', ref: 'T1', f: { status: 'open' } })
  await open(page, p, 'T1')
  // the card keeps both buttons where they were, as they were (their icons too), greyed and not to be pressed
  // (r1003, r1007); Not yet, what you chose, said as done: Sent back (R3-4 #1)
  const kept = (label: string) => pane(page).getByRole('button', { name: new RegExp(`^${label}`) }).filter({ visible: true })
  await expect(kept('Sent back')).toBeDisabled()
  await expect(kept('Sent back').locator('svg').first()).toBeVisible()
  await expect(kept('Accept')).toHaveCount(1)
  await expect(kept('Accept')).toBeDisabled()
})

test('T529: two agents never share a mark, and an agent Taska has no name for is called by a name', async ({
  page,
  request,
}) => {
  const p = await project(request, { agent: 'new task P2 now Ship the export\n', approve: ['T1'] })
  await doAs(request, p, 'antigravity', 'T1 say Antigravity looked at it\n')
  await doAs(request, p, 'agent', 'T1 say An agent looked at it\n')
  await doAs(request, p, 'gemini', 'T1 say Gemini looked at it\n')
  await open(page, p, 'T1')
  const who = async (words: string) => {
    const head = message(page, words).locator('> div').first().locator('> div').first()
    return {
      mark: ((await head.locator('> span').nth(0).textContent()) || '').trim(),
      name: ((await head.locator('> span').nth(1).textContent()) || '').trim(),
    }
  }
  const [anti, agent, gemini] = [
    await who('Antigravity looked'),
    await who('An agent looked'),
    await who('Gemini looked'),
  ]
  expect([anti.name, agent.name, gemini.name]).toEqual(['Antigravity', 'Agent', 'Gemini'])
  expect(new Set([anti.mark, agent.mark, gemini.mark]).size, 'each agent its own mark').toBe(3)
})

test('T529: the line under your comment on a document has even gaps between its words', async ({ page, request }) => {
  const p = await project(request, {
    agent: 'new task P2 now Plan the export\n',
    approve: ['T1'],
    then: 'T1 doc The plan\n  Ship option A today.\n',
  })
  await op(request, p, { op: 'dc', d: 1, para: 1, quote: '', text: 'Why not B?' })
  await open(page, p, 'T1')
  const where = pane(page).getByRole('button', { name: /^on D0*1$/ })
  await expect(where.filter({ visible: true })).toHaveCount(1)
  // each word of the line (on D1 · 14:05), where it starts and ends; the gaps between them
  const words = await where.filter({ visible: true }).evaluate((b) => {
    const line = b.parentElement as HTMLElement,
      out: { w: string; l: number; r: number }[] = [],
      walk = document.createTreeWalker(line, NodeFilter.SHOW_TEXT)
    for (let n = walk.nextNode(); n; n = walk.nextNode())
      for (const m of (n.textContent || '').matchAll(/\S+/g)) {
        const r = document.createRange()
        r.setStart(n, m.index)
        r.setEnd(n, m.index + m[0].length)
        const box = r.getBoundingClientRect()
        const last = out.at(-1)
        // one word in two text nodes (D and 1) is one word
        if (last && Math.abs(box.left - last.r) < 0.5) Object.assign(last, { w: last.w + m[0], r: box.right })
        else out.push({ w: m[0], l: box.left, r: box.right })
      }
    return out
  })
  expect(words.map((x) => x.w).slice(0, 3)).toEqual(['on', 'D1', '·'])
  const gaps = words.slice(1).map((x, i) => x.l - words[i].r)
  expect(Math.max(...gaps) - Math.min(...gaps), `gaps ${gaps.map((g) => g.toFixed(1)).join(', ')}`).toBeLessThan(1)
})

test('T529 B640: on an input moved to another project, its voice note\'s original words show beside it under the pointer, over none of your words', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'pointing is the desktop; the phone has a mark for the original words beside the note')
  const p = await project(request, LOOP),
    q = await project(request)
  const up = await request.post(`${p.url}api/file?name=${encodeURIComponent('voice 0-07.webm')}`, {
    headers: { 'Content-Type': 'audio/webm' },
    data: Buffer.from('not really sound'),
  })
  const f = (await up.json()) as { f: string }
  const rid = (
    await op(request, p, {
      op: 'input',
      text: 'The user docs should start with the export, then the filters',
      scope: 4,
      files: [{ f: f.f, name: 'voice 0-07.webm', mime: 'audio/webm' }],
    })
  ).split(' ')[1]
  // the agent answered, you added details (a note of what changed, after its answer), then sent the input to the
  // project it belongs to: the input and its first words go, the note stays here
  await p.doAs('T4 say Noted, I will start with the export\n')
  await op(request, p, {
    op: 'amend',
    id: rid,
    mode: 'append',
    text: 'And a page on the filters, with a picture of each one and what it does to the export, in their order',
  })
  const answer = await request.post(`${p.url}api/move-input`, { data: { id: rid, to: q.name } })
  const moved = (await answer.json()) as { ok: boolean }
  expect(moved.ok).toBe(true)
  await open(page, p, 'T4')
  // The input's words and its voice note share one bubble (T668): its words, the note's pill under them.
  const play = page.getByRole('button', { name: 'Play the voice note, 0:07', exact: true })
  const mine = pane(page).locator('div').filter({ has: page.locator(`[data-voice="${rid}"]`) }).filter({ has: play }).last()
    .filter({ visible: true })
    .first()
  const words = mine.locator(`[data-voice="${rid}"] > :first-child`)
  await expect(words).toBeVisible()
  await mine.locator(play).first().hover()
  const tip = page.locator('#tip[data-said]')
  await expect(tip).toBeVisible()
  const [b, w] = [await tip.boundingBox(), await words.boundingBox()]
  if (!b || !w) throw new Error('not drawn')
  const apart = b.y >= w.y + w.height || b.y + b.height <= w.y || b.x >= w.x + w.width || b.x + b.width <= w.x
  expect(apart, `the words ${JSON.stringify(b)} are clear of yours ${JSON.stringify(w)}`).toBe(true)
})

test('D115 #5: while a new answer is on its way the card shows no Edit; it is back once Taska has the answer', async ({
  page,
  request,
}) => {
  const p = await project(request, {
    agent: 'new task P2 now Some work\n',
    approve: ['T1'],
    then: `T1 ask Which format?
  - ( ) CSV
  - ( ) Excel
`,
  })
  await op(request, p, { op: 'input', text: '✓ CSV', scope: 1 })
  let release = () => {}
  const held = new Promise<void>((ok) => (release = ok))
  await page.route(/\/api\/commands\b/, async (route) => {
    const o = route.request().postDataJSON() as { commands: { op: string }[] }
    if (!o.commands.some((x) => x.op === 'input')) return route.continue()
    await held
    await route.continue()
  })
  await open(page, p, 'T1')
  const card = pane(page).locator('section').filter({ hasText: 'asks you' }).filter({ visible: true }).first()
  const edit = card.getByRole('button', { name: 'Edit', exact: true })
  await card.hover()
  await edit.click()
  await card.getByRole('button', { name: /Excel/ }).first().click()
  await card.getByRole('button', { name: /^Send answer/ }).click()
  await expect(card).toContainText('Sending…')
  await expect(edit).toHaveCount(0)
  release()
  await expect(card).not.toContainText('Sending…')
  await card.hover()
  await expect(edit).toBeVisible()
})
