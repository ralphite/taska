// The desktop's search (F479), the way desktop apps have it: a dialog over nearly the whole window whose top is a large
// field with the focus (typing is the default; the mic at its end records, with the time and the level only, then
// Transcribing…, as the phone does); under it the kinds and the Project and Status filters; then one list, best
// first, each row with its project as a path (nothing typed: Recent; words that name an action: Actions), the
// highlighted row's preview beside it (each scrolls only when it holds more than the room), and the keys at the foot.
// Props only; it sits in the page's sheet.

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { RecBar } from '../ui/PlaceVoice'
import { DraftWords } from '../features/composer/Doubts'
import { CHIP, ViewBar } from '../features/list/ViewBar'
import type { FindKind, Found } from '../model/find'
import { Hit, ProjTile } from '../ui/bits'
import { Icon, StateIcon } from '../ui/Icon'
import { Rich } from '../ui/Markdown'
import type { InlineWorld } from '../ui/markdown/inline'
import { TYPE_TEXT } from '../ui/tones'
import { SearchBody, type SearchEvents, type SearchView } from './SearchPage'
import { isFound, type ActionLine, type FoundLine, type SearchDialogView } from './searchDialogView'

export interface DialogEvents {
  /** words typed: it searches them a moment after you stop */
  type(words: string): void
  /** the words as said, clicked: back to typing them */
  toTyping(): void
  /** the mic: what you say takes the words' place when `replace` (they were all selected), else goes after them */
  mic(replace: boolean): void
  stop(): void
  discard(): void
  pick(fk: string, k: number, side: 'was' | 'alt'): void
  kind(k: FindKind | 'all'): void
  project(slug: string | null): void
  status(s: SearchDialogView['status']): void
  select(i: number): void
  /** a row opened (`tab`: in a new tab) */
  open(x: Found, tab: boolean): void
  act(id: ActionLine['id']): void
  close(): void
}

const ROW = 'flex w-full min-w-0 shrink-0 gap-2.5 rounded-lg px-2.5 text-left text-sm aria-selected:bg-blue-50 dark:aria-selected:bg-blue-400/15'
const LABEL = 'px-2.5 pt-2 pb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400'
const KEY = 'grid h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-semibold text-zinc-500 ring-1 ring-zinc-300 dark:text-zinc-400 dark:ring-zinc-600'
const ICON = 'grid size-8 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
const FOOT: [string, string][] = [
  ['↑↓', 'Select'],
  ['↵', 'Open'],
  ['⌘↵', 'New tab'],
  ['⌥V', 'Speak'],
  ['Esc', 'Close'],
]
const noSearch: SearchEvents = { leave() {}, mic() {}, stop() {}, discard() {}, clear() {}, type() {}, search() {}, pick() {}, kind() {}, open() {} }

/** Where the words are in `root`'s text, as the list's Hit finds them (any case). */
function foundRanges(root: HTMLElement, words: readonly string[]): Range[] {
  const ws = words.filter(Boolean)
  if (!ws.length) return []
  const re = new RegExp(ws.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi')
  const out: Range[] = []
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walk.nextNode(); n && out.length < 200; n = walk.nextNode())
    for (const m of (n.textContent ?? '').matchAll(re)) {
      const r = document.createRange()
      r.setStart(n, m.index)
      r.setEnd(n, m.index + m[0].length)
      out.push(r)
    }
  return out
}

function Mark({ l }: { l: FoundLine }) {
  if (l.mark.kind === 'item') return <StateIcon s={l.mark.s} label={l.mark.label} cls="size-4 shrink-0" />
  return <Icon n={l.mark.kind === 'doc' ? 'doc' : 'newinput'} c="size-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
}

function FoundRow({ l, i, sel, marks, recent, on }: { l: FoundLine; i: number; sel: boolean; marks: readonly string[]; recent: boolean; on: DialogEvents }) {
  return (
    <button
      {...(recent ? { 'data-recent': l.key } : { 'data-found': l.key })}
      aria-selected={sel}
      onMouseMove={() => !sel && on.select(i)}
      onClick={(e) => on.open(l.found, e.metaKey || e.ctrlKey)}
      className={`${ROW} items-start py-2`}
    >
      <span className="grid h-5 shrink-0 place-items-center">
        <Mark l={l} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate leading-5">
          {l.code ? <span className={`mr-1.5 font-mono text-xs font-bold ${l.mark.kind === 'item' ? TYPE_TEXT[l.mark.type] : 'text-zinc-500 dark:text-zinc-400'}`}>{l.code}</span> : null}
          <Hit text={l.title} words={marks} />
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
          <ProjTile title={l.projectTitle} tone={l.tone} cls="size-3.5 rounded-[3px] text-[8px]" />
          <span className="truncate">{l.path}</span>
        </span>
      </span>
    </button>
  )
}

function ActionRow({ a, i, sel, on }: { a: ActionLine; i: number; sel: boolean; on: DialogEvents }) {
  return (
    <button data-action={a.id} aria-selected={sel} onMouseMove={() => !sel && on.select(i)} onClick={() => on.act(a.id)} className={`${ROW} h-10 items-center`}>
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

/** A filter's chip and its menu (Project, Status). */
function Pick({ label, set, open, rows, onOpen, onPick }: { label: string; set: string | null; open: boolean; rows: [string | null, ReactNode][]; onOpen(): void; onPick(v: string | null): void }) {
  return (
    <div className="relative shrink-0">
      <button onClick={onOpen} aria-pressed={!!set} aria-expanded={open} className={`${CHIP} gap-1.5 pr-1.5`}>
        {set ?? label}
        <Icon n="down" c="size-3.5 opacity-60" sw="2.25" />
      </button>
      {open ? (
        <div role="menu" className="absolute top-full right-0 z-30 mt-1 w-52 rounded-xl bg-white p-1 shadow-lg ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10">
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

const Check = ({ on }: { on: boolean }) => (on ? <Icon n="check" c="size-4 text-blue-600 dark:text-blue-400" sw="2.25" /> : null)

/** The field: the words typed, or as said (lit, a word to check), or the recording; the mic at its end. */
function Field({ v, field, on }: { v: SearchDialogView; field: RefObject<HTMLInputElement | null>; on: DialogEvents }) {
  const rec = v.phase === 'listening'
  const writing = v.phase === 'writing'
  const busy = rec || writing
  const lit = !v.typing && v.added && v.words.endsWith(v.added) ? v.added.replace(/^[\s,，]+/, '') : ''
  let words: ReactNode = null
  if (rec)
    words = (
      <div role="status" aria-label="Recording" className="flex min-w-0 flex-1 items-center gap-2.5">
        {v.words && !v.replace ? <span className="max-w-[45%] truncate text-lg text-zinc-400 dark:text-zinc-500">{v.words}</span> : null}
        <RecBar time={v.rec?.time ?? '0:00'} levels={v.rec?.levels ?? []} />
      </div>
    )
  else if (writing)
    words = (
      <p className="flex min-w-0 flex-1 items-center gap-2 text-lg text-zinc-500 dark:text-zinc-400">
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400" />
        Transcribing…
      </p>
    )
  else if (v.spots) words = <DraftWords text={v.words} spots={v.spots} className="min-w-0 flex-1 truncate text-lg leading-8 outline-none" on={{ pick: on.pick, escape() {}, plain: on.toTyping }} />
  else if (lit)
    words = (
      <button onClick={on.toTyping} aria-label="Change the words" className="min-w-0 flex-1 truncate text-left text-lg">
        {v.words.slice(0, -lit.length)}
        <mark className="rounded bg-blue-100 text-inherit dark:bg-blue-400/25">{lit}</mark>
      </button>
    )
  const all = () => {
    const el = field.current
    return !!el && !el.hidden && !!v.words && el.selectionStart === 0 && el.selectionEnd === v.words.length
  }
  return (
    <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-zinc-200 pr-3 pl-4 dark:border-zinc-800">
      {busy ? (
        <button onClick={on.discard} aria-label="Discard the recording" title="Discard" className={`${ICON} -ml-1.5`}>
          <Icon n="x" c="size-5" />
        </button>
      ) : (
        <Icon n="search" c="size-5 shrink-0 text-zinc-400 dark:text-zinc-500" sw="2" />
      )}
      {words}
      <input
        ref={field}
        hidden={!!words}
        value={v.words}
        aria-label="What to find"
        placeholder="Search Taska…"
        autoComplete="off"
        onChange={(e) => on.type(e.currentTarget.value)}
        className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
      />
      {v.faded ? <Icon n="spinner" c="size-4 shrink-0 animate-spin text-zinc-400" sw="2.25" /> : null}
      {rec ? (
        <button onClick={on.stop} aria-label="Stop and search" title="Stop and search · ↵" className="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
          <Icon n="up" c="size-4" sw="2.25" />
        </button>
      ) : writing ? null : (
        <button onClick={() => on.mic(all() || v.replace)} aria-label="Speak" title="Speak · ⌥V" className={ICON}>
          <Icon n="mic" c="size-5" />
        </button>
      )}
    </div>
  )
}

export function SearchDialog({ v, preview, menuAt = null, on }: { v: SearchDialogView; /** the highlighted row's preview */ preview: ReactNode; /** a filter's menu open from the start (a story's) */ menuAt?: 'project' | 'status' | null; on: DialogEvents }) {
  const root = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const look = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState(menuAt)
  const rows = [...v.recent, ...v.results, ...v.actions]
  const busy = v.phase === 'listening' || v.phase === 'writing'
  const hasPreview = rows.some(isFound)
  // the focus: the field when it shows (all of it selected when the words are old), else the dialog
  useLayoutEffect(() => {
    const el = field.current
    if (el && !el.hidden) {
      if (document.activeElement !== el) el.focus({ preventScroll: true })
    } else if (!root.current?.contains(document.activeElement) || document.activeElement === el) root.current?.focus({ preventScroll: true })
  }, [v.typing, v.phase])
  useLayoutEffect(() => {
    if (v.replace && field.current && !field.current.hidden) field.current.select()
  }, [v.replace])
  useLayoutEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [v.sel])
  // another row's preview starts at its top
  useLayoutEffect(() => {
    if (look.current) look.current.scrollTop = 0
  }, [v.sel, v.words])
  // the words searched lit in the preview as in the list, the first of them in sight (R6-2 #12); a highlight of the
  // page's (CSS highlights), so the preview's own words are left as they are
  const litKey = isFound(v.lit) ? v.lit.key : ''
  useLayoutEffect(() => {
    const el = look.current
    const all = typeof CSS !== 'undefined' ? CSS.highlights : undefined
    if (!el || !all || typeof Highlight === 'undefined' || !litKey) return
    const t = setTimeout(() => {
      const ranges = foundRanges(el, v.marks)
      all.set('found', new Highlight(...ranges))
      ranges[0]?.startContainer.parentElement?.scrollIntoView({ block: 'center' })
    }, 60)
    return () => {
      clearTimeout(t)
      all.delete('found')
    }
  }, [litKey, v.marks])
  const open = (l: (typeof rows)[number] | null, tab: boolean) => {
    if (!l) return
    if (isFound(l)) on.open(l.found, tab)
    else on.act(l.id)
  }
  const keys = (e: KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return
    const stop = () => (e.preventDefault(), e.stopPropagation())
    if (e.key === 'Escape') return (stop(), menu ? setMenu(null) : on.close())
    if (e.altKey && e.code === 'KeyV') {
      stop()
      if (v.phase === 'listening') return on.stop()
      const el = field.current
      if (v.phase !== 'writing') on.mic(v.replace || (!!el && !el.hidden && !!v.words && el.selectionStart === 0 && el.selectionEnd === v.words.length))
      return
    }
    if (v.phase === 'listening') {
      if (e.key === 'Enter') return (stop(), on.stop())
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        stop()
        const base = v.replace ? '' : v.words
        return on.type(base + (base && !/\s$/.test(base) && e.key !== ' ' ? ' ' : '') + e.key)
      }
      return
    }
    if (busy) return
    if (!v.typing && (e.key.length === 1 || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      stop()
      return on.type(e.key === 'Backspace' ? v.words.slice(0, -1) : v.words + e.key)
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && rows.length) return (stop(), on.select((v.sel + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length))
    if (e.key === 'Enter') return (stop(), open(v.lit, e.metaKey || e.ctrlKey))
  }
  const mid: SearchView = { phase: v.middle ?? 'ready', words: v.words, added: '', typed: false, doubts: null, rec: null, kinds: null, groups: null, recent: null, marks: [] }
  return (
    <div ref={root} tabIndex={-1} onKeyDownCapture={keys} data-part="search" aria-label="Search" className="flex min-h-0 flex-1 flex-col outline-none">
      <Field v={v} field={field} on={on} />
      {v.kinds ? (
        <div data-chips className="flex h-12 shrink-0 items-center gap-1 border-b border-zinc-200 pr-3 pl-2 dark:border-zinc-800">
          <div className="min-w-0 flex-1 [&>[data-views]]:border-0">
            <ViewBar views={v.kinds} onView={(k) => on.kind(k as FindKind | 'all')} />
          </div>
          <Pick
            label="Project"
            set={v.projects.find((p) => p.slug === v.project)?.title ?? null}
            open={menu === 'project'}
            onOpen={() => setMenu(menu === 'project' ? null : 'project')}
            onPick={(x) => (setMenu(null), on.project(x))}
            rows={[
              [
                null,
                <>
                  <span className="flex-1">Any project</span>
                  <Check on={v.project === null} />
                </>,
              ],
              ...v.projects.map((p): [string, ReactNode] => [
                p.slug,
                <>
                  <ProjTile title={p.title} tone={p.tone} cls="size-5 rounded-md text-[10px]" />
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  <Check on={v.project === p.slug} />
                </>,
              ]),
            ]}
          />
          <Pick
            label="Status"
            set={v.status === 'open' ? 'Open' : v.status === 'finished' ? 'Finished' : null}
            open={menu === 'status'}
            onOpen={() => setMenu(menu === 'status' ? null : 'status')}
            onPick={(x) => (setMenu(null), on.status(x as SearchDialogView['status']))}
            rows={[
              [
                null,
                <>
                  <span className="flex-1">Any status</span>
                  <Check on={v.status === null} />
                </>,
              ],
              ...(
                [
                  ['open', 'Open'],
                  ['finished', 'Finished'],
                ] as const
              ).map(([x, w]): [string, ReactNode] => [
                x,
                <>
                  <span className="flex-1">{w}</span>
                  <Check on={v.status === x} />
                </>,
              ]),
            ]}
          />
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        {v.middle || !rows.length ? (
          <div className="flex min-w-0 flex-1 flex-col justify-center">{v.middle ? <SearchBody v={mid} on={noSearch} desk /> : null}</div>
        ) : (
          <>
            <div className={`overflow-y-auto lg:scrollbar-thin ${hasPreview ? 'w-[clamp(22rem,34%,28rem)] shrink-0' : 'flex-1'}`}>
              <div ref={list} className={`flex flex-col gap-0.5 p-1.5 transition-opacity ${v.faded ? 'opacity-45' : ''}`}>
                {v.recent.length ? <p className={LABEL}>Recent</p> : null}
                {[...v.recent, ...v.results].map((l, i) => (
                  <FoundRow key={l.key} l={l} i={i} sel={i === v.sel} marks={v.recent.length ? [] : v.marks} recent={!!v.recent.length} on={on} />
                ))}
                {v.actions.length ? <p className={LABEL}>Actions</p> : null}
                {v.actions.map((a, j) => {
                  const i = v.recent.length + v.results.length + j
                  return <ActionRow key={a.id} a={a} i={i} sel={i === v.sel} on={on} />
                })}
              </div>
            </div>
            {/* only a look: nothing in it is reached, but the wheel scrolls what does not fit */}
            <div ref={look} hidden={!hasPreview} data-preview={isFound(v.lit) ? v.lit.found.kind : ''} className="min-w-0 flex-1 overflow-y-auto border-l border-zinc-200 bg-white lg:scrollbar-thin dark:border-zinc-800 dark:bg-zinc-950 [&_*::highlight(found)]:bg-yellow-200 [&_*::highlight(found)]:text-zinc-900 dark:[&_*::highlight(found)]:bg-yellow-400/30 dark:[&_*::highlight(found)]:text-white">
              <div inert className={`transition-opacity ${v.faded ? 'opacity-45' : ''}`}>
                {preview}
              </div>
            </div>
          </>
        )}
      </div>
      <footer className="flex h-9 shrink-0 items-center gap-4 border-t border-zinc-200 px-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {/* nothing to pick (nothing found, the microphone not allowed, out of reach): only Speak and Close */}
        {FOOT.filter(([k]) => rows.length || k === '⌥V' || k === 'Esc').map(([k, w]) => (
          <span key={k} className="flex items-center gap-1.5">
            <kbd className={KEY}>{k}</kbd>
            {w}
          </span>
        ))}
      </footer>
    </div>
  )
}

const NO_WORLD: InlineWorld = { find: () => null, url: () => '', size: () => undefined }

/** A row's preview when its page is not here (another project's, a document, an input): what the search knows of it. */
export function FoundPreview({ l, text, meta }: { l: FoundLine; /** its words (Markdown): an item's body, a document's text */ text: string; meta: string }) {
  return (
    <article className="px-8 pt-7 pb-10">
      <p className="mb-2 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        <ProjTile title={l.projectTitle} tone={l.tone} cls="size-4 rounded text-[9px]" />
        {l.path}
      </p>
      <h2 className="flex items-start gap-2 text-xl leading-snug font-semibold">
        <span className="mt-1.5">
          <Mark l={l} />
        </span>
        <span>
          {l.code ? <span className={`mr-2 font-mono text-base font-bold ${l.mark.kind === 'item' ? TYPE_TEXT[l.mark.type] : 'text-zinc-500 dark:text-zinc-400'}`}>{l.code}</span> : null}
          {l.title}
        </span>
      </h2>
      {meta ? <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{meta}</p> : null}
      {text ? <Rich text={text} world={NO_WORLD} cls="mt-5" /> : null}
    </article>
  )
}
