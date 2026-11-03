// F479 (r982, #8722): searching by voice on the phone, a prototype to look at before anything is built. Phone only
// (393 by 852); voice first, typing allowed.
//
// The idea: while you search, the box at the bottom of the screen (the one you always speak into) is the search box.
// What you said is its words; what it found is the page above it. So saying more is what the box always does: tap
// its mic, speak, and the new words join the old ones; the search runs again on all of them.
//
// The journeys
// 1. Find something by saying it. Tap the magnifier: the search page opens and the box records at once. Say what to
//    find; tap the up arrow. Taska writes your words out after you stop (nothing shows while you speak), puts them in
//    the box and searches every project by what they mean: "Searching…", then the results grouped by project (
//    the one you are in first, then each other one, each under its tile and name, which stay at the top while its
//    rows scroll), closest first in each; a row of kinds (All, Items, Inputs, Rules, Documents) filters them all.
// 2. Say more. With the results showing, tap the mic in the box. Your words stay in the box and the results stay on
//    the page while you speak. Tap the up arrow: what you added is put at the end of your words, lit, and it searches
//    all of them again; the results change in place (faded while it searches, never blank).
// 3. Fix what it heard. A word one model heard differently shows its two versions in the box; tap the right one and it
//    searches again. Or tap the words and type: the up arrow searches what you typed.
// 4. Start over. The x beside the words clears them and the results; tap the mic or type.
// 5. Use a result. Tap it: it opens as it does anywhere in Taska, and the box writes to it (you can reply to it at
//    once). Back: the same search, as you left it. (A document opens over its item, an input opens what it became.)
// 6. Leave. The back arrow at the top: back to the list where you were; the next search starts afresh.
//
// The states: listening; writing out your words; searching; found (All, or one kind); a result open; a word that may be misheard; saying more with the results showing; searching
// again; typing; nothing found; nothing heard; no microphone (type instead); Taska out of reach (it keeps trying).
//
// Words on the screen are as few as will do (#8722: nothing verbose). Drawn here because they are not built: the
// search page (its head, its status line, the rows for documents and inputs) and the box in its search role. The rest is the page's own: the list's head, tabs and rows (items and rules
// are the list's ItemRow), the views' row (for the kinds), the recording bar, the misheard words and their two
// versions, the item page and the box under it, with the demo project Shop (searchFixtures.ts: what each thing you
// might say finds). Nothing here changes Taska itself.
import { useEffect, useState, type ReactNode } from 'react'
import { Composer, RecBar } from '../features/composer/Composer'
import { BOX_WORDS_LOOK, Doubts, DraftWords } from '../features/composer/Doubts'
import { ItemRow } from '../features/list/ListRows'
import { ViewBar } from '../features/list/ViewBar'
import { rowFacts, rowLook, type DrawWith } from '../features/list/drawRows'
import { ListHead, PhoneTabs } from '../pages/Header'
import { agentInfo, phoneTabs, tabCounts } from '../pages/headFacts'
import { boxRole, shownBox } from '../model/boxFoot'
import { spotsIn } from '../model/doubts'
import { codeOf, type ProjectModel } from '../model/project'
import { NO_FILTERS, parseRoute } from '../model/route'
import type { Item } from '../model/types'
import { Hit, ProjTile } from '../ui/bits'
import { Icon } from '../ui/Icon'
import { PROJECT_TONES } from '../ui/tones'
import { Frame } from './Frames'
import { T } from './fixtures'
import { pageOf } from './itemPage'
import { listOf, listOn } from './listFixtures'
import { ADDED, D1, HEARD, HOME, ITEMS, KINDS, MISHEARD, MORE, RIGHT, SHOP, searchOf, type Found, type Kind, type Search } from './searchFixtures'

// ---------------------------------------------------------------- where you are, and what the search is doing

export type Phase =
  /** nothing to search yet: the box waits for you to speak or type */
  | 'ready'
  | 'listening'
  /** writing out what you said, after you stopped */
  | 'writing'
  /** searching: the first time (nothing yet), or again (the results before it, faded) */
  | 'searching'
  | 'found'
  | 'nothing'
  /** you stopped, but there were no words in it */
  | 'unheard'
  | 'nomic'
  | 'offline'

export interface Flow {
  at: 'list' | 'search' | 'open'
  phase: Phase
  /** the words in the box */
  words: string
  /** the words you just added, lit at the end of them until you change them */
  added: string
  /** a word of what you said may be misheard: its two versions in the box */
  doubt: boolean
  /** what it found last, still shown while it listens or searches again */
  search: Search | null
  kind: Kind | 'all'
  /** words typed since it last searched: the up arrow searches them */
  typed: boolean
  /** the result open */
  open: Found | null
}
export const START: Flow = { at: 'list', phase: 'ready', words: '', added: '', doubt: false, search: null, kind: 'all', typed: false, open: null }

/** A state to open a story on, by name. */
export const AT: Record<string, Partial<Flow>> = {
  listening: { at: 'search', phase: 'listening' },
  writing: { at: 'search', phase: 'writing' },
  searching: { at: 'search', phase: 'searching', words: RIGHT.words },
  found: { at: 'search', phase: 'found', words: RIGHT.words, search: RIGHT },
  oneKind: { at: 'search', phase: 'found', words: RIGHT.words, search: RIGHT, kind: 'items' },
  open: { at: 'open', phase: 'found', words: MORE.words, search: MORE, open: MORE.found[0] },
  misheard: { at: 'search', phase: 'found', words: MISHEARD.words, search: MISHEARD, doubt: true },
  sayingMore: { at: 'search', phase: 'listening', words: RIGHT.words, search: RIGHT },
  again: { at: 'search', phase: 'searching', words: MORE.words, added: ADDED, search: RIGHT },
  againFound: { at: 'search', phase: 'found', words: MORE.words, added: ADDED, search: MORE },
  typing: { at: 'search', phase: 'found', words: 'where the export loses my filter on the phone', search: RIGHT, typed: true },
  cleared: { at: 'search', phase: 'ready' },
  nothing: { at: 'search', phase: 'nothing', words: 'the blue button in the settings', search: null },
  unheard: { at: 'search', phase: 'unheard' },
  nomic: { at: 'search', phase: 'nomic' },
  offline: { at: 'search', phase: 'offline', words: RIGHT.words },
}

const WAIT = { writing: 1300, searching: 1400 }

/** The search as it goes: tap, speak, stop, the words written out, the search. */
function useFlow(start: Partial<Flow>, still: boolean) {
  const [f, setF] = useState<Flow>({ ...START, ...start })
  const set = (p: Partial<Flow>) => setF((x) => ({ ...x, ...p }))
  // what it finds once it has searched
  const done = (x: Flow): Flow => {
    const s = searchOf(x.words)
    return s ? { ...x, phase: 'found', search: s } : { ...x, phase: 'nothing', search: null }
  }
  useEffect(() => {
    if (still) return
    const after = (ms: number, next: (x: Flow) => Flow) => {
      const t = setTimeout(() => setF(next), ms)
      return () => clearTimeout(t)
    }
    if (f.phase === 'writing')
      return after(WAIT.writing, (x) => {
        // the first words heard (one misheard); said again with words there: what you add, at their end
        if (!x.words) return { ...x, phase: 'searching', words: MISHEARD.words, doubt: true, added: '' }
        const more = x.words.includes('phone') ? ', in the last week' : ADDED
        return { ...x, phase: 'searching', words: x.words + more, added: more, doubt: false }
      })
    if (f.phase === 'searching') return after(WAIT.searching, done)
  }, [f.phase, still])
  const searchNow = () => set({ phase: 'searching', typed: false, kind: 'all' })
  return {
    f,
    open: () => setF({ ...START, at: 'search', phase: 'listening' }),
    leave: () => setF(START),
    mic: () => set({ phase: 'listening', added: '' }),
    stop: () => set({ phase: 'writing' }),
    discard: () => set({ phase: f.search ? 'found' : 'ready' }),
    clear: () => set({ phase: 'ready', words: '', added: '', doubt: false, search: null, kind: 'all', typed: false }),
    type: (words: string) => set({ words, added: '', doubt: false, typed: true }),
    searchNow,
    pickVersion: () => (set({ words: RIGHT.words, doubt: false }), searchNow()),
    kind: (k: Kind | 'all') => set({ kind: k }),
    pick: (x: Found) => set({ at: 'open', open: x }),
    back: () => set({ at: 'search', open: null }),
  }
}
type Acts = ReturnType<typeof useFlow>

// ---------------------------------------------------------------- the box, in its search role

const ROUND = 'grid size-11 shrink-0 place-items-center rounded-full'
const MAIN = `${ROUND} bg-zinc-900 text-white disabled:opacity-25 dark:bg-zinc-100 dark:text-zinc-900`
const SIDE = `${ROUND} text-zinc-500 dark:text-zinc-400`
const LEVELS = [0.2, 0.5, 0.8, 0.4, 0.6, 0.3, 0.7, 0.5, 0.9, 0.4, 0.6, 0.3]

/** The box while you search: the words you said (or typed), and its buttons. Recording, writing out: what you said
 * before stays above. The main button is the mic (say it, say more); it is the up arrow while you record (stop and
 * search) and once you typed (search what you typed). The x discards a recording, or clears the words. */
function SearchBox({ f, a }: { f: Flow; a: Acts }) {
  const rec = f.phase === 'listening'
  const writing = f.phase === 'writing'
  const busy = rec || writing
  const before = busy && f.words ? <p className="px-4 pt-2.5 text-[17px] leading-6 text-zinc-500 dark:text-zinc-400">{f.words}</p> : null
  let field: ReactNode
  if (rec)
    field = (
      <div role="status" aria-label="Recording" className="flex min-h-11 min-w-0 items-center gap-2.5 px-1">
        <RecBar time={f.words ? '0:02' : '0:03'} levels={LEVELS} />
      </div>
    )
  else if (writing)
    field = (
      <p className="flex min-h-11 items-center gap-2 px-1 text-[15px] text-zinc-500 dark:text-zinc-400">
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400" />
        Transcribing…
      </p>
    )
  else if (f.doubt)
    field = <DraftWords text={f.words} spots={spotsIn(f.words, HEARD)} className={BOX_WORDS_LOOK} on={{ pick: (_fk, _k, side) => (side === 'alt' ? a.pickVersion() : undefined), escape() {}, plain() {} }} />
  else if (f.added && f.words.endsWith(f.added)) {
    // what you just added, lit until you change the words (a tap on them: back to typing); the comma that joins
    // them is not lit
    const lit = f.added.replace(/^[\s,]+/, '')
    field = (
      <button onClick={() => a.type(f.words)} aria-label="Change the words" className="min-h-11 px-1 py-2.5 text-left text-[17px] leading-6">
        {f.words.slice(0, -lit.length)}
        <mark className="rounded bg-blue-100 text-inherit dark:bg-blue-400/25">{lit}</mark>
      </button>
    )
  } else
    field = (
      <textarea
        rows={1}
        value={f.words}
        aria-label="What to find"
        placeholder={f.phase === 'nomic' ? 'Type' : 'Say or type'}
        onChange={(e) => a.type(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
          e.preventDefault()
          a.searchNow()
        }}
        className="field-sizing-content max-h-48 min-h-11 w-full min-w-0 resize-none bg-transparent px-1 py-2.5 text-[17px] leading-6 outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
      />
    )
  const left = busy ? (
    <button onClick={a.discard} aria-label={rec ? 'Discard the recording' : 'Discard what you said'} className={SIDE}>
      <Icon n="x" c="size-6" />
    </button>
  ) : f.words ? (
    <button onClick={a.clear} aria-label="Clear the words" className={SIDE}>
      <Icon n="x" c="size-6" />
    </button>
  ) : (
    <span className="w-2 shrink-0" />
  )
  const main = rec ? (
    <button onClick={a.stop} aria-label="Stop and search" className={MAIN}>
      <Icon n="up" c="size-5" sw="2.25" />
    </button>
  ) : writing ? null : f.typed && f.words.trim() ? (
    <button onClick={a.searchNow} aria-label="Search" className={MAIN}>
      <Icon n="up" c="size-5" sw="2.25" />
    </button>
  ) : (
    <button onClick={a.mic} aria-label={f.words ? 'Say more' : 'Say what to find'} className={MAIN}>
      <Icon n="mic" c="size-6" />
    </button>
  )
  return (
    <div className={`flex flex-col rounded-4xl border bg-white shadow-sm dark:bg-zinc-900 dark:shadow-none ${f.typed ? 'border-zinc-400 dark:border-zinc-600' : 'border-zinc-200 dark:border-zinc-800'}`}>
      {f.doubt && !busy ? <Doubts view={{ kind: 'phone', toCheck: 1, showing: true }} on={{ use() {}, show() {} }} /> : null}
      {before}
      <div className="flex items-end gap-2 p-1.5">
        {left}
        <div className="grid min-w-0 flex-1">{field}</div>
        {f.typed && f.words.trim() && !busy ? (
          <button onClick={a.mic} aria-label="Say more" className={SIDE}>
            <Icon n="mic" c="size-6" />
          </button>
        ) : null}
        {main}
      </div>
    </div>
  )
}

/** The page's foot, where the box always is. */
const Foot = ({ keyboard = false, children }: { keyboard?: boolean; children: ReactNode }) => (
  <footer className={`relative z-20 shrink-0 border-t border-zinc-200 bg-zinc-50 px-3 pt-3 dark:border-transparent dark:bg-zinc-950 dark:pt-1 ${keyboard ? 'pb-2' : 'pb-5'}`}>{children}</footer>
)

// ---------------------------------------------------------------- what it found

const drawWith = (words: string[]): DrawWith => ({ slug: 'shop', openN: null, selected: new Set(), words, desk: false, drafts: new Set(), head: undefined, seen: { since: T }, drag: { n: null, at: null }, heldHeight: () => 64 })

/** A row of what it found: an item or a rule is the list's own row (with where the words were found, when not in
 * its title, as the list says it); a document or an input, a row like it. Its project is its group's. */
function FoundRow({ x, marks, onPick }: { x: Found; marks: string[]; onPick(x: Found): void }) {
  const m: ProjectModel = x.home ? HOME : SHOP
  if (!x.code) {
    const one = m.byN.get(x.n) as Item
    const w = drawWith(marks)
    return <ItemRow it={one} depth={0} band="" foldable={false} folded={false} facts={rowFacts(m, one, w)} look={rowLook(one, w)} on={{ ...listOn, open: () => onPick(x) }} />
  }
  return (
    <article className="border-b border-zinc-100 dark:border-zinc-800/70">
      <button onClick={() => onPick(x)} data-found={x.key} className="flex w-full items-start gap-3 py-2.5 pr-3 pl-4 text-left">
        <Icon n={x.kind === 'docs' ? 'doc' : 'newinput'} c="mt-px size-5 text-zinc-400 dark:text-zinc-500" />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[15px] leading-snug font-medium">
            <span className="mr-1.5 font-mono text-[13px] font-bold text-zinc-500 dark:text-zinc-400">{x.code}</span>
            <Hit text={x.title ?? ''} words={marks} />
          </span>
          <span className="mt-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">{x.meta}</span>
        </span>
      </button>
    </article>
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

/** The projects, as the sidebar draws them: the one you are in first, then the others. */
const GROUPS = [
  { home: false, title: SHOP.facts.title, tone: PROJECT_TONES[1] },
  { home: true, title: HOME.facts.title, tone: PROJECT_TONES[0] },
]

/** What it found, by project (the one you are in first), each closest first; a kind chip shows only that kind. A
 * project's head stays at the top while its rows scroll under it. */
function Results({ s, kind, faded, a }: { s: Search; kind: Kind | 'all'; faded: boolean; a: Acts }) {
  const shown = s.found.filter((x) => kind === 'all' || x.kind === kind)
  return (
    <div className={faded ? 'opacity-45 transition-opacity' : 'transition-opacity'}>
      {GROUPS.map((g) => {
        const list = shown.filter((x) => !!x.home === g.home)
        return list.length ? (
          <section key={g.title}>
            <h2 className="sticky top-0 z-20 flex h-10 items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 text-[15px] font-semibold dark:border-zinc-800 dark:bg-zinc-900">
              <ProjTile title={g.title} tone={g.tone} />
              {g.title}
            </h2>
            {list.map((x) => (
              <FoundRow key={x.key} x={x} marks={s.marks} onPick={a.pick} />
            ))}
          </section>
        ) : null
      })}
    </div>
  )
}

/** The search page: its head (back to where you were), the kinds it found, what it found or what it is doing, and the
 * box at the bottom. */
function SearchPage({ f, a }: { f: Flow; a: Acts }) {
  const s = f.search
  const counts = s ? KINDS.map(([k, label]) => [k, label, s.found.filter((x) => x.kind === k).length] as const).filter(([, , n]) => n) : []
  const status = s && f.phase === 'searching' ? 'Searching…' : null
  let body: ReactNode
  if (s) body = <Results s={s} kind={f.kind} faded={f.phase === 'searching'} a={a} />
  else if (f.phase === 'searching')
    body = (
      <Middle title={<Icon n="spinner" c="mx-auto size-7 animate-spin text-zinc-400" sw="2" />}>Searching…</Middle>
    )
  else if (f.phase === 'writing') body = null
  else if (f.phase === 'nothing') body = <Middle title="Nothing found" />
  else if (f.phase === 'unheard') body = <Middle title="Didn’t catch that" />
  else if (f.phase === 'nomic')
    body = (
      <Middle title="Microphone not allowed">
        Safari: aA › Website Settings › Microphone
      </Middle>
    )
  else if (f.phase === 'offline')
    body = (
      <Middle title={<span className="flex items-center justify-center gap-2"><Icon n="spinner" c="size-4 animate-spin text-zinc-400" sw="2" />Can’t reach Taska</span>} />
    )
  else body = null
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-1 px-2">
        <button onClick={a.leave} aria-label="Leave search" className="grid size-11 shrink-0 place-items-center rounded-full text-zinc-700 dark:text-zinc-300">
          <Icon n="left" c="size-6" />
        </button>
        <span className="flex-1 truncate text-[19px] font-semibold tracking-tight">Search</span>
      </header>
      {s ? (
        <div className="shrink-0">
          <ViewBar
            views={[{ value: 'all', label: 'All', count: s.found.length, on: f.kind === 'all', dot: false }, ...counts.map(([k, label, n]) => ({ value: k, label, count: n, on: f.kind === k, dot: false }))]}
            onView={(v) => a.kind(v as Kind | 'all')}
          />
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">{body}</div>
      <Foot keyboard={f.typed}>
        {status ? <Status>{status}</Status> : null}
        <SearchBox f={f} a={a} />
      </Foot>
      {f.typed ? <Keyboard /> : null}
    </div>
  )
}

/** Where the phone's own keyboard is while you type: not Taska's, drawn so the page shows what is left above it. */
const Keyboard = () => (
  <div aria-hidden className="grid h-[17rem] shrink-0 place-items-center bg-zinc-300 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
    the phone’s keyboard
  </div>
)

// ---------------------------------------------------------------- the page around it, as it is

/** The page's own box where you are (the list: a new input; an item: a reply to it). */
function PageBox({ m = SHOP, at }: { m?: ProjectModel; at: string }) {
  const route = parseRoute(`/p/shop/${at}`, '')
  if (route.page !== 'project') throw new Error('not a project')
  const role = boxRole(m, route, false, 'Shop', null, { reply: null, quote: null, sel: new Set() }, { mine: {}, going: {}, open: new Set() })
  const shown = shownBox(role, { mode: null, text: '', key: 'here', recordingFor: null })
  return (
    <Foot>
      <Composer line={shown.line} waiting={shown.waiting} placeholder={shown.placeholder} sendWord={shown.send} text="" desk={false} composePage={false} micTip="" on={{ text() {}, send() {}, attach() {}, mic() {} }} />
    </Foot>
  )
}

/** The list, as the phone shows it now: its head with the magnifier, its tabs, the rows, the box. */
function ListPage({ onSearch }: { onSearch(): void }) {
  return (
    <div className="flex h-full flex-col">
      <ListHead
        phone
        title="Shop"
        otherNeeds={false}
        searching={false}
        q=""
        placeholder=""
        agent={agentInfo(SHOP, 0)}
        notSaved={0}
        filtersSet={false}
        filtersOpen={false}
        place=""
        on={{ menu() {}, agents() {}, notSaved() {}, search: onSearch, query() {}, clear() {}, firstResult() {}, filters() {} }}
      />
      <PhoneTabs tabs={phoneTabs(tabCounts(SHOP, 'items', NO_FILTERS, false), 'items')} filtersSet={false} showFilter on={{ tab() {}, filters() {} }} />
      <div className="flex min-h-0 flex-1 flex-col">{listOf(ITEMS, 'items', {}, false)}</div>
      <PageBox at="" />
    </div>
  )
}

/** A result open: the item's own page (its back: the search as you left it), and the box under it writes to it. */
function OpenPage({ x, onBack }: { x: Found; onBack(): void }) {
  const m = x.home ? HOME : SHOP
  const one = m.byN.get(x.n) as Item
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">{pageOf(one, false, { onBack, docs: x.n === 1 ? [D1] : [] })}</div>
      <PageBox m={m} at={codeOf(m, x.n)} />
    </div>
  )
}

// ---------------------------------------------------------------- the phone

/** The phone through the search, from the state `start` names; `still`: it stays in that state (a state's story). */
export function SearchPhone({ start = {}, still = false }: { start?: Partial<Flow>; still?: boolean }) {
  const a = useFlow(start, still)
  const { f } = a
  return (
    <div className="relative h-full">
      {f.at === 'list' ? <ListPage onSearch={a.open} /> : f.at === 'open' && f.open ? <OpenPage x={f.open} onBack={a.back} /> : <SearchPage f={f} a={a} />}
    </div>
  )
}

/** A state's story: the phone, opened on that state, staying in it. */
export const stateStory = (at: keyof typeof AT) => ({
  render: () => (
    <Frame layout="phone">
      <SearchPhone start={AT[at]} still />
    </Frame>
  ),
})
