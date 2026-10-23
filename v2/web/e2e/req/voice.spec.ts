// Yadong's requirements on voice notes (D29, "The input box", "Details"; T475, D45): each check is named by the codes of
// his inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/components/Composer.tsx src/components/Talk.tsx src/components/Sheets.tsx src/components/Inputs.tsx src/lib/voice.ts src/lib/audio.ts src/lib/outbox.ts src/lib/drafts.ts src/lib/actions.ts
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { LOOP, isDesk, open, project } from '../seed'
import type { Project } from '../seed'

test.use({
  launchOptions: {
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
})

const voices = async (p: Project) => ((await p.read('inbox')).match(/voice/gi) || []).length

/** Start recording from the box's main button; -> where that button is. */
async function record(page: Page) {
  const mic = page.locator('#composer [data-act="mic"]').filter({ visible: true }).last()
  const at = await mic.boundingBox()
  if (!at) throw new Error('no mic')
  await mic.click()
  await expect(page.locator('#recBar')).toBeVisible()
  return { x: at.x + at.width / 2, y: at.y + at.height / 2 }
}

test('r245 r281: while recording, a second tap where the recording started sends it', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  const before = await voices(p)
  const at = await record(page)
  await page.waitForTimeout(1200) // a second of sound
  // the same place is now Stop and send
  await expect
    .poll(() =>
      page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-act]')?.getAttribute('data-act'), at),
    )
    .toBe('rec-send')
  await page.mouse.click(at.x, at.y)
  await expect(page.locator('#recBar')).toBeHidden()
  await expect(page.locator('#text')).toHaveValue('')
  await expect.poll(() => voices(p), { timeout: 15000 }).toBeGreaterThan(before)
})

test('r512: a voice note you sent never comes back to the box: it goes once the network is back, even after a reload', async ({
  page,
  context,
  request,
}) => {
  const p = await project(request, LOOP)
  await open(page, p)
  await page.reload() // the page is kept by the browser now, as after any visit
  await open(page, p)
  const before = await voices(p)
  const at = await record(page)
  await page.waitForTimeout(1200)
  await context.setOffline(true)
  await page.mouse.click(at.x, at.y)
  await expect(page.locator('#recBar')).toBeHidden()
  await page.reload()
  await page.locator('#text').waitFor()
  // not in the box: no words, no file waiting there
  await expect(page.locator('#text')).toHaveValue('')
  await expect(page.locator('#composer [data-act="unfile"], #composer [data-act="view-draft"]')).toHaveCount(0)
  await context.setOffline(false)
  await expect.poll(() => voices(p), { timeout: 20000 }).toBe(before + 1)
  await expect(page.locator('#composer [data-act="unfile"], #composer [data-act="view-draft"]')).toHaveCount(0)
})

test('r485 r497: the original words of a voice note float up when you point at it, and are not shown otherwise', async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP)
  const up = await request.post(`${p.url}api/file?name=${encodeURIComponent('voice 0-07.webm')}`, {
    headers: { 'Content-Type': 'audio/webm' },
    data: Buffer.from('not really sound'),
  })
  const f = (await up.json()) as { f: string }
  await request.post(`${p.url}api/op`, {
    data: { op: 'input', text: 'About the export', files: [{ f: f.f, name: 'voice 0-07.webm', mime: 'audio/webm' }] },
  })
  await open(page, p)
  if (!isDesk(page)) await page.locator('[data-act="tab"][data-tab="inputs"]').filter({ visible: true }).first().click()
  const chip = page.locator('button[data-act="play"]').filter({ visible: true }).first().locator('xpath=..')
  await expect(chip).toBeVisible()
  const words = page.locator('[data-act="as-said"]').filter({ visible: true })
  if (isDesk(page)) {
    await page.mouse.move(2, 2)
    await expect(words).toHaveCount(0)
    await expect(page.getByText('Original words', { exact: true }).filter({ visible: true })).toHaveCount(0)
    await chip.hover()
    await expect(words).toHaveCount(1)
    const [w, c] = [await words.boundingBox(), await chip.boundingBox()]
    if (!w || !c) throw new Error('not drawn')
    expect(w.y + w.height).toBeLessThanOrEqual(c.y + 1) // above the note, as over a selection
  } else {
    // the phone, with no pointing: a small icon at the end of the note, no words in a line of their own
    await expect(words).toHaveCount(1)
    const [w, c] = [await words.boundingBox(), await chip.boundingBox()]
    if (!w || !c) throw new Error('not drawn')
    expect(w.x + w.width).toBeLessThanOrEqual(c.x + c.width + 1)
    expect(w.y).toBeGreaterThanOrEqual(c.y - 1)
  }
  // opening them is quick: no wait of seconds for a note that has its words (r485)
  await words.first().click()
  await expect(page.getByText('Original words', { exact: true }).filter({ visible: true })).toBeVisible({
    timeout: 3000,
  })
})
