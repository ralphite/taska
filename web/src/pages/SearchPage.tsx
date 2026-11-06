// The phone's search page (F479), voice first: its head (back to where you were), the kinds it found, what it found
// (by project, the one you are in first, each under its tile and name, which stay at the top while its rows scroll)
// or what it is doing, and the box at the bottom, which is the search box: what you said (or typed) is its words.
// Words on the screen are as few as will do. Props only.

import { useRef, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { RecBar } from '../ui/PlaceVoice'
import { BOX_WORDS_LOOK, Doubts, DraftWords } from '../features/composer/Doubts'
import { ItemRow, type RowEvents, type RowFacts, type RowLook } from '../features/list/ListRows'
import { ViewBar } from '../features/list/ViewBar'
import type { ViewChip } from '../features/list/rows'
import type { Spot } from '../model/doubts'
import { micAllow } from '../model/micWords'
import type { FindPhase, Found } from '../model/find'
import type { Item } from '../model/types'
import { Hit, ProjTile } from '../ui/bits'
import { Icon } from '../ui/Icon'
import { noMatches } from '../model/words'

/** A row of what it found: an item or a rule is the list's own row; an input or a document, a row like it. */
export type FoundRowView =
  | { kind: 'item'; key: string; found: Found; it: Item; facts: RowFacts; look: RowLook; on: RowEvents }
  | { kind: 'other'; key: string; found: Found; icon: 'doc' | 'newinput'; code: string; title: string; meta: string }

export interface FoundGroupView {
  project: string
  title: string
  tone: string
  rows: FoundRowView[]
}

export interface SearchView {
  phase: FindPhase
  /** the words in the box */
  words: string
  /** the words just added, lit at their end */
  added: string
  /** words typed since it last searched */
  typed: boolean
  /** words that may be misheard, still to pick (none: null) */
  doubts: { spots: readonly Spot[]; toCheck: number } | null
  /** the recording, while it records */
  rec: { time: string; levels: readonly number[] } | null
  /** the kinds it found (none found yet: null) */
  kinds: ViewChip[] | null
  /** what it found last, by project (none: null) */
  groups: FoundGroupView[] | null
  /** nothing asked yet: the pages you visited last, by project (none: null) */
  recent: FoundGroupView[] | null
  /** the words it marks where they are found */
  marks: readonly string[]
}

export interface SearchEvents {
  leave(): void
  /** say what to find, or say more */
  mic(): void
  /** stop recording and search */
  stop(): void
  /** the recording, or what you said being written out, goes */
  discard(): void
  /** the words and the results go */
  clear(): void
  type(words: string): void
  search(): void
  pick(fk: string, k: number, side: 'was' | 'alt'): void
  kind(value: string): void
  open(x: Found): void
}

const ROUND = 'grid size-11 shrink-0 place-items-center rounded-full'
const MAIN = `${ROUND} bg-zinc-900 text-white disabled:opacity-25 dark:bg-zinc-100 dark:text-zinc-900`
const SIDE = `${ROUND} text-zinc-500 dark:text-zinc-400`

/** The box while you search: the words you said (or typed), and its buttons. Recording, writing out: what you said
 * before stays above. The main button is the mic (say it, say more); it is the up arrow while you record (stop and
 * search) and once you typed (search what you typed). The x discards a recording, or clears the words. */
export function SearchBox({ v, on }: { v: SearchView; on: SearchEvents }) {
  const field = useRef<HTMLTextAreaElement>(null)
  const rec = v.phase === 'listening'
  const writing = v.phase === 'writing'
  const busy = rec || writing
  // a tap on the words: back to typing them, with the phone's keyboard (the field takes the focus in the tap itself)
  const toTyping = () => {
    flushSync(() => on.type(v.words))
    field.current?.focus()
  }
  const before = busy && v.words ? <p className="px-4 pt-2.5 text-[17px] leading-6 text-zinc-500 dark:text-zinc-400">{v.words}</p> : null
  let body: ReactNode
  if (rec)
    body = (
      <div role="status" aria-label="Recording" className="flex min-h-11 min-w-0 items-center gap-2.5 px-1">
        <RecBar time={v.rec?.time ?? '0:00'} levels={v.rec?.levels ?? []} />
      </div>
    )
  else if (writing)
    body = (
      <p className="flex min-h-11 items-center gap-2 px-1 text-[15px] text-zinc-500 dark:text-zinc-400">
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400" />
        Transcribing…
      </p>
    )
  else if (v.doubts) body = <DraftWords text={v.words} spots={v.doubts.spots} className={BOX_WORDS_LOOK} on={{ pick: on.pick, escape() {}, plain: toTyping }} />
  else if (v.added && v.words.endsWith(v.added)) {
    // what you just added, lit until you change the words (a tap on them: back to typing); the comma that joins
    // them is not lit
    const lit = v.added.replace(/^[\s,，]+/, '')
    body = (
      <button onClick={toTyping} aria-label="Change the words" className="min-h-11 px-1 py-2.5 text-left text-[17px] leading-6">
        {v.words.slice(0, -lit.length)}
        <mark className="rounded bg-blue-100 text-inherit dark:bg-blue-400/25">{lit}</mark>
      </button>
    )
  } else body = null
  const left = busy ? (
    <button onClick={on.discard} aria-label={rec ? 'Discard the recording' : 'Discard what you said'} className={SIDE}>
      <Icon n="x" c="size-6" />
    </button>
  ) : v.words ? (
    <button onClick={on.clear} aria-label="Clear the words" className={SIDE}>
      <Icon n="x" c="size-6" />
    </button>
  ) : (
    <span className="w-2 shrink-0" />
  )
  const main = rec ? (
    <button onClick={on.stop} aria-label="Stop and search" className={MAIN}>
      <Icon n="up" c="size-5" sw="2.25" />
    </button>
  ) : writing ? null : v.typed && v.words.trim() ? (
    <button onClick={on.search} aria-label="Search" className={MAIN}>
      <Icon n="up" c="size-5" sw="2.25" />
    </button>
  ) : v.phase === 'nomic' ? null : (
    <button onClick={on.mic} aria-label={v.words ? 'Say more' : 'Say what to find'} className={MAIN}>
      <Icon n="mic" c="size-6" />
    </button>
  )
  return (
    <div className={`flex flex-col rounded-4xl border bg-white shadow-sm dark:bg-zinc-900 dark:shadow-none ${v.typed ? 'border-zinc-400 dark:border-zinc-600' : 'border-zinc-200 dark:border-zinc-800'}`}>
      {v.doubts && !busy ? <Doubts view={{ kind: 'box', toCheck: v.doubts.toCheck, showing: true }} on={{ show() {} }} /> : null}
      {before}
      <div className="flex items-end gap-2 p-1.5">
        {left}
        <div className="grid min-w-0 flex-1">
          {body}
          {/* the field stays while the words show otherwise, so a tap on them can give it the focus */}
          <textarea
            ref={field}
            rows={1}
            hidden={!!body}
            value={v.words}
            aria-label="What to find"
            placeholder={v.phase === 'nomic' ? 'Type' : 'Say or type'}
            onChange={(e) => on.type(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
              e.preventDefault()
              on.search()
            }}
            className="field-sizing-content max-h-48 min-h-11 w-full min-w-0 resize-none bg-transparent px-1 py-2.5 text-[17px] leading-6 outline-none placeholder:text-zinc-500 dark:placeholder:text-zinc-400"
          />
        </div>
        {v.typed && v.words.trim() && !busy && v.phase !== 'nomic' ? (
          <button onClick={on.mic} aria-label="Say more" className={SIDE}>
            <Icon n="mic" c="size-6" />
          </button>
        ) : null}
        {main}
      </div>
    </div>
  )
}

/** A document or an input found: a row like the list's. */
function OtherRow({ r, marks, onOpen }: { r: Extract<FoundRowView, { kind: 'other' }>; marks: readonly string[]; onOpen(x: Found): void }) {
  return (
    <article className="border-b border-zinc-100 dark:border-zinc-800/70">
      <button onClick={() => onOpen(r.found)} data-found={r.key} className="flex w-full items-start gap-3 py-2.5 pr-3 pl-4 text-left">
        <Icon n={r.icon} c="mt-px size-5 text-zinc-400 dark:text-zinc-500" />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[15px] leading-snug font-medium">
            <span className="mr-1.5 font-mono text-[13px] font-bold text-zinc-500 dark:text-zinc-400">{r.code}</span>
            <Hit text={r.title} words={marks} />
          </span>
          {r.meta ? <span className="mt-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">{r.meta}</span> : null}
        </span>
      </button>
    </article>
  )
}

/** What it found, by project (the one you are in first), each closest first. A project's head stays at the top while
 * its rows scroll under it. */
function Results({ groups, marks, faded, onOpen }: { groups: FoundGroupView[]; marks: readonly string[]; faded: boolean; onOpen(x: Found): void }) {
  return (
    <div className={faded ? 'opacity-45 transition-opacity' : 'transition-opacity'}>
      {groups.map((g) => (
        <section key={g.project}>
          <h2 className="sticky top-0 z-20 flex h-10 items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 text-[15px] font-semibold dark:border-zinc-800 dark:bg-zinc-900">
            <ProjTile title={g.title} tone={g.tone} />
            {g.title}
          </h2>
          {g.rows.map((r) =>
            r.kind === 'item' ? (
              <ItemRow key={r.key} it={r.it} depth={0} band="" foldable={false} folded={false} facts={r.facts} look={r.look} on={r.on} />
            ) : (
              <OtherRow key={r.key} r={r} marks={marks} onOpen={onOpen} />
            ),
          )}
        </section>
      ))}
    </div>
  )
}

/** What it is doing, on the line over the box, where the page says what became of what you sent (so the results
 * above do not move). */
const Status = ({ children }: { children: ReactNode }) => (
  <p role="status" className="mb-1.5 flex min-h-7 items-center gap-2 rounded-full bg-white/95 pr-1 pl-2.5 text-[13px] text-zinc-600 dark:bg-zinc-950/95 dark:text-zinc-300">
    <span className="size-2 shrink-0 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400" />
    <span className="min-w-0 flex-1 truncate">{children}</span>
  </p>
)

/** The middle of an empty page: what is going on, what to do. */
const Middle = ({ title, children }: { title: ReactNode; children?: ReactNode }) => (
  <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
    <p className="text-[17px] font-medium">{title}</p>
    {children ? <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{children}</p> : null}
  </div>
)

/** What the page shows under its kinds: what it found (faded while it searches again), or what it is doing. `desk`:
 * the desktop's words where they differ (how to allow the microphone). */
export function SearchBody({ v, on, desk = false }: { v: SearchView; on: SearchEvents; desk?: boolean }) {
  let body: ReactNode = null
  if (v.groups) body = <Results groups={v.groups} marks={v.marks} faded={v.phase === 'searching'} onOpen={on.open} />
  else if (v.recent)
    body = (
      <>
        <p className="px-4 pt-3 pb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Recent</p>
        <Results groups={v.recent} marks={[]} faded={false} onOpen={on.open} />
      </>
    )
  else if (v.phase === 'searching') body = <Middle title={<Icon n="spinner" c="mx-auto size-7 animate-spin text-zinc-400" sw="2" />}>Searching…</Middle>
  else if (v.phase === 'nothing') body = <Middle title={noMatches(v.words)} />
  else if (v.phase === 'unheard') body = <Middle title="Didn't catch that" />
  else if (v.phase === 'nomic') body = <Middle title="Microphone not allowed">{micAllow(desk)}</Middle>
  else if (v.phase === 'offline')
    body = (
      <Middle
        title={
          <span className="flex items-center justify-center gap-2">
            <Icon n="spinner" c="size-4 animate-spin text-zinc-400" sw="2" />
            Taska is out of reach, retrying…
          </span>
        }
      />
    )
  return body
}

export function SearchPage({ v, on, hidden }: { v: SearchView; on: SearchEvents; hidden?: boolean }) {
  return (
    <div hidden={hidden} data-part="search" className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-1 px-2">
        <button onClick={on.leave} aria-label="Leave search" className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-700 dark:text-zinc-300">
          <Icon n="left" c="size-6" />
        </button>
        <span className="flex-1 truncate text-[19px] font-semibold tracking-tight">Search</span>
      </header>
      {v.kinds ? (
        <div className="shrink-0">
          <ViewBar views={v.kinds} onView={on.kind} />
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        <SearchBody v={v} on={on} />
      </div>
      <footer className={`relative z-20 shrink-0 border-t border-zinc-200 bg-zinc-50 px-3 pt-3 dark:border-transparent dark:bg-zinc-950 dark:pt-1 ${v.typed ? 'pb-2' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))]'}`}>
        {v.groups && v.phase === 'searching' ? <Status>Searching…</Status> : null}
        <SearchBox v={v} on={on} />
      </footer>
    </div>
  )
}
