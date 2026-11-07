// Every Demo played from start to end as the check that it still works (T589): its Play pressed in the phone's frame
// and the desktop's, in a headless browser, on a static Storybook build. Fails when a step's part is not on the screen,
// a step was done before it began, the page asked for something no answer was recorded for (record it again:
// scripts/record-demo.mjs), or anything left the frame for a server. It also leaves each Demo alone for half a
// minute first: the page's long wait for news must be answered as the server answers it, never seen as offline.
//
//   node scripts/check-demos.mjs <storybook-static-dir> [--shots dir] [--video dir] [--quick]
//
// --shots: each frame at each step; --video: the played run; --quick: no half minute alone.

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { browser, demos, serveStorybook, storyUrl, untilDone } from './demo-run.mjs'

const args = process.argv.slice(2)
const dir = args[0]
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null)
const shots = opt('--shots')
const video = opt('--video')
if (!dir) {
  console.log('usage: node scripts/check-demos.mjs <storybook-static-dir> [--shots dir] [--video dir] [--quick]')
  process.exit(2)
}
for (const d of [shots, video]) if (d) mkdirSync(d, { recursive: true })
const LAYOUTS = ['phone', 'desk']

/** A request that left a Demo's frame for anything but the Storybook build's own files. */
const leaves = (sb, url) => !url.startsWith(sb + '/') || /^\/(api|dev)\/|^\/p\/[^/]+\/(api|do|agent|inbox)\b/.test(url.slice(sb.length))

/** What the frame's replay noted: requests it had no answer for, long waits answered "nothing new". */
const replayLog = (page, layout) => page.frames().find((f) => f.url().includes(`layout=${layout}`))?.evaluate(() => window.__demoLog)

async function check(b, sb, demo) {
  const bad = []
  // alone for half a minute: the page waits for news and is answered as the server answers, so it stays online
  if (!args.includes('--quick')) {
    const page = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage()
    await page.goto(storyUrl(sb, demo.story))
    await page.waitForTimeout(32000)
    for (const l of LAYOUTS) {
      const log = await replayLog(page, l)
      const frame = page.frames().find((f) => f.url().includes(`layout=${l}`))
      const offline = await frame?.getByText('Out of reach').count()
      if (!log?.nothingNew) bad.push(`${l}: the long wait for news was not answered "nothing new" after the wait`)
      if (offline) bad.push(`${l}: the page says it is out of reach while it waits`)
      if (log?.unmatched.length) bad.push(`${l}: asked for what was not recorded: ${log.unmatched.join(', ')}`)
      if ((await page.locator(`[data-tour][data-demo="${l}"]`).getAttribute('data-step')) !== '0') bad.push(`${l}: moved on by itself`)
    }
    await page.context().close()
  }
  // played to the end, both frames at once
  const context = await b.newContext({ viewport: { width: 1600, height: 1000 }, ...(video ? { recordVideo: { dir: video, size: { width: 1600, height: 1000 } } } : {}) })
  const page = await context.newPage()
  const left = []
  page.on('request', (r) => leaves(sb, r.url()) && left.push(r.url()))
  page.on('pageerror', (e) => bad.push(`page error: ${e.message}`))
  await page.goto(storyUrl(sb, demo.story))
  for (const l of LAYOUTS) await page.locator(`[data-tour][data-demo="${l}"]`).getByRole('button', { name: 'Play' }).click()
  const seen = {}
  const shoot = async () => {
    if (!shots) return
    for (const l of LAYOUTS) {
      const f = page.locator(`[data-tour][data-demo="${l}"]`)
      const step = await f.getAttribute('data-step')
      if (seen[l] === step) continue
      seen[l] = step
      await page.waitForTimeout(700) // the step's spot settles
      await f.screenshot({ path: join(shots, `${demo.id}-${l}-${String(Number(step) + 1)}.png`) })
    }
  }
  const timer = setInterval(() => void shoot().catch(() => {}), 400)
  try {
    await Promise.all(LAYOUTS.map((l) => untilDone(page, l, 120000)))
  } catch (e) {
    bad.push(e.message)
  }
  clearInterval(timer)
  await page.waitForTimeout(1500)
  await shoot()
  if (shots) await page.screenshot({ path: join(shots, `${demo.id}-both-end.png`) })
  for (const l of LAYOUTS) {
    const log = await replayLog(page, l)
    if (log?.unmatched.length) bad.push(`${l}: asked for what was not recorded: ${log.unmatched.join(', ')}`)
  }
  if (left.length) bad.push(`left the frame for a server: ${[...new Set(left)].join(', ')}`)
  await context.close()
  return bad
}

const sb = await serveStorybook(dir)
const b = await browser()
let failed = false
try {
  for (const demo of demos()) {
    const bad = await check(b, sb.url, demo)
    console.log(`${demo.id}: ${bad.length ? 'failed' : 'played to the end'}`)
    for (const x of bad) console.log(`  ${x}`)
    failed ||= bad.length > 0
  }
} finally {
  await b.close()
  sb.stop()
}
process.exit(failed ? 1 : 0)
