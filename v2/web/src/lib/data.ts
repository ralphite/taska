// Taska's state on screen, and saving (T160). Every request has a time limit: a dead connection fails after a while
// instead of hanging, and the screen says so. One-tap changes show at once and are saved behind you, one at a time and
// in order; until Taska has a change it is kept as a patch over Taska's last state, so a refresh meanwhile doesn't
// take it off the screen. A save that fails takes its patch back, and a red toast says so, with Retry.
import { BEHAVIOUR } from './behaviour'
import { LETTER, SAID } from './constants'
import { failedRetry, toast } from './toast'
import {
  CLOSED,
  DR,
  U,
  bump,
  byN,
  byR,
  code,
  ctx,
  desk,
  kids,
  liveN,
  model,
  openKids,
  plural,
  render,
  sleep,
  type UndoEntry,
} from './state'
import type { Item, ProjectRow, State } from './types'
import { mergeDrafts, draftStore, goDraft } from './drafts'
import { fixURL, writeURL } from './url'
import { noticeItems, noticeProjects } from './notices'
import { holdRow } from './listhold'
import { noteWith, resendOutbox } from './outbox'
import { advanceDesk } from './go'
import { closeItem } from './nav'

export const NET = { op: 10000, state: 30000, get: 15000 } // ms
export class NetError extends Error {
  net = true
}
export async function net<T = unknown>(
  url: string,
  opts: RequestInit = {},
  ms = NET.get,
  as: 'json' | 'text' = 'json',
): Promise<T> {
  const ctl = new AbortController(),
    t = setTimeout(() => ctl.abort(), ms),
    t0 = Date.now()
  let status = 0
  try {
    const r = await fetch(url, { cache: 'no-store', ...opts, signal: ctl.signal })
    status = r.status
    const out = (as === 'text' ? await r.text() : await r.json()) as T
    const ms = Date.now() - t0
    if (ms > 1000 && !/\/api\/(poll|transcript)|[?&]wait=/.test(url)) slowLog(url, ms, String(status)) // F334
    if (opts.method === 'POST' && NETLOG.list.length) sendNetlog() // what failed before goes now that Taska answers
    return out
  } catch {
    const why = ctl.signal.aborted ? 'timeout' : status ? 'bad answer' : 'unreachable'
    if (opts.method === 'POST')
      NETLOG.list.push({
        t: new Date().toISOString(),
        why,
        url: url.replace(/^.*\/p\//, '/p/'),
        ms: Date.now() - t0,
        status,
      })
    throw new NetError(ctl.signal.aborted ? 'No answer from Taska' : 'Taska is out of reach')
  } finally {
    clearTimeout(t)
  }
}
// B326: every save that did not go through is told to Taska once it answers again, so the log can count them
const NETLOG = { list: [] as Record<string, unknown>[], t: 0 }
// F334: whatever took more than a second, for the log: a page that came up slowly, a request that answered late
export function slowLog(url: string, ms: number, status = '') {
  if (!ctx.P) return // the log is a project's: the front page has none
  NETLOG.list.push({ t: new Date().toISOString(), why: 'slow', url: url.replace(/^.*\/p\//, '/p/'), ms, status })
  clearTimeout(NETLOG.t)
  NETLOG.t = window.setTimeout(sendNetlog, 3000)
}
// T335: what went wrong on the page (a script error, a red message) goes to the log too, with where you were
export function errorLog(msg: string, where: string) {
  if (!ctx.P) return
  const last = NETLOG.list[NETLOG.list.length - 1]
  if (last && last.msg === msg) return // the same error again at once: once is enough
  NETLOG.list.push({ t: new Date().toISOString(), why: 'error', url: location.pathname, msg: msg.slice(0, 300), where })
  clearTimeout(NETLOG.t)
  NETLOG.t = window.setTimeout(sendNetlog, 3000)
}
function sendNetlog() {
  const list = NETLOG.list.splice(0, 30)
  void fetch(ctx.P + 'api/netlog', JSON_POST({ list })).catch(() => NETLOG.list.unshift(...list))
}
export const JSON_POST = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
export interface OpAnswer {
  ok: boolean
  res: string[]
  rev?: number
  error?: string
}
// B326: a save that can't reach Taska (it restarts, the tunnel drops, no answer in time) is sent again by itself,
// for about a minute, under one id, so Taska does it once however often it arrives
const RETRY_MS = [1000, 2000, 4000, 8000, 15000, 30000]
let lastSaid = '' // what the latest save was, for a Not saved that was not told (B326)
export async function op(o: unknown): Promise<OpAnswer> {
  lastSaid = saidOp(o)
  const cid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  let d: (OpAnswer & { state?: State & { delta?: number } }) | null = null
  const g = gen,
    since = sinceQuery() // T339: what changed comes back with the answer, so the page changes after one trip
  for (let i = 0; !d; i++) {
    try {
      d = await net<OpAnswer>(ctx.P + 'api/op?cid=' + cid + (since ? '&' + since : ''), JSON_POST(o), NET.op)
    } catch (ex) {
      if (!(ex as { net?: boolean }).net || i >= RETRY_MS.length) throw ex
      await new Promise((ok) => setTimeout(ok, RETRY_MS[i]))
    }
  }
  if (!d.ok) {
    toast((d.res || []).find((x) => x.startsWith('err')) || d.error || 'Not saved', null, { error: true })
    throw new Error('op failed')
  }
  try {
    if (d.state && g === gen) applyState(d.state)
    else await load() // an answer kept from before (sent again) has no state with it
  } catch {
    /* it is saved; the next refresh brings the rest */
  }
  return d
}
// A save that didn't reach Taska after a minute of trying. Several in a row are retried together, in order. The toast
// stays until you act on it and says which changes they were (B326).
const failedWhat: string[] = []
export function notSaved(ex: unknown, retry?: () => unknown, what = lastSaid || 'a change') {
  if (!(ex as { net?: boolean })?.net) return
  if (retry) failedRetry.push(retry)
  if (!failedRetry.length) failedWhat.length = 0
  failedWhat.push(what)
  const k = failedWhat.length
  toast(
    `Not saved: ${failedWhat.slice(-3).join('; ')}${k > 3 ? ` and ${k - 3} more` : ''}`,
    failedRetry.length
      ? () => {
          failedWhat.length = 0
          for (const r of failedRetry.splice(0)) r()
        }
      : null,
    { error: true, label: 'Retry', sticky: true },
  )
}
// What a save was, in a few words, for the toast that says it did not go through
export function saidOp(o: unknown): string {
  const x = (Array.isArray(o) ? o[0] : o) as Record<string, unknown> | undefined
  if (!x) return 'a change'
  const f = x.f as Record<string, unknown> | undefined
  const word = (k: string, v: unknown) =>
    k === 'when'
      ? v === 'later'
        ? 'to Later'
        : 'back to now'
      : k === 'archived'
        ? v
          ? 'archived'
          : 'out of Archive'
        : k === 'status'
          ? `marked ${String(v)}`
          : k === 'pri'
            ? `set to ${String(v)}`
            : k === 'rank'
              ? 'moved in the list'
              : `${k} changed`
  if (x.op === 'set' && f)
    return `${String(x.ref)} ${Object.entries(f)
      .map(([k, v]) => word(k, v))
      .join(', ')}`
  if (x.op === 'input') return x.scope ? `your words to ${String(x.scope)}` : 'your new input'
  return `${String(x.op)}${x.ref ? ' ' + String(x.ref) : ''}`
}
export const notLoaded = (what: string, retry: () => unknown) =>
  toast(`Couldn't load ${what}`, retry, { error: true, label: 'Retry' })
// Something that waits for Taska before it shows: its button stays busy meanwhile
export async function save(o: unknown, retry?: () => unknown) {
  try {
    return await op(o)
  } catch (ex) {
    notSaved(ex, retry, saidOp(o))
    throw ex
  }
}

// ---------------------------------------------------------------- loading

export const SAVE = {
  q: Promise.resolve(true) as Promise<boolean>,
  pend: [] as Patch[],
  last: '',
  down: 0,
}
export interface Patch {
  n?: number
  f?: Record<string, unknown>
  cfg?: Record<string, unknown>
}
export const CACHE = new Map<string, string>() // each project's state as last loaded: switching back draws it at once (B292)
let gen = 0 // the project this page shows; a load or poll for another one is dropped
export const generation = () => gen
export function nextGeneration() {
  return ++gen
}

// T293: with a copy here, only what changed since comes over (everything, when Taska restarted meanwhile)
const sinceQuery = () => {
  const S = model.S as State & { sv?: number }
  return SAVE.last && S.sv ? `since=${S.sv}&boot=${encodeURIComponent(S.boot)}` : ''
}
export async function load() {
  const g = gen,
    since = sinceQuery()
  const text = await net<string>(ctx.P + 'api/state' + (since ? '?' + since : ''), {}, NET.state, 'text')
  if (g !== gen) return
  if (/^project \S+ was deleted/.test(text) || /^no project /.test(text)) {
    if (!U.leaving)
      void import('./switch').then(({ navigate }) => navigate('/?gone=' + encodeURIComponent(ctx.HERE), true))
    return
  }
  applyState(JSON.parse(text) as State & { delta?: number })
}
/** A state from Taska (all of it, or what changed since this page's copy) into the page. */
function applyState(d: State & { delta?: number }) {
  if (d.delta && SAVE.last) d = mergeState(JSON.parse(SAVE.last) as State, d)
  const text = JSON.stringify(d)
  SAVE.last = text
  CACHE.set(ctx.HERE, text)
  ingest(d)
  cachePut(text)
}
type Delta = State & { delta?: number; drop?: Record<string, (number | string)[]> }
/** T293: the changed items, inputs and documents into the copy this page has. */
export function mergeState(was: State, d: Delta): State {
  const w = was as unknown as Record<string, Record<string, unknown>[]>,
    dd = d as unknown as Record<string, Record<string, unknown>[]>
  for (const [kind, id] of [
    ['items', 'n'],
    ['inputs', 'id'],
    ['docs', 'd'],
  ] as const) {
    const drop = new Set(d.drop?.[kind] || []),
      fresh = new Map(dd[kind].map((x) => [x[id], x]))
    const out = w[kind].filter((x) => !drop.has(x[id] as number)).map((x) => fresh.get(x[id]) ?? x),
      have = new Set(out.map((x) => x[id]))
    for (const x of dd[kind]) if (!have.has(x[id])) out.push(x)
    w[kind] = out
  }
  const rest: Record<string, unknown> = { ...d }
  for (const k of ['items', 'inputs', 'docs', 'delta', 'drop']) delete rest[k]
  return Object.assign(was, rest)
}
// T293: the project's last state is kept in this browser (IndexedDB), so opening it again draws at once from there.
const SC = { db: null as Promise<IDBDatabase> | null, t: 0 }
const stateDB = () =>
  (SC.db ||= new Promise((ok, no) => {
    const r = indexedDB.open('taska-state', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('s')
    r.onsuccess = () => ok(r.result)
    r.onerror = () => no(r.error)
  }))
async function cacheGet(): Promise<string> {
  const read = (async () => {
    const db = await stateDB()
    return await new Promise<string>((ok) => {
      const q = db.transaction('s').objectStore('s').get(ctx.HERE)
      q.onsuccess = () => ok((q.result as string) || '')
      q.onerror = () => ok('')
    })
  })()
  try {
    return await Promise.race([read, new Promise<string>((ok) => setTimeout(() => ok(''), 300))]) // a slow store never holds the page up
  } catch {
    return ''
  }
}
function cachePut(text: string) {
  clearTimeout(SC.t)
  SC.t = window.setTimeout(async () => {
    try {
      ;(await stateDB()).transaction('s', 'readwrite').objectStore('s').put(text, ctx.HERE)
    } catch {
      /* no store */
    }
  }, 1500)
}
/** Draw from the kept copy first, then bring it up to date. */
export async function loadKept() {
  const kept = typeof indexedDB === 'undefined' ? '' : await cacheGet()
  if (kept && !SAVE.last)
    try {
      SAVE.last = kept
      ingest(JSON.parse(kept) as State)
    } catch {
      SAVE.last = ''
    }
  return load()
}
export function ingest(d: State, first = false) {
  noticeItems(d)
  model.S = d
  ctx.BASE = d.base || ctx.BASE
  byN.clear()
  byR.clear()
  for (const it of d.items) {
    if (CLOSED(it.status)) it.wait = null // closed: its question is history, not a pending ask (B128)
    byN.set(it.n, it)
  }
  for (const r of d.inputs) byR.set(r.id, r)
  for (const p of SAVE.pend) patch(p)
  linkKids()
  followCodes()
  const was = U.open && byN.get(U.open)?.merged_into ? U.open : null
  if (was) {
    U.open = liveN(was)
    writeURL(false)
  } // the item you look at was merged: the one it went into shows (B118)
  const moved = d.project ? mergeDrafts() : [],
    mine = was && moved.find(([f]) => f === code(was))
  if (was)
    toast(`${code(was)} was merged into ${code(U.open)}${mine ? '. What you wrote for it is in this box now' : ''}`)
  else if (moved.length)
    toast(
      `${moved.map(([f, t]) => `${f} → ${t}`).join(', ')}: merged, and what you wrote went along`,
      () => goDraft(moved[0][1]),
      {
        label: 'Go there',
      },
    )
  if (U.open && !byN.has(U.open) && (d.deleted || []).some((x) => x.items.some((i) => i.n === U.open))) {
    // deleted with its input (F177)
    if (desk()) {
      U.open = null
      writeURL(false)
    } else closeItem()
  }
  render()
  if (!first) fixURL()
  autoArchive()
}
// T274 #6: what was finished before today goes to Archive by itself, once a visit, with Undo (a switch: D21 #2)
const AA = { done: '' }
function autoArchive() {
  if (!BEHAVIOUR.autoArchive || !model.S.project || AA.done === model.S.project) return
  AA.done = model.S.project
  const day = new Date().setHours(0, 0, 0, 0),
    ids = model.S.items
      .filter(
        (it) =>
          !it.merged_into &&
          !it.archived &&
          it.type !== 'rule' &&
          CLOSED(it.status) &&
          Date.parse(it.t1 || it.t0) < day,
      )
      .map((it) => it.n)
  if (!ids.length) return
  const set = (on: boolean) =>
    optimistic(
      ids.map((n) => ({ n, f: { archived: on } })),
      () => op({ op: 'archive', refs: ids.map(code), on }),
    )
  set(true)
  toast(
    `Archived ${plural(ids.length, 'item')} finished before today`,
    pushUndo(`${plural(ids.length, 'finished item')} archived`, () => {
      toast(`Put back ${plural(ids.length, 'item')}`)
      return set(false)
    }),
  )
}
// An item's code follows its type: T13 becomes B13 (T113 S2). What you wrote to it goes along.
function followCodes() {
  const now = (k: string | null) => {
    const m = /^[A-Z](\d+)$/.exec(k || ''),
      n = m && Number(m[1])
    return n && byN.has(n) && code(n) !== k ? code(n) : null
  }
  for (const k of Object.keys(draftStore()).filter(now))
    draftStore((all) => {
      const to = now(k) as string
      if (!all[to]) all[to] = all[k]
      delete all[k]
    })
  for (const k of Object.keys(U.parked || {}).filter(now)) {
    const to = now(k) as string
    U.parked[to] ||= U.parked[k]
    delete U.parked[k]
  }
  if (now(U.draftKey)) U.draftKey = now(U.draftKey)
}

// R328: when an agent has new code for Taska while you are using it, Taska is not restarted under your hands: a toast
// offers it, and Restart restarts Taska and then this page. (Left alone for a minute, the deploy restarts it.)
const UPD = { told: false }
function offerRestart() {
  UPD.told = true
  toast(
    'Taska has an update',
    async () => {
      toast('Restarting Taska…')
      try {
        await fetch(ctx.P.replace(/\/p\/[^/]+\/$/, '/') + 'api/restart', { method: 'POST' })
      } catch {
        /* it may go before it answers */
      }
      const boot = model.S.boot
      for (let i = 0; i < 60; i++) {
        await new Promise((ok) => setTimeout(ok, 1000))
        try {
          const d = await (await fetch(`${ctx.P}api/poll?rev=0&boot=${boot}&wait=0`, { cache: 'no-store' })).json()
          if (d.boot && d.boot !== boot) return location.reload()
        } catch {
          /* still starting */
        }
      }
      location.reload()
    },
    { label: 'Restart', sticky: true },
  )
}
const POLL = { stop: () => {} }
/** T339: another project is shown now: this one's poll ends, its wait let go of. */
export function stopPoll() {
  nextGeneration()
  POLL.stop()
}
export async function poll(g: number) {
  while (g === gen) {
    const ctl = new AbortController(),
      timer = setTimeout(() => ctl.abort(), 35000) // a dead connection never answers
    // T293, T335: a browser keeps at most 6 connections to Taska, and a waiting poll holds one, so with a few windows
    // open a save waited its turn for 10 s. Only the window you are in waits for news; one you can see but are not in
    // asks every 5 s, one behind every 20 s, and each lets go at once. Leaving the window lets go of its wait too.
    const idle = document.hidden || !document.hasFocus()
    let left = false
    const leave = () => {
      left = true
      ctl.abort()
    }
    if (!idle) addEventListener('blur', leave)
    POLL.stop = leave // T339: switching project lets go of this project's wait at once
    try {
      const S = model.S
      const d = await (
        await fetch(`${ctx.P}api/poll?rev=${S.rev}&boot=${S.boot}&pv=${S.pv ?? -1}${idle ? '&wait=0' : ''}`, {
          cache: 'no-store',
          signal: ctl.signal,
        })
      ).json()
      if (g !== gen) return
      if (model.offline) {
        model.offline = 0
        bump('head', 'side')
        resendOutbox()
      } // Taska is back: what you sent meanwhile goes now (B151)
      const news = d.rev !== model.S.rev || d.boot !== model.S.boot || d.pv !== model.S.pv
      if (news) await load()
      if (d.ver && d.ver !== VERSION.page) VERSION.server = d.ver // R284: no reload by itself; the next reload brings it
      if (d.update && !UPD.told) offerRestart() // R328: new code waits for a restart, and you are using Taska: your call
      checkOthers()
      if (idle && !news) await napIdle(document.hidden ? 20000 : 5000)
    } catch {
      if (g !== gen) return
      if (left) continue // you went to another window: not a lost connection
      model.offline += ctl.signal.aborted ? 2 : 1
      bump('head', 'side')
      await sleep(model.offline > 1 ? Math.min(30000, 1500 * 2 ** Math.min(model.offline, 5)) : 500) // back off while the server is away
    } finally {
      clearTimeout(timer)
      removeEventListener('blur', leave)
    }
  }
}
export const VERSION = { page: '', server: '' }
/** A wait that ends early when the tab shows again or you come back to its window. */
const napIdle = (ms: number) =>
  new Promise<void>((ok) => {
    const done = () => {
      clearTimeout(t)
      removeEventListener('visibilitychange', done)
      removeEventListener('focus', done)
      ok()
    }
    const t = setTimeout(done, ms)
    addEventListener('visibilitychange', done)
    addEventListener('focus', done)
  })
export async function refresh() {
  try {
    await load()
    if (model.offline) {
      model.offline = 0
      bump('head', 'side')
    }
  } catch {
    /* the next poll tries again */
  }
}

export function patch(p: Patch) {
  // one change on screen: {n, f} for an item, {cfg} for the project
  if (p.cfg) {
    model.S.cfg = { ...model.S.cfg, ...p.cfg }
    return
  }
  const it = p.n != null ? byN.get(p.n) : undefined
  if (!it || !p.f) return
  const back = 'status' in p.f && !CLOSED(String(p.f.status)) && it.archived && !('archived' in p.f)
  Object.assign(it, p.f)
  if (back) it.archived = false // reopening brings an archived item back, as Taska does
  if (CLOSED(it.status)) it.wait = null
}
export function linkKids() {
  kids.clear()
  for (const it of model.S.items)
    if (it.parent && !it.merged_into) {
      if (!kids.has(it.parent)) kids.set(it.parent, [])
      kids.get(it.parent)?.push(it)
    }
}
const restore = () => {
  if (SAVE.last) ingest(JSON.parse(SAVE.last) as State)
}
// Show a change at once and save it behind you. -> a promise: true once saved, false if it couldn't be.
export function optimistic(
  patches: Patch[],
  send: () => Promise<unknown>,
  fail: (ex: unknown) => void = (ex) => notSaved(ex, undefined, patchesSaid(patches)),
  needed: () => boolean = () => true,
): Promise<boolean> {
  const drop = () => {
    SAVE.pend = SAVE.pend.filter((p) => !patches.includes(p))
  }
  SAVE.pend.push(...patches)
  for (const p of patches) patch(p)
  linkKids()
  followCodes()
  render()
  fixURL()
  const made = Date.now()
  return (SAVE.q = SAVE.q.then(async () => {
    try {
      if (!needed()) return true
      if (SAVE.down > made) throw new NetError('Taska is out of reach') // it waited behind a save that couldn't reach Taska
      await send()
      return true
    } catch (ex) {
      if ((ex as { net?: boolean }).net) SAVE.down = Date.now()
      drop()
      try {
        restore()
        fail(ex)
      } catch {
        /* nothing more to do */
      }
      return false
    } finally {
      drop()
    }
  }))
}
export const setNow = (n: number, f: Record<string, unknown>, retry?: () => unknown) => {
  const ref = code(n)
  return optimistic(
    [{ n, f }],
    () => op({ op: 'set', ref, f }),
    (ex) => notSaved(ex, retry, saidOp({ op: 'set', ref, f })),
  )
}
const patchesSaid = (patches: Patch[]) =>
  patches.length === 1
    ? saidOp({ op: 'set', ref: code(patches[0].n), f: patches[0].f })
    : `${patches.length} items changed`

// ---------------------------------------------------------------- changes with Undo

export const saidOf = (f: string, v: unknown, before: unknown, ref: string) =>
  f === 'archived'
    ? v
      ? 'archived'
      : 'unarchived'
    : f === 'status' && v === 'done' && before === 'review'
      ? 'accepted'
      : f === 'status' && v === 'open' && before === 'proposed'
        ? 'approved'
        : f === 'pri'
          ? `is now ${v}`
          : f === 'type'
            ? `is now ${LETTER[v as Item['type']]}${ref.slice(1)}, ${/^[aeiou]/.test(String(v)) ? 'an' : 'a'} ${v}`
            : f === 'parent'
              ? v
                ? `is now under ${code(v as number)}`
                : 'stands on its own'
              : f === 'rank'
                ? v == null
                  ? 'is back in order'
                  : 'goes next in its priority'
                : SAID[String(v)]
export const wire = (f: string, v: unknown) => (f === 'parent' ? (v ? String(v) : 'none') : v) // a parent goes to Taska as an item ref

// One-tap changes (swipes, row pills, the focus card, keys, the ... menu): they show at once and are saved behind you,
// say what happened and offer Undo, which puts the old value back; Z does the same (T113 A7).
export function change(
  n: number,
  f: string,
  v: unknown,
  { said, note }: { said?: string; note?: string } = {},
): Promise<boolean> {
  const it = byN.get(n) as (Item & Record<string, unknown>) | undefined
  if (!it || it[f] === v) return Promise.resolve(!!it)
  const before = it[f],
    ref = code(n),
    job = { saved: false, undone: false }
  said ||=
    (it.type === 'rule' &&
      f === 'status' &&
      before !== 'proposed' &&
      ({ open: 'is active again', dropped: 'is retired' } as Record<string, string>)[String(v)]) ||
    saidOf(f, v, before, ref) // a rule's words (B158)
  const words = said as string
  // eslint-disable-next-line prefer-const -- the Undo below refers to it before it is made
  let run: (() => Promise<unknown>) & { entry?: UndoEntry }
  const undo = () => {
    job.undone = true
    U.settle.delete(n) // T241: the row shows the item again, not the line saying what was done
    if (U.go) {
      U.go.done.delete(n)
      delete U.go.how?.[n]
    }
    toast(`${ref} put back`)
    return optimistic(
      [{ n, f: { [f]: before } }],
      () => {
        const u = (model.S.undo || []).find((u) => u.n === n && f in u.f) // the recorded change, so the change log knows it was undone (F80)
        return u ? revert(u.seq) : op({ op: 'set', ref, f: { [f]: wire(f, before) } })
      },
      (ex) => notSaved(ex, run),
      () => job.saved,
    ) // a change that never reached Taska has nothing to put back there
  }
  run = pushUndo(`${ref} ${words}`, undo)
  const settles = desk() && !!U.go && U.go.list.includes(n) && f === 'status'
  if (desk() && n === U.open)
    U.stepFrom = {
      n,
      rows: [...document.querySelectorAll<HTMLElement>('#list [data-act="open"][data-n]')].map((el) =>
        Number(el.dataset.n),
      ),
    } // J goes on from here (B124)
  if (settles && U.go) {
    U.go.done.add(n)
    U.go.how[n] = words.replace(/^is (marked )?/, '').replace(/^./, (c) => c.toUpperCase())
    U.go.undo[n] = run
  }
  if (!settles && (n !== U.open || desk())) holdRow(n, `${words.replace(/^./, (c) => c.toUpperCase())}`, run) // the row you acted on holds still (B148)
  const left = f === 'status' && v === 'done' ? openKids(n) : 0 // done before its subitems: say so (B147)
  const noted = f === 'status' && noteWith(n) // B4: what you wrote for it goes with your decision
  const inPlace = desk() && !!document.querySelector(`#list article[data-n="${n}"]`)
  toast(
    `${ref} ${words}${noted ? ', with your note' : ''}${left ? ` · ${plural(left, 'subitem')} still open` : ''}${note && !noted ? `. ${note}.` : ''}`,
    inPlace ? null : run,
  )
  const saved = optimistic(
    [{ n, f: { [f]: v } }],
    () => op({ op: 'set', ref, f: { [f]: wire(f, v) } }),
    (ex) => {
      // taken back
      forget(run)
      if (U.settle.delete(n)) bump('list')
      if (U.go?.done.has(n)) {
        U.go.done.delete(n)
        delete U.go.how?.[n]
        delete U.go.undo?.[n]
        render()
      }
      if (!job.undone) notSaved(ex, () => change(n, f, v, { said: words, note }))
    },
  )
  saved.then((ok) => {
    job.saved = ok
  })
  if (settles && U.open === n && U.go) advanceDesk(n, U.go.how[n])
  return saved
}

// Z and the sidebar's Undo mean one thing (B127): put back your own last action on this page, newest first.
export function pushUndo(label: string, undo: () => unknown) {
  const e: UndoEntry = { label, done: false, run: (async () => undefined) as UndoEntry['run'] }
  e.run = async () => {
    if (e.done) return
    e.done = true
    U.mine = U.mine.filter((x) => x !== e)
    bump('side')
    const ok = await undo()
    if (ok === false) {
      e.done = false
      U.mine.push(e)
      bump('side')
    } // it couldn't be put back: Z can try again (T160)
    return ok
  }
  e.run.entry = e
  U.mine.push(e)
  if (U.mine.length > 30) U.mine.shift()
  bump('side')
  return e.run
}
export function forget(run: { entry?: UndoEntry } | null | undefined) {
  const e = run?.entry
  if (!e || e.done) return
  e.done = true
  U.mine = U.mine.filter((x) => x !== e)
  bump('side')
}
export async function undoMine() {
  const e = U.mine.at(-1)
  if (!e) return toast('Nothing of yours to undo on this page. Older changes: Change log')
  try {
    await e.run()
  } catch {
    /* it said why */
  }
}
export async function revert(seq: number) {
  const d = await net<{ ok: boolean; error?: string; res?: string[] }>(ctx.P + 'api/revert', JSON_POST({ seq }), NET.op)
  if (!d.ok) {
    toast(d.error || (d.res || [])[0] || 'Could not undo', null, { error: true })
    throw new Error('revert failed')
  }
  try {
    await load()
  } catch {
    /* the next poll */
  }
}
export function undoLabel(u: { n: number; f: Record<string, unknown>; was: Record<string, unknown> }) {
  const f = u.f,
    w = u.was,
    c = code(u.n)
  if ('status' in f)
    return f.status === 'done' && w.status === 'review'
      ? `${c} accepted`
      : f.status === 'open' && w.status === 'proposed'
        ? `${c} approved`
        : `${c} ${SAID[String(f.status)] || f.status}`
  if ('archived' in f) return `${c} ${f.archived ? 'archived' : 'unarchived'}`
  if ('when' in f) return `${c} ${SAID[String(f.when)]}`
  if ('pri' in f) return `${c} ${w.pri} → ${f.pri}`
  if ('type' in f) return `${c} became a ${f.type}`
  if ('parent' in f) return f.parent ? `${c} moved under ${code(f.parent as number)}` : `${c} stands on its own`
  return `${c} ${Object.keys(f).join(' and ')} edited`
}
export async function revertNow(seq: number): Promise<void> {
  const u = (model.S.undo || []).find((u) => u.seq === seq)
  try {
    await revert(seq)
  } catch (ex) {
    return notSaved(ex, () => revertNow(seq))
  }
  toast(`Undid: ${u ? undoLabel(u) : 'the change'}`)
  bump('side', 'project')
}

// ---------------------------------------------------------------- the other projects

export function keepProjects() {
  noticeProjects(DR.list || [])
  try {
    localStorage.setItem('taska.projects', JSON.stringify(DR.list))
  } catch {
    /* no storage */
  }
}
const OTHERS = { t: 0 }
// The amber dot on the menu icon and the sidebar's counts: checked now and then, not on every change.
export async function checkOthers(force = false) {
  if (!force && Date.now() - OTHERS.t < 20000) return
  OTHERS.t = Date.now()
  const names = () =>
      (DR.list || [])
        .map((p) => p.name)
        .sort()
        .join('\n'),
    had = names()
  try {
    DR.list = (await net<ProjectRow[]>('/api/projects')).sort((a, b) => (b.t || 0) - (a.t || 0))
    keepProjects()
  } catch {
    return
  }
  if (names() !== had && model.S.rev >= 0) return render()
  bump('side', 'head')
}
export async function fillDrawer() {
  try {
    DR.list = (await net<ProjectRow[]>('/api/projects')).sort((a, b) => (b.t || 0) - (a.t || 0))
    keepProjects()
  } catch {
    /* the list stays as last seen */
  }
  bump('side')
}
