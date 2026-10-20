// The page's model: Taska's state for the open project (S), what you are doing on the page (U), the desktop's layout
// (D), the projects list (DR). They are plain objects, changed by the actions; a change is shown by bump(), which
// redraws the parts of the page that read it. This keeps one source of truth, as the one-file Taska had, while every
// part of the page is a React component.
import { create } from 'zustand'
import { flushSync } from 'react-dom'
import { BEHAVIOUR } from './behaviour'
import { AGENT_NAME, LETTER, PROJ_TONES, QUIET_MS, RULE_STATUS, STATUS, VIEW_KEYS, type Tab } from './constants'
import type { Doc, FileRef, Input, Item, Msg, ProjectRow, State, Status } from './types'

// ---------------------------------------------------------------- redraw

export type Area =
  | 'list'
  | 'detail'
  | 'composer'
  | 'feedback'
  | 'side'
  | 'head'
  | 'dialog'
  | 'project'
  | 'inputs'
  | 'view'
  | 'toast'
  | 'viewer'
  | 'tip'
  | 'vc'
  | 'rec'
const AREAS: Area[] = [
  'list',
  'detail',
  'composer',
  'feedback',
  'side',
  'head',
  'dialog',
  'project',
  'inputs',
  'view',
  'toast',
  'viewer',
  'tip',
  'vc',
  'rec',
]
export const useTick = create<Record<Area, number>>(
  () => Object.fromEntries(AREAS.map((a) => [a, 0])) as Record<Area, number>,
)
export const useArea = (a: Area) => useTick((s) => s[a])
let rendering = 0
export const inRender = () => rendering > 0
export function renderPhase<T>(fn: () => T): T {
  rendering++
  try {
    return fn()
  } finally {
    rendering--
  }
}
const before: (() => void)[] = []
/** Something that has to be true before every redraw (the box follows its target, a merged item gives way...). */
export function beforeRender(fn: () => void) {
  before.push(fn)
}
let pending: Set<Area> | null = null
/** Redraw these parts now (synchronously, so the code that follows sees the new page), or soon when inside a redraw. */
export function bump(...areas: Area[]) {
  const list = areas.length ? areas : AREAS
  if (rendering) {
    if (!pending) {
      pending = new Set()
      queueMicrotask(() => {
        const p = pending
        pending = null
        if (p) bump(...p)
      })
    }
    for (const a of list) pending.add(a)
    return
  }
  for (const fn of before) fn()
  const next = { ...useTick.getState() }
  for (const a of list) next[a]++
  try {
    flushSync(() => useTick.setState(next))
  } catch {
    useTick.setState(next)
  }
}
/** Redraw everything. */
export const render = () => {
  idleCompose()
  bump()
}
// T318 (B269, r309): on the desktop, Items with nothing open is the New input page, as clicking New input shows it
function idleCompose() {
  if (
    BEHAVIOUR.newInputPage &&
    desk() &&
    U.tab === 'items' &&
    !U.open &&
    !U.doc &&
    !D.page &&
    !D.compose &&
    U.editing == null
  )
    D.compose = true
}

// ---------------------------------------------------------------- where we are

export const ctx = {
  P: '/', // /p/<project>/
  HERE: '', // this project's address, known before its data arrives (B190)
  BASE: '', // what a coding agent calls BASE
}
export function setProject(name: string) {
  ctx.HERE = name
  ctx.P = `/p/${encodeURIComponent(name)}/`
  ctx.BASE = location.origin + ctx.P.replace(/\/$/, '')
}

export const EMPTY_STATE: State = {
  rev: -1,
  boot: '',
  pv: -1,
  agents: [],
  work: false,
  width: 1,
  file: '',
  cfg: { auto: true },
  undo: [],
  org: { on: false, model: '', busy: null },
  items: [],
  inputs: [],
  deleted: [],
  docs: [],
  gone: [],
  project: '',
  title: '',
  base: '',
  key: '',
  remote: '',
}
export const model = { S: EMPTY_STATE as State, offline: 0 }
export const byN = new Map<number, Item>()
export const byR = new Map<string, Input>()
export const kids = new Map<number, Item[]>()
export const S = () => model.S

export interface Go {
  list: number[]
  done: Set<number>
  how: Record<number, string>
  undo: Record<number, () => unknown>
  at: number | null
  hidden: number
  by: string
}
export interface DraftFile extends Partial<FileRef> {
  name: string
  mime: string
  f?: string
  size?: number
  preview?: string
  done: Promise<unknown>
  settle?: () => void
  failed?: boolean
  // voice notes
  rid?: string
  ms?: number
  t?: number
  blob?: Blob
  data?: ArrayBuffer
  at?: number
  key?: string | null
  scope?: string | null
  vc?: string
  transcribing?: boolean
  retrying?: boolean
  tr?: string
  tr_error?: string
  doubts?: import('./types').Doubt[]
  trAdded?: string
  more?: boolean
  sent?: boolean
  gone?: boolean
  loop?: boolean
  held?: Promise<unknown> | null
  release?: (() => void) | null
  job?: { id: string; text: string } | null
}
export interface Job {
  id: string
  q: string
  t: number
  text: string
  files: DraftFile[]
  scope: string | null
  from: string | null
  quiet?: boolean
  failed?: boolean
  sending?: boolean
  net?: boolean
  tries?: number
  rid?: string
  undo?: (() => Promise<unknown>) & { entry?: UndoEntry }
}
export interface UndoEntry {
  label: string
  done: boolean
  run: (() => Promise<unknown>) & { entry?: UndoEntry }
}

export const U = {
  doc: null as number | null,
  docNew: null as number | null,
  docEdit: false,
  docText: null as string | null,
  docSel: new Set<string>(),
  docQuote: null as { key: string; text: string } | null,
  docCircle: false,
  docThreads: new Set<string>(),
  docDrafts: {} as Record<string, string>,
  docScroll: {} as Record<number, number>,
  docReply: null as string | null,
  docType: false,
  docPick: {} as Record<number, { sel: string[]; quote: { key: string; text: string } | null; reply: string | null }>,
  docSig: '',
  peek: null as number | null,
  moreInputs: new Set<string>(),
  tab: 'items' as Tab,
  q: '',
  type: 'all',
  when: 'all',
  status: 'all',
  pri: 'all',
  sort: 'all',
  undoArch: null as null | { ids: number[]; left: number; timer?: number; run?: () => Promise<unknown> },
  archHold: null as null | { h: number; sig: string },
  folded: new Set<number>(),
  moreMsgs: new Set<number>(),
  subFor: null as number | null,
  choice: null as null | { n: number; picked: Set<number> },
  choiceLabels: {} as Record<number, string[]>,
  go: null as Go | null,
  goBack: null as null | { go: Go; n: number },
  sheet: null as string | null,
  searching: false,
  open: null as number | null,
  scopeOff: false,
  editing: null as number | null,
  files: [] as DraftFile[],
  lastSent: null as string | null,
  more: new Set<number>(),
  docsAll: new Set<number>(), // I289: items whose documents all show, not the latest 3
  tabOpen: {} as Record<string, number | null>,
  settle: new Map<number, { said: string; undo: () => unknown }>(),
  tabTop: {} as Record<string, number>,
  stepFrom: null as null | { n: number; rows: number[] },
  mine: [] as UndoEntry[],
  tabView: {} as Record<string, Record<string, string>>,
  sel: new Set<number>(),
  selFrom: null as number | null,
  outbox: [] as Job[],
  qn: 0,
  sentJobs: [] as Job[],
  draftKey: null as string | null,
  parked: {} as Record<string, DraftFile[]>,
  vcMarks: [] as { label: string; d: number; key: string; quote: string }[],
  oldDraft: '',
  amend: null as
    null | { id: string; mode: 'edit' | 'append'; v: number } | { mode: 'dc'; d: number; id: number; was: string },
  correct: null as null | { id: string; wrong: string; v: number },
  correctSel: false,
  fixCand: null as null | { id: string; wrong: string; v: number },
  fixEd: null as null | { s: number; e: number; wrong: string },
  prefsEdit: null as null | { was: string },
  asRule: null as boolean | null,
  ask: null as number | null,
  note: null as string | null,
  fbFor: null as number | null,
  listTop: null as null | [number, number],
  inSel: null as string | null,
  inputsEnd: false,
  needsAll: false,
  menuArm: null as string | null,
  menuFor: null as number | null,
  popXY: null as null | [number, number],
  armKey: null as null | { k: string; n: number; t: number },
  boxView: false,
  renaming: null as string | null,
  pNew: false,
  npOpen: false, // the sidebar's New project field (B131)
  npErr: '',
  pNewText: '',
  pErr: '',
  pMenu: null as string | null,
  showHidden: new Set<number>(),
  vcSending: false,
  leaving: false,
  boxGone: null as null | { k: string; t: number },
  undoArchTick: 0,
}
export type UI = typeof U

export const D = {
  page: null as string | null,
  section: null as string | null,
  full: false,
  sideHidden: (() => {
    try {
      return !!localStorage.getItem('taska.sideHidden')
    } catch {
      return false
    }
  })(),
  sideOpen: false,
  filters: false,
  g: 0,
  compose: false,
  prev: null as number | null,
  prevTab: null as Tab | null,
  prevDoc: null as number | null,
  docKey: null as string | null,
}

export const DR = {
  open: false,
  list: (() => {
    try {
      return JSON.parse(localStorage.getItem('taska.projects') || 'null') as ProjectRow[] | null
    } catch {
      return null
    }
  })(),
}

// ---------------------------------------------------------------- layout

const DESK = typeof matchMedia === 'function' ? matchMedia('(min-width: 1024px)') : null
const WIDE = typeof matchMedia === 'function' ? matchMedia('(min-width: 1280px)') : null
const REDUCE = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
export const desk = () => !!DESK?.matches
export const wide = () => !!WIDE?.matches
export const reduceMotion = () => !!REDUCE?.matches
export const onLayout = (fn: () => void) => {
  DESK?.addEventListener('change', fn)
  WIDE?.addEventListener('change', fn)
}

// ---------------------------------------------------------------- small words

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
export const esc = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )
export function when(t: string | number | undefined | null) {
  if (t == null || t === '') return ''
  const d = new Date(t),
    now = new Date(),
    hm = d.toTimeString().slice(0, 5)
  if (d.toDateString() === now.toDateString()) return hm
  if (new Date(+now - 864e5).toDateString() === d.toDateString()) return 'Yesterday ' + hm
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
export const agoShort = (t: number) => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000))
  return m < 1 ? 'now' : m < 60 ? m + 'm' : m < 1440 ? Math.round(m / 60) + 'h' : Math.round(m / 1440) + 'd'
}
export const agoLong = (t: number) => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000))
  return m < 1
    ? 'just now'
    : m < 60
      ? `${m} min ago`
      : m < 1440
        ? `${Math.round(m / 60)} h ago`
        : `${plural(Math.round(m / 1440), 'day')} ago`
}
export const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`
export const dayOf = (t: string) => {
  const d = new Date(t),
    now = new Date()
  return d.toDateString() === now.toDateString()
    ? 'Today'
    : new Date(+now - 864e5).toDateString() === d.toDateString()
      ? 'Yesterday'
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
export const dayShort = (t: string) =>
  t ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
export const who = (b: string) => (b === 'you' ? 'You' : b === 'org' ? 'Organizer' : b === 'agent' ? 'Agent' : b)
export const whoName = (b: string) => AGENT_NAME[b] || who(b)
export const rcode = (id: string | null | undefined) => String(id || '').replace(/^r(\d+)$/, '#$1') // T274 #22: an input reads #315
export const isAudio = (f: { mime?: string }) => (f.mime || '').startsWith('audio/')
export const isImage = (f: { mime?: string }) => (f.mime || '').startsWith('image/')

// ---------------------------------------------------------------- items

export const CLOSED = (s: Status | string) => s === 'done' || s === 'dropped'
export const code = (n: number | null | undefined) => {
  if (n == null) return ''
  const it = byN.get(n)
  return (it ? LETTER[it.type] : '?') + String(n).padStart(model.S.width, '0')
}
export const parseRef = (s: unknown) => {
  const m = /^[A-Za-z]?0*(\d+)$/.exec(String(s ?? '').trim())
  return m ? Number(m[1]) : null
}
export const liveN = (n: number) => {
  let it = byN.get(n)
  for (let i = 0; it?.merged_into && byN.has(it.merged_into) && i < 50; i++) it = byN.get(it.merged_into)
  return it ? it.n : n
}
// The user's move: an agent asked or is blocked, proposed an item, or wants a finished item accepted.
export const needsYou = (it: Item) =>
  !it.merged_into &&
  !CLOSED(it.status) &&
  (!!it.wait || ((it.status === 'proposed' || it.status === 'review') && !it.reply)) // B286
// T274 #7: in progress means an agent is on it. Nobody on it, or quiet too long: it is stuck (a switch: D21 #4)
export const stuck = (it: Item) =>
  BEHAVIOUR.stuckLabel &&
  it.status === 'doing' &&
  !it.wait &&
  !(it.agent && Date.now() - new Date(it.agent.t).getTime() <= QUIET_MS)
export const statusName = (it: Item) =>
  stuck(it) ? 'Stuck' : (it.type === 'rule' ? RULE_STATUS[it.status] : STATUS[it.status]) || STATUS[it.status]
export const userWord = (x: Msg) =>
  x.by === 'you' || (x.by === 'org' && ['say', 'decide', 'propose'].includes(x.kind) && !!x.src)
export const lastAgentMsg = (it: Item) => [...it.thread].reverse().find((x) => !userWord(x))
export const oneLine = (t: unknown) =>
  String(t || '')
    .split('\n')
    .map((l) =>
      l
        .replace(/^\s*(#+|>|[-*+]\s+(\(|\[)[ xX]?(\)|\])|[-*+]|\d+[.)])\s*/, '')
        .replace(/[*`]/g, '')
        .trim(),
    )
    .find(Boolean) || ''
export const excerpt = (it: Item) =>
  oneLine(it.wait ? it.wait.text : it.status === 'review' ? lastAgentMsg(it)?.text : lastAgentMsg(it)?.text || it.body)
export const rowAction = (it: Item): ['answer' | 'approve' | 'accept', string] =>
  it.wait ? ['answer', 'Answer'] : it.status === 'proposed' ? ['approve', 'Approve'] : ['accept', 'Accept'] // T274 #31
export const needWord = (it: Item) => (needsYou(it) ? rowAction(it)[1] : '')
export const inTab = (it: Item, t: string) =>
  t === 'rules'
    ? it.type === 'rule' && !it.archived
    : t === 'archive'
      ? it.archived
      : !it.archived && (it.type !== 'rule' || it.status === 'proposed')
export const tabOf = (it: Item): Tab => (it.archived ? 'archive' : it.type === 'rule' ? 'rules' : 'items')
export const inQueue = (it: Item) =>
  !it.merged_into && !it.archived && it.type !== 'rule' && !needsYou(it) && !CLOSED(it.status)
export const laterOf = (q: Item[]) => q.filter((it) => it.when === 'later').length
// F291: the order agents take the work. Now before later, in progress first; then your order comes before
// priority: what you dragged or put next keeps its place (rank), and what you never placed goes in by priority, each
// just before the first item of your order that has a lower priority (the same as the server's /next).
export function sortQueue(items: Item[]): Item[] {
  const bucket = (it: Item) => (it.when !== 'now' ? 2 : 0) + (it.status !== 'doing' ? 1 : 0)
  const out: Item[] = []
  for (const b of [0, 1, 2, 3]) {
    const mine = items.filter((it) => bucket(it) === b)
    const ranked = mine
      .filter((it) => it.rank != null)
      .sort((x, y) => (x.rank as number) - (y.rank as number) || x.n - y.n)
    const rest = mine.filter((it) => it.rank == null).sort((x, y) => x.pri.localeCompare(y.pri) || x.n - y.n)
    let i = 0
    for (const r of ranked) {
      while (i < rest.length && rest[i].pri.localeCompare(r.pri) < 0) out.push(rest[i++])
      out.push(r)
    }
    out.push(...rest.slice(i))
  }
  return out
}
export const queueHead = () =>
  sortQueue(model.S.items.filter((it) => inQueue(it) && it.when === 'now' && it.status !== 'doing'))[0]?.n
export const openKids = (n: number) => (kids.get(n) || []).filter((k) => !CLOSED(k.status)).length
export const openCount = () =>
  model.S.items.filter((it) => !it.merged_into && inTab(it, 'items') && !CLOSED(it.status)).length // B130

const HAY = new WeakMap<Item, string>() // an item's words, worked out once per load
export function hay(it: Item) {
  let h = HAY.get(it)
  if (h === undefined)
    HAY.set(
      it,
      (h = (
        code(it.n) +
        ' ' +
        LETTER[it.type] +
        it.n +
        ' ' +
        it.title +
        ' ' +
        it.body +
        ' ' +
        it.next +
        ' ' +
        it.thread.map((x) => x.text).join(' ')
      ).toLowerCase()),
    )
  return h
}
export const searchWords = () => U.q.trim().toLowerCase().split(/\s+/).filter(Boolean)
/** F291: on Items the status is the preset view the list shows, not a filter laid over it. */
export const statusIsView = () => BEHAVIOUR.treeList && U.tab === 'items' && U.sort === 'all'
export const filtered = () =>
  !!(U.q.trim() || U.type !== 'all' || U.when !== 'all' || (U.status !== 'all' && !statusIsView()) || U.pri !== 'all')
export const inputMatch = (r: Input, words: string[]) =>
  words.every((w) => (r.id + ' ' + r.text).toLowerCase().includes(w))

export function visible(tab: string = U.tab) {
  const words = U.q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  // Items shows the work, plus rules an agent proposed: they wait on you too (T65).
  const okTab = (it: Item) =>
    tab === 'rules'
      ? it.type === 'rule' && !it.archived
      : tab === 'archive' || it.type !== 'rule' || (it.status === 'proposed' && !it.archived)
  const okStatus = (it: Item) =>
    tab === 'rules'
      ? U.status === 'all' || it.status === U.status
      : tab === 'archive'
        ? it.archived &&
          (U.status === 'all' ||
            U.status === 'archived' ||
            (U.status === 'active' ? !CLOSED(it.status) : it.status === U.status))
        : U.status === 'archived'
          ? it.archived
          : !it.archived &&
            (U.status === 'every' ||
              (U.status === 'all' && statusIsView() ? !CLOSED(it.status) && it.when === 'now' : U.status === 'all') ||
              (U.status === 'active'
                ? !CLOSED(it.status)
                : U.status === 'closed'
                  ? CLOSED(it.status)
                  : U.status === 'wait'
                    ? needsYou(it)
                    : U.status === 'queued'
                      ? inQueue(it) && it.status !== 'doing' && it.when === 'now'
                      : U.status === 'later'
                        ? it.when === 'later' && !CLOSED(it.status)
                        : it.status === U.status))
  return model.S.items
    .filter(
      (it) =>
        !it.merged_into &&
        okTab(it) &&
        (U.type === 'all' || tab === 'rules' || it.type === U.type) &&
        (U.when === 'all' || it.when === U.when) &&
        (U.pri === 'all' || it.pri === U.pri) &&
        okStatus(it) &&
        words.every((w) => hay(it).includes(w)),
    )
    .sort(
      U.sort === 'new'
        ? (a, b) => b.n - a.n
        : U.sort === 'upd'
          ? (a, b) => (b.t1 || '').localeCompare(a.t1 || '') || b.n - a.n
          : (a, b) => a.pri.localeCompare(b.pri) || a.n - b.n,
    ) // same priority: oldest first, like /next
}
// While the search box has words, a tab's count is what that tab shows with them (T225 #13)
export function searchCount(t: string) {
  const words = searchWords()
  if (t === 'inputs') return model.S.inputs.filter((r) => !r.deleted && inputMatch(r, words)).length
  const keep = Object.fromEntries(VIEW_KEYS.map((k) => [k, U[k]])) as Record<string, string>
  const v = t === U.tab ? keep : U.tabView[t] || {}
  for (const k of VIEW_KEYS) if (k !== 'q') (U as Record<string, unknown>)[k] = v[k] ?? 'all'
  try {
    return visible(t).length
  } finally {
    Object.assign(U, keep)
  }
}
export const tabNum = (n: number) => (n >= 1000 ? Math.floor(n / 1000) + 'k' : n || '') // 1234 reads 1k (T225 #12)
export const tabRows = (t: string) =>
  t === 'inputs' ? model.S.inputs : model.S.items.filter((it) => !it.merged_into && inTab(it, t))
export const tabCount = (t: string) =>
  t === 'items'
    ? openCount()
    : t === 'inputs'
      ? model.S.inputs.filter((r) => !r.acked).length || ''
      : t === 'archive'
        ? tabRows('archive').length || ''
        : (tabRows('rules') as Item[]).filter((it) => it.status !== 'dropped').length || ''

// An item's own files: those of the inputs it was made from. A reply on it keeps its files to itself (B224).
export function filesOf(it: Item) {
  const replies = new Set(it.thread.filter((x) => x.by === 'you' && x.src).map((x) => x.src)),
    seen = new Set<string>(),
    out: FileRef[] = []
  for (const rid of it.srcs)
    if (!replies.has(rid))
      for (const f of byR.get(rid)?.files || [])
        if (!seen.has(f.f)) {
          seen.add(f.f)
          out.push(f)
        }
  return out
}

// What needs you, newest first (B238): what changed last on top, the Later ones under the rest (B153).
export const laterLast = (a: Item, b: Item) => +(a.when === 'later') - +(b.when === 'later')
export const needsOrder = (a: Item, b: Item) => laterLast(a, b) || (b.t1 > a.t1 ? 1 : b.t1 < a.t1 ? -1 : b.n - a.n)
export const walkOrder = (g: Go) => (a: Item, b: Item) =>
  (g.list.indexOf(a.n) + 1 || 1e9) - (g.list.indexOf(b.n) + 1 || 1e9) || needsOrder(a, b)
export const walkTab = () =>
  U.tab === 'rules' && !D.page && !D.compose && visible('rules').some(needsYou) ? 'rules' : 'items'
export const needsList = (t = walkTab()) =>
  visible(t)
    .filter(needsYou)
    .sort(needsOrder)
    .map((it) => it.n)

// T274 #5: what an agent wrote since you last looked at an item: a blue dot on its row (kept in this browser)
const SEEN = { key: '', map: null as null | Record<string, string> }
export function seenMap(): Record<string, string> {
  const key = 'taska.seen.' + model.S.project
  if (SEEN.key !== key) {
    SEEN.key = key
    try {
      SEEN.map = JSON.parse(localStorage.getItem(key) || 'null')
    } catch {
      SEEN.map = null
    }
  }
  if (!SEEN.map) {
    SEEN.map = { since: new Date().toISOString() }
    saveSeen()
  }
  return SEEN.map
}
export const saveSeen = () => {
  try {
    localStorage.setItem(SEEN.key, JSON.stringify(SEEN.map))
  } catch {
    /* no storage here */
  }
}
export const unread = (it: Item) => {
  const m = lastAgentMsg(it),
    s = seenMap()
  return !!m && !it.archived && Date.parse(m.t) > Date.parse(s[it.n] || s.since)
}
export const unreadCount = () => model.S.items.filter((it) => !it.merged_into && unread(it)).length
export function markSeen(it: Item) {
  const m = lastAgentMsg(it)
  if (!m || !unread(it)) return
  seenMap()[it.n] = m.t
  saveSeen()
}

// ---------------------------------------------------------------- documents

export const docsOf = (n: number) => (model.S.docs || []).filter((d) => d.n === n)
export const docById = (d: number | null | undefined) =>
  d == null ? undefined : (model.S.docs || []).find((x) => x.d === d)
export const docResolved = (d: Doc, key: string) => !!d.resolved?.[key]
export const dcAll = (dn: number) => {
  const d = docById(dn)
  return d ? [...(d.whole || []), ...d.blocks.flatMap((b) => b.comments), ...d.detached.flatMap((t) => t.comments)] : []
}
export const dcFind = (dn: number, id: number) => dcAll(dn).find((c) => c.id === id)
export const sameText = (a: string, b: string) => a.split(/\s+/).join(' ') === b.split(/\s+/).join(' ')

// ---------------------------------------------------------------- projects

export const projHash = (name: string) => {
  let h = 0
  for (const c of String(name)) h = (h * 31 + (c.codePointAt(0) || 0)) >>> 0
  return h
}
const TONE = { key: '', map: new Map<string, number>() }
export function projTone(name: string) {
  const names = [...new Set([model.S.project, ...(DR.list || []).map((p) => p.name)].filter(Boolean))].sort(),
    L = PROJ_TONES.length
  if (TONE.key !== names.join('\n')) {
    const taken = new Set<number>()
    TONE.map = new Map()
    TONE.key = names.join('\n')
    for (const n of names) {
      let i = projHash(n) % L
      for (let k = 0; k < L && taken.has(i); k++) i = (i + 1) % L
      taken.add(i)
      TONE.map.set(n, i)
    }
  }
  return PROJ_TONES[TONE.map.get(name) ?? projHash(name) % L]
}
export const titleOf = (p: { title?: string; name: string }) => p.title || p.name
export const projTitle = () =>
  model.S.title || model.S.project || titleOf((DR.list || []).find((p) => p.name === ctx.HERE) || { name: ctx.HERE })
export const titleFor = (slug: string) =>
  slug === model.S.project ? projTitle() : titleOf((DR.list || []).find((p) => p.name === slug) || { name: slug })
export const projName = (slug: string) => titleOf((DR.list || []).find((p) => p.name === slug) || { name: slug })
export const otherProjects = () => (DR.list || []).filter((p) => p.name !== model.S.project)
export const projOrder = (a: ProjectRow, b: ProjectRow) =>
  (a.pos ?? 1e9) - (b.pos ?? 1e9) || titleOf(a).localeCompare(titleOf(b))
export function sideProjects(): ProjectRow[] {
  // every project in your order, this one with what this page knows now (B12, B200)
  const S = model.S
  const seen = (DR.list || []).find((p) => p.name === (S.project || ctx.HERE))
  const here: ProjectRow = S.project
    ? {
        name: S.project,
        title: S.title,
        open: openCount(),
        needs: S.items.filter(needsYou).length,
        agents: S.agents,
        work: S.work,
        pos: seen?.pos,
      }
    : seen || { name: ctx.HERE, title: '', open: '…', needs: 0 }
  return [here, ...(DR.list || []).filter((p) => p.name !== here.name)].sort(projOrder)
}
export const othersNeeding = () =>
  (DR.list || []).filter((p) => p.name !== (model.S.project || ctx.HERE) && p.needs).sort(projOrder)

// ---------------------------------------------------------------- agents

export function agentState(
  agents: { name: string; t: number; waiting: boolean }[] | undefined,
  work: boolean | undefined,
) {
  const list = [...(agents || [])].sort((a, b) => b.t - a.t),
    a = list.find((x) => x.waiting) || list[0]
  const name = a ? AGENT_NAME[a.name] || a.name : ''
  if (a?.waiting) return ['ok', `${name} ready`, `${name} is connected and picks up new work right away.`] as const
  if (a && Date.now() - a.t < 10 * 60e3)
    return ['ok', `${name} · ${agoShort(a.t)}`, `${name} was here ${agoLong(a.t)}.`] as const
  const last = a ? `The last agent (${name}) was here ${agoLong(a.t)}.` : 'No agent has connected to this project yet.'
  return work
    ? ([
        'bad',
        a ? `No agent · ${agoShort(a.t)}` : 'No agent',
        `Work is waiting, but no agent is here to take it. ${last}`,
      ] as const)
    : (['idle', a ? `${name} · ${agoShort(a.t)}` : 'No agent', `Nothing is waiting for an agent. ${last}`] as const)
}

// ---------------------------------------------------------------- the input box's target

export const detailShown = () => !desk() || (U.tab !== 'inputs' && !D.page)
export const ruleMode = () => U.asRule ?? U.tab === 'rules'
export const scopeN = () =>
  U.peek && byN.has(U.peek) ? U.peek : U.open && !U.scopeOff && byN.has(U.open) && detailShown() ? U.open : null
export const docOpen = () => (U.doc && !U.docEdit && (desk() || !!OV.spec) ? docById(U.doc) : undefined)

// ---------------------------------------------------------------- the sheet (dialog), one at a time

export interface DialogOpts {
  aboveComposer?: boolean
  focus?: boolean
  tall?: boolean
  card?: boolean
  pop?: boolean
  walk?: boolean
}
// Which sheet is open: its kind (components/sheets.tsx draws each kind) and what it is about.
export interface DialogSpec extends DialogOpts {
  kind: string
  props: Record<string, unknown>
}
export const OV = { spec: null as DialogSpec | null, popXY: null as null | [number, number], maxH: 0 }
export const els = {
  text: null as HTMLTextAreaElement | null,
  list: null as HTMLElement | null,
  detailBody: null as HTMLElement | null,
  dlgBody: null as HTMLElement | null,
  inputsView: null as HTMLElement | null,
  projectBody: null as HTMLElement | null,
  projectNav: null as HTMLElement | null,
  foot: null as HTMLElement | null,
  composer: null as HTMLElement | null,
  boxHome: null as HTMLElement | null,
  q: null as HTMLInputElement | null,
}
export const boxText = () => els.text?.value ?? ''

// The recorder (voice.ts): here so every part can tell whether a voice note is being recorded.
export const R_STATE = {
  rec: null as MediaRecorder | null,
  chunks: [] as Blob[],
  stream: null as MediaStream | null,
  t0: 0,
  tick: 0,
  ctx: null as AudioContext | null,
  levels: [] as number[],
  meter: (() => 0.2) as () => number,
  key: null as string | null,
  scope: null as string | null,
  from: null as string | null,
  typing: false,
  muted: false,
  vc: null as null | {
    d: number | null
    key: string | null
    quote: string
    range: Range | null
    rect: DOMRect | { top: number; bottom: number; left: number; width: number; height: number }
    top: number
  },
}
