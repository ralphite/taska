// T457, T518 (#6214): what the page talks to in Storybook, with no Taska behind it. It runs before the page's own
// code, in the real page (app.html) and in the component stories (preview-head.html): the page's requests are
// answered here in the browser from saved answers (fixtures/); what it writes is kept in memory
// (window.__storyWrites) and answered as Taska answers a change that went in. The real client code runs unchanged.
// In app.html it also moves the address to the place the story shows (#path=...).
;(() => {
  const h = new URLSearchParams(location.hash.slice(1))
  const theme = h.get('theme')
  if (theme) document.documentElement.dataset.theme = theme
  if (h.has('path')) history.replaceState(null, '', h.get('path'))
  const real = window.fetch.bind(window)
  const FX = '/storybook/fixtures/'
  const json = (o, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } })
  // the demo was made at one moment (fixtures/meta.json): every time in it moves on by as long as has passed since,
  // so "5 min ago" stays 5 min ago
  const shift = real(FX + 'meta.json')
    .then((r) => r.json())
    .then((m) => Date.now() - m.now)
    .catch(() => 0)
  const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/
  const TIME_KEYS = new Set(['t', 'at', 't0', 't1', 'next', 'seen'])
  const move = (x, d, k) => {
    if (typeof x === 'string') return ISO.test(x) ? new Date(Date.parse(x) + d).toISOString() : x
    if (typeof x === 'number' && TIME_KEYS.has(k)) {
      if (x > 1.5e12 && x < 2.5e12) return x + d
      if (x > 1.5e9 && x < 2.5e9) return x + d / 1000
      return x
    }
    if (Array.isArray(x)) return x.map((v) => move(v, d, k))
    if (x && typeof x === 'object') {
      const o = {}
      for (const [kk, v] of Object.entries(x)) o[kk] = move(v, d, kk)
      return o
    }
    return x
  }
  window.fetch = async (input, init) => {
    const u = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href)
    const p = u.pathname
    // only what the page asks Taska; Storybook's own files and the page's code go as they are
    if (u.origin !== location.origin || !/^\/(api|p|k|health|login|skill|dev)(\/|$)/.test(p)) return real(input, init) // F448: dev, the dashboard's
    const method = String((init && init.method) || (input instanceof Request ? input.method : 'GET')).toUpperCase()
    if (/\/api\/poll$/.test(p)) return new Promise(() => {}) // nothing changes while you look
    if (method !== 'GET') {
      // a change: kept here, answered as a change Taska took
      let body = init && init.body
      try {
        body = typeof body === 'string' ? JSON.parse(body) : body
      } catch {
        /* text */
      }
      ;(window.__storyWrites = window.__storyWrites || []).push({ method, path: p + u.search, body })
      return json({ ok: true, res: ['ok'], rev: 1 })
    }
    const name = p.replace(/^\/|\/$/g, '').replace(/\//g, '__')
    for (const ext of ['.json', '.txt', '']) {
      const r = await real(FX + name + ext)
      if (!r.ok) continue
      if (ext !== '.json') return r
      return json(move(await r.json(), await shift))
    }
    return json({ ok: false, error: 'not in the story data' }, 404)
  }
  // the demo's pictures and voice notes are among the saved answers
  const fix = (el) => {
    for (const a of ['src', 'href', 'poster']) {
      const v = el.getAttribute(a),
        m = v && /^\/p\/([^/]+)\/f\/([^?#]+)/.exec(v)
      if (m) el.setAttribute(a, `${FX}p__${m[1]}__f__${decodeURIComponent(m[2])}`)
    }
  }
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === 'attributes') fix(m.target)
      else
        m.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return
          fix(n)
          n.querySelectorAll('[src^="/p/"], [href*="/f/"], [poster^="/p/"]').forEach(fix)
        })
    }
  }).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['src', 'href', 'poster'],
  })
  if (navigator.serviceWorker) navigator.serviceWorker.register = () => new Promise(() => {}) // no offline copy here
  // T456, F479, B540: Storybook never asks for your microphone: the page "hears" a recorded sentence (fixtures/mic.webm,
  // the Mac's reading voice), played over and over, so its own recorder and meter draw the waveform of real speech
  const micClip = real(FX + 'mic.webm').then((r) => r.arrayBuffer())
  if (navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async () => {
      const ac = new AudioContext(),
        src = ac.createBufferSource(),
        out = ac.createMediaStreamDestination()
      src.buffer = await ac.decodeAudioData((await micClip).slice(0))
      src.loop = true
      src.connect(out)
      src.start()
      void ac.resume().catch(() => {})
      return out.stream
    }
  // T456: a story that plays itself has had no tap in its page, and the browser keeps sound stopped until one comes
  // (the tone above is then silent, the recording empty). So the stand-in speaks on: the page's level meter reads a
  // voice's rise and fall, and a recording that got nothing holds one of the demo's voice notes. With sound running
  // (you tapped), both are the real tone's.
  if (window.AnalyserNode) {
    const read = AnalyserNode.prototype.getByteTimeDomainData
    AnalyserNode.prototype.getByteTimeDomainData = function (buf) {
      if (this.context.state === 'running') return read.call(this, buf)
      const t = performance.now() / 1000
      // syllables about four a second, words in groups, a short breath every few seconds
      const level = Math.max(0, Math.sin(t * 7.3) * 0.5 + Math.sin(t * 2.1 + 1) * 0.35 + 0.25) * (t % 3.4 < 0.35 ? 0.1 : 1)
      for (let i = 0; i < buf.length; i++) buf[i] = 128 + Math.round((Math.random() * 2 - 1) * 70 * level)
    }
  }
  if (window.MediaRecorder) {
    const note = fetch(FX + 'p__shop__f__f3-voice_0-08.webm')
      .then((r) => r.blob())
      .catch(() => null)
    let held = null
    void note.then((b) => (held = b))
    const Real = window.MediaRecorder
    window.MediaRecorder = class extends Real {
      constructor(...a) {
        super(...a)
        this.got = 0
        this.addEventListener('dataavailable', (e) => (this.got += e.data.size))
      }
      stop() {
        if (!this.got && held && this.state !== 'inactive') {
          const e = new Event('dataavailable')
          e.data = held
          this.dispatchEvent(e)
        }
        super.stop()
      }
    }
  }

  // The stories share their address with your Taska: they get storage of their own, so they never read or change
  // your drafts, views or settings, and start the same every time.
  class Mem {
    constructor() {
      this.m = new Map()
    }
    get length() {
      return this.m.size
    }
    key(i) {
      return [...this.m.keys()][i] ?? null
    }
    getItem(k) {
      return this.m.has(String(k)) ? this.m.get(String(k)) : null
    }
    setItem(k, v) {
      this.m.set(String(k), String(v))
    }
    removeItem(k) {
      this.m.delete(String(k))
    }
    clear() {
      this.m.clear()
    }
  }
  for (const name of ['localStorage', 'sessionStorage'])
    Object.defineProperty(window, name, { value: new Mem(), configurable: true })
  const open = indexedDB.open.bind(indexedDB)
  for (const db of ['taska-state', 'taska-voice']) indexedDB.deleteDatabase('story-' + db)
  indexedDB.open = (name, v) => open('story-' + name, v)
  const on = window.addEventListener.bind(window)
  window.addEventListener = (type, ...rest) => (type === 'storage' ? undefined : on(type, ...rest)) // not your tabs' changes
})()
