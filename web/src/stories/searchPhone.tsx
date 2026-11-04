// F479: searching by voice on the phone, for its stories: the product's search page (features/search) drawn from the
// demo project Shop (searchFixtures.ts) in each of its states, and walked through as the Finder takes it (here with
// the demo's answers and a pause in place of the microphone and the server).
//
// The journeys
// 1. Find something by saying it. Tap the magnifier: the search page opens and the box records at once. Say what to
//    find; tap the up arrow. Taska writes your words out after you stop, puts them in the box and searches every
//    project: "Searching…", then the results by project (the one you are in first), closest first in each; a row of
//    kinds (All, Items, Inputs, Rules, Documents) filters them all.
// 2. Say more. With the results showing, tap the mic in the box: what you added is put at the end of your words, lit,
//    and it searches all of them again; the results change in place (faded while it searches, never blank).
// 3. Fix what it heard. A word two models heard differently shows its two versions in the box; tap the right one and
//    it searches again. Or tap the words and type: the up arrow searches what you typed.
// 4. Start over. The x beside the words clears them and the results.
// 5. Use a result. Tap it: it opens as it does anywhere in Taska. Back: the same search, as you left it.
// 6. Leave. The back arrow at the top: back to the list where you were; the next search starts afresh.
import { useEffect, useState, type ReactNode } from 'react'
import { Composer } from '../features/composer/Composer'
import { SearchPage, type SearchEvents } from '../pages/SearchPage'
import { searchView, type SearchNow, type SearchPlace } from '../pages/searchView'
import { ListHead, PhoneTabs } from '../pages/Header'
import { agentInfo, phoneTabs, tabCounts } from '../pages/headFacts'
import { boxRole, shownBox } from '../model/boxFoot'
import { pickSide } from '../model/doubts'
import { saidMore, type Found } from '../model/find'
import { codeOf, type ProjectModel } from '../model/project'
import { NO_FILTERS, parseRoute } from '../model/route'
import type { Item } from '../model/types'
import { PROJECT_TONES } from '../ui/tones'
import { Frame } from './Frames'
import { noRowEvents, T } from './fixtures'
import { pageOf } from './itemPage'
import { listOf } from './listFixtures'
import { ADDED, D1, HEARD, HOME, ITEMS, MISHEARD, MORE, ORDER, RIGHT, SHOP, searchOf } from './searchFixtures'

/** Where the phone is: the list, the search page, or a result open over it. */
export interface Flow extends SearchNow {
  at: 'list' | 'search' | 'open'
  open: Found | null
}
const LEVELS = [0.2, 0.5, 0.8, 0.4, 0.6, 0.3, 0.7, 0.5, 0.9, 0.4, 0.6, 0.3]
export const START: Flow = { at: 'list', phase: 'ready', words: '', added: '', heard: [], answer: null, kind: 'all', typed: false, ms: 3000, levels: LEVELS, open: null }

/** A state to open a story on, by name. */
export const AT: Record<string, Partial<Flow>> = {
  listening: { at: 'search', phase: 'listening' },
  writing: { at: 'search', phase: 'writing' },
  searching: { at: 'search', phase: 'searching', words: RIGHT.q },
  found: { at: 'search', phase: 'found', words: RIGHT.q, answer: RIGHT },
  oneKind: { at: 'search', phase: 'found', words: RIGHT.q, answer: RIGHT, kind: 'items' },
  open: { at: 'open', phase: 'found', words: MORE.q, answer: MORE, open: MORE.found[0] },
  misheard: { at: 'search', phase: 'found', words: MISHEARD.q, answer: MISHEARD, heard: HEARD },
  sayingMore: { at: 'search', phase: 'listening', words: RIGHT.q, answer: RIGHT, ms: 2000 },
  again: { at: 'search', phase: 'searching', words: MORE.q, added: ADDED, answer: RIGHT },
  againFound: { at: 'search', phase: 'found', words: MORE.q, added: ADDED, answer: MORE },
  typing: { at: 'search', phase: 'found', words: 'where the export loses my filter on the phone', answer: RIGHT, typed: true },
  cleared: { at: 'search', phase: 'ready' },
  nothing: { at: 'search', phase: 'nothing', words: 'the blue button in the settings' },
  unheard: { at: 'search', phase: 'unheard' },
  nomic: { at: 'search', phase: 'nomic' },
  offline: { at: 'search', phase: 'offline', words: RIGHT.q },
}

/** The page's data around the search: the project you are in is Shop. */
const PLACE: SearchPlace = {
  here: 'shop',
  m: SHOP,
  order: ORDER,
  tone: (slug) => (slug === 'home' ? PROJECT_TONES[0] : PROJECT_TONES[1]),
  seen: { since: T },
  drafts: new Set(),
  on: () => noRowEvents,
  // the demo's day: the second time you speak is today
  now: Date.parse('2026-11-02T18:00:00-08:00'),
}
const placeFor = (onOpen: (x: Found) => void): SearchPlace => ({ ...PLACE, on: (x) => ({ ...noRowEvents, open: () => onOpen(x) }) })

const WAIT = { writing: 1300, searching: 1400 }

/** The search as it goes, as the Finder takes it: tap, speak, stop, the words written out, the search. */
function useFlow(start: Partial<Flow>, still: boolean) {
  const [f, setF] = useState<Flow>({ ...START, ...start })
  const set = (p: Partial<Flow>) => setF((x) => ({ ...x, ...p }))
  useEffect(() => {
    if (still) return
    const after = (ms: number, next: (x: Flow) => Flow) => {
      const t = setTimeout(() => setF(next), ms)
      return () => clearTimeout(t)
    }
    if (f.phase === 'writing')
      return after(WAIT.writing, (x) => {
        // the first words heard (one misheard); said again with words there: what you add, at their end
        if (!x.words) return { ...x, phase: 'searching', words: MISHEARD.q, heard: HEARD, added: '' }
        const more = saidMore(x.words, x.words.includes('phone') ? 'In the last week.' : 'Only on the phone.')
        return { ...x, phase: 'searching', ...more, heard: [] }
      })
    if (f.phase === 'searching')
      return after(WAIT.searching, (x) => {
        const a = searchOf(x.words)
        return a ? { ...x, phase: 'found', answer: a } : { ...x, phase: 'nothing', answer: null }
      })
  }, [f.phase, still])
  const search = () => set({ phase: 'searching', typed: false, kind: 'all' })
  const on: SearchEvents = {
    leave: () => setF(START),
    mic: () => set({ phase: 'listening', added: '', ms: 2000 }),
    stop: () => set({ phase: 'writing' }),
    discard: () => set({ phase: f.answer ? 'found' : 'ready' }),
    clear: () => set({ phase: 'ready', words: '', added: '', heard: [], answer: null, kind: 'all', typed: false }),
    type: (words) => set({ words, added: '', heard: [], typed: true }),
    search,
    pick: (fk, k, side) => {
      const h = f.heard.find((x) => x.key === fk)
      if (!h) return
      const r = pickSide(f.words, h, k, side)
      set({ words: r.text, heard: f.heard.map((x) => (x === h ? { ...x, trAdded: r.trAdded, doubts: r.doubts } : x)) })
      search()
    },
    kind: (k) => set({ kind: k as Flow['kind'] }),
    open: (x) => set({ at: 'open', open: x }),
  }
  return { f, on, openSearch: () => setF({ ...START, at: 'search', phase: 'listening' }), back: () => set({ at: 'search', open: null }) }
}

// ---------------------------------------------------------------- the page around it, as it is

const Foot = ({ children }: { children: ReactNode }) => (
  <footer className="relative z-20 shrink-0 border-t border-zinc-200 bg-zinc-50 px-3 pt-3 pb-5 dark:border-transparent dark:bg-zinc-950 dark:pt-1">{children}</footer>
)

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

/** The list, as the phone shows it: its head with the magnifier, its tabs, the rows, the box. */
function ListPage({ onSearch }: { onSearch(): void }) {
  return (
    <div className="flex h-full flex-col">
      <ListHead
        title="Shop"
        otherNeeds={false}
        searching={false}
        q=""
        placeholder=""
        agent={agentInfo(SHOP, 0)}
        notSaved={0}
        on={{ menu() {}, agents() {}, notSaved() {}, search: onSearch, query() {}, clear() {} }}
      />
      <PhoneTabs tabs={phoneTabs(tabCounts(SHOP, 'items', NO_FILTERS, false), 'items')} filtersSet={false} showFilter on={{ tab() {}, filters() {} }} />
      <div className="flex min-h-0 flex-1 flex-col">{listOf(ITEMS, 'items', {}, false)}</div>
      <PageBox at="" />
    </div>
  )
}

/** A result open: the item's own page (its back: the search as you left it), and the box under it writes to it. */
function OpenPage({ x, onBack }: { x: Found; onBack(): void }) {
  const m = x.project === 'home' ? HOME : SHOP
  const one = m.byN.get(x.n ?? 0) as Item
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">{pageOf(one, false, { onBack, docs: x.n === 1 ? [D1] : [] })}</div>
      <PageBox m={m} at={codeOf(m, one.n)} />
    </div>
  )
}

/** Where the phone's own keyboard is while you type: not Taska's, drawn so the page shows what is left above it. */
const Keyboard = () => (
  <div aria-hidden className="grid h-[17rem] shrink-0 place-items-center bg-zinc-300 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
    the phone&apos;s keyboard
  </div>
)

/** The phone through the search, from the state `start` names; `still`: it stays in that state (a state's story). */
export function SearchPhone({ start = {}, still = false }: { start?: Partial<Flow>; still?: boolean }) {
  const { f, on, openSearch, back } = useFlow(start, still)
  if (f.at === 'list') return <ListPage onSearch={openSearch} />
  if (f.at === 'open' && f.open) return <OpenPage x={f.open} onBack={back} />
  return (
    <div className="flex h-full flex-col">
      <SearchPage v={searchView(f, placeFor(on.open))} on={on} />
      {f.typed ? <Keyboard /> : null}
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
