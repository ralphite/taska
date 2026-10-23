// The box keeps its height while you record, whatever else the page draws meanwhile (B481); the line on top names what
// it writes to as the page does everywhere (T529).
// guards: src/components/Composer.tsx src/components/Shell.tsx src/components/Detail.tsx src/components/Talk.tsx src/lib/voice.ts src/lib/audio.ts src/lib/outbox.ts src/lib/drafts.ts
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from './seed'

test.use({
  launchOptions: {
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
})

test('a pasted link keeps the box still while you record and agents write (B481)', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await page.goto(p.url + 'new')
  const box = page.locator('#composer'),
    height = async () => Math.round((await box.boundingBox())?.height || 0)
  // on the desktop it fits the box's whole width, but not beside its buttons
  await page.locator('#text').fill('http://localhost:8088/screenshot/2bc31034eb91e7e6ce3bd81f29dbaab7.png ')
  const before = await height()
  await page.locator('#composer [data-act="mic"]').filter({ visible: true }).first().click()
  await expect(page.locator('#recBar')).toBeVisible()
  const seen = new Set<number>()
  for (let i = 1; i <= 4; i++) {
    await p.doAs(`T4 progress step ${i}`) // each write reaches the page and draws it again
    await page.waitForTimeout(800)
    seen.add(await height())
  }
  expect([...seen]).toEqual([before])
  await page.locator('#composer [data-act="rec-cancel"]').click()
})

test('what scrolls shows only around the top of the box: from its middle down the page covers it, and the end clears the box (F478)', async ({
  page,
  request,
}) => {
  const many = Array.from(
    { length: 30 },
    (_, i) => `new task P2 now Item number ${i + 1} with a title long enough`,
  ).join('\n')
  const p = await project(request, {
    agent: `${many}\nnew task P1 now A long one\n${Array.from({ length: 60 }, (_, i) => `  Line ${i + 1} of the body.`).join('\n')}\n`,
    approve: Array.from({ length: 31 }, (_, i) => `T${String(i + 1).padStart(2, '0')}`),
  })
  await open(page, p, isDesk(page) ? 'T31' : '')
  const scroller = page.locator(isDesk(page) ? '#detailBody' : '#list')
  // the page's own colour from the box's middle to the bottom of the screen
  const cover = await page.evaluate(() => {
    const f = document.getElementById('foot') as HTMLElement,
      b = (document.getElementById('composer') as HTMLElement).getBoundingClientRect(),
      a = getComputedStyle(f, '::after'),
      top = f.getBoundingClientRect().top + parseFloat(a.top)
    return { top, middle: b.top + b.height / 2, bg: a.backgroundColor, bottom: f.getBoundingClientRect().bottom }
  })
  expect(Math.abs(cover.top - cover.middle)).toBeLessThan(2)
  expect(cover.bg).not.toBe('rgba(0, 0, 0, 0)')
  expect(cover.bottom).toBeGreaterThanOrEqual((page.viewportSize()?.height || 0) - 1)
  // scrolled to the end, the last thing ends where the scroller's content ends: clear above the box
  await scroller.evaluate((e) => (e.scrollTop = e.scrollHeight))
  const gap = await scroller.evaluate((e) => {
    const r = e.getBoundingClientRect(),
      end = r.bottom - parseFloat(getComputedStyle(e).paddingBottom),
      box = (document.getElementById('foot') as HTMLElement).getBoundingClientRect().top
    return { gap: box - end, under: r.bottom >= box }
  })
  expect(gap.under).toBe(true) // it runs on under the box, around its top corners
  const gapPx = gap.gap
  expect(gapPx).toBeGreaterThanOrEqual(20)
})

test('in two columns the line between them is one line to the bottom of the screen, and the item beside the box can be pointed at (B495)', async ({
  page,
  request,
}) => {
  test.skip(!isDesk(page), 'two columns are for a wide desktop pane')
  await page.setViewportSize({ width: 1920, height: 1000 })
  const p = await project(request, {
    agent: `new task P1 now A long one\n${Array.from({ length: 60 }, (_, i) => `  Line ${i + 1} of the body.`).join('\n')}\n`,
    approve: ['T1'],
  })
  await open(page, p, 'T1')
  await expect(page.locator('#app')).toHaveAttribute('data-duo', '')
  const at = await page.evaluate(() => {
    const g = (document.querySelector('[data-grip="duo"]') as HTMLElement).getBoundingClientRect(),
      f = (document.getElementById('foot') as HTMLElement).getBoundingClientRect(),
      x = g.left - 200,
      hit = document.elementFromPoint(x, innerHeight - 10)
    return {
      lineEnd: g.bottom,
      lineRight: g.right,
      footLeft: f.left,
      height: innerHeight,
      inFoot: !!hit?.closest('#foot'),
    }
  })
  expect(at.lineEnd).toBeGreaterThanOrEqual(at.height - 1) // one line, top to bottom: no second piece under the box
  expect(at.footLeft).toBeGreaterThanOrEqual(at.lineRight - 1) // the box's row is the talk's column only
  expect(at.inFoot).toBe(false) // the item's column runs down beside the box, free to point at and scroll
  // the talk, scrolled to its end, still ends clear above the box
  const gap = await page.locator('#itemTalk').evaluate((e) => {
    e.scrollTop = e.scrollHeight
    const end = e.getBoundingClientRect().bottom - parseFloat(getComputedStyle(e).paddingBottom)
    return (document.getElementById('foot') as HTMLElement).getBoundingClientRect().top - end
  })
  expect(gap).toBeGreaterThanOrEqual(20)
})

test('correcting a word of a voice note names the input as the page does everywhere: #20, not r20 (T529)', async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP)
  const up = await request.post(`${p.url}api/file?name=${encodeURIComponent('voice 0-07.webm')}`, {
    headers: { 'Content-Type': 'audio/webm' },
    data: Buffer.from('not really sound'),
  })
  const f = (await up.json()) as { f: string }
  const said = await request.post(`${p.url}api/op`, {
    data: {
      op: 'input',
      text: 'About the export format',
      scope: 'T4',
      files: [{ f: f.f, name: 'voice 0-07.webm', mime: 'audio/webm' }],
    },
  })
  const id = ((await said.json()) as { res: string[] }).res[0].split(' ')[1]
  await open(page, p, 'T4') // in the item's thread
  const note = page.locator(`[data-voice="${id}"]`).filter({ visible: true }).first()
  await expect(note).toBeVisible()
  // select "export" in what it said, as with the mouse or a finger
  await note.evaluate((el) => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      const i = (t.textContent || '').indexOf('export')
      if (i < 0) continue
      const r = document.createRange()
      r.setStart(t, i)
      r.setEnd(t, i + 'export'.length)
      getSelection()?.removeAllRanges()
      getSelection()?.addRange(r)
      return
    }
  })
  await page.locator('#fixBtn').click()
  const line = page.locator('#scope')
  await expect(line).toContainText('Correct “export”')
  await expect(line).toContainText(`in #${id.slice(1)} · remembered for every project`)
  await expect(line).not.toContainText(`in ${id}`)
})
