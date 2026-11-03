// F479 on the desktop, a prototype (nothing here changes Taska), the search as desktop apps have it (Notion's): a
// Search row at the top of the sidebar, and ⌘K (or /) anywhere, open a modal in the top third over the dimmed page.
// Its top is a large field, focused: you type, and what it finds comes as you type, best first, each row with its
// project as a path. The mic at the field's end records (no words while you speak, r797), then Transcribing…, then
// the results, as on the phone. Under the field, the kinds and the Project and Status filters; beside the list, the
// highlighted row's preview; at the foot, the keys. ⌘K's commands come in it as Actions when the words match them.
// The modal is the command palette's sheet; the field's recording, its words to check and the words you added are
// the box's own parts (RecBar, DraftWords); the empty states are the phone's (SearchBody). The demo: Shop and Home
// (searchFixtures.ts), with a pause in place of the microphone and the server.
//
// The journeys
// 1. Find by typing. Click Search or press ⌘K: the field has the focus; Recent shows. Type: the results come, the
//    words found lit; ↑↓ (or the pointer) move the highlight and the preview follows; ↵ opens it in its project's
//    pane, ⌘↵ in a new tab; the modal goes.
// 2. Narrow it: a kind (Items, Inputs, Rules, Documents), a Project, a Status (Open or Finished).
// 3. Say it: the mic, or ⌥V. ↵ stops; the words are written out into the field and it searches. What you say goes
//    where typing would: over the words if they are all selected, else after them (said more: lit).
// 4. Fix what it heard: click the right one of a word's two versions. Click the words, or type, to edit them.
// 5. Come back: ⌘K again shows the last words, selected (type to start over), and what they found.
// 6. Do something: words that name a command (Done, Settings…) show it under Actions; ↵ does it.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { paletteRows } from '../app/actions'
import { Tooltip } from '../app/Tooltip'
import { RecBar } from '../features/composer/Composer'
import { DraftWords } from '../features/composer/Doubts'
import { CHIP, ViewBar } from '../features/list/ViewBar'
import { pickSide, spotsIn, type HeardFile } from '../model/doubts'
import { FIND_KINDS, saidMore, type FindAnswer, type FindKind, type FindPhase, type Found } from '../model/find'
import { closed, shownStatus } from '../model/items'
import { codeOf } from '../model/project'
import { refCard } from '../model/refCard'
import { clock } from '../model/time'
import { SearchBody, type SearchEvents, type SearchView } from '../pages/SearchPage'
import { Hit, ProjTile } from '../ui/bits'
import { Icon, StateIcon } from '../ui/Icon'
import { Sheet } from '../ui/Sheet'
import { TYPE_TEXT, toneOf } from '../ui/tones'
import { Frame } from './Frames'
import { HEARD, MISHEARD, MORE, ADDED, RIGHT, SHOP, searchOf } from './searchFixtures'
import { DeskPage, TONES, itemOf, modelFor, previewOf, titleOf } from './searchDeskPage'

// ---------------------------------------------------------------- where the search is

export interface Desk {
  open: boolean
  phase: FindPhase
  words: string
  /** the words you said last, lit at the end */
  added: string
  heard: HeardFile[]
  answer: FindAnswer | null
  kind: 'all' | FindKind
  project: string | null
  status: 'open' | 'finished' | null
  menu: 'project' | 'status' | null
  /** the highlighted row */
  sel: number
  /** the words in the field, to type in; else as they were said (lit, or a word to check) */
  typing: boolean
  /** what is said next takes the words' place (they were all selected) */
  replace: boolean
  /** the search came from the voice (it takes longer) */
  voice: boolean
  ms: number
  /** what the pane shows */
  pane: { slug: string; n: number }
}

const LEVELS = [0.2, 0.5, 0.8, 0.4, 0.6, 0.3, 0.7, 0.5, 0.9, 0.4, 0.6, 0.3]
export const START: Desk = { open: false, phase: 'ready', words: '', added: '', heard: [], answer: null, kind: 'all', project: null, status: null, menu: null, sel: 0, typing: true, replace: false, voice: false, ms: 3000, pane: { slug: 'shop', n: 1 } }

const TYPED = 'export filter'
const found = (words: string, a: FindAnswer, f: Partial<Desk> = {}): Partial<Desk> => ({ open: true, phase: 'found', words, answer: { ...a, q: words }, ...f })

/** A state to open a story on, by name. */
export const AT: Record<string, Partial<Desk>> = {
  closed: {},
  recent: { open: true },
  typingFirst: { open: true, phase: 'searching', words: 'export' },
  typingMore: found(TYPED, RIGHT, { phase: 'searching', words: TYPED + ' on the ph' }),
  found: found(TYPED, RIGHT),
  previewInput: found(TYPED, RIGHT, { sel: 1 }),
  previewDoc: found(TYPED, RIGHT, { sel: 2 }),
  oneKind: found(TYPED, RIGHT, { kind: 'items' }),
  projectMenu: found(TYPED, RIGHT, { menu: 'project' }),
  inHome: found(TYPED, RIGHT, { project: 'home' }),
  statusOpen: found(TYPED, RIGHT, { status: 'open', menu: 'status' }),
  actions: found('filter', RIGHT),
  onlyActions: { open: true, phase: 'nothing', words: 'settings' },
  listening: { open: true, phase: 'listening', typing: false, voice: true },
  writing: { open: true, phase: 'writing', typing: false, voice: true },
  misheard: found(MISHEARD.q, MISHEARD, { heard: HEARD, typing: false, voice: true }),
  sayingMore: found(RIGHT.q, RIGHT, { phase: 'listening', typing: false, voice: true, ms: 2000 }),
  saidMore: found(MORE.q, MORE, { added: ADDED, typing: false, voice: true }),
  opened: found(MORE.q, MORE, { open: false, pane: { slug: 'shop', n: 18 } }),
  reopened: found(MORE.q, MORE, { pane: { slug: 'shop', n: 18 }, replace: true }),
  nothing: { open: true, phase: 'nothing', words: 'the blue button on the invoice' },
  unheard: { open: true, phase: 'unheard', typing: false },
  nomic: { open: true, phase: 'nomic' },
  offline: { open: true, phase: 'offline', words: TYPED },
}

/** What the words find (the demo's answers; a start of export, filter or phone finds the first). */
function deskFind(words: string): FindAnswer | null {
  const a = searchOf(words)
  if (a) return a
  return /\b(exp|fil|pho)/i.test(words) ? { ...RIGHT, q: words } : null
}

/** The commands ⌘K had, as Actions when the words name one (those on an item act on the one open). */
const COMMANDS = [...paletteRows(true), ...paletteRows(false)].filter((c) => c.id !== 'palette')
function actionsFor(words: string, open: string) {
  const q = words.trim().toLowerCase()
  if (q.length < 3) return []
  return COMMANDS.filter((c) => c.label.toLowerCase().split(/[^a-z']+/).some((w) => w.startsWith(q)) || c.label.toLowerCase().startsWith(q))
    .slice(0, 3)
    .map((c) => ({ id: c.id, label: c.label.replace(/…$/, ''), sub: c.item ? open : '', keys: c.keys }))
}
type Action = ReturnType<typeof actionsFor>[number]

/** The search as it goes: typing searches as you type (a pause first); the mic records, writes out, searches. */
function useDesk(start: Partial<Desk>, still: boolean) {
  const [f, setF] = useState<Desk>({ ...START, ...start })
  const set = (p: Partial<Desk>) => setF((x) => ({ ...x, ...p }))
  useEffect(() => {
    if (still) return
    const after = (ms: number, next: (x: Desk) => Desk) => {
      const t = setTimeout(() => setF(next), ms)
      return () => clearTimeout(t)
    }
    if (f.phase === 'listening') return after(250, (x) => (x.phase === 'listening' ? { ...x, ms: x.ms + 250 } : x))
    if (f.phase === 'writing')
      return after(1300, (x) => {
        // the first words heard (one misheard); said with words there: what you add, at their end
        if (!x.words || x.replace) return { ...x, phase: 'searching', words: MISHEARD.q, heard: HEARD, added: '', replace: false }
        const more = saidMore(x.words, x.words.includes('phone') ? 'In the last week.' : 'Only on the phone.')
        return { ...x, phase: 'searching', ...more, heard: [] }
      })
    if (f.phase === 'searching')
      return after(f.voice ? 1400 : 450, (x) => {
        const a = deskFind(x.words)
        return { ...x, phase: a ? 'found' : 'nothing', answer: a, sel: 0 }
      })
  }, [f.phase, f.ms, still, f.voice])
  // typing searches what you typed, a moment after you stop
  useEffect(() => {
    if (still || !f.typing || !f.open || f.phase === 'listening' || f.phase === 'writing') return
    const t = setTimeout(() => setF((x) => (x.words.trim().length < 2 ? { ...x, phase: 'ready', answer: null } : { ...x, phase: 'searching', voice: false })), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.words])
  return { f, set, setF }
}

// ---------------------------------------------------------------- the rows

interface Line {
  key: string
  found: Found
  icon: ReactNode
  code: string
  codeCls: string
  title: string
  /** where it is: its project, and the item it is under or on */
  path: string
  project: string
}

function lineOf(x: Found): Line {
  const m = modelFor(x.project)
  const it = itemOf(x)
  const base = { key: x.project + '/' + x.key, found: x, project: x.project }
  if ((x.kind === 'items' || x.kind === 'rules') && it) {
    const code = x.item?.code ?? codeOf(m, it.n)
    const under = it.parent ? codeOf(m, it.parent) : ''
    return { ...base, icon: <StateIcon {...shownStatus(it)} cls="size-4 shrink-0" />, code, codeCls: TYPE_TEXT[it.type], title: it.title, path: [titleOf(x.project), under].filter(Boolean).join(' / ') }
  }
  const on = x.kind === 'docs' ? x.on : x.became
  return {
    ...base,
    icon: <Icon n={x.kind === 'docs' ? 'doc' : 'newinput'} c="size-4 shrink-0 text-zinc-400 dark:text-zinc-500" />,
    code: x.code ?? '',
    codeCls: 'text-zinc-500 dark:text-zinc-400',
    title: x.title ?? '',
    path: [titleOf(x.project), on].filter(Boolean).join(' / '),
  }
}

const ROW =
  'flex h-10 w-full min-w-0 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-left text-sm aria-selected:bg-blue-50 dark:aria-selected:bg-blue-400/15'
const LABEL = 'px-2.5 pt-2 pb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400'
const KEY = 'grid h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold text-zinc-500 ring-1 ring-zinc-300 dark:text-zinc-400 dark:ring-zinc-600'

function FoundRow({ l, i, sel, marks, attr, on }: { l: Line; i: number; sel: boolean; marks: readonly string[]; attr: string; on: { sel(i: number): void; open(x: Found): void } }) {
  return (
    <button {...{ [attr]: l.key }} aria-selected={sel} onMouseMove={() => !sel && on.sel(i)} onClick={() => on.open(l.found)} className={`${ROW} h-auto items-start py-2`}>
      <span className="grid h-5 shrink-0 place-items-center">{l.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate leading-5">
          {l.code ? <span className={`mr-1.5 font-mono text-xs font-bold ${l.codeCls}`}>{l.code}</span> : null}
          <Hit text={l.title} words={marks} />
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
          <ProjTile title={titleOf(l.project)} tone={toneOf(TONES, l.project)} cls="size-3.5 rounded-[3px] text-[8px]" />
          <span className="truncate">{l.path}</span>
        </span>
      </span>
    </button>
  )
}

function ActionRow({ a, i, sel, on }: { a: Action; i: number; sel: boolean; on: { sel(i: number): void; act(): void } }) {
  return (
    <button data-action={a.id} aria-selected={sel} onMouseMove={() => !sel && on.sel(i)} onClick={on.act} className={ROW}>
      <Icon n="arrow" c="size-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
      <span className="min-w-0 flex-1 truncate">
        {a.label}
        {a.sub ? <span className="ml-1.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">{a.sub}</span> : null}
      </span>
      {a.keys.split(' ').map((k, j) => (
        <kbd key={j} className={KEY}>
          {k}
        </kbd>
      ))}
    </button>
  )
}

// ---------------------------------------------------------------- the filters

function Pick({ label, set, open, rows, onOpen, onPick }: { label: string; set: string | null; open: boolean; rows: [string | null, ReactNode][]; onOpen(): void; onPick(v: string | null): void }) {
  return (
    <div className="relative shrink-0">
      <button onClick={onOpen} aria-pressed={!!set} aria-expanded={open} className={`${CHIP} gap-1.5 pr-1.5`}>
        {set ?? label}
        <Icon n="down" c="size-3.5 opacity-60" sw="2.25" />
      </button>
      {open ? (
        <div role="menu" className="absolute top-full right-0 z-30 mt-1 w-48 rounded-xl bg-white p-1 shadow-lg ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10">
          {rows.map(([v, inner]) => (
            <button key={v ?? 'any'} role="menuitem" onClick={() => onPick(v)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700">
              {inner}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------- the field

function Field({ f, field, on }: { f: Desk; field: React.RefObject<HTMLInputElement | null>; on: { type(w: string): void; mic(): void; stop(): void; discard(): void; pick(fk: string, k: number, side: 'was' | 'alt'): void; toTyping(): void } }) {
  const rec = f.phase === 'listening'
  const writing = f.phase === 'writing'
  const busy = rec || writing
  const spots = !f.typing && f.heard.length ? spotsIn(f.words, f.heard) : []
  const lit = !f.typing && f.added && f.words.endsWith(f.added) ? f.added.replace(/^[\s,，]+/, '') : ''
  let words: ReactNode = null
  if (rec)
    words = (
      <div role="status" aria-label="Recording" className="flex min-w-0 flex-1 items-center gap-2.5">
        {f.words && !f.replace ? <span className="max-w-[45%] truncate text-lg text-zinc-400 dark:text-zinc-500">{f.words}</span> : null}
        <RecBar time={clock(f.ms)} levels={LEVELS} />
      </div>
    )
  else if (writing)
    words = (
      <p className="flex min-w-0 flex-1 items-center gap-2 text-lg text-zinc-500 dark:text-zinc-400">
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400" />
        Transcribing…
      </p>
    )
  else if (spots.length)
    words = <DraftWords text={f.words} spots={spots} className="min-w-0 flex-1 truncate text-lg leading-8 outline-none" on={{ pick: on.pick, escape() {}, plain: on.toTyping }} />
  else if (lit)
    words = (
      <button onClick={on.toTyping} aria-label="Change the words" className="min-w-0 flex-1 truncate text-left text-lg">
        {f.words.slice(0, -lit.length)}
        <mark className="rounded bg-blue-100 text-inherit dark:bg-blue-400/25">{lit}</mark>
      </button>
    )
  const icon = 'grid size-8 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
  return (
    <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-zinc-200 pr-3 pl-4 dark:border-zinc-800">
      {busy ? (
        <button onClick={on.discard} aria-label="Discard the recording" title="Discard" className={`${icon} -ml-1.5`}>
          <Icon n="x" c="size-5" />
        </button>
      ) : (
        <Icon n="search" c="size-5 shrink-0 text-zinc-400 dark:text-zinc-500" sw="2" />
      )}
      {words}
      <input
        ref={field}
        hidden={!!words}
        value={f.words}
        aria-label="What to find"
        placeholder="Search Taska…"
        autoComplete="off"
        onChange={(e) => on.type(e.currentTarget.value)}
        className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
      />
      {f.phase === 'searching' && f.typing && f.answer ? <Icon n="spinner" c="size-4 shrink-0 animate-spin text-zinc-400" sw="2.25" /> : null}
      {rec ? (
        <button onClick={on.stop} aria-label="Stop and search" title="Stop and search · ↵" className="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
          <Icon n="up" c="size-4" sw="2.25" />
        </button>
      ) : writing ? null : (
        <button onClick={on.mic} aria-label="Speak" title="Speak · ⌥V" className={icon}>
          <Icon n="mic" c="size-5" />
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- the modal

const RECENT: Found[] = [RIGHT.found[0], RIGHT.found[2], { project: 'shop', kind: 'items', key: 'i2', n: 2 }, MORE.found[0], RIGHT.found.find((x) => x.project === 'home') as Found]
const noSearch: SearchEvents = { leave() {}, mic() {}, stop() {}, discard() {}, clear() {}, type() {}, search() {}, pick() {}, kind() {}, open() {} }

export function SearchModal({ f, set, onOpen, onClose }: { f: Desk; set(p: Partial<Desk>): void; onOpen(x: Found): void; onClose(): void }) {
  const root = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const a = f.answer
  const marks = a?.marks ?? []
  const it = (x: Found) => itemOf(x)
  const pass = (x: Found) =>
    (f.project === null || x.project === f.project) &&
    (f.status === null || ((x.kind === 'items' || x.kind === 'rules') && !!it(x) && closed((it(x) as NonNullable<ReturnType<typeof it>>).status) === (f.status === 'finished')))
  const narrowed = a ? a.found.filter(pass) : []
  const shown = narrowed.filter((x) => f.kind === 'all' || x.kind === f.kind)
  const results = f.words.trim() ? shown.map(lineOf) : []
  const busy = f.phase === 'listening' || f.phase === 'writing'
  // nothing typed or said yet: what you opened lately (while you speak, too)
  const recent = !f.words.trim() && (f.phase === 'ready' || busy) ? RECENT.map(lineOf) : []
  const typed = f.typing && f.phase !== 'listening' && f.phase !== 'writing'
  const actions = typed && f.kind === 'all' && !f.project && !f.status ? actionsFor(f.words, codeOf(modelFor(f.pane.slug), f.pane.n)) : []
  const rows: (Line | Action)[] = [...recent, ...results, ...actions]
  const sel = Math.min(f.sel, Math.max(0, rows.length - 1))
  const lit = rows[sel]
  // only commands listed: no preview, the list takes the width
  const hasPreview = rows.some((r) => 'found' in r)
  // nothing to list: what it is doing, or why not (the phone's words)
  const middle: FindPhase | null = busy || rows.length ? null : f.phase === 'found' ? 'nothing' : f.phase
  const mid: SearchView = { phase: middle ?? 'ready', words: f.words, added: '', typed: false, doubts: null, rec: null, kinds: null, groups: null, marks: [] }
  const faded = f.phase === 'searching' && !!a
  // the focus: the field when it shows (all of it selected when the modal opens on old words), else the modal
  useLayoutEffect(() => {
    const el = field.current
    if (el && !el.hidden) {
      if (document.activeElement !== el) el.focus({ preventScroll: true })
    } else if (!root.current?.contains(document.activeElement) || document.activeElement === el) root.current?.focus({ preventScroll: true })
  }, [f.typing, f.phase])
  useLayoutEffect(() => {
    if (f.replace && field.current && !field.current.hidden) field.current.select()
  }, [f.replace])
  useLayoutEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [sel])
  const open = (r: Line | Action | undefined) => {
    if (!r) return
    if ('found' in r) onOpen(r.found)
    else onClose()
  }
  const speak = () => {
    const el = field.current
    const all = !!el && !el.hidden && !!f.words && el.selectionStart === 0 && el.selectionEnd === f.words.length
    set({ phase: 'listening', typing: false, replace: all || f.replace, voice: true, ms: 0, menu: null })
  }
  const on = {
    type: (w: string) => set({ words: w, added: '', heard: [], typing: true, replace: false, sel: 0, ...(busy ? { phase: a ? 'found' : 'ready' } : {}) }),
    mic: speak,
    stop: () => set({ phase: 'writing' }),
    discard: () => set({ phase: a ? 'found' : f.words ? 'nothing' : 'ready', typing: true, replace: false }),
    pick: (fk: string, k: number, side: 'was' | 'alt') => {
      const h = f.heard.find((x) => x.key === fk)
      if (!h) return
      const r = pickSide(f.words, h, k, side)
      set({ words: r.text, heard: f.heard.map((x) => (x === h ? { ...x, trAdded: r.trAdded, doubts: r.doubts } : x)), phase: 'searching', voice: true })
    },
    toTyping: () => set({ typing: true, added: '' }),
  }
  const keys = (e: KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return
    const stop = () => (e.preventDefault(), e.stopPropagation())
    if (e.key === 'Escape') return (stop(), f.menu ? set({ menu: null }) : onClose())
    if (e.altKey && e.code === 'KeyV') return (stop(), f.phase === 'listening' ? on.stop() : f.phase === 'writing' ? undefined : speak())
    if (f.phase === 'listening') {
      if (e.key === 'Enter') return (stop(), on.stop())
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        stop()
        const base = f.replace ? '' : f.words
        return on.type(base + (base && !/\s$/.test(base) && e.key !== ' ' ? ' ' : '') + e.key)
      }
      return
    }
    if (f.phase === 'writing') return
    if (!f.typing && (e.key.length === 1 || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      stop()
      return on.type(e.key === 'Backspace' ? f.words.slice(0, -1) : f.words + e.key)
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && rows.length) return (stop(), set({ sel: (sel + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length }))
    // ⌘↵ opens it in a new tab (the browser's: nothing to draw here)
    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) return (stop(), open(lit))
  }
  const kinds = a
    ? [{ value: 'all', label: 'All', count: narrowed.length, on: f.kind === 'all', needs: false }, ...FIND_KINDS.map(([k, label]) => ({ value: k, label, count: narrowed.filter((x) => x.kind === k).length, on: f.kind === k, needs: false })).filter((c) => c.count || c.on)]
    : null
  const listRows = (
    <div ref={list} className={`flex flex-col gap-0.5 p-1.5 transition-opacity ${faded ? 'opacity-45' : ''}`}>
      {recent.length ? <p className={LABEL}>Recent</p> : null}
      {[...recent, ...results].map((l, i) => (
        <FoundRow key={l.key} l={l} i={i} sel={i === sel} marks={recent.length ? [] : marks} attr={recent.length ? 'data-recent' : 'data-found'} on={{ sel: (j) => set({ sel: j }), open: onOpen }} />
      ))}
      {actions.length ? <p className={LABEL}>Actions</p> : null}
      {actions.map((x, j) => {
        const i = recent.length + results.length + j
        return <ActionRow key={x.id} a={x} i={i} sel={i === sel} on={{ sel: (k) => set({ sel: k }), act: onClose }} />
      })}
    </div>
  )
  return (
    <Sheet open look={{ search: true }} desk onClose={onClose}>
      <div ref={root} tabIndex={-1} onKeyDownCapture={keys} data-part="search" aria-label="Search" className="flex min-h-0 flex-1 flex-col outline-none">
        <Field f={f} field={field} on={on} />
        {kinds ? (
          <div data-chips className="flex h-12 shrink-0 items-center gap-1 border-b border-zinc-200 pr-3 pl-2 dark:border-zinc-800">
            <div className="min-w-0 flex-1 [&>[data-views]]:border-0">
              <ViewBar views={kinds} onView={(k) => set({ kind: k as Desk['kind'], sel: 0 })} />
            </div>
            <Pick
              label="Project"
              set={f.project ? titleOf(f.project) : null}
              open={f.menu === 'project'}
              onOpen={() => set({ menu: f.menu === 'project' ? null : 'project' })}
              onPick={(v) => set({ project: v, menu: null, sel: 0 })}
              rows={[
                [null, <span className="flex-1">Any project</span>],
                ...(['shop', 'home'] as const).map((p): [string, ReactNode] => [
                  p,
                  <>
                    <ProjTile title={titleOf(p)} tone={toneOf(TONES, p)} cls="size-5 rounded-md text-[10px]" />
                    <span className="flex-1">{titleOf(p)}</span>
                    {f.project === p ? <Icon n="check" c="size-4 text-blue-600 dark:text-blue-400" sw="2.25" /> : null}
                  </>,
                ]),
              ]}
            />
            <Pick
              label="Status"
              set={f.status === 'open' ? 'Open' : f.status === 'finished' ? 'Finished' : null}
              open={f.menu === 'status'}
              onOpen={() => set({ menu: f.menu === 'status' ? null : 'status' })}
              onPick={(v) => set({ status: v as Desk['status'], menu: null, sel: 0 })}
              rows={[
                [null, <span className="flex-1">Any status</span>],
                ...(
                  [
                    ['open', 'Open'],
                    ['finished', 'Finished'],
                  ] as const
                ).map(([v, w]): [string, ReactNode] => [
                  v,
                  <>
                    <span className="flex-1">{w}</span>
                    {f.status === v ? <Icon n="check" c="size-4 text-blue-600 dark:text-blue-400" sw="2.25" /> : null}
                  </>,
                ]),
              ]}
            />
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1">
          {middle || !rows.length ? (
            <div className="flex min-w-0 flex-1 flex-col justify-center">{middle ? <SearchBody v={mid} on={noSearch} desk /> : null}</div>
          ) : (
            <>
              <div className={`overflow-y-auto lg:scrollbar-thin ${hasPreview ? 'w-[23rem] shrink-0' : 'flex-1'}`}>{listRows}</div>
              <div hidden={!hasPreview} data-preview={lit && 'found' in lit ? lit.found.kind : ''} className="relative min-w-0 flex-1 overflow-hidden border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                <div className={`pointer-events-none origin-top-left transition-opacity ${faded ? 'opacity-45' : ''}`}>{lit && 'found' in lit ? previewOf(lit.found) : null}</div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-white dark:from-zinc-950" />
              </div>
            </>
          )}
        </div>
        <footer className="flex h-9 shrink-0 items-center gap-4 border-t border-zinc-200 px-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {(
            [
              ['↑↓', 'Select'],
              ['↵', 'Open'],
              ['⌘↵', 'New tab'],
              ['⌥V', 'Speak'],
              ['Esc', 'Close'],
            ] as const
          ).map(([k, w]) => (
            <span key={k} className="flex items-center gap-1.5">
              <kbd className={KEY}>{k}</kbd>
              {w}
            </span>
          ))}
        </footer>
      </div>
    </Sheet>
  )
}

// ---------------------------------------------------------------- the whole of it

export interface DeskOpts {
  /** the sidebar folded to its rail */
  rail?: boolean
}

/** The desktop through the search, from the state `start` names; `still`: it stays in that state (a state's story). */
export function SearchDesk({ start = {}, still = false, rail = false }: { start?: Partial<Desk>; still?: boolean } & DeskOpts) {
  const { f, set, setF } = useDesk(start, still)
  // opening it: the last words, all selected, and what they found; none: Recent
  const show = () => setF((x) => (x.words ? { ...x, open: true, typing: true, replace: true, menu: null, sel: 0, kind: 'all', project: null, status: null, phase: x.answer ? 'found' : 'ready' } : { ...START, open: true, pane: x.pane }))
  const close = () => set({ open: false, menu: null, phase: f.phase === 'listening' || f.phase === 'writing' ? (f.answer ? 'found' : 'ready') : f.phase })
  // the page's keys: ⌘K (or /) opens the search, and ⌘K again closes it
  useEffect(() => {
    const key = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (f.open) close()
        else show()
      } else if (e.key === '/' && !f.open && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName ?? '')) {
        e.preventDefault()
        show()
      }
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  })
  return (
    <>
      <DeskPage slug={f.pane.slug} n={f.pane.n} rail={rail} onSearch={show} />
      {f.open ? <SearchModal f={f} set={set} onOpen={(x) => x.n != null && set({ open: false, menu: null, pane: { slug: x.project, n: x.n } })} onClose={close} /> : null}
    </>
  )
}

/** The page's own tooltip, over the whole window (the buttons' tips with their keys). */
export const Tips = () => <Tooltip card={(ref) => refCard(SHOP, ref)} />

/** The desktop at a width (1440 unless the story says), 900 high. */
export const DeskFrame = ({ width = 1440, children }: { width?: number; children: ReactNode }) => (
  <div className="bg-zinc-200 p-6 dark:bg-zinc-800">
    <Frame layout="desk" width={width} height={900}>
      {children}
    </Frame>
    <Tips />
  </div>
)

/** A state's story: the desktop, opened on that state, staying in it. */
export const deskStory = (at: keyof typeof AT, o: DeskOpts & { width?: number } = {}) => ({
  render: () => (
    <DeskFrame width={o.width}>
      <SearchDesk start={AT[at]} still rail={o.rail} />
    </DeskFrame>
  ),
})
