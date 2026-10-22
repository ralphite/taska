// Taska's state on screen, and saving (T160). Every request has a time limit: a dead connection fails after a while
// instead of hanging, and the screen says so. One-tap changes show at once and are saved behind you, one at a time and
// in order; until Taska has a change it is kept as a patch over Taska's last state, so a refresh meanwhile doesn't
// take it off the screen. A save that fails takes its patch back, and a red toast says so, with Retry.
import { LETTER, SAID } from './constants'
import { FAILED, addFailed, failedStore, nextFailedId, retryFailed, toast } from './toast'
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
  lastAgentMsg,
  liveN,
  model,
  openKids,
  plural,
  projName,
  rcode,
  render,
  sleep,
  type UndoEntry,
} from './state'
import type { Item, ProjectRow, State } from './types'
import { mergeDrafts, draftStore, goDraft } from './drafts'
import { fixURL, writeURL } from './url'
import { noticeItems, noticeProjects } from './notices'
import { holdRow, settleMoved } from './listhold'
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
    if (status === 401) {
      askKey() // T339 #16: the key stopped working (or this device never had it): ask for it here, keep the page
      throw new Error('key')
    }
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
// T339 #16: Taska wants its key: one sign-in in the page, not a page of its own; the page stays where it was
const KEY = { asking: false }
export function askKey() {
  if (KEY.asking) return
  KEY.asking = true
  void import('./dialog').then(({ openDialog }) => openDialog('sign-in', {}, { focus: true }))
}
export async function signIn(key: string) {
  const r = await fetch('/api/login', JSON_POST({ key }))
  const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string }
  if (!d.ok) throw new Error(d.error || 'That key is not right.')
  KEY.asking = false
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
// r512, r521: every input that did not go in at once (failed, sent again after a reload, in late), to count and cut down
export function sendLog(why: string, msg: string) {
  if (!ctx.P) return
  NETLOG.list.push({
    t: new Date().toISOString(),
    why,
    url: location.pathname,
    msg: msg.slice(0, 300),
    where: 'outbox',
  })
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
// B326, T424 (#4910): a save that can't reach Taska (it restarts, the tunnel drops, no answer in time) is sent again by
// itself, under one id so Taska does it once, and it never gives up: the pauses grow to 30 s, and the moment Taska
// answers again it goes at once. Only Taska saying no ends it.
const RETRY_MS = [1000, 2000, 4000, 8000, 15000]
let lastSaid = '' // what the latest save was, for a Not saved that was not told (B326)
export const newCid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
const BACK = new Set<() => void>() // what waits for Taska to answer again
const waitBack = (ms: number) =>
  new Promise<void>((ok) => {
    const go = () => {
      clearTimeout(t)
      BACK.delete(go)
      ok()
    }
    const t = setTimeout(go, ms)
    BACK.add(go)
  })
/** Taska answers again: every save waiting for it goes now, and what was not saved is sent again by itself. */
export function backOnline() {
  for (const go of [...BACK]) go()
  retryFailed()
  const again = [...RELOAD.values()]
  RELOAD.clear()
  for (const run of again) void run()
}
export async function postAgain<T>(url: string, body: unknown, cid = newCid()): Promise<T> {
  const at = url + (url.includes('?') ? '&' : '?') + 'cid=' + cid
  for (let i = 0; ; i++) {
    try {
      return await net<T>(at, JSON_POST(body), NET.op)
    } catch (ex) {
      if (!(ex as { net?: boolean }).net) throw ex
      await waitBack(RETRY_MS[i] ?? 30000)
    }
  }
}
export async function op(o: unknown, cid?: string, p = ctx.P): Promise<OpAnswer> {
  lastSaid = saidOp(o)
  const g = gen,
    here = p === ctx.P,
    since = here ? sinceQuery() : '' // T339: what changed comes back with the answer, so the page changes after one trip
  const d = await postAgain<OpAnswer & { state?: State & { delta?: number } }>(
    p + 'api/op' + (since ? '?' + since : ''),
    o,
    cid,
  )
  if (!d.ok) {
    const why = ((d.res || []).find((x) => x.startsWith('err')) || d.error || 'Taska said no').replace(/^err:?\s*/, '')
    addFailed(saidOp(o), why, null, p) // T424: Taska said no; sending it again would not help
    throw new Error('op failed')
  }
  if (!here) return d // T424: a change kept for another project, sent from here: nothing to show here
  try {
    if (d.state && g === gen) applyState(d.state)
    else await load() // an answer kept from before (sent again) has no state with it
  } catch {
    /* it is saved; the next refresh brings the rest */
  }
  return d
}
// A save that didn't reach Taska after a minute of trying: it goes to the list of what is not saved, with a way to
// send it again (B326, T424)
export function notSaved(ex: unknown, retry?: (() => unknown) & { entry?: UndoEntry }, what?: string) {
  if (!(ex as { net?: boolean })?.net) return
  // A7 (T422): it says what it was: given, or the Undo it was, or the last save sent
  what ||= retry?.entry ? `undoing “${retry.entry.label}”` : lastSaid || 'a change'
  addFailed(what, 'Taska was out of reach: it goes by itself when Taska answers', retry || null)
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
  const on = x.on === false // the same op taking it back
  const said: Record<string, string> = {
    hide: `${on ? 'showing' : 'hiding'} a message on ${String(x.ref)}`,
    idel: `deleting ${String(x.ref)}`,
    iundel: `restoring ${String(x.ref)}`,
    delete: `deleting input ${rcode(String(x.id))}`,
    restore: `restoring input ${rcode(String(x.id))}`,
    ddel: `${on ? 'restoring' : 'deleting'} D${String(x.d)}`,
    dmove: `moving D${String(x.d)} to ${String(x.to)}`,
    dcres: `${on ? 'reopening' : 'resolving'} a comment on D${String(x.d)}`,
    dcdel: `deleting a comment on D${String(x.d)}`,
    dcundel: `restoring a comment on D${String(x.d)}`,
    rescope: `filing input ${rcode(String(x.id))} under ${String(x.to)}`,
    dc: `your comment on D${String(x.d)}`,
    dcedit: `editing your comment on D${String(x.d)}`,
    dticks: `your choices in D${String(x.d)}`,
    correct: `fixing “${String(x.wrong)}” in ${rcode(String(x.id))}`,
    amend: `${x.mode === 'edit' ? 'your edit of' : 'what you added to'} ${rcode(String(x.id))}`,
  }
  if (said[String(x.op)]) return said[String(x.op)]
  return `${String(x.op)}${x.ref ? ' ' + String(x.ref) : ''}`
}
// T424 #4910: what could not load loads again by itself when Taska answers again; nothing to click
const RELOAD = new Map<string, () => unknown>()
export function notLoaded(what: string, retry: () => unknown) {
  RELOAD.set(what, retry)
  toast(`Couldn't load ${what} yet: it loads when Taska answers`, null, { error: true })
}
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
  going: [] as string[], // T424: ids of kept changes on their way now
  last: '',
}
export interface Patch {
  n?: number
  f?: Record<string, unknown>
  cfg?: Record<string, unknown>
  fn?: () => void // R409: any change to the page's copy, done again after each load until Taska has it
  temp?: boolean // T424: it adds something Taska has not made yet: once Taska has it, the page shows Taska's
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
// T438 #1: an answer still on its way shows its item as answered at once, as it will be once Taska has it: the
// question is no longer waiting on you and the item is your agent's turn (the card, the row and the counts follow)
export function answersGoing() {
  for (const q of U.outbox) {
    if (q.kind !== 'answer' || q.unsent || (q.p && q.p !== ctx.P)) continue
    const it = model.S.items.find((i) => code(i.n) === q.scope)
    if (it?.wait?.kind === 'ask') {
      it.wait = null
      it.reply = true
    }
  }
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
  answersGoing()
  settleMoved((n) => byN.get(n) as Record<string, unknown> | undefined)
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
const UPD = { told: false, ver: '', stale: false }
// the name of this page's main script, as Taska says its own (T427: the service worker may give a page from before)
const MY_VER = (/\/assets\/(index-[\w-]+\.js)/.exec(
  document.querySelector<HTMLScriptElement>('script[type=module][src*="/assets/index-"]')?.src || '',
) || [])[1]
// B344: Taska restarted with new code while this page was open (left alone, the deploy restarts it by itself): the page
// still runs the old code, so it says so and offers a reload; it never reloads by itself (R284)
function offerReload() {
  UPD.stale = true
  toast('Taska has an update', () => location.reload(), { label: 'Reload', sticky: true })
}
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
        backOnline()
      } // Taska is back: what you sent and changed meanwhile goes now (B151, T424)
      const news = d.rev !== model.S.rev || d.boot !== model.S.boot || d.pv !== model.S.pv
      if (news) await load()
      if (d.update && !UPD.told) offerRestart() // R328: new code waits for a restart, and you are using Taska: your call
      if (d.ver && !UPD.ver) UPD.ver = MY_VER || d.ver // T427: a page kept from before knows it is old at once
      if (d.ver && d.ver !== UPD.ver && !UPD.stale) offerReload()
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
      backOnline()
    }
  } catch {
    /* the next poll tries again */
  }
}

export function patch(p: Patch) {
  // one change on screen: {n, f} for an item, {cfg} for the project, {fn} for anything else
  if (p.fn) return p.fn()
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
/** B3 (T422): something shown at once while what it stands for is still on its way (a comment waiting for its voice
 * note's words, say): it stays over every refresh of the page's copy until the function returned is called. */
export function standIn(fn: () => void) {
  const p: Patch = { fn, temp: true }
  SAVE.pend.push(p)
  patch(p)
  return () => {
    SAVE.pend = SAVE.pend.filter((x) => x !== p)
    restore()
  }
}
// T424 (D32): the changes not saved yet are kept in this browser too, with their id, so after a reload or a closed tab
// they show again and go out again (Taska takes a change once, by its id)
type Kept = {
  id: string
  o: Record<string, unknown> | Record<string, unknown>[]
  patches: Patch[]
  t: number
  p: string
}
const keptKey = (p: string) => 'taska.pending.' + decodeURIComponent(p.replace(/^\/p\//, '').replace(/\/$/, ''))
function keptStore(p: string, change?: (all: Kept[]) => Kept[]): Kept[] {
  try {
    let all = JSON.parse(localStorage.getItem(keptKey(p)) || '[]') as Kept[]
    if (change) {
      all = change(all)
      if (all.length) localStorage.setItem(keptKey(p), JSON.stringify(all))
      else localStorage.removeItem(keptKey(p))
    }
    return all
  } catch {
    return [] // no storage: it is saved as before, only not kept over a reload
  }
}
/** What did not go out before a reload or a closed tab, in any project: shown again here (this project's) and sent. */
/** A2 (T422): what was not saved before a reload is listed again, to say so (what can be sent again is a change kept
 * with its op, and those are sent again by restorePending). */
export function restoreFailed() {
  for (const e of failedStore())
    FAILED.push({
      id: nextFailedId(),
      sid: e.sid,
      what:
        e.p === ctx.P
          ? e.what
          : `${e.what} (in ${projName(decodeURIComponent(e.p.replace(/^\/p\//, '').replace(/\/$/, '')))})`,
      why: e.why,
      at: e.at,
      retry: null,
      p: e.p,
    })
  bump('head')
}
export function restorePending() {
  const mine = new Set(SAVE.going)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k?.startsWith('taska.pending.')) continue
      const p = '/p/' + encodeURIComponent(k.slice('taska.pending.'.length)) + '/'
      for (const e of keptStore(p).sort((a, b) => a.t - b.t))
        if (!mine.has(e.id)) {
          sendLog('resend', `${e.id} (${saidOp(e.o)}) kept from before, going out again`)
          void optimistic(p === ctx.P ? e.patches : [], e.o as Record<string, unknown>, undefined, undefined, {
            id: e.id,
            p,
          })
        }
    }
  } catch {
    /* no storage */
  }
}
// Show a change at once and save it behind you. -> a promise: true once saved, false if it couldn't be. `send` is
// the op itself (kept in this browser until Taska has it, T424) or, for what is more than one op, how to send it.
export function optimistic(
  patches: Patch[],
  send: (() => Promise<unknown>) | Record<string, unknown> | Record<string, unknown>[],
  fail: (ex: unknown) => void = (ex) => notSaved(ex, () => optimistic(patches, send), patchesSaid(patches)),
  needed: () => boolean = () => true,
  again?: { id: string; p: string },
): Promise<boolean> {
  const id = again?.id || newCid(),
    p = again?.p || ctx.P,
    o = typeof send === 'function' ? null : send
  if (o) {
    SAVE.going.push(id)
    if (!again) keptStore(p, (all) => [...all, { id, o, patches: patches.filter((x) => !x.fn), t: Date.now(), p }])
  }
  const go = o ? () => op(o, id, p) : (send as () => Promise<unknown>)
  const drop = () => {
    SAVE.pend = SAVE.pend.filter((x) => !patches.includes(x))
    if (o) {
      SAVE.going = SAVE.going.filter((x) => x !== id)
      keptStore(p, (all) => all.filter((e) => e.id !== id))
    }
  }
  SAVE.pend.push(...patches)
  for (const p of patches) patch(p)
  linkKids()
  followCodes()
  render()
  fixURL()
  return (SAVE.q = SAVE.q.then(async () => {
    try {
      if (!needed()) return true
      await go()
      if (patches.some((x) => x.temp)) {
        drop()
        restore() // the stand-in goes; what Taska made is there
      }
      return true
    } catch (ex) {
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
  return optimistic([{ n, f }], { op: 'set', ref, f }, (ex) =>
    notSaved(ex, retry || (() => setNow(n, f)), saidOp({ op: 'set', ref, f })),
  )
}
/** R409: show a change at once (fn changes the page's copy; it must be safe to do twice), save it behind you, sent
 * again while Taska can't be reached; only when it finally can't be saved does the page go back, and says what. */
export const instant = (o: unknown, fn: () => void, what = saidOp(o), retry?: () => unknown): Promise<boolean> =>
  optimistic([{ fn }], o as Record<string, unknown>, (ex) => notSaved(ex, retry || (() => instant(o, fn, what)), what)) // T424: anything can be sent again from the list of what is not saved
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
  // F428 (P0): deciding on a proposal or finished work leaves its card where it was, grey, saying what you chose
  if (f === 'status' && (before === 'proposed' || before === 'review') && !it.wait)
    U.decided.set(n, { from: String(before), to: String(v), msg: lastAgentMsg(it)?.id ?? null })
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
    // T438 #3 (A1): someone moved it on since (an agent took it further): Undo does not take their work back
    const now = byN.get(n)
    if (job.saved && now && JSON.stringify(now[f as keyof Item]) !== JSON.stringify(v)) {
      toast(`${ref} changed since: nothing put back`)
      return Promise.resolve(false)
    }
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
      (ex) => notSaved(ex, run, `putting ${ref} back`),
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
  if (!settles && (n !== U.open || desk())) holdRow(n, `${words.replace(/^./, (c) => c.toUpperCase())}`, run, f, v) // the row you acted on holds still (B148)
  const left = f === 'status' && v === 'done' ? openKids(n) : 0 // done before its subitems: say so (B147)
  const noted = f === 'status' && noteWith(n) // B4: what you wrote for it goes with your decision
  // T438 #3: Undo is in the toast, always: never on the row, where a second click would undo what the first did
  toast(
    `${ref} ${words}${noted ? ', with your note' : ''}${left ? ` · ${plural(left, 'subitem')} still open` : ''}${note && !noted ? `. ${note}.` : ''}`,
    run,
  )
  const saved = optimistic([{ n, f: { [f]: v } }], { op: 'set', ref, f: { [f]: wire(f, v) } }, (ex) => {
    // taken back
    forget(run)
    if (U.settle.delete(n)) bump('list')
    if (U.go?.done.has(n)) {
      U.go.done.delete(n)
      delete U.go.how?.[n]
      delete U.go.undo?.[n]
      render()
    }
    if (!job.undone) notSaved(ex, () => change(n, f, v, { said: words, note }), `${ref} ${words}`) // A7 (T422)
  })
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
