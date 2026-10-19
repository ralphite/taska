/// <reference lib="webworker" />
// Taska's service worker (F192, F195). It makes Taska installable, keeps the page itself (scripts, styles, icons)
// so it opens fast and opens at all while the server restarts, and is where phone notifications arrive. Data is
// never cached: every API request goes to the network as usual.
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: { url: string; revision: string | null }[] }

const CACHE = 'taska-shell-v2'
const SHELL = self.__WB_MANIFEST.map((e) => '/' + e.url.replace(/^\//, ''))

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE)
      await Promise.allSettled(SHELL.map((u) => c.add(u)))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keep = new Set(SHELL.map((u) => new URL(u, self.location.origin).href))
      const c = await caches.open(CACHE)
      for (const req of await c.keys()) if (!keep.has(req.url)) await c.delete(req)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/assets/')) {
    // built files carry their content hash in the name: the cached copy is the right one
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)))
    return
  }
  if (req.mode === 'navigate') {
    // the page: from the network; while the server is away, the kept copy, which waits and sends later
    e.respondWith(fetch(req).catch(async () => (await caches.match('/index.html')) || Response.error()))
  }
})

// A push carries nothing (F195): what needs you is asked of Taska itself, so the push service never sees it.
interface Need {
  project: string
  ptitle?: string
  code: string
  title: string
  kind: string
}
const WORDS: Record<string, string> = {
  ask: 'asks you',
  block: 'is blocked',
  proposed: 'waits for approval',
  review: 'is ready to accept',
}
self.addEventListener('push', (e) => {
  e.waitUntil(
    (async () => {
      let list: Need[]
      try {
        list = (await (await fetch('/api/needs', { credentials: 'include', cache: 'no-store' })).json()) as Need[]
      } catch {
        list = []
      }
      const one = list.length === 1 ? list[0] : undefined
      const say = (x: Need) => `${x.code} ${WORDS[x.kind] || 'needs you'} · ${x.ptitle || x.project}`
      const first = list[0]
      await self.registration.showNotification(
        one
          ? `${one.code} ${WORDS[one.kind] || 'needs you'}`
          : list.length
            ? `${list.length} things need you`
            : 'Taska',
        {
          body: one
            ? `${one.title} · ${one.ptitle || one.project}`
            : list.length
              ? list.slice(0, 3).map(say).join('\n')
              : 'Something new needs you',
          tag: 'taska-needs-you',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          data: {
            url: one
              ? `/p/${encodeURIComponent(one.project)}/${encodeURIComponent(one.code)}`
              : first
                ? `/p/${encodeURIComponent(first.project)}/`
                : '/',
          },
          ...({ renotify: true } as object),
        },
      )
    })(),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    (async () => {
      const url = (e.notification.data as { url?: string } | null)?.url || '/'
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const win = open[0]
      if (win) {
        await win.focus()
        await win.navigate(url)
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})
