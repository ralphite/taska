// What recording a Demo and checking one share (T589): a static Storybook build served on a free port, a headless
// Chromium, and the Demos themselves (src/stories/demo/*.json, each naming its story).

import { spawn } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

export const WEB = join(dirname(fileURLToPath(import.meta.url)), '..')
export const ROOT = join(WEB, '..')
export const DEMO_DIR = join(WEB, 'src', 'stories', 'demo')
export const KEYS = ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_APPLICATION_CREDENTIALS']

/** Each Demo: its id, its story and what lies outside Taska in it (words, plan). */
export function demos() {
  return readdirSync(DEMO_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ id: f.slice(0, -5), ...JSON.parse(readFileSync(join(DEMO_DIR, f), 'utf8')) }))
    .filter((d) => d.story)
}

export const freePort = () =>
  new Promise((ok, fail) => {
    const s = createServer()
    s.on('error', fail)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => ok(port))
    })
  })

/** Waits until `url` answers; -> whether it did in `ms`. */
export async function answers(url, ms = 20000) {
  for (const t0 = Date.now(); Date.now() - t0 < ms; await new Promise((ok) => setTimeout(ok, 200))) {
    try {
      if ((await fetch(url)).ok) return true
    } catch {
      /* not yet */
    }
  }
  return false
}

/** A process that is stopped when we are. */
export function child(cmd, args, opts = {}) {
  const env = { ...process.env, ...(opts.env ?? {}) }
  for (const k of KEYS) delete env[k]
  const p = spawn(cmd, args, { ...opts, env, stdio: opts.stdio ?? 'ignore' })
  const stop = () => p.exitCode === null && p.kill()
  process.on('exit', stop)
  return { proc: p, stop }
}

// python3 -m http.server, with room for the many scripts a page asks for at once (its queue of 5 drops some)
const HTTP_SERVER =
  "import runpy, socketserver, sys; socketserver.TCPServer.request_queue_size = 256; sys.argv[0] = 'http.server'; runpy.run_module('http.server', run_name='__main__')"

/** The static Storybook build in `dir`, served on a free port. */
export async function serveStorybook(dir) {
  const port = await freePort()
  const s = child('python3', ['-c', HTTP_SERVER, String(port), '--bind', '127.0.0.1', '--directory', dir])
  const url = `http://127.0.0.1:${port}`
  if (!(await answers(`${url}/iframe.html`))) throw new Error(`the Storybook build in ${dir} did not come up`)
  return { url, stop: s.stop }
}

/** Headless Chromium; the microphone's recording plays without a tap first. */
export const browser = () => chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })

/** A Demo's story, as Storybook shows it alone. */
export const storyUrl = (base, story, extra = '') => `${base}/iframe.html?id=${story}&viewMode=story${extra}`

/** Waits until the Demo's frame for `layout` is at its end; throws when a step's part is missing or a step was done
 * before it began. */
export async function untilDone(page, layout, ms) {
  const f = page.locator(`[data-tour][data-demo="${layout}"]`)
  for (const t0 = Date.now(); ; await page.waitForTimeout(250)) {
    const [done, missing, skipped, step] = await Promise.all(['data-done', 'data-missing', 'data-skipped', 'data-step'].map((a) => f.getAttribute(a)))
    if (missing) throw new Error(`${layout}: step ${Number(step) + 1}: its part is not on the screen`)
    if (skipped) throw new Error(`${layout}: step ${skipped} was done before it began`)
    if (done) return
    if (Date.now() - t0 > ms) throw new Error(`${layout}: stuck at step ${Number(step) + 1}`)
  }
}
