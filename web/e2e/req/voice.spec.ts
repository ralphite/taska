// Yadong's requirements on voice notes (D29, "The input box", "Details"; T475, D45): each check is named by the codes of
// his inputs, so a change that breaks one is stopped before it ships with his own words.
// guards: src/features/composer/ src/features/task/Talk.tsx src/features/inputs/ src/ui/Files.tsx src/app/voice/ src/app/inputs/ src/stores/box.ts src/stores/outbox.ts src/stores/noteVault.ts src/app/actions.ts src/app/search/finder.ts
// layouts: phone desktop phone-webkit
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { LOOP, isDesk, open, project } from '../seed'
import type { Project } from '../seed'
import { box, boxAux, boxMain, buttonAt, docEdit, docHint, docMic, draftFiles, fakeMic, recording, tab, voiceChip } from '../ui'

test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } })

// Safari's engine runs the check of the iPhone's microphone (T800) only; the rest are Chromium's, on the phone and the desktop
test.beforeEach(async ({ page, browserName }, info) => {
  test.skip(browserName === 'webkit' && !info.title.startsWith('T800'), "Chromium's check")
  if (browserName === 'webkit') await fakeMic(page)
})

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
  // "the moment it can go, it goes" (r512, T538): well inside that 16 s pause, even on a busy machine
  await expect.poll(() => voices(p), { timeout: 10000 }).toBe(before + 1)
  await expect(draftFiles(page)).toHaveCount(0)
})

test('r512 T538: a voice note that waited offline a while goes within seconds of the network coming back', async ({
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

test('r485 r497 T640: pointing at a voice note shows its original words at once, beside it; the phone opens them from its icon', async ({
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
  const play = voiceChip(page)
  const chip = play.locator('xpath=..')
  await expect(chip).toBeVisible()
  const words = page.getByRole('button', { name: 'Original words', exact: true }).filter({ visible: true })
  // their words are already on the page: nothing asks Taska for them (counted, not timed)
  const asked: string[] = []
  page.on('request', (r) => {
    if (/\/api\/words\b/.test(r.url())) asked.push(r.method())
  })
  if (isDesk(page)) {
    // no button to press: pointing at play shows them in the page's tip, beside the note
    await page.mouse.move(2, 2)
    await expect(page.locator('#tip')).toBeHidden()
    await play.hover()
    const tip = page.locator('#tip')
    await expect(tip).toBeVisible()
    await expect(tip).toHaveAttribute('data-said', '')
    await expect(words).toHaveCount(0)
    const [t, c] = [await tip.boundingBox(), await chip.boundingBox()]
    if (!t || !c) throw new Error('not drawn')
    expect(t.y + t.height <= c.y + 1 || t.y >= c.y + c.height - 1, 'above or below the note, not over it').toBe(true)
    // T697: the words are in the tip at once; one read of the note's record (a GET) may follow for the steps that
    // worked them out, and nothing writes the note down again (no POST: that took seconds, r485, T363)
    expect(asked.length).toBeLessThanOrEqual(1)
    expect(asked.filter((m) => m !== 'GET')).toEqual([])
    return
  }
  // the phone, with no pointing: a small icon at the end of the note, no words in a line of their own
  await expect(words).toHaveCount(1)
  const [w, c] = [await words.boundingBox(), await chip.boundingBox()]
  if (!w || !c) throw new Error('not drawn')
  expect(w.x + w.width).toBeLessThanOrEqual(c.x + c.width + 1)
  expect(w.y).toBeGreaterThanOrEqual(c.y - 1)
  // they open from one question to Taska at most, not a second try that writes the note down again (that took
  // seconds, r485, T363)
  await words.first().click()
  await expect(page.getByRole('dialog', { name: 'Original words', exact: true })).toBeVisible({ timeout: 15000 })
  expect(asked.length).toBeLessThanOrEqual(1)
})

/** Taska opened from the Home Screen (an app of its own), and every microphone the page is given, counted and kept to
 * look at. Before the page opens (after `fakeMic`, which it wraps in WebKit). */
const homeScreenMics = (page: Page) =>
  page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => true })
    const media = window.matchMedia.bind(window)
    window.matchMedia = (q: string) => {
      const m = media(q)
      if (/display-mode:\s*standalone/.test(q)) Object.defineProperty(m, 'matches', { configurable: true, get: () => true })
      return m
    }
    const w = window as unknown as { mics: MediaStream[]; micAsked: number }
    w.mics = []
    w.micAsked = 0
    const ask = MediaDevices.prototype.getUserMedia
    Object.defineProperty(MediaDevices.prototype, 'getUserMedia', {
      configurable: true,
      value: async function (this: MediaDevices, c?: MediaStreamConstraints) {
        w.micAsked++
        const s = await ask.call(this, c)
        w.mics.push(s)
        return s
      },
    })
  })

/** How often the page asked for the microphone, and how many of the tracks it was given still hear (not ended). */
const mics = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { mics: MediaStream[]; micAsked: number }
    return { asked: w.micAsked, hearing: w.mics.flatMap((s) => s.getTracks()).filter((t) => t.readyState !== 'ended').length }
  })

test('T800 r1371: from the Home Screen, each recording opens the microphone and lets it go at its end: two voice notes, a spoken search, dictation into a document; the phone as the desktop', async ({
  page,
  request,
}) => {
  test.setTimeout(120000)
  await homeScreenMics(page)
  const p = await project(request, {
    agent: 'new P2 now Plan the export\n',
    approve: ['T1'],
    then: 'T1 doc The plan\n  Ship option A today.\n',
  })
  await open(page, p)
  expect(await page.evaluate(() => matchMedia('(display-mode: standalone)').matches)).toBe(true)
  // two voice notes, each recorded and sent from the box: each asks for the microphone, and at its end nothing hears
  for (const n of [1, 2]) {
    const before = await voices(p)
    const at = await record(page)
    await expect.poll(() => mics(page)).toEqual({ asked: n, hearing: 1 })
    await aSecond(page)
    await expect.poll(() => buttonAt(page, at)).toBe('Stop and send')
    await page.mouse.click(at.x, at.y)
    await expect(recording(page)).toBeHidden()
    await expect.poll(() => voices(p), { timeout: 15000 }).toBeGreaterThan(before)
    await expect.poll(() => mics(page), { message: `voice note ${n}: the microphone is let go` }).toEqual({ asked: n, hearing: 0 })
  }
  // a spoken search: the phone's search page listens at once, the desktop's dialog when you press Speak
  if (isDesk(page)) {
    await page.keyboard.press('ControlOrMeta+k')
    await page.locator('[data-part="search"]').getByRole('button', { name: 'Speak', exact: true }).click()
  } else {
    await page.getByRole('button', { name: 'Search', exact: true }).filter({ visible: true }).first().click()
  }
  const search = page.locator('[data-part="search"]').filter({ visible: true })
  await expect.poll(() => mics(page)).toEqual({ asked: 3, hearing: 1 })
  await search.getByRole('button', { name: 'Stop and search', exact: true }).click()
  await expect.poll(() => mics(page), { message: 'the spoken search: the microphone is let go' }).toEqual({ asked: 3, hearing: 0 })
  // dictation into a document being edited (the page opens afresh: what it counts starts again)
  await open(page, p, 'D1')
  await docEdit(page)
  await docMic(page).click()
  await expect(docHint(page)).toContainText('Listening')
  await expect.poll(() => mics(page)).toEqual({ asked: 1, hearing: 1 })
  await page.waitForTimeout(1000) // long enough to be heard, not thrown away as too short
  await docMic(page).click()
  await expect.poll(() => mics(page), { message: 'dictation: the microphone is let go' }).toEqual({ asked: 1, hearing: 0 })
})
