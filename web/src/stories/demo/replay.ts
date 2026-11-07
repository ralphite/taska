// A Demo's server (T589, r858, r881): the answers a real Taska gave when the same steps were played against it
// (web/scripts/record-demo.mjs), handed back to the page in the order they came. No server code runs here and nothing
// is worked out: an answer is only ever one that was recorded.
//
// - A request gets the next recorded answer to the same request (its method and path, in the order they came).
// - An answer the server gave because of something the page sent (the organizer filing what you said, a voice note's
//   words) waits until the page has sent that too, then as long again as it took the server.
// - The long wait for news (changes?wait=25) is held like the real server holds it: the news when it is due, else
//   "nothing new" after the wait. A page that waits is never answered "away", so it never thinks it is offline.
// - A read asked again after its recorded answers ran out gets the last of them. Off the route (a change, or a read
//   never recorded) nothing answers, as a server that stopped at this step (Restart starts again).

import type { Transport } from '../../api/http'

/** One request the page made while recording, and the server's answer. */
export interface Exchange {
  method: string
  /** the address, from its path on (/p/shop/api/view) */
  url: string
  status: number
  /** the answer: its JSON as it came, or its words */
  json?: unknown
  text?: string
  /** ms from the start: when the request came, when the answer went */
  sent: number
  at: number
}

/** A Demo's answers for one layout. */
export interface Recording {
  demo: string
  layout: string
  /** when it was recorded, and from which commit */
  made: string
  exchanges: Exchange[]
}

/** The long wait for news, and how long it waits (0: it asks and lets go). */
export const pollWait = (url: string) => {
  const m = /\/api\/changes\?(?:.*&)?wait=(\d+)/.exec(url)
  return m ? Number(m[1]) : null
}
const pathOf = (url: string) => url.split('?')[0]
const isChange = (method: string) => method !== 'GET'
const same = (x: Exchange) => !!(x.json && typeof x.json === 'object' && (x.json as { same?: boolean }).same)

/** When an answer may go: once the page has sent `after` changes (the ones the server had when it answered), `delay`
 * ms after the last of them (or after the request, when that came later). */
export interface Due {
  after: number
  delay: number
}

/** When each recorded answer may go. A long wait answered with news was answered because of the changes that came
 * before its answer; any other request is answered with what the server had when it came. */
export function dues(exchanges: Exchange[]): Due[] {
  const changes = exchanges.filter((x) => isChange(x.method)).map((x) => x.sent).sort((a, b) => a - b)
  return exchanges.map((x) => {
    const by = pollWait(x.url) ? x.at : x.sent
    const after = changes.filter((t) => t < by).length
    const last = after ? changes[after - 1] : 0
    return { after, delay: Math.max(0, Math.min(8000, x.at - Math.max(x.sent, last))) }
  })
}

export interface ReplayLog {
  /** requests no answer was recorded for */
  unmatched: string[]
  /** reads asked again after their recorded answers ran out, given the last one */
  again: number
  /** answers given */
  answered: number
  /** long waits for news answered "nothing new" (as the server does after the wait) */
  nothingNew: number
}

/** The page's network, answered from `rec`. `clock` and `later` are the frame's own (tests pass fakes). */
export function replay(rec: Recording, Res: typeof Response = Response, clock: () => number = () => performance.now(), later: typeof setTimeout = setTimeout): { transport: Transport; log: ReplayLog } {
  const xs = rec.exchanges
  const due = dues(xs)
  const used = new Set<number>()
  const sentAt: number[] = [] // when the page sent each change, in order
  const waiting = new Set<() => void>() // answers waiting for a change the page has not sent yet
  const log: ReplayLog = { unmatched: [], again: 0, answered: 0, nothingNew: 0 }
  const template = xs.find((x) => same(x))?.json as { server?: unknown } | undefined
  const answer = (x: Exchange) => {
    log.answered += 1
    return new Res(x.text ?? JSON.stringify(x.json), { status: x.status, headers: { 'Content-Type': x.json !== undefined ? 'application/json' : 'text/plain' } })
  }
  const nothingNew = (url: string) => {
    log.answered += 1
    log.nothingNew += 1
    const cursor = new URLSearchParams(url.split('?')[1] ?? '').get('cursor')
    return new Res(JSON.stringify({ cursor, same: true, server: template?.server ?? { page: '', update: false } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  /** resolves when answer i may go; -> how to stop waiting */
  const whenDue = (i: number, asked: number, go: () => void): (() => void) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const check = () => {
      const d = due[i]
      if (sentAt.length < d.after) return false
      waiting.delete(check)
      const from = Math.max(asked, d.after ? sentAt[d.after - 1] : 0)
      timer = later(go, Math.max(0, from + d.delay - clock()))
      return true
    }
    if (!check()) waiting.add(check)
    return () => {
      waiting.delete(check)
      if (timer !== undefined) clearTimeout(timer)
    }
  }
  const aborted = () => new DOMException('The page let go', 'AbortError')

  const transport: Transport = (url, init) =>
    new Promise<Response>((ok, fail) => {
      const method = (init.method ?? 'GET').toUpperCase()
      const asked = clock()
      const stops: (() => void)[] = []
      const end = () => stops.forEach((s) => s())
      const signal = init.signal
      if (signal?.aborted) return fail(aborted())
      signal?.addEventListener('abort', () => (end(), fail(aborted())), { once: true })
      if (isChange(method)) {
        sentAt.push(asked)
        for (const w of [...waiting]) w()
      }
      const wait = method === 'GET' ? pollWait(url) : null
      if (wait) {
        // the long wait for news: the news recorded for this same question when it is due, else nothing new after the
        // wait (as the server answers)
        const i = xs.findIndex((x, j) => !used.has(j) && x.method === 'GET' && x.url === url && !same(x))
        const t = later(() => (end(), ok(nothingNew(url))), wait * 1000)
        stops.push(() => clearTimeout(t))
        if (i >= 0)
          stops.push(
            whenDue(i, asked, () => {
              if (signal?.aborted || used.has(i)) return
              used.add(i)
              end()
              ok(answer(xs[i]))
            }),
          )
        return
      }
      const path = pathOf(url)
      const i = xs.findIndex((x, j) => !used.has(j) && x.method === method && pathOf(x.url) === path && !pollWait(x.url))
      if (i < 0) {
        // asked again (a read the page repeats as time goes by): what it said last; a change, or a read never
        // recorded: no answer (the server stopped at this step)
        const last = method === 'GET' ? xs.findLast((x) => x.method === 'GET' && pathOf(x.url) === path && !pollWait(x.url)) : undefined
        if (last) {
          log.again += 1
          ok(answer(last))
        } else log.unmatched.push(`${method} ${url}`)
        return
      }
      used.add(i)
      stops.push(whenDue(i, asked, () => (end(), ok(answer(xs[i])))))
    })
  return { transport, log }
}
