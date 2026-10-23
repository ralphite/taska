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
  // T457 (#6481): a Demo plays on the real Taska server, run in the page (story-server.js): every request goes to it
  const live = h.has('server')
  if (live) {
    window.__storySeed = h.get('server') // the demo's beginning: what happened before it starts
    document.write('<script src="/storybook/story-server.js"></' + 'script>')
  }
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
      // an item's "read" holds, by agent, when it read the item (ms): times too
      for (const [kk, v] of Object.entries(x)) o[kk] = move(v, d, k === 'read' ? 't' : kk)
      return o
    }
    return x
  }
  // T522: how Taska answers in this story, for the page's loading and error states (#net={"<path regex>": how}):
  // "hang" Taska never answers (the page's own time limits end the wait, as with a stuck Taska), "down" nothing
  // answers (refused: Taska stopped or restarting), a number answers with that HTTP status, as a crashed request does,
  // "no" Taska says no to a change (its item deleted meanwhile).
  // The first rule whose regex matches the address's path decides; a path no rule matches is answered as usual.
  let rules = []
  try {
    rules = Object.entries(JSON.parse(h.get('net') || '{}')).map(([re, how]) => [new RegExp(re), how])
  } catch {
    /* no rules */
  }
  const ruleFor = (p) => (rules.find(([re]) => re.test(p)) || [])[1]
  const signalOf = (input, init) => (init && init.signal) || (input instanceof Request ? input.signal : null)
  const aborted = () => new DOMException('The user aborted a request.', 'AbortError')
  const answerBy = (how, signal) => {
    if (how === 'down') return Promise.reject(new TypeError('Failed to fetch')) // what the browser says when refused
    if (how === 'hang')
      return new Promise((_, no) => {
        if (signal?.aborted) no(aborted())
        signal?.addEventListener('abort', () => no(aborted()))
      })
    return Promise.resolve(
      new Response(`${how} story server error\n`, { status: Number(how), headers: { 'Content-Type': 'text/plain' } }),
    )
  }
  // T522: a project Taska does not have, or one deleted, is answered as Taska answers it (server/taska/web.py)
  const projects = Promise.all(
    ['api__projects.json', 'api__projects__deleted.json'].map((f) =>
      real(FX + f)
        .then((r) => r.json())
        .catch(() => []),
    ),
  )
  const noProject = async (p) => {
    const m = /^\/p\/([a-z0-9][a-z0-9-]*)(\/|$)/.exec(p)
    if (!m) return null
    const [have, deleted] = await projects
    const list = Array.isArray(have) ? have : have.projects || []
    if (list.some((x) => x.name === m[1])) return null
    const text = deleted.some((x) => x.name === m[1])
      ? `project ${m[1]} was deleted: there is no work here. The user can restore it in Taska (Settings › Projects).\n`
      : `no project ${m[1]}. Projects: ${list
          .map((x) => x.name)
          .sort()
          .join(', ')}\n`
    return new Response(text, { status: 404, headers: { 'Content-Type': 'text/plain' } })
  }
  // T522: the story's own data, changed from the saved answers (#items={"<n>": {fields}}): those items of the project
  // the page shows, with those fields (a very long title...). Only data: the page draws it as it draws any item.
  let items = {}
  try {
    items = JSON.parse(h.get('items') || '{}')
  } catch {
    /* none */
  }
  const edit = (p, o) => {
    if (/\/api\/state$/.test(p) && o && Array.isArray(o.items))
      o.items = o.items.map((it) => (items[it.n] ? { ...it, ...items[it.n] } : it))
    return o
  }
  // B555: how many of the page's requests to Taska are still on their way (not the long wait for news): a story does
  // its steps once the page has what it asked for, as a person starts once the page is there
  let busy = 0
  window.__storyBusy = () => busy
  const answerOf = async (input, init) => {
    const u = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href)
    const p = u.pathname
    // only what the page asks Taska; Storybook's own files and the page's code go as they are
    if (u.origin !== location.origin || !/^\/(api|p|k|health|login|skill|dev)(\/|$)/.test(p)) return real(input, init) // F448: dev, the dashboard's
    const how = ruleFor(p)
    if (how === 'no') {
      // B555: Taska refuses the change, as its /api/op says when the item was deleted meanwhile (store.py)
      let o = {}
      try {
        o = JSON.parse(String((init && init.body) || '{}'))
      } catch {
        /* not words */
      }
      const x = Array.isArray(o) ? o[0] || {} : o
      // what it names, as the store words it (store.py item: "<ref> not found"; a reply names its item's number)
      const ref = x.ref ?? (Array.isArray(x.refs) ? x.refs[0] : undefined) ?? x.scope
      // a comment on a document deleted meanwhile: "no document D1"
      return json({ ok: false, res: [x.d != null ? `err: no document D${x.d}` : `err: ${ref} not found`] })
    }
    if (how !== undefined) return answerBy(how, signalOf(input, init))
    const method = String((init && init.method) || (input instanceof Request ? input.method : 'GET')).toUpperCase()
    if (live) {
      const hd = new Headers((init && init.headers) || (input instanceof Request ? input.headers : undefined))
      const body = init && 'body' in init ? init.body : input instanceof Request ? await input.blob() : null
      return (await window.__storyServer).fetch(
        u,
        method,
        hd.get('Content-Type') || (body && body.type) || '',
        body,
        init && init.signal,
      )
    }
    const none = await noProject(p)
    if (none) return none
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
      // T456: a voice note is heard as Taska hears one: kept under a name, then its words (always the same demo
      // sentence), so what waits for words (a comment on a document) goes on as it does with Taska
      if (/\/api\/file$/.test(p))
        return json({ f: 'f990-' + (u.searchParams.get('name') || 'voice.webm').replace(/\s+/g, '_') })
      if (/\/api\/transcript$/.test(p))
        return json({
          done: true,
          tr: '\u5148\u505a\u65b9\u6848 A \u53ef\u4ee5\uff0c\u4f46\u8981\u5199\u6e05\u695a\u65b9\u6848 B \u4ec0\u4e48\u65f6\u5019\u505a\u3002',
        })
      return json({ ok: true, res: ['ok'], rev: 1 })
    }
    const name = p.replace(/^\/|\/$/g, '').replace(/\//g, '__')
    for (const ext of ['.json', '.txt', '']) {
      const r = await real(FX + name + ext)
      if (!r.ok) continue
      if (ext !== '.json') return r
      return json(edit(p, move(await r.json(), await shift)))
    }
    return json({ ok: false, error: 'not in the story data' }, 404)
  }
  window.fetch = (input, init) => {
    const u = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href)
    if (u.origin !== location.origin || !/^\/(api|p|k|health|login|skill|dev)(\/|$)/.test(u.pathname))
      return real(input, init)
    if (/\/api\/poll$/.test(u.pathname)) return answerOf(input, init)
    busy++
    const r = answerOf(input, init)
    r.then(
      () => busy--,
      () => busy--,
    )
    return r
  }
  // the demo's pictures and voice notes are among the saved answers
  const saved = (v) => {
    const m = v && /^\/p\/([^/]+)\/f\/([^?#]+)/.exec(v)
    return m ? `${FX}p__${m[1]}__f__${decodeURIComponent(m[2])}` : null
  }
  // T522: a picture whose path a "hang" rule matches never comes (Storybook's server keeps the request open,
  // .storybook/main.ts); "down" or a status: it fails to load, as the browser shows a picture that did not come
  const held = (v) => {
    const how = v && ruleFor(v.split(/[?#]/)[0])
    return how === undefined || !how ? null : how === 'hang' ? '/story-hang' : FX + 'not-there'
  }
  const fix = (el) => {
    for (const a of ['src', 'href', 'poster']) {
      const v = el.getAttribute(a),
        stop = held(v),
        to = saved(v)
      if (stop) el.setAttribute(a, stop)
      else if (to && live) void window.__storyServer.then((s) => el.setAttribute(a, s.file(v.split(/[?#]/)[0])))
      else if (to) el.setAttribute(a, to)
    }
  }
  // T529: the page plays a voice note with new Audio(src), an element never put on the page (lib/audio.ts), so the
  // watch below does not see it: it is made with the saved file's address instead
  const RealAudio = window.Audio
  if (RealAudio) {
    const StoryAudio = function Audio(src) {
      return src === undefined ? new RealAudio() : new RealAudio(saved(String(src)) || src)
    }
    StoryAudio.prototype = RealAudio.prototype
    window.Audio = StoryAudio
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
  // B555: a component story is a picture of the page at one moment: once its steps are done, a story may stop the
  // page's clock (window.__storyStill), so what would go by itself a few seconds later (a toast) stays in the picture
  let still = false
  for (const name of ['setTimeout', 'setInterval']) {
    const orig = window[name].bind(window)
    window[name] = (fn, ...rest) =>
      orig(typeof fn === 'function' ? (...a) => (still ? undefined : fn(...a)) : fn, ...rest)
  }
  window.__storyStill = () => (still = true)
  // B555: Storybook's pointer (twin.ts) is not one the browser knows, so the browser takes every focus that follows a
  // story's click for the keyboard's and rings it (:focus-visible), where a real click leaves none (a menu's first row).
  // So in a story the page's focus rings show where a real keyboard's would: in a text field, and on what a story's
  // Tab marks (data-sb-focus-visible, twin.ts pointed).
  const FV = /(?<!\\):focus-visible\b/g
  const quiet = (list) => {
    for (const r of list) {
      if (r instanceof CSSStyleRule && FV.test(r.selectorText)) {
        FV.lastIndex = 0
        r.selectorText = r.selectorText
          .split(',')
          .map((x) =>
            FV.test(x)
              ? ((FV.lastIndex = 0),
                x.replace(
                  FV,
                  ':is(:focus-visible:is(input, textarea, select, [contenteditable]), [data-sb-focus-visible])',
                ))
              : x,
          )
          .join(',')
      }
      FV.lastIndex = 0
      if (r.cssRules && r.cssRules.length) quiet(r.cssRules)
    }
  }
  const done = new WeakSet()
  const quietAll = () => {
    for (const sh of document.styleSheets) {
      if (done.has(sh)) continue
      try {
        quiet(sh.cssRules)
        done.add(sh)
      } catch {
        /* not loaded yet, or another origin's */
      }
    }
  }
  new MutationObserver(quietAll).observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
  })
  addEventListener('load', quietAll, true) // a stylesheet's link has loaded
  // B555: a web page document is drawn in a frame of its own (WebPage.tsx), sandboxed apart from the page. A story's
  // pointer (Storybook's stand-in for the mouse and the finger, src/stories/lib/twin.ts) has to reach into it to point
  // at or pick a part, as a real one does; so here, and only here, the frame is let be of the page's origin. What the
  // page and the frame's own script do is unchanged.
  const setAttr = Element.prototype.setAttribute
  Element.prototype.setAttribute = function (name, value) {
    if (this.tagName === 'IFRAME' && String(name).toLowerCase() === 'sandbox' && !/allow-same-origin/.test(value))
      value = value + ' allow-same-origin'
    return setAttr.call(this, name, value)
  }
  if (navigator.serviceWorker) navigator.serviceWorker.register = () => new Promise(() => {}) // no offline copy here
  // T456, F479, B540: Storybook never asks for your microphone: the page "hears" a recorded sentence (fixtures/mic.webm,
  // the Mac's reading voice), played over and over, so its own recorder and meter draw the waveform of real speech
  // T457: a Demo says its own sentence (fixtures/said-<clip>.webm), which its speech model hears
  let said = ''
  try {
    said = JSON.parse(h.get('server') || '{}').mic || ''
  } catch {
    /* no demo */
  }
  const micClip = real(FX + (said ? `said-${said}.webm` : 'mic.webm')).then((r) => r.arrayBuffer())
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
      const level =
        Math.max(0, Math.sin(t * 7.3) * 0.5 + Math.sin(t * 2.1 + 1) * 0.35 + 0.25) * (t % 3.4 < 0.35 ? 0.1 : 1)
      for (let i = 0; i < buf.length; i++) buf[i] = 128 + Math.round((Math.random() * 2 - 1) * 70 * level)
    }
  }
  // B555: a voice note played before any tap in its page (a story's steps play it) is stopped by the browser until one
  // comes; the speaker is a device Storybook stands in for, so it plays on, muted: the page's own player runs as it does
  if (window.HTMLMediaElement) {
    const play = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function () {
      return play.call(this).catch((e) => {
        if (!e || e.name !== 'NotAllowedError') throw e
        this.muted = true
        return play.call(this)
      })
    }
  }
  if (window.MediaRecorder) {
    const note = fetch(FX + 'mic.webm') // the demo's sentence, whatever the voice notes' names are this time
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
