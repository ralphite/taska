// T457: the real Taska page in a story. It runs before the page's own code: it moves the address to the place the
// story shows (#path=...), and answers the page's requests from saved answers (fixtures/) instead of a server.
;(() => {
  const h = new URLSearchParams(location.hash.slice(1))
  const theme = h.get('theme')
  if (theme) document.documentElement.dataset.theme = theme
  history.replaceState(null, '', h.get('path') || '/p/shop/')
  const real = window.fetch.bind(window)
  const FX = '/storybook/fixtures/'
  const json = (o, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } })
  window.fetch = async (input, init) => {
    const u = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href)
    const p = u.pathname
    if (u.origin !== location.origin || p.startsWith('/storybook/') || p.startsWith('/assets/'))
      return real(input, init)
    const method = String((init && init.method) || (input instanceof Request ? input.method : 'GET')).toUpperCase()
    if (/\/api\/poll$/.test(p)) return new Promise(() => {}) // nothing changes while you look
    if (method !== 'GET') return json({ ok: true, res: ['ok'], rev: 1 })
    const name = p.replace(/^\/|\/$/g, '').replace(/\//g, '__')
    for (const ext of ['.json', '.txt', '']) {
      const r = await real(FX + name + ext)
      if (r.ok) return r
    }
    return json({ ok: false, error: 'not in the story data' }, 404)
  }
  if (navigator.serviceWorker) navigator.serviceWorker.register = () => new Promise(() => {}) // no offline copy here

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
