// Records a Demo's server answers (T589, r881): the Demo's own steps, played by its Play in a headless browser, on
// the real page against a real Taska on a fresh copy of the demo projects (tools/demo_server.py: the clock, the voice
// note's words, the organizer's answer and an agent's replies fixed; nothing reaches a model). Every request the page makes and every
// answer goes into src/stories/demo/recordings/<demo>.<layout>.json, which the Demo replays.
//
//   node scripts/record-demo.mjs <storybook-static-dir> [demo] [phone|desk]
//
// Build Storybook first (npm run build-storybook); build it again after recording, then check
// (scripts/check-demos.mjs). Never touches ~/.taska or a running Taska: the server is its own, on a free port.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEMO_DIR, ROOT, answers, browser, child, demos, freePort, serveStorybook, storyUrl, untilDone } from './demo-run.mjs'

const [dir, only, onlyLayout] = process.argv.slice(2)
if (!dir) {
  console.log('usage: node scripts/record-demo.mjs <storybook-static-dir> [demo] [phone|desk]')
  process.exit(2)
}

/** One layout of one Demo, recorded on a server of its own. */
async function record(sb, demo, layout) {
  const tmp = mkdtempSync(join(tmpdir(), 'taska-demo-'))
  const data = join(tmp, 'data')
  execFileSync('python3', [join(ROOT, 'tools', 'copy_data.py'), join(ROOT, 'web', '.storybook', 'demo-data'), data], { stdio: 'ignore' })
  writeFileSync(join(tmp, 'words.txt'), demo.words ?? '')
  writeFileSync(join(tmp, 'plan.txt'), demo.plan ?? '')
  const replies = demo.replies ? ['--replies', join(tmp, 'replies.json')] : []
  if (demo.replies) writeFileSync(join(tmp, 'replies.json'), JSON.stringify(demo.replies))
  const port = await freePort()
  const server = `http://127.0.0.1:${port}`
  const taska = child('python3', [join(ROOT, 'tools', 'demo_server.py'), '--root', data, '--port', String(port), '--words', join(tmp, 'words.txt'), '--plan', join(tmp, 'plan.txt'), ...replies], { stdio: ['ignore', 'ignore', 'inherit'] })
  const b = await browser()
  try {
    if (!(await answers(`${server}/health`))) throw new Error('the demo server did not start')
    const context = await b.newContext({ viewport: { width: 1600, height: 1000 } })
    const exchanges = []
    let t0 = 0
    const ms = () => Math.round(performance.now() - t0)
    // the page's requests, through the script to the real server: what the frame's hook does while it records
    await context.exposeBinding('__demoNet', async (_from, req) => {
      const sent = ms()
      const body = req.body?.startsWith('base64:') ? Buffer.from(req.body.slice(7), 'base64') : req.body
      const r = await fetch(server + req.url, { method: req.method, headers: req.headers, body })
      const text = await r.text()
      const type = r.headers.get('content-type') || 'text/plain'
      let json
      if (type.includes('json'))
        try {
          json = JSON.parse(text)
        } catch {
          /* its words, then */
        }
      exchanges.push({ method: req.method, url: req.url, status: r.status, ...(json !== undefined ? { json } : { text }), sent, at: ms() })
      return { status: r.status, text, type }
    })
    const page = await context.newPage()
    page.on('pageerror', (e) => console.log(`  ${layout}: page error: ${e.message}`))
    t0 = performance.now()
    await page.goto(storyUrl(sb, demo.story, `&record=${layout}`))
    await untilDone(page, layout, 120000)
    await page.waitForTimeout(1500) // what the last step brings
    await context.close()
    exchanges.sort((a, b) => a.sent - b.sent)
    const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
    const rec = { demo: demo.id, layout, made: `${new Date().toISOString()} at ${commit}`, exchanges }
    writeFileSync(join(DEMO_DIR, 'recordings', `${demo.id}.${layout}.json`), JSON.stringify(rec, null, 1) + '\n')
    console.log(`${demo.id} ${layout}: ${exchanges.length} answers recorded`)
  } finally {
    await b.close()
    taska.stop()
    rmSync(tmp, { recursive: true, force: true })
  }
}

const sb = await serveStorybook(dir)
let failed = false
try {
  for (const demo of demos().filter((d) => !only || d.id === only))
    for (const layout of ['phone', 'desk'].filter((l) => !onlyLayout || l === onlyLayout))
      try {
        await record(sb.url, demo, layout)
      } catch (e) {
        failed = true
        console.log(`${demo.id} ${layout}: not recorded: ${e.message}`)
      }
} finally {
  sb.stop()
}
process.exit(failed ? 1 : 0)
