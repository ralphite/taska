// What a Demo's page has around it (T589): the page is the real one, in a frame of its own; only what it reaches
// outside itself is the Demo's. Its storage and its address are kept in memory (gone with the frame), it is always the
// window you are in, it has no copy kept for later and no service worker, its clock starts at the demo data's time,
// its microphone plays a fixed recording, and it reaches no server: its requests go to the replay (or, while
// recording, through the recording script's hook), and every other way out of the frame is closed.

import { Http, type Transport } from '../../api/http'
import type { AppEnv } from '../../app/createApp'
import type { History } from '../../stores/route'
import { memoryStore } from '../../stores/storage'
import { memoryVault } from '../../stores/noteVault'
import { noCache } from '../../sync/cache'
import type { Presence } from '../../sync/projectSync'

type Win = Window & typeof globalThis

/** The address, in memory: Back and Forward as the browser's, nothing written to the frame's own address. */
export function memoryHistory(start: string): History {
  const stack: { url: string; state: unknown }[] = [{ url: start, state: null }]
  let i = 0
  const heard = new Set<() => void>()
  const at = () => new URL(stack[i].url, 'http://demo.invalid')
  const full = (url: string) => {
    const u = new URL(url, at())
    return u.pathname + u.search + u.hash
  }
  const go = (n: number) => {
    const j = Math.max(0, Math.min(stack.length - 1, i + n))
    if (j === i) return
    i = j
    setTimeout(() => heard.forEach((fn) => fn()))
  }
  return {
    location: () => ({ path: at().pathname, search: at().search, hash: at().hash }),
    push: (url, state) => {
      stack.splice(i + 1)
      stack.push({ url: full(url), state: state ?? null })
      i += 1
    },
    replace: (url, state) => {
      stack[i] = { url: full(url), state: state ?? null }
    },
    state: () => stack[i].state,
    back: () => go(-1),
    backBy: (n) => go(-n),
    listen: (fn) => {
      heard.add(fn)
      return () => heard.delete(fn)
    },
  }
}

/** Always the window you are in: the page waits for news as it does while you use it. */
export const foreground: Presence = {
  hidden: () => false,
  focused: () => true,
  nap: (ms) => new Promise((ok) => setTimeout(ok, ms)),
  blurred: () => new Promise(() => {}),
  watch: () => () => {},
}

/** The frame's clock starts at `at` (the demo data's time, ms) and runs on from there. */
export function fixClock(w: Win, at: number) {
  const Real = w.Date
  const off = at - Real.now()
  class DemoDate extends Real {
    constructor(...a: unknown[]) {
      if (a.length) super(...(a as [number]))
      else super(Real.now() + off)
    }
    static now() {
      return Real.now() + off
    }
  }
  w.Date = DemoDate as DateConstructor
}

/** The frame's microphone: it plays `clip` (a data: address, so nothing is fetched) for as long as the page records; a
 * Demo that says nothing has none. */
export function fixMic(w: Win, clip?: string) {
  const md = w.navigator.mediaDevices
  if (!md) return
  md.getUserMedia = async () => {
    if (!clip) throw new DOMException('This Demo has no microphone', 'NotFoundError')
    const ac = new w.AudioContext()
    if (ac.state === 'suspended') await ac.resume().catch(() => {})
    const bytes = Uint8Array.from(w.atob(clip.slice(clip.indexOf(',') + 1)), (c) => c.charCodeAt(0))
    const src = ac.createBufferSource()
    src.buffer = await ac.decodeAudioData(bytes.buffer)
    const out = ac.createMediaStreamDestination()
    src.connect(out)
    src.start()
    for (const t of out.stream.getTracks()) {
      const stop = t.stop.bind(t)
      t.stop = () => {
        stop()
        void ac.close().catch(() => {})
      }
    }
    return out.stream
  }
}

/** Every way out of the frame the page could use, closed: a request it makes besides the Demo's is an error. */
export function lockNetwork(w: Win) {
  const no = (what: string) => new TypeError(`A Demo reaches no server (${what})`)
  w.fetch = () => Promise.reject(no('fetch'))
  for (const k of ['XMLHttpRequest', 'WebSocket', 'EventSource'] as const)
    Object.defineProperty(w, k, {
      configurable: true,
      value: function closed() {
        throw no(k)
      },
    })
  w.navigator.sendBeacon = () => false
  if (w.navigator.serviceWorker) w.navigator.serviceWorker.register = () => Promise.reject(no('service worker'))
}

/** What the recording script hands the frame while it records (web/scripts/record-demo.mjs): the real server, through
 * the script. A Demo shown to you has none. */
export type DemoNet = (req: { method: string; url: string; headers: Record<string, string>; body?: string }) => Promise<{ status: number; text: string; type: string }>

const base64 = (buf: ArrayBuffer) => {
  let s = ''
  const b = new Uint8Array(buf)
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(s)
}

/** The page's requests through the recording script's hook. */
export function recordingTransport(net: DemoNet): Transport {
  return async (url, init) => {
    const b = init.body
    const body = b == null ? undefined : typeof b === 'string' ? b : b instanceof Blob ? 'base64:' + base64(await b.arrayBuffer()) : String(b)
    const ask = net({ method: init.method ?? 'GET', url, headers: (init.headers ?? {}) as Record<string, string>, body })
    const signal = init.signal
    const left = new Promise<never>((_, fail) => signal?.addEventListener('abort', () => fail(new DOMException('The page let go', 'AbortError')), { once: true }))
    const r = await Promise.race([ask, left])
    return new Response(r.text, { status: r.status, headers: { 'Content-Type': r.type } })
  }
}

/** The page's surroundings in the frame, its network `transport`. */
export function frameEnv(transport: Transport, start: string, desk: boolean): AppEnv {
  return {
    http: new Http(transport),
    kv: memoryStore(),
    session: memoryStore(),
    history: memoryHistory(start),
    presence: foreground,
    cache: noCache,
    vault: memoryVault(),
    pageScript: '',
    desk: () => desk,
  }
}
