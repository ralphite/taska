// Yadong's requirements on voice notes (D29, "The input box", "Details"; T475, D45): each check is named by the codes of
// his inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/features/composer/ src/features/item/Talk.tsx src/features/inputs/ src/ui/Files.tsx src/app/voice/ src/app/inputs/ src/stores/box.ts src/stores/outbox.ts src/stores/noteVault.ts src/app/actions.ts
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { LOOP, isDesk, open, project } from '../seed'
import type { Project } from '../seed'
import { box, boxAux, boxMain, buttonAt, draftFiles, recording, tab, voiceChip } from '../ui'

test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } })

const voices = async (p: Project) => ((await p.read('inbox')).match(/voice/gi) || []).length

/** Start recording from the box's main button; -> where that button is. */
async function record(page: Page) {
  const mic = page.locator('#composer').getByRole('button', { name: 'Record a voice note', exact: true }).filter({ visible: true }).last()
  const at = await mic.boundingBox()
  if (!at) throw new Error('no mic')
  await mic.click()
  await expect(recording(page)).toBeVisible()
  return { x: at.x + at.width / 2, y: at.y + at.height / 2 }
}

/** A second of sound recorded, by the recording's own clock (not a fixed wait: a slow machine starts it late). */
const aSecond = (page: Page) =>
  expect(recording(page)).toContainText(/\b(0:0[1-9]|0:[1-5]\d|[1-9]\d*:\d\d)\b/, { timeout: 15000 })

/** The voice notes this browser keeps until Taska has them (IndexedDB taska-voice). */
const keptNotes = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((ok) => {
        const r = indexedDB.open('taska-voice', 1)
        r.onupgradeneeded = () => r.result.createObjectStore('notes', { keyPath: 'id' })
        r.onerror = () => ok(-1)
        r.onsuccess = () => {
          const q = r.result.transaction('notes', 'readonly').objectStore('notes').count()
          q.onsuccess = () => {
            r.result.close()
            ok(q.result)
          }
          q.onerror = () => ok(-1)
        }
      }),
  )

test('r245 r281: while recording, a second tap where the recording started sends it', async ({ page, request }) => {
  const p = await project(request, LOOP)
  await open(page, p)
  const before = await voices(p)
  const at = await record(page)
  await aSecond(page)
  // the same place is now Stop and send
  await expect.poll(() => buttonAt(page, at)).toBe('Stop and send')
  await page.mouse.click(at.x, at.y)
  await expect(recording(page)).toBeHidden()
  await expect(box(page)).toHaveValue('')
  await expect.poll(() => voices(p), { timeout: 15000 }).toBeGreaterThan(before)
})

test('r245 r281 T529: started from the small mic beside your words, a second tap there sends it', async ({
  page,
  request,
}) => {
  const p = await project(request, LOOP)
  await open(page, p)
  const before = await voices(p)
  await box(page).fill('About the export')
  const mic = boxAux(page)
  await expect(mic).toBeVisible()
  const b = await mic.boundingBox()
  if (!b) throw new Error('no small mic')
  const at = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  await mic.click()
  await expect(recording(page)).toBeVisible()
  await aSecond(page)
  // the same place is now Stop and send; the main button stops it into the box
  await expect.poll(() => buttonAt(page, at)).toBe('Stop and send')
  await expect(boxMain(page)).toHaveAccessibleName('Stop and put words in the box')
  await page.mouse.click(at.x, at.y)
  await expect(recording(page)).toBeHidden()
  await expect(box(page)).toHaveValue('')
  await expect.poll(() => voices(p), { timeout: 15000 }).toBeGreaterThan(before)
  expect(await p.read('inbox')).toContain('About the export') // your words went with it
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
  await aSecond(page)
  await context.setOffline(true)
  await page.mouse.click(at.x, at.y)
  await expect(recording(page)).toBeHidden()
  // the page has kept the note in this browser (its sound is put together a moment after Send): only then reload
  await expect.poll(() => keptNotes(page), { timeout: 15000 }).toBeGreaterThan(0)
  let tried = 0
  page.on('requestfailed', (r) => {
    if (r.url().includes('/api/file')) tried++
  })
  await page.reload()
  await box(page).waitFor()
  // not in the box: no words, no file waiting there
  await expect(box(page)).toHaveValue('')
  await expect(draftFiles(page)).toHaveCount(0)
  // offline long enough for its tries to space out (2, 4, 8 s): the next pause would be 16 s
  await expect.poll(() => tried, { timeout: 40000 }).toBeGreaterThanOrEqual(4)
  await context.setOffline(false)
  // "the moment it can go, it goes" (r512, B538): well inside that 16 s pause, even on a busy machine
  await expect.poll(() => voices(p), { timeout: 10000 }).toBe(before + 1)
  await expect(draftFiles(page)).toHaveCount(0)
})

test('r512 B538: a voice note that waited offline a while goes within seconds of the network coming back', async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(90000)
  const p = await project(request, LOOP)
  await open(page, p)
  const before = await voices(p)
  const at = await record(page)
  await aSecond(page)
  let tried = 0
  page.on('requestfailed', (r) => {
    if (r.url().includes('/api/file')) tried++
  })
  await context.setOffline(true)
  await page.mouse.click(at.x, at.y)
  await expect(recording(page)).toBeHidden()
  // offline long enough that the pause before its next try has grown to 16 s (tries after 2, 4 and 8 s): counted
  await expect.poll(() => tried, { timeout: 40000 }).toBeGreaterThanOrEqual(4)
  await context.setOffline(false)
  // well inside that 16 s pause, even on a busy machine
  await expect.poll(() => voices(p), { timeout: 10000 }).toBe(before + 1)
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
  // A sent note has already gone through transcription. Finish that step for the silent fixture before testing
  // that opening its original words is a single read, with no request to transcribe it again.
  await request.post(`${p.url}api/words?f=${encodeURIComponent(f.f)}`)
  await p.op({ op: 'input', text: 'About the export', files: [{ f: f.f, name: 'voice 0-07.webm', mime: 'audio/webm' }] })
  await open(page, p)
  if (!isDesk(page)) await tab(page, 'Inputs').click()
  const chip = voiceChip(page).locator('xpath=..')
  await expect(chip).toBeVisible()
  const words = page.getByRole('button', { name: 'Original words', exact: true }).filter({ visible: true })
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
  // they open from one question to Taska, not a second try that writes the note down again (that took seconds, r485,
  // B363); counted, not timed, so a busy machine does not fail it
  const asked: string[] = []
  page.on('request', (r) => {
    if (/\/api\/words\b/.test(r.url())) asked.push(r.method())
  })
  await words.first().click()
  // what opens is the words' own pop-up (its title); the bar you clicked may stay while the pointer is on the note
  await expect(page.getByRole('dialog', { name: 'Original words', exact: true })).toBeVisible({ timeout: 15000 })
  expect(asked).toEqual(['GET'])
})
