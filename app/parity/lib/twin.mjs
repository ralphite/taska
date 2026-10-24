// Two Taskas driven in lockstep, as one user would use each: every step runs on both at the same moment, at the
// same screen point, and then both screens are settled, captured and compared.
//
// A target is found on side A (the reference, the old Taska) and the step acts on its screen point on both sides,
// so side B is driven by what the user sees, never by its own page structure. When B's screen differs, the step
// lands on whatever B shows there, and the captures say so.
import fs from 'node:fs'
import path from 'node:path'
import { diffBoxes, filmDiff, imageDiff, textDiff } from './diff.mjs'
import { SIDE_COOKIE } from './door.mjs'

export const VARIANTS = {
  'desk-light': { viewport: { width: 1440, height: 900 }, dpr: 2, scheme: 'light', phone: false },
  'desk-dark': { viewport: { width: 1440, height: 900 }, dpr: 2, scheme: 'dark', phone: false },
  'phone-light': { viewport: { width: 393, height: 852 }, dpr: 3, scheme: 'light', phone: true },
  'phone-dark': { viewport: { width: 393, height: 852 }, dpr: 3, scheme: 'dark', phone: true },
}
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const INIT = () => {
  const P = (window.__parity = { lastMut: performance.now() })
  // the text caret blinks on its own clock: hidden, as Playwright's screenshots hide it, so the film stays still
  const caret = () => {
    const root = document.head || document.documentElement
    if (!root) return document.addEventListener('DOMContentLoaded', caret, { once: true })
    const st = document.createElement('style')
    st.textContent = '*{caret-color:transparent!important}'
    root.appendChild(st)
  }
  caret()
  // motion: every CSS animation and transition that starts, by what it moves and how long it takes (the film
  // does not see a fade, whose every frame is brief)
  P.motion = []
  const rec = (e) => {
    const anim = e.type === 'animationstart'
    const a = e.target.getAnimations?.().find((x) => (anim ? x.animationName === e.animationName : x.transitionProperty === e.propertyName))
    const t = a?.effect?.getTiming?.() || {}
    const what = anim ? 'animation' : `transition ${e.propertyName}`
    const ms = Math.round(+t.duration || 0)
    // a spinner (endless) shows only while something loads, so whether it starts depends on timing: the film judges
    // it (a screen shown 120 ms or more); 0 ms: nothing moves
    if (ms > 0 && t.iterations !== Infinity) P.motion.push(`${what} ${ms}ms delay ${Math.round(+t.delay || 0)} ${t.easing || ''} x${t.iterations ?? 1}`) // 0 ms: nothing moves
  }
  document.addEventListener('animationstart', rec, true)
  document.addEventListener('transitionrun', rec, true)
  const watch = () =>
    new MutationObserver(() => (P.lastMut = performance.now())).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    })
  watch()
}

class Side {
  constructor(name, server, door, browser, variant) {
    Object.assign(this, { name, server, browser, variant })
    this.base = door.base
    this.pending = new Map()
    this.errors = []
    this.dialogs = []
  }
  async open() {
    const v = this.variant
    this.ctx = await this.browser.newContext({
      viewport: v.viewport,
      deviceScaleFactor: v.dpr,
      isMobile: v.phone,
      hasTouch: v.phone,
      userAgent: v.phone ? IPHONE_UA : undefined,
      colorScheme: v.scheme,
      locale: 'en-US',
      timezoneId: 'America/Los_Angeles',
      serviceWorkers: 'allow',
    })
    await this.ctx.addCookies([{ name: SIDE_COOKIE, value: this.name, url: this.base }])
    await this.ctx.addInitScript(INIT)
    this.page = await this.ctx.newPage()
    const p = this.page
    p.on('request', (r) => {
      if (!['eventsource', 'websocket'].includes(r.resourceType())) this.pending.set(r, Date.now())
    })
    const done = (r) => this.pending.delete(r)
    p.on('requestfinished', done)
    p.on('requestfailed', done)
    p.on('response', (r) => {
      if (r.status() >= 500) this.errors.push(`HTTP ${r.status()} ${r.request().method()} ${this.strip(r.url())}`)
    })
    p.on('console', (m) => {
      if (m.type() === 'error') this.errors.push('console: ' + this.strip(m.text()).slice(0, 300))
    })
    p.on('pageerror', (e) => this.errors.push('page error: ' + this.strip(String(e.message)).slice(0, 300)))
    p.on('dialog', async (d) => {
      this.dialogs.push(`${d.type()}: ${d.message()}`)
      await d.dismiss().catch(() => {})
    })
  }
  strip(s) {
    return s.split(this.base).join('BASE').split(this.server.root).join('ROOT')
  }
  takeErrors() {
    const e = this.errors
    this.errors = []
    return e
  }
  takeDialogs() {
    const d = this.dialogs
    this.dialogs = []
    return d
  }
  /** The page is still: no DOM change for `quiet` ms, images and fonts loaded, no fresh request open, and two
   * pictures in a row the same. -> the wall time of its last change. */
  async settle({ quiet = 300, max = 15000 } = {}) {
    const p = this.page
    const t0 = Date.now()
    let doneAt = Date.now()
    for (;;) {
      let st = null
      try {
        st = await p.evaluate(() => ({
          idle: window.__parity ? performance.now() - window.__parity.lastMut : null,
          // images on the screen. A lazy image is not waited for: the browser may hold it back (the old Taska has
          // thumbnails that stay blank until a scroll), and the pictures-in-a-row check below still sees it arrive.
          imgs: [...document.images].every((i) => {
            if (i.complete || i.loading === 'lazy') return true
            const r = i.getBoundingClientRect()
            return r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth || !r.width
          }),
          fonts: document.fonts.status === 'loaded',
          ready: document.readyState === 'complete',
        }))
      } catch {
        st = null // the page is between two documents
      }
      // a request open for over a second is a long poll (or a stream): it does not hold the page from being still
      const fresh = [...this.pending.values()].filter((t) => Date.now() - t < 1000).length
      if (st && st.idle === null) throw new Error('the page has no parity watcher (init script failed)')
      if (st && st.idle >= quiet && st.imgs && st.fonts && st.ready && !fresh) {
        doneAt = Date.now() - st.idle
        break
      }
      if (Date.now() - t0 > max) {
        this.errors.push(`did not settle within ${max / 1000}s`)
        break
      }
      await sleep(40)
    }
    let prev = await this.shot('css')
    for (let i = 0; i < 12; i++) {
      await sleep(150)
      const cur = await this.shot('css')
      if (cur.equals(prev)) break
      prev = cur
      doneAt = Date.now()
    }
    return doneAt
  }
  // ---- the film: every frame the page paints during a step (Chrome's screencast), kept as the distinct screens
  async filmStart() {
    if (!this.cdp) {
      this.cdp = await this.ctx.newCDPSession(this.page)
      this.cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
        this.cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
        if (!this.film) return
        const png = Buffer.from(data, 'base64')
        const last = this.film[this.film.length - 1]
        if (last && last.png.equals(png)) return
        this.film.push({ t: metadata.timestamp * 1000, png })
      })
    }
    await this.page.evaluate(() => window.__parity && (window.__parity.motion = [])).catch(() => {})
    this.film = []
    this.prevFrame = this.lastFrame // the screen before this step, as the previous step's film ended
    const vp = this.variant.viewport
    await this.cdp.send('Page.startScreencast', { format: 'png', maxWidth: vp.width, maxHeight: vp.height, everyNthFrame: 1 })
  }
  /** -> [{ png, ms }]: each distinct screen in order and how long it stayed. */
  async filmStop() {
    const end = Date.now()
    await this.cdp.send('Page.stopScreencast').catch(() => {})
    const f = this.film || []
    this.film = null
    if (f.length) this.lastFrame = f[f.length - 1].png
    return f.map((x, i) => ({ png: x.png, ms: Math.round((i + 1 < f.length ? f[i + 1].t : end) - x.t) }))
  }
  shot(scale = 'device', type = 'png') {
    return this.page.screenshot({ animations: 'disabled', caret: 'hide', scale, type, quality: type === 'jpeg' ? 70 : undefined })
  }
  async capture() {
    const p = this.page
    const png = await this.shot()
    const u = new URL(p.url())
    let text = ''
    let aria = ''
    try {
      text = await p.evaluate(() => document.body.innerText)
      aria = await p.locator('body').ariaSnapshot({ timeout: 5000 })
    } catch (e) {
      text ||= `(no text: ${e.message.split('\n')[0]})`
    }
    const motion = await p.evaluate(() => (window.__parity?.motion || []).slice().sort()).catch(() => [])
    return { png, url: u.pathname + u.search + u.hash, title: await p.title(), text, aria, motion }
  }
  async close() {
    await this.ctx?.close().catch(() => {})
  }
}

export class Twin {
  constructor({ browser, door, a, b, variantName, outDir, log }) {
    this.variantName = variantName
    this.variant = VARIANTS[variantName]
    this.door = door
    this.sides = [new Side('a', a, door, browser, this.variant), new Side('b', b, door, browser, this.variant)]
    this.outDir = outDir
    this.log = log || (() => {})
    this.steps = []
    fs.mkdirSync(outDir, { recursive: true })
  }
  get A() {
    return this.sides[0]
  }
  get desk() {
    return !this.variant.phone
  }
  get phone() {
    return this.variant.phone
  }
  get dark() {
    return this.variant.scheme === 'dark'
  }
  async open() {
    await Promise.all(this.sides.map((s) => s.open()))
  }
  async close() {
    await Promise.all(this.sides.map((s) => s.close()))
  }

  // ------------------------------------------------------------------ steps
  /** Runs fn(side) on both sides at once, then settles, captures and compares (unless check is false). */
  async step(label, fn, { check = true, settle = {} } = {}) {
    if (check) await Promise.all(this.sides.map((s) => s.filmStart()))
    const t0 = Date.now()
    const res = await Promise.allSettled(this.sides.map((s) => fn(s)))
    const failed = res.map((r) => (r.status === 'rejected' ? String(r.reason?.message || r.reason).split('\n')[0] : null))
    if (failed[0]) throw new Error(`"${label}" failed on side A (the reference): ${failed[0]}`)
    if (!check) {
      if (failed[1]) this.record({ label, kind: 'action', same: false, cats: { action: failed }, ms: {} })
      return
    }
    const done = await Promise.all(this.sides.map((s) => s.settle(settle)))
    const films = await Promise.all(this.sides.map((s) => s.filmStop()))
    await this.compare(label, { t0, done, failed, films })
  }
  /** The screen point of a target on side A: fn(page) -> locator, "text" (exact text), or {x, y}. */
  async point(target, { dx, dy } = {}) {
    if (target && typeof target.x === 'number') return target
    const p = this.A.page
    const loc = typeof target === 'function' ? target(p) : p.getByText(target, { exact: true }).first()
    const box = await loc.boundingBox({ timeout: 5000 })
    if (!box) throw new Error(`target not shown on side A: ${target}`)
    const vp = this.variant.viewport
    const x = box.x + (dx ?? box.width / 2)
    const y = box.y + (dy ?? box.height / 2)
    if (x < 0 || y < 0 || x >= vp.width || y >= vp.height) throw new Error(`target is off the screen on side A (${Math.round(x)},${Math.round(y)}): scroll first`)
    return { x, y }
  }
  async goto(urlPath, label = `打开 ${urlPath}`) {
    await this.step(label, (s) => s.page.goto(s.base + urlPath, { waitUntil: 'commit' }))
  }
  async reload(label = '刷新') {
    await this.step(label, (s) => s.page.reload({ waitUntil: 'commit' }))
  }
  async back(label = '后退') {
    await this.step(label, (s) => s.page.goBack({ waitUntil: 'commit' }).catch(() => null))
  }
  async click(target, label, opts = {}) {
    const pt = await this.point(target, opts)
    await this.step(label || `点 ${describe(target)}`, (s) => (this.phone && !opts.mouse ? s.page.touchscreen.tap(pt.x, pt.y) : s.page.mouse.click(pt.x, pt.y, opts)), opts)
  }
  async hover(target, label, opts = {}) {
    const pt = await this.point(target, opts)
    await this.step(label || `指着 ${describe(target)}`, (s) => s.page.mouse.move(pt.x, pt.y), opts)
  }
  async type(text, label, opts = {}) {
    await this.step(label || `打字 "${text.slice(0, 30)}"`, (s) => s.page.keyboard.type(text, { delay: 15 }), opts)
  }
  async key(key, label, opts = {}) {
    await this.step(label || `按 ${key}`, (s) => s.page.keyboard.press(key), opts)
  }
  async wheel(target, dy, label, opts = {}) {
    const pt = await this.point(target, opts)
    await this.step(
      label || `滚动 ${dy}`,
      async (s) => {
        await s.page.mouse.move(pt.x, pt.y)
        await s.page.mouse.wheel(0, dy)
      },
      opts,
    )
  }
  async offline(on, label, opts = {}) {
    await this.step(label || (on ? '断网' : '恢复网络'), (s) => s.ctx.setOffline(on), opts)
  }
  async wait(ms, label = `等 ${ms / 1000} 秒`) {
    await this.step(label, () => sleep(ms))
  }
  /** Waits until both pages show `text` (agent writes appear without a reload); records how long each took. */
  async waitText(text, label = `等页面出现 "${text}"`, timeout = 10000) {
    // never fails: a side that does not show it in time is seen in the capture that follows
    await this.step(label, (s) =>
      s.page.waitForFunction((t) => document.body.innerText.includes(t), text, { timeout, polling: 50 }).catch(() => null),
    )
  }

  /** An agent call on both servers at once; the answers must be the same, word for word. */
  async agent(method, urlPath, body, label) {
    label ||= `agent ${method} ${urlPath}`
    for (let attempt = 0; ; attempt++) {
      const t0 = Date.now()
      const ans = await Promise.all(
        this.sides.map(async (s) => {
          const headers = { 'X-Parity-Side': s.name, ...(body ? { 'Content-Type': 'text/plain' } : {}) }
          const r = await fetch(s.base + urlPath, { method, body: body ?? undefined, headers })
          // the data folders are two by necessity: their paths are the one difference allowed
          const text = (await r.text()).split(s.server.root).join('ROOT')
          return { status: r.status, text, ms: Date.now() - t0 }
        }),
      )
      const same = ans[0].status === ans[1].status && ans[0].text === ans[1].text
      if (!same && method === 'GET' && attempt < 2) {
        await sleep(400)
        continue
      }
      this.record({
        label,
        kind: 'agent',
        same,
        retries: attempt,
        cats: same ? {} : { agent: { status: [ans[0].status, ans[1].status], diff: textDiff(ans[0].text, ans[1].text) } },
        ms: { a: ans[0].ms, b: ans[1].ms },
        answer: ans[0].text.slice(0, 4000),
      })
      return ans[0].text
    }
  }

  // ------------------------------------------------------------------ comparing
  async compare(label, { t0, done, failed, films }) {
    const n = this.steps.length
    let caps
    let cats
    let retries = 0
    for (;;) {
      caps = await Promise.all(this.sides.map((s) => s.capture()))
      cats = {}
      const img = imageDiff(caps[0].png, caps[1].png)
      if (img.pixels) cats.pixels = { n: img.pixels, boxes: diffBoxes(img.png).map((b) => scaleBox(b, this.variant.dpr)), size: img.size || false }
      if (caps[0].url !== caps[1].url) cats.url = [caps[0].url, caps[1].url]
      if (caps[0].title !== caps[1].title) cats.title = [caps[0].title, caps[1].title]
      if (caps[0].text !== caps[1].text) cats.text = textDiff(caps[0].text, caps[1].text)
      if (caps[0].aria !== caps[1].aria) cats.aria = textDiff(caps[0].aria, caps[1].aria)

      if (!Object.keys(cats).length || retries >= 2) {
        caps.img = img
        break
      }
      retries++
      await sleep(500)
      await Promise.all(this.sides.map((s) => s.settle()))
    }
    const errs = this.sides.map((s) => s.takeErrors())
    const newErrs = errs[1].filter((e) => !errs[0].includes(e))
    if (newErrs.length) cats.errors = { a: errs[0], b: errs[1] }
    const dialogs = this.sides.map((s) => s.takeDialogs())
    if (JSON.stringify(dialogs[0]) !== JSON.stringify(dialogs[1])) cats.dialogs = dialogs
    if (failed?.[1]) cats.action = failed
    const base = `${String(n).padStart(3, '0')}`
    const files = {}
    let film = null
    if (films) {
      film = filmDiff(films[0], films[1], this.sides.map((s) => s.prevFrame))
      if (film.diff) {
        cats.film = film.rows
        for (const [k, side] of [['a', 0], ['b', 1]])
          film[k].forEach((x, j) => fs.writeFileSync(path.join(this.outDir, (x.file = `${base}-film-${k}${j}.png`)), films[side][x.i].png))
      }
    }
    const same = !Object.keys(cats).length
    if (same) {
      files.preview = `${base}.jpg`
      fs.writeFileSync(path.join(this.outDir, files.preview), await this.A.shot('css', 'jpeg'))
    } else {
      files.a = `${base}-a.png`
      files.b = `${base}-b.png`
      fs.writeFileSync(path.join(this.outDir, files.a), caps[0].png)
      fs.writeFileSync(path.join(this.outDir, files.b), caps[1].png)
      if (caps.img.png) fs.writeFileSync(path.join(this.outDir, (files.diff = `${base}-diff.png`)), caps.img.png)
    }
    this.record({
      label,
      kind: 'check',
      same,
      retries,
      cats,
      url: caps[0].url,
      ms: t0 ? { a: Math.max(0, Math.round(done[0] - t0)), b: Math.max(0, Math.round(done[1] - t0)) } : {},
      files,
      errorsA: errs[0],
      film: film && { a: film.a, b: film.b, short: film.short },
      // compared over the whole scenario (run.mjs): a fade can start a step later on one side, as an image arrives
      motion: caps[0].motion.length || caps[1].motion.length ? { a: caps[0].motion, b: caps[1].motion } : undefined,
    })
  }
  record(step) {
    step.i = this.steps.length
    this.steps.push(step)
    const mark = step.same ? 'same' : 'DIFF ' + Object.keys(step.cats).join(',')
    this.log(`    ${String(step.i).padStart(3)} ${mark.padEnd(22)} ${step.ms?.a ?? '-'}/${step.ms?.b ?? '-'} ms  ${step.label}`)
  }
}

const scaleBox = (b, k) => ({ x: Math.round(b.x / k), y: Math.round(b.y / k), w: Math.round(b.w / k), h: Math.round(b.h / k) })
function describe(t) {
  if (typeof t === 'string') return `"${t}"`
  if (t && typeof t.x === 'number') return `(${t.x},${t.y})`
  return String(t).replace(/^\(?p\)? => p\./, '').slice(0, 60)
}
