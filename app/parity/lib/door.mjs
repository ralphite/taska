// One front door for both Taskas: the two pages are at the same address (http://127.0.0.1:<door>/...), so every
// address a page shows or uses (the agent's curl lines, links, the address bar) is the same text on both sides.
// Each request goes to side A's or side B's server by the parity_side cookie of the browser context it comes from
// (or the X-Parity-Side header, for the agent calls made from here). The Host header is passed on unchanged and
// no X-Forwarded header is added, so each server answers exactly as it would to a browser on this machine.
import http from 'node:http'
import net from 'node:net'

export const SIDE_COOKIE = 'parity_side'

function sideOf(req) {
  const h = req.headers['x-parity-side']
  if (h) return h
  const m = new RegExp(`(?:^|;\\s*)${SIDE_COOKIE}=(\\w+)`).exec(req.headers.cookie || '')
  return m?.[1]
}
function clean(headers) {
  const out = { ...headers }
  delete out['x-parity-side']
  if (out.cookie) {
    out.cookie = out.cookie
      .split(/;\s*/)
      .filter((c) => !c.startsWith(SIDE_COOKIE + '='))
      .join('; ')
    if (!out.cookie) delete out.cookie
  }
  return out
}

/** targets: { a: port, b: port } -> { base, port, close(), log } ; log: one row per request: side, method, path, status, ms. */
export async function openDoor(port, targets) {
  const log = []
  const server = http.createServer((req, res) => {
    const side = sideOf(req)
    const to = targets[side]
    if (!to) {
      res.writeHead(421, { 'Content-Type': 'text/plain' })
      res.end(`parity door: this request has no side (${req.method} ${req.url})`)
      log.push({ side: '?', method: req.method, path: req.url, status: 421, ms: 0 })
      return
    }
    const t0 = Date.now()
    const row = { side, method: req.method, path: req.url, status: 0, ms: 0, t: t0 }
    log.push(row)
    const up = http.request({ host: '127.0.0.1', port: to, method: req.method, path: req.url, headers: clean(req.headers) }, (r) => {
      row.status = r.statusCode
      res.writeHead(r.statusCode, r.statusMessage, r.rawHeaders)
      r.pipe(res)
      r.on('end', () => (row.ms = Date.now() - t0))
    })
    up.on('error', (e) => {
      row.status = 502
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' })
      res.end(`parity door: ${e.message}`)
    })
    res.on('close', () => up.destroy()) // the page went away (offline, another page): the server sees it go too
    req.pipe(up)
  })
  server.on('upgrade', (req, sock, head) => {
    const to = targets[sideOf(req)]
    if (!to) return sock.destroy()
    const up = net.connect(to, '127.0.0.1', () => {
      const h = clean(req.headers)
      up.write(`${req.method} ${req.url} HTTP/1.1\r\n` + Object.entries(h).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n')
      if (head?.length) up.write(head)
      up.pipe(sock)
      sock.pipe(up)
    })
    up.on('error', () => sock.destroy())
    sock.on('error', () => up.destroy())
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  return {
    port,
    base: `http://127.0.0.1:${port}`,
    log,
    close: () =>
      new Promise((r) => {
        server.closeAllConnections?.()
        server.close(() => r())
      }),
  }
}
