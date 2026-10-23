// Yadong's requirements on web page documents (F432; D29, "Documents"; T475, D45): each check is named by the codes of
// his inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/components/WebPage.tsx src/components/Doc.tsx src/lib/voice.ts src/lib/actions.ts src/lib/keys.ts
import { expect, test } from '@playwright/test'
import { LOOP, isDesk, open, project } from '../seed'

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
  await request.post(`${p.url}api/op`, {
    data: { op: 'dc', d: 1, key: A, quote: 'Ship option A today.', text: 'Why today?' },
  })
  await open(page, p, 'D1')
  const frame = page.frameLocator('iframe').first()
  await expect(frame.getByText('Ship option A today.')).toBeVisible()
  const count = page.locator(`[data-act="doc-thread"][data-key^="${A}"]`).filter({ visible: true }),
    ring = page.locator(`[data-ring="${A}"]`),
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
  await expect(page.locator('[data-act="page-say"]').filter({ visible: true })).toHaveCount(0) // nothing picked
  await page.mouse.move(0, 0)
  await expect(page.locator('[data-ring]')).toHaveCount(0)
  if (!isDesk(page)) return
  // a click outside the page closes it too (the document's name over it)
  await count.click()
  await expect(thread).toHaveCount(1)
  await page.getByText('Plan page', { exact: true }).filter({ visible: true }).first().click()
  await expect(thread).toHaveCount(0)
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
  const stop = page.locator('[data-act="page-say"].bg-red-600').filter({ visible: true }),
    ring = page.locator(`[data-ring="${A}"]`)
  const say = async () => {
    if (isDesk(page)) {
      await page.locator('[data-act="doc-inspect"]').click()
      const a = await frame.locator('#a').boundingBox()
      if (!a) throw new Error('not drawn')
      await page.mouse.move(a.x + 40, a.y + a.height / 2, { steps: 4 })
      const mic = page.locator(`[data-act="page-say"][data-key="${A}"]`).filter({ visible: true })
      const m = await mic.boundingBox()
      if (!m) throw new Error('no mic')
      await page.mouse.move(m.x + m.width / 2, m.y + m.height / 2, { steps: 10 })
      await mic.click()
    } else {
      await frame.locator('#a').click()
      await page.locator(`[data-act="page-say"][data-key="${A}"]`).filter({ visible: true }).click()
    }
    await expect(stop).toHaveCount(1)
    await expect(stop).toHaveAttribute('data-key', A)
    await expect(ring).toHaveCount(1)
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
    await expect(page.locator('#scope')).toContainText('Ship option A today.')
    await page.locator(`[data-act="page-say"][data-key="${A}"]`).filter({ visible: true }).click()
    await expect(stop).toHaveCount(1)
    await expect(stop).toHaveAttribute('data-key', A)
    await page.keyboard.press('Escape')
  } else {
    await expect(page.locator('[data-rec-time]').filter({ visible: true })).toBeVisible()
    await page.locator('[data-act="doc-say-cancel"]').filter({ visible: true }).click()
  }
  await expect(stop).toHaveCount(0)
})
