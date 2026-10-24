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
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

export const VARIANTS = {
  'desk-light': { viewport: { width: 1440, height: 900 }, dpr: 2, scheme: 'light', phone: false },
  'desk-dark': { viewport: { width: 1440, height: 900 }, dpr: 2, scheme: 'dark', phone: false },
  'phone-light': { viewport: { width: 393, height: 852 }, dpr: 3, scheme: 'light', phone: true },
  'phone-dark': { viewport: { width: 393, height: 852 }, dpr: 3, scheme: 'dark', phone: true },
  // Safari's engine, as on Yadong's iPhone (no film there: the screencast is Chrome's)
  'iphone-light': { viewport: { width: 393, height: 852 }, dpr: 3, scheme: 'light', phone: true, engine: 'webkit' },
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
    if (ms > 0 && t.iterations !== Infinity) {
      P.motion.push(`${what} ${ms}ms delay ${Math.round(+t.delay || 0)} ${t.easing || ''} x${t.iterations ?? 1}`)
      // when it moves, in wall-clock ms: the frames painted meanwhile depend on how busy the machine is
      const t0 = performance.timeOrigin + performance.now()
      P.moving.push([t0, t0 + (+t.delay || 0) + ms * (+t.iterations || 1)])
    }
  }
  P.moving = []
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
    this.pages = []
    await this.newPage()
  }
  /** A new tab in the same browser (shares cookies and storage, as a second tab of Yadong's) becomes the active one. */
  async newPage() {
    const p = await this.ctx.newPage()
    this.pages.push(p)
    this.use(this.pages.length - 1)
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
    return p
  }
  use(i) {
    this.page = this.pages[i]
    this.cdp = null // the film follows the active tab
    this.lastFrame = null
  }
  strip(s) {
    // addresses without their query (a server's own boot id and revision in a poll address)
    return s.split(this.base).join('BASE').split(this.server.root).join('ROOT').replace(/(BASE\/[^\s?]*)\?\S*/g, '$1?…')
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
  async settle({ quiet, max = 15000 } = {}) {
    // a tooltip comes 500 ms after the pointer stops on a control (desktop): still means past that too
    quiet ??= this.variant.phone ? 300 : 650
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
    if (this.variant.engine === 'webkit') return
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
    await this.page.evaluate(() => window.__parity && ((window.__parity.motion = []), (window.__parity.moving = []))).catch(() => {})
    this.film = []
    this.prevFrame = this.lastFrame // the screen before this step, as the previous step's film ended
    // the desktop film at half size: four times less work for a busy machine, still plain enough for a person to read
    const vp = this.variant.viewport
    const k = this.variant.phone ? 1 : 2
    await this.cdp.send('Page.startScreencast', { format: 'png', maxWidth: Math.round(vp.width / k), maxHeight: Math.round(vp.height / k), everyNthFrame: 1 })
  }
  /** -> [{ png, ms }]: each distinct screen in order and how long it stayed. */
  async filmStop() {
    if (this.variant.engine === 'webkit') return null
    const end = Date.now()
    await this.cdp.send('Page.stopScreencast').catch(() => {})
    const f = this.film || []
    this.film = null
    if (f.length) this.lastFrame = f[f.length - 1].png
    const moving = await this.page.evaluate(() => window.__parity?.moving || []).catch(() => [])
    return f.map((x, i) => {
      const t1 = i + 1 < f.length ? f[i + 1].t : end
      // painted while something was moving (a slide, a fade): a frame in the middle of a motion
      const inMotion = moving.some(([m0, m1]) => x.t >= m0 - 20 && x.t <= m1 + 20)
      return { png: x.png, ms: Math.round(t1 - x.t), inMotion }
    })
  }
  shot(scale = 'device', type = 'png') {
    return this.page.screenshot({ animations: 'disabled', caret: 'hide', scale, type, quality: type === 'jpeg' ? 70 : undefined })
  }
  /** env: what differs between two instances by nature on this step (a key each made for itself): { mask(page) ->
   * locators painted over in the picture, text: [regex] replaced by <env> in the text and the tree }. */
  async capture(env) {
    const p = this.page
    const png = env?.mask
      ? await p.screenshot({ animations: 'disabled', caret: 'hide', mask: env.mask(p), maskColor: '#888' })
      : await this.shot()
    const u = new URL(p.url())
    let text = ''
    let aria = ''
    try {
      text = await p.evaluate(() => document.body.innerText)
      aria = await p.locator('body').ariaSnapshot({ timeout: 5000 })
    } catch (e) {
      text ||= `(no text: ${e.message.split('\n')[0]})`
    }
    for (const re of env?.text || []) {
      text = text.replace(re, '<env>')
      aria = aria.replace(re, '<env>')
    }
    const motion = await p.evaluate(() => (window.__parity?.motion || []).slice().sort()).catch(() => [])
    // every box that scrolls, where it is and how far it is scrolled: [x, y, w, h, scrollTop]
    const scrollers = await p
      .evaluate(() => {
        const out = [[0, 0, innerWidth, innerHeight, Math.round(scrollY)]]
        for (const el of document.querySelectorAll('*')) {
          if (el.scrollHeight <= el.clientHeight + 1) continue
          if (!/(auto|scroll)/.test(getComputedStyle(el).overflowY)) continue
          const r = el.getBoundingClientRect()
          out.push([Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), Math.round(el.scrollTop * 100) / 100])
        }
        return out
      })
      .catch(() => [])
    return { png, url: u.pathname + u.search + u.hash, title: await p.title(), text, aria, motion, scrollers }
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
  async step(label, fn, { check = true, settle = {}, untimed = this.untimed, env } = {}) {
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
    let films = this.variant.engine === 'webkit' ? null : await Promise.all(this.sides.map((s) => s.filmStop()))
    if (env) films = null // the film cannot be masked: the step's own capture is compared, masked
    await this.compare(label, { t0, done, failed, films, untimed, env })
  }
  /** The screen point of a target on side A: fn(page) -> locator, "text" (exact text), or {x, y}. */
  async point(target, { dx, dy } = {}) {
    if (target && typeof target.x === 'number') return target
    const p = this.A.page
    const loc = typeof target === 'function' ? target(p) : p.getByText(target, { exact: true }).first()
    const box = await loc.boundingBox({ timeout: 15000 })
    if (!box) throw new Error(`target not shown on side A: ${target}`)
    const vp = this.variant.viewport
    const x = box.x + (dx ?? box.width / 2)
    const y = box.y + (dy ?? box.height / 2)
    if (x < 0 || y < 0 || x >= vp.width || y >= vp.height) throw new Error(`target is off the screen on side A (${Math.round(x)},${Math.round(y)}): scroll first`)
    return { x, y }
  }
  async goto(urlPath, label = `打开 ${urlPath}`, opts = {}) {
    await this.step(label, (s) => s.page.goto(s.base + urlPath, { waitUntil: 'commit' }), opts)
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
      (s) => scrollAt(s, pt.x, pt.y, dy),
      opts,
    )
  }
  /** Scrolls (the wheel, at the same point on both sides) until the target is on side A's screen, then checks. */
  async reveal(target, label, opts = {}) {
    const vp = this.variant.viewport
    for (let i = 0; i < 10; i++) {
      const p = this.A.page
      const loc = typeof target === 'function' ? target(p) : p.getByText(target, { exact: true }).first()
      const box = await loc.boundingBox({ timeout: 15000 })
      if (!box) throw new Error(`target not shown on side A: ${target}`)
      const cy = box.y + box.height / 2
      if (cy >= 60 && cy <= vp.height - 120) break
      const x = Math.min(Math.max(box.x + box.width / 2, 5), vp.width - 5)
      const dy = Math.round(cy - vp.height / 2)
      await this.step('', (s) => scrollAt(s, x, vp.height / 2, dy), { check: false })
      await sleep(350)
    }
    await this.step(label || `滚到 ${describe(target)}`, () => sleep(50), opts)
  }
  /** Press, move and let go (select text, drag a row); on the phone a finger. */
  async drag(from, to, label, opts = {}) {
    const a = await this.point(from, opts.from || {})
    const b = await this.point(to, opts.to || {})
    await this.step(
      label || `拖 ${describe(from)} 到 ${describe(to)}`,
      async (s) => {
        if (this.phone) return touch(s, [a, b], opts.hold ?? 600)
        await s.page.mouse.move(a.x, a.y)
        await s.page.mouse.down()
        await s.page.mouse.move(b.x, b.y, { steps: 12 })
        await s.page.mouse.up()
      },
      opts,
    )
  }
  /** Hold a finger (phone) or the mouse button (desktop) on the target. */
  async press(target, label, opts = {}) {
    const a = await this.point(target, opts)
    await this.step(
      label || `长按 ${describe(target)}`,
      async (s) => {
        if (this.phone) return touch(s, [a], opts.hold ?? 700)
        await s.page.mouse.move(a.x, a.y)
        await s.page.mouse.down()
        await sleep(opts.hold ?? 700)
        await s.page.mouse.up()
      },
      opts,
    )
  }
  /** Tap/click the target, which opens the file picker, and choose these files (paths) on both sides. */
  async upload(target, files, label, opts = {}) {
    const pt = await this.point(target, opts)
    await this.step(
      label || `选文件 ${files.map((f) => path.basename(f)).join(', ')}`,
      async (s) => {
        const [chooser] = await Promise.all([
          s.page.waitForEvent('filechooser', { timeout: 15000 }),
          this.phone ? s.page.touchscreen.tap(pt.x, pt.y) : s.page.mouse.click(pt.x, pt.y),
        ])
        await chooser.setFiles(files)
      },
      opts,
    )
  }
  /** A second tab of the same browser on both sides, opened at urlPath; it becomes the one the steps act on. */
  async newTab(urlPath, label = `新开一个标签页 ${urlPath}`) {
    await Promise.all(this.sides.map((s) => s.newPage()))
    await this.goto(urlPath, label)
  }
  async tab(i, label = `回到第 ${i + 1} 个标签页`) {
    for (const s of this.sides) s.use(i)
    await this.step(label, (s) => s.page.bringToFront())
  }
  /** Both servers stop (Taska out of reach) or start again on the same port and data. */
  async servers(up, label) {
    await this.step(label || (up ? '服务器恢复' : '服务器停了'), (s) => (up ? s.server.restart() : s.server.stop()), { untimed: true })
  }
  async offline(on, label, opts = {}) {
    await this.step(label || (on ? '断网' : '恢复网络'), (s) => s.ctx.setOffline(on), { untimed: true, ...opts })
  }
  async wait(ms, label = `等 ${ms / 1000} 秒`) {
    await this.step(label, () => sleep(ms), { untimed: true })
  }
  /** Waits until both pages show `text` (agent writes appear without a reload); records how long each took. */
  async waitText(text, label = `等页面出现 "${text}"`, timeout = 10000) {
    // never fails: a side that does not show it in time is seen in the capture that follows
    await this.step(label, (s) =>
      s.page.waitForFunction((t) => document.body.innerText.includes(t), text, { timeout, polling: 50 }).catch(() => null),
      { untimed: true },
    )
  }

  /** Speed, one side at a time (no sharing of the machine): before(side) sets the scene, fn(side) is timed until the
   * page is still; n times each, alternating; the medians are compared. Slower: a quarter longer and 150 ms more. */
  async timed(label, fn, { n = 3, before } = {}) {
    const ms = { a: [], b: [] }
    for (let i = 0; i < n; i++)
      for (const s of this.sides) {
        if (before) await before(s)
        await s.settle()
        const t0 = Date.now()
        await fn(s)
        ms[s.name].push(Math.max(0, Math.round((await s.settle()) - t0)))
      }
    const med = (x) => [...x].sort((p, q) => p - q)[Math.floor(x.length / 2)]
    const [a, b] = [med(ms.a), med(ms.b)]
    const slow = b > a * 1.25 + 150
    for (const s of this.sides) s.takeErrors()
    this.record({ label, kind: 'timed', same: !slow, cats: slow ? { speed: { a, b, all: ms } } : {}, ms: { a, b }, all: ms })
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
  async compare(label, { t0, done, failed, films, untimed, env }) {
    const n = this.steps.length
    let caps
    let cats
    let retries = 0
    let scrolled = false
    let note
    for (;;) {
      caps = await Promise.all(this.sides.map((s) => s.capture(env)))
      cats = {}
      const img = imageDiff(caps[0].png, caps[1].png)
      if (img.pixels) cats.pixels = { n: img.pixels, boxes: diffBoxes(img.png).map((b) => scaleBox(b, this.variant.dpr)), size: img.size || false }
      if (caps[0].url !== caps[1].url) cats.url = [caps[0].url, caps[1].url]
      if (caps[0].title !== caps[1].title) cats.title = [caps[0].title, caps[1].title]
      if (caps[0].text !== caps[1].text) cats.text = textDiff(caps[0].text, caps[1].text)
      if (caps[0].aria !== caps[1].aria) cats.aria = textDiff(caps[0].aria, caps[1].aria)

      if (!Object.keys(cats).length || retries >= 2) {
        caps.img = img
        // the same picture, one part scrolled a few pixels further on one side (the page scrolled an item into view
        // while the content above it was still coming): the scroll position, not what the page shows, differs
        // a box that scrolls, in the same place on both sides, holding every differing pixel, scrolled further on one
        // side; and the picture inside it the same once moved by that much: the scroll position differs, not the page.
        // A shift of the layout itself (1 px lower) leaves the scroll positions equal, and is a difference.
        const dy = cats.pixels && !cats.pixels.size ? scrollExplains(caps[0], caps[1], cats.pixels.boxes, this.variant.dpr) : 0
        if (cats.pixels) cats.pixels.geo = { dy, a: caps[0].scrollers, b: caps[1].scrollers } // why it was or was not a scroll
        if (dy) {
          cats = Object.fromEntries(Object.entries(cats).filter(([k]) => k !== 'pixels'))
          cats.scroll = { dy, boxes: diffBoxes(img.png).map((b) => scaleBox(b, this.variant.dpr)) }
          scrolled = true
        }
        break
      }
      retries++
      await sleep(500)
      await Promise.all(this.sides.map((s) => s.settle()))
    }
    const errs = this.sides.map((s) => s.takeErrors())
    const newErrs = errs[1].filter((e) => !errs[0].includes(e))
    if (newErrs.length) cats.errors = { a: errs[0], b: errs[1] } // judged again over the scenario (run.mjs)
    const dialogs = this.sides.map((s) => s.takeDialogs())
    if (JSON.stringify(dialogs[0]) !== JSON.stringify(dialogs[1])) cats.dialogs = dialogs
    if (failed?.[1]) cats.action = failed
    const base = `${String(n).padStart(3, '0')}`
    const files = {}
    let film = null
    if (films && !scrolled) {
      film = filmDiff(films[0], films[1], this.sides.map((s) => s.prevFrame))
      if (film.brief.length) note = { ...note, brief: film.brief }
      // screens during a step depend on how fast each side answered at that moment (on a busy machine a hover before a
      // click, a spinner while a picture comes, can last a second on one side only): listed for a person to judge with
      // the two strips, not counted. What a step ends on, and every motion, is counted.
      if (film.diff) {
        note = { ...note, film: film.rows }
        for (const [k, side] of [['a', 0], ['b', 1]])
          film[k].forEach((x, j) => fs.writeFileSync(path.join(this.outDir, (x.file = `${base}-film-${k}${j}.png`)), films[side][x.i].png))
      }
    }
    // only a scroll position differs (a few pixels, the same picture, the same text): a note, not a difference; the
    // old Taska does this to itself from run to run
    if (scrolled && Object.keys(cats).length === 1) {
      note = { ...note, scroll: cats.scroll.dy }
      cats = {}
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
      errorsB: errs[1],
      untimed: untimed || undefined, // a wait on purpose: its time says nothing about speed
      note,
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

// The wheel at a point; mobile WebKit has no wheel, so there the nearest scrollable box under the point scrolls.
async function scrollAt(side, x, y, dy) {
  if (side.variant.engine !== 'webkit') {
    await side.page.mouse.move(x, y)
    return side.page.mouse.wheel(0, dy)
  }
  await side.page.evaluate(
    ([x, y, dy]) => {
      for (let el = document.elementFromPoint(x, y); el; el = el.parentElement) {
        const st = getComputedStyle(el)
        if (/(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight) return el.scrollBy(0, dy)
      }
      scrollBy(0, dy)
    },
    [x, y, dy],
  )
}

// A finger: down at the first point, held, moved through the rest, up (Chrome's touch events, as a phone sends).
async function touch(side, pts, hold) {
  if (side.variant.engine === 'webkit') throw new Error('a long press or a finger drag needs Chrome (no CDP in WebKit)')
  const cdp = await side.ctx.newCDPSession(side.page)
  const tp = (p) => [{ x: p.x, y: p.y, id: 1, radiusX: 4, radiusY: 4, force: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(pts[0]) })
  await sleep(hold)
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]]
    for (let k = 1; k <= 10; k++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp({ x: a.x + ((b.x - a.x) * k) / 10, y: a.y + ((b.y - a.y) * k) / 10 }) })
      await sleep(16)
    }
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach().catch(() => {})
}

// -> how much further B's box is scrolled (CSS px) when that explains every differing pixel, else 0
export function scrollExplains(ca, cb, boxes, dpr) {
  const near = (p, q) => p.slice(0, 4).every((v, k) => Math.abs(v - q[k]) <= 2)
  const inside = (c) => boxes.every((b) => b.x >= c[0] - 24 && b.y >= c[1] - 24 && b.x + b.w <= c[0] + c[2] + 24 && b.y + b.h <= c[1] + c[3] + 24)
  let A
  let B
  for (const sa of ca.scrollers)
    for (const sb of cb.scrollers) {
      const d = sb[4] - sa[4]
      if (!near(sa, sb) || Math.abs(d) < 0.5 || Math.abs(d) > sa[3] / 2 || !inside(sa)) continue
      A ||= PNG.sync.read(ca.png)
      B ||= PNG.sync.read(cb.png)
      // inside the box: B at row y shows what A shows at row y + d
      const dd = Math.round(d * dpr)
      const x0 = Math.max(0, sa[0] * dpr)
      const w = Math.min(A.width - x0, sa[2] * dpr)
      const top = Math.max(0, sa[1] * dpr)
      const bottom = Math.min(A.height, (sa[1] + sa[3]) * dpr)
      const h = bottom - top - Math.abs(dd)
      if (w <= 0 || h <= 0) continue
      const crop = (P, y) => {
        const out = new PNG({ width: w, height: h })
        PNG.bitblt(P, out, x0, y, w, h, 0, 0)
        return out
      }
      const pa = crop(A, dd > 0 ? top + dd : top)
      const pb = crop(B, dd > 0 ? top : top - dd)
      const bad = pixelmatch(pa.data, pb.data, null, w, h, { threshold: 0.1, includeAA: false })
      if (bad / (w * h) < 0.003) return Math.round(d)
    }
  return 0
}

const scaleBox = (b, k) => ({ x: Math.round(b.x / k), y: Math.round(b.y / k), w: Math.round(b.w / k), h: Math.round(b.h / k) })
function describe(t) {
  if (typeof t === 'string') return `"${t}"`
  if (t && typeof t.x === 'number') return `(${t.x},${t.y})`
  return String(t).replace(/^\(?p\)? => p\./, '').slice(0, 60)
}
