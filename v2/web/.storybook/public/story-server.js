// T457 (#6481, D68): the real Taska server, running in the page. The Demo stories load it (app.html#...&server=1,
// through app-shim.js): Pyodide runs the server's own Python code (/storybook/server/taska/, the same files Taska
// runs) on a copy of the demo's data (fixtures/demo-data.zip, made by v2/tools/story_fixtures.py), in memory. Every
// request the page makes is answered by that server, so a tap really changes the data, as in Taska; a reload starts
// from the demo again. Nothing of Taska is written again here: this file only carries requests in and answers out.
// What has no place in a page is stood in for in story_server.py: the speech model (the microphone's sentence is
// heard), the organizer's model (the demo gives its commands), threads (work is done at once).
;(() => {
  const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/'
  const FX = '/storybook/fixtures/'
  const HEARING_MS = 1500 // how long a voice note takes to be heard, as with Taska's speech model on a good day
  const POLL_MS = 300 // a waiting page hears of a change this soon
  const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/
  const TIME_KEYS = new Set(['t', 'at', 't0', 't1', 'next', 'seen'])
  // the demo was made at one moment: the server's clock runs that far back, and every time it answers moves on by
  // as long, so "5 min ago" stays 5 min ago and what you do now is "now"
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
  const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms))
  const log = (window.__storyLog = [])
  const enc = new TextEncoder(),
    dec = new TextDecoder()

  const ready = (async () => {
    const { loadPyodide } = await import(PYODIDE + 'pyodide.mjs')
    const [py, data, boot] = await Promise.all([
      loadPyodide({ indexURL: PYODIDE }),
      fetch(FX + 'demo-data.zip').then((r) => r.arrayBuffer()),
      fetch('/storybook/story_server.py').then((r) => r.text()),
    ])
    await py.loadPackage('sqlite3')
    py.unpackArchive(data, 'zip', { extractDir: '/data' })
    const story = JSON.parse(py.FS.readFile('/data/story.json', { encoding: 'utf8' }))
    const shift = Date.now() - story.now
    py.globals.set('SHIFT', shift / 1000)
    py.globals.set('MIC', story.mic)
    py.runPython(boot)
    const call = py.globals.get('call')
    /** one request, as Taska gets it: -> {status, headers, body (bytes)} */
    const raw = (method, path, type, body) => {
      const out = call(method, path, type || '', body || new Uint8Array()).toJs()
      const at = out.findIndex((_, i) => out[i] === 13 && out[i + 1] === 10 && out[i + 2] === 13 && out[i + 3] === 10)
      const head = dec.decode(out.slice(0, at)).split('\r\n')
      const headers = Object.fromEntries(
        head.slice(1).map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]),
      )
      return { status: +head[0].split(' ')[1], headers, body: out.slice(at + 4) }
    }
    const answer = (r) => {
      const type = r.headers['Content-Type'] || ''
      let body = r.body
      if (type.startsWith('application/json')) body = JSON.stringify(move(JSON.parse(dec.decode(body)), shift))
      return new Response(r.status === 304 ? null : body, { status: r.status, headers: r.headers })
    }
    const server = {
      py,
      raw,
      async fetch(u, method, type, body, signal) {
        const path = u.pathname + u.search
        if (!/\/api\/poll$/.test(u.pathname))
          log.push(`${method} ${path} ${typeof body === 'string' ? body.slice(0, 300) : ''}`) // what the page asked, to look at
        if (/\/api\/poll$/.test(u.pathname)) {
          // the page waits for news: asked again until something changed (the server itself would hold the
          // request; a page has one thread, so the waiting is done here)
          const want = Object.fromEntries(u.searchParams)
          for (;;) {
            const r = raw('GET', path.replace(/([?&])wait=\d+/, '$1') + '&wait=0')
            const d = JSON.parse(dec.decode(r.body))
            if (
              d.rev !== +want.rev ||
              d.boot !== want.boot ||
              (+want.pv >= 0 && d.pv !== +want.pv) ||
              want.wait === '0'
            ) {
              delete d.ver // no new page code can come from here
              return new Response(JSON.stringify(d), { status: 200, headers: { 'Content-Type': 'application/json' } })
            }
            await sleep(POLL_MS)
            if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
          }
        }
        const bytes = body == null ? null : new Uint8Array(await new Response(body).arrayBuffer())
        if (u.pathname.endsWith('/api/transcript') && method === 'POST') await sleep(HEARING_MS)
        return answer(raw(method, path, type, bytes))
      },
      /** an agent writes to Taska, in its own words (the commands of /agent) */
      agent(project, text, by = 'claude-code') {
        const r = raw('POST', `/p/${project}/do?by=${by}`, 'text/plain', enc.encode(text))
        const out = dec.decode(r.body)
        if (/^err/m.test(out)) throw new Error(`demo agent: ${out}`)
        return out
      },
      /** the organizer files the newest input with these commands, as its model would have written them */
      organize(project, plan) {
        py.globals.get('organize')(project, plan)
      },
      /** what the speech model hears in the next voice note: {tr, doubts...}, or the microphone's sentence */
      heard(said) {
        py.globals.set('HEARD', py.toPy(said || {}))
      },
      /** a file Taska keeps (a picture, a voice note), for the page to show: a blob address */
      file: (() => {
        const made = new Map()
        return (path) => {
          if (!made.has(path)) {
            const r = raw('GET', path)
            made.set(path, URL.createObjectURL(new Blob([r.body], { type: r.headers['Content-Type'] })))
          }
          return made.get(path)
        }
      })(),
    }
    // the demo's beginning (Player in src/stories/lib/player.tsx): what was said and done before it starts, in the
    // agents' commands; a line "you: ..." is Yadong's own
    let seed = {}
    try {
      seed = JSON.parse(window.__storySeed || '{}')
    } catch {
      /* no beginning of its own */
    }
    if (seed.heard) server.heard(seed.heard)
    let block = []
    const flush = () => block.length && server.agent(seed.project, block.splice(0).join('\n'))
    for (const l of (seed.before || '').split('\n')) {
      if (!l.trim()) continue
      if (!l.startsWith('you: ')) {
        block.push(l)
        continue
      }
      flush()
      server.agent(seed.project, l.slice(5), 'you')
    }
    flush()
    return server
  })()
  ready.catch((ex) => console.error('story server', ex))
  window.__storyServer = ready
})()
