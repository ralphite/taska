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
    t = setTimeout(() => ctl.abort(), ms)
  try {
    const r = await fetch(url, { cache: 'no-store', ...opts, signal: ctl.signal })
    return (as === 'text' ? await r.text() : await r.json()) as T
  } catch {
    throw new NetError(ctl.signal.aborted ? 'No answer from Taska' : 'Taska is out of reach')
  } finally {
    clearTimeout(t)
  }
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
export async function op(o: unknown): Promise<OpAnswer> {
  const d = await net<OpAnswer>(ctx.P + 'api/op', JSON_POST(o), NET.op)
  if (!d.ok) {
    toast((d.res || []).find((x) => x.startsWith('err')) || d.error || 'Not saved', null, { error: true })
    throw new Error('op failed')
  }
  try {
    await load()
  } catch {
    /* it is saved; the next refresh brings the rest */
  }
  return d
}
// A save that didn't reach Taska. Several in a row are retried together, in order.
export function notSaved(ex: unknown, retry?: () => unknown) {
  if (!(ex as { net?: boolean })?.net) return
  if (retry) failedRetry.push(retry)
  const k = failedRetry.length
  toast(
    k > 1 ? `${k} changes not saved` : 'Not saved',
    k
      ? () => {
          for (const r of failedRetry.splice(0)) r()
        }
      : null,
    { error: true, label: 'Retry' },
  )
}
export const notLoaded = (what: string, retry: () => unknown) =>
  toast(`Couldn't load ${what}`, retry, { error: true, label: 'Retry' })
// Something that waits for Taska before it shows: its button stays busy meanwhile
export async function save(o: unknown, retry?: () => unknown) {
  try {
    return await op(o)
  } catch (ex) {
    notSaved(ex, retry)
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

export async function load() {
  const g = gen
  // T293: with a copy here, only what changed since comes over (everything, when Taska restarted meanwhile)
  const S = model.S as State & { sv?: number }
  const since = SAVE.last && S.sv ? `?since=${S.sv}&boot=${encodeURIComponent(S.boot)}` : ''
  let text = await net<string>(ctx.P + 'api/state' + since, {}, NET.state, 'text')
  if (g !== gen) return
  if (/^project \S+ was deleted/.test(text) || /^no project /.test(text)) {
    if (!U.leaving) location.replace('/?gone=' + encodeURIComponent(ctx.HERE))
    return
  }
  let d = JSON.parse(text) as State & { delta?: number }
  if (d.delta && SAVE.last) {
    d = mergeState(JSON.parse(SAVE.last) as State, d)
    text = JSON.stringify(d)
  }
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

export async function poll(g: number) {
  while (g === gen) {
    const ctl = new AbortController(),
      timer = setTimeout(() => ctl.abort(), 35000) // a dead connection never answers
    try {
      const S = model.S
      // T293: a browser keeps at most 6 connections to Taska, and every waiting tab held one, so with a few tabs open
      // the next page waited its turn for many seconds. Only the tab you look at waits for news; one behind asks
      // every 20 s and lets go at once, and catches up as soon as it shows.
      const hidden = document.hidden
      const d = await (
        await fetch(`${ctx.P}api/poll?rev=${S.rev}&boot=${S.boot}&pv=${S.pv ?? -1}${hidden ? '&wait=0' : ''}`, {
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
      checkOthers()
      if (hidden && !news) await napHidden(20000)
    } catch {
      if (g !== gen) return
      model.offline += ctl.signal.aborted ? 2 : 1
      bump('head', 'side')
      await sleep(model.offline > 1 ? Math.min(30000, 1500 * 2 ** Math.min(model.offline, 5)) : 500) // back off while the server is away
    } finally {
      clearTimeout(timer)
    }
  }
}
export const VERSION = { page: '', server: '' }
/** A wait that ends early when the tab shows again. */
const napHidden = (ms: number) =>
  new Promise<void>((ok) => {
    const done = () => {
      clearTimeout(t)
      removeEventListener('visibilitychange', done)
      ok()
    }
    const t = setTimeout(done, ms)
    addEventListener('visibilitychange', done)
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
  fail: (ex: unknown) => void = (ex) => notSaved(ex),
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
    (ex) => notSaved(ex, retry),
  )
}

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
