// F479 (D85, #6924, #6930): a prototype of searching everything by voice, to look at before anything is built.
// Desktop: Search sits at the top of the sidebar, left of its fold button; it opens a dialog in the middle that listens
// at once. The words come once you stop (no words while you speak: Taska does not have that); then it finds in every
// project, by the words and by what they mean, grouped by kind (All, Items, Documents, What you said, Rules,
// Projects). A pick closes it and opens what you picked. The list has no row over it any more; the filters are an icon
// at the end of the views. Phone: the magnifier stays where it is; a panel rises and listens, the results are a page of
// their own. What is not built yet is drawn here (the Search button, the dialog and panel, the results, the filter
// icon); the sidebar, the project's bar, the list, the item and the filters are the page's own, with the demo
// project. Nothing here changes Taska itself.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { DeskFilters, filtersSheet } from '../features/list/Filters'
import { filterFacts } from '../features/list/filterFacts'
import { ListHead, ProjectBar } from '../pages/Header'
import { agentInfo, deskTabs, tabCounts } from '../pages/headFacts'
import { shownStatus } from '../model/items'
import { NO_FILTERS } from '../model/route'
import type { Item } from '../model/types'
import { ProjTile, Hit } from '../ui/bits'
import { Icon, StateIcon } from '../ui/Icon'
import { Sheet } from '../ui/Sheet'
import { PROJECT_TONES, TYPE_TEXT } from '../ui/tones'
import { Frame, States } from './Frames'
import { GuideLine, Level, Mark, sel, type Step } from './guide'
import { item, modelOf } from './fixtures'
import { pageOf } from './itemPage'
import { PROJECT, listOf } from './listFixtures'
import { side } from './sideFixtures'

export default { title: 'Prototype/F479 Search everything', parameters: { layout: 'padded' } } satisfies Meta

// ---------------------------------------------------------------- what it finds

type Kind = 'item' | 'doc' | 'said' | 'rule' | 'project'
interface Found {
  kind: Kind
  code: string
  title: string
  /** the item, for its status and type */
  it?: Item
  /** another project's */
  project?: string
  /** why it is here */
  why: string
}
const M = modelOf(PROJECT, [], { title: 'Shop', agents: [{ name: 'claude-code', t: Date.parse('2026-10-23T14:29:00-07:00'), waiting: true }], work: true })
const byN = (n: number) => PROJECT.find((x) => x.n === n) as Item
const HEARD = 'where the export loses my filter'
const WORDS = ['export', 'filter']
const FOUND: Found[] = [
  { kind: 'item', code: 'F001', title: byN(1).title, it: byN(1), why: 'What you described: the export drops the filter you set' },
  { kind: 'item', code: 'F003', title: byN(3).title, it: byN(3), why: 'The filter in what the export writes' },
  { kind: 'item', code: 'T014', title: byN(14).title, it: byN(14), why: 'Part of F001: where the export gets the filter from' },
  { kind: 'item', code: 'F021', title: 'Export contacts with the sort kept', it: item({ n: 21, title: 'Export contacts with the sort kept' }), project: 'Home', why: 'The same trouble in Home: its export drops the sort' },
  { kind: 'doc', code: 'D1', title: 'Plan: the export keeps the filter', why: 'The plan for fixing it, on F001' },
  { kind: 'said', code: '#8', title: 'The export should keep the filter I set.', why: 'You said it on Oct 23; it made F001' },
  { kind: 'said', code: '#4', title: 'When I export contacts the order is gone', project: 'Home', why: 'You said the same of Home’s export' },
  { kind: 'rule', code: 'R015', title: 'Exports write what the list shows', why: 'A rule on what every export writes' },
]
const KINDS: [Kind | 'all', string][] = [
  ['all', 'All'],
  ['item', 'Items'],
  ['doc', 'Documents'],
  ['said', 'What you said'],
  ['rule', 'Rules'],
  ['project', 'Projects'],
]

// ---------------------------------------------------------------- the parts not built yet

type State = 'listening' | 'speaking' | 'working' | 'finding' | 'found' | 'none' | 'unheard' | 'nomic' | 'offline'

/** The Search button at the top of the sidebar, left of its fold button (#6924). */
const SearchButton = ({ onTap }: { onTap(): void }) => (
  <button
    onClick={onTap}
    title="Search · /"
    aria-label="Search everything"
    className="absolute top-3 right-11 z-10 grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:bg-zinc-800"
  >
    <Icon n="search" c="size-[18px]" />
  </button>
)

/** The filters, an icon at the end of the views (#6924), lit while some are set. */
const FilterIcon = ({ on, set, onTap }: { on: boolean; set: boolean; onTap(): void }) => (
  <button
    onClick={onTap}
    data-search="filters"
    aria-label="Filters"
    aria-expanded={on}
    className="relative mr-2 grid size-9 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 aria-expanded:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:aria-expanded:bg-zinc-800"
  >
    <Icon n="sliders" c="size-[18px]" />
    {set ? <span className="absolute top-2 right-2 size-2 rounded-full bg-blue-600 ring-2 ring-white dark:bg-blue-400 dark:ring-zinc-950" /> : null}
  </button>
)

/** One thing it found: its mark and code, its title (the words that matched lit), where it is, why it is here. */
function FoundRow({ f, onPick }: { f: Found; onPick(f: Found): void }) {
  const mark =
    f.kind === 'item' && f.it ? (
      <StateIcon {...shownStatus(f.it)} cls="size-4" />
    ) : f.kind === 'project' ? (
      <ProjTile title={f.title} tone={PROJECT_TONES[0]} cls="size-4 rounded text-[9px]" />
    ) : (
      <Icon n={f.kind === 'doc' ? 'doc' : f.kind === 'said' ? 'newinput' : 'items'} c="size-4 text-zinc-500 dark:text-zinc-400" />
    )
  const tone = f.it ? TYPE_TEXT[f.it.type] : f.kind === 'rule' ? TYPE_TEXT.rule : 'text-zinc-500 dark:text-zinc-400'
  return (
    <button data-code={f.code} onClick={() => onPick(f)} className="flex w-full min-w-0 items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800">
      <span className="mt-0.5 shrink-0">{mark}</span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2 text-[15px]">
          <span className={`shrink-0 font-mono text-xs font-bold ${tone}`}>{f.code}</span>
          <span className="truncate">
            <Hit text={f.title} words={WORDS} />
          </span>
          {f.project ? <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">in {f.project}</span> : null}
        </span>
        <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">{f.why}</span>
      </span>
    </button>
  )
}

/** What it found, by kind: All in groups (the closest few of each, then how many more), or one kind in full. */
function Results({ kind, onKind, onPick, onAgain, none }: { kind: Kind | 'all'; onKind(k: Kind | 'all'): void; onPick(f: Found): void; onAgain(): void; none?: boolean }) {
  const list = none ? [] : FOUND
  const of = (k: Kind) => list.filter((f) => f.kind === k)
  const shown = kind === 'all' ? null : of(kind)
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-[17px] leading-snug font-medium">“{HEARD}”</p>
        <button onClick={onAgain} className="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-blue-600 ring-1 ring-blue-200 dark:text-blue-400 dark:ring-blue-400/30">
          <Icon n="mic" c="size-4" />
          Again
        </button>
      </div>
      <div className="-mx-1 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-1">
        {KINDS.map(([k, label]) => {
          const n = k === 'all' ? list.length : of(k).length
          return (
            <button
              key={k}
              data-kind={k}
              onClick={() => onKind(k)}
              aria-pressed={kind === k}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-zinc-100 px-3 text-[13px] font-medium text-zinc-700 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:bg-zinc-800 dark:text-zinc-300 dark:aria-pressed:bg-zinc-100 dark:aria-pressed:text-zinc-900"
            >
              {label}
              <span className="font-mono text-[11px] opacity-60">{n}</span>
            </button>
          )
        })}
      </div>
      {none ? (
        <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Nothing found for this in any project. Say it another way: Again.</p>
      ) : shown ? (
        shown.length ? (
          <div className="-mx-3 flex flex-col">{shown.map((f) => <FoundRow key={f.code} f={f} onPick={onPick} />)}</div>
        ) : (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">No {KINDS.find(([k]) => k === kind)?.[1].toLowerCase()} for this. All has the rest.</p>
        )
      ) : (
        <div className="-mx-3 flex flex-col gap-3">
          {KINDS.slice(1).map(([k, label]) => {
            const g = of(k as Kind)
            return g.length ? (
              <section key={k}>
                <h3 className="px-3 pb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">{label}</h3>
                {g.slice(0, 3).map((f) => (
                  <FoundRow key={f.code} f={f} onPick={onPick} />
                ))}
                {g.length > 3 ? (
                  <button onClick={() => onKind(k)} className="px-3 py-1 text-[13px] font-semibold text-blue-600 dark:text-blue-400">
                    {g.length - 3} more {label.toLowerCase()}
                  </button>
                ) : null}
              </section>
            ) : null
          })}
        </div>
      )}
    </div>
  )
}

/** The search in each state: listening, you speaking, working out your words, finding, what it found, nothing, no
 * sound, no microphone, Taska out of reach. */
function SearchBody({ state, kind, onKind, onDone, onAgain, onPick }: { state: State; kind: Kind | 'all'; onKind(k: Kind | 'all'): void; onDone(): void; onAgain(): void; onPick(f: Found): void }) {
  const middle = (children: ReactNode) => <div className="flex min-h-64 flex-col items-center justify-center gap-4 py-6 text-center">{children}</div>
  const mic = (loud: boolean) => (
    <span className="relative grid size-20 place-items-center rounded-full bg-red-600 text-white shadow-lg">
      {loud ? <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" /> : null}
      <Icon n="mic" c="size-9" sw="2" />
    </span>
  )
  const again = (
    <button onClick={onAgain} className="flex h-10 items-center gap-1.5 rounded-full bg-zinc-900 px-4 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
      <Icon n="mic" c="size-4" />
      Again
    </button>
  )
  if (state === 'listening' || state === 'speaking')
    return middle(
      <>
        {mic(state === 'speaking')}
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{state === 'speaking' ? 'Listening… it stops when you pause' : 'Listening… say what to find, in any project'}</p>
        {state === 'speaking' ? <Level /> : <span className="h-8" />}
        <button data-search="done" onClick={onDone} className="h-10 rounded-full px-5 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-300 dark:text-zinc-200 dark:ring-zinc-600">
          Done
        </button>
      </>,
    )
  if (state === 'working' || state === 'finding')
    return middle(
      <>
        <Icon n="spinner" c="size-8 animate-spin text-zinc-400" sw="2" />
        {state === 'finding' ? <p className="text-[17px] font-medium">“{HEARD}”</p> : null}
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{state === 'working' ? 'Working out what you said…' : 'Finding it in every project, by the words and by what they mean…'}</p>
      </>,
    )
  if (state === 'unheard')
    return middle(
      <>
        <p className="text-[17px] font-medium">Didn’t hear anything</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Say it a little louder, or nearer.</p>
        {again}
      </>,
    )
  if (state === 'nomic')
    return middle(
      <>
        <Icon n="alert" c="size-8 text-red-600 dark:text-red-400" sw="2" />
        <p className="text-[17px] font-medium">Taska can’t use the microphone</p>
        <p className="max-w-80 text-sm text-zinc-500 dark:text-zinc-400">Allow it in the browser’s settings for this page (the icon by the address), then Again.</p>
        {again}
      </>,
    )
  if (state === 'offline')
    return middle(
      <>
        <p className="text-[17px] font-medium">“{HEARD}”</p>
        <p className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Icon n="spinner" c="size-4 animate-spin" sw="2" />
          Can’t reach Taska · trying again; it finds as soon as Taska answers
        </p>
      </>,
    )
  return <Results kind={kind} onKind={onKind} onPick={onPick} onAgain={onAgain} none={state === 'none'} />
}

/** The search's words, working out and finding take a moment, as they will in the page. */
function useSearch() {
  const [state, setState] = useState<State | null>(null)
  const [kind, setKind] = useState<Kind | 'all'>('all')
  useEffect(() => {
    if (state !== 'working' && state !== 'finding') return
    const t = setTimeout(() => setState(state === 'working' ? 'finding' : 'found'), 1100)
    return () => clearTimeout(t)
  }, [state])
  return { state, kind, setKind, open: () => (setKind('all'), setState('listening')), done: () => setState('working'), close: () => setState(null) }
}

// ---------------------------------------------------------------- the desktop

const DESK_STEPS: Step[] = [
  { say: 'There is no row over the list now. Search sits at the top of the sidebar, left of its fold button. Tap it: it listens at once', tap: sel('[aria-label="Search everything"]') },
  { say: 'Say what to find; your words come once you stop. Tap Done (or just pause)', tap: sel('[data-search="done"]') },
  { say: 'It works out your words, then finds in every project, by the words and by what they mean. Tap Documents', tap: sel('[data-kind="doc"]') },
  { say: 'Only documents. Tap All: every kind, the closest few of each', tap: sel('[data-kind="all"]') },
  { say: 'Tap F001: the dialog closes and F001 opens beside the list', tap: sel('button[data-code="F001"]') },
  { say: 'The filters are an icon at the end of the views. Tap it', tap: sel('[data-search="filters"]') },
]

function Desk({ n = -1, onNext }: { n?: number; onNext?(): void }) {
  const s = useSearch()
  const [open, setOpen] = useState<number | null>(null)
  const [filters, setFilters] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const step = n >= 0 ? (DESK_STEPS[n] ?? null) : null
  const next = (e: React.MouseEvent) => {
    const el = root.current && step ? step.tap(root.current) : null
    if (el && el.contains(e.target as Node)) setTimeout(() => onNext?.(), 0)
  }
  const list = { ...NO_FILTERS }
  const pick = (f: Found) => {
    s.close()
    if (f.it && !f.project) setOpen(f.it.n)
  }
  const it = open ? PROJECT.find((x) => x.n === open) : null
  return (
    <div ref={root} onClickCapture={next} className="relative flex h-full">
      <div className="relative h-full w-60 shrink-0 border-r border-zinc-200 dark:border-zinc-800">
        {side(false)}
        <SearchButton onTap={s.open} />
      </div>
      <div className="grid min-w-0 flex-1 grid-cols-[420px_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)]">
        <ProjectBar title="Shop" tone={PROJECT_TONES[1]} tabs={deskTabs(tabCounts(M, 'items', list, true), 'items', false)} agent={agentInfo(M, 0)} notSaved={0} place="col-span-2" on={{ tab() {}, agents() {}, notSaved() {} }} />
        <div className="flex min-h-0 flex-col border-r border-zinc-200 dark:border-zinc-800">
          {listOf(PROJECT, 'items', {}, true, {
            open: open ?? undefined,
            viewsEnd: <FilterIcon on={filters} set={false} onTap={() => setFilters((x) => !x)} />,
            top: null,
            on: { open: (k) => setOpen(k) },
          })}
        </div>
        <div className="min-h-0">{it ? pageOf(it, true) : <p className="grid h-full place-items-center text-sm text-zinc-400">Nothing open</p>}</div>
      </div>
      {filters ? (
        <div className="absolute top-[6.5rem] left-60 z-20 w-[420px] bg-white shadow-lg dark:bg-zinc-950">
          <DeskFilters tab="items" list={list} set={[]} open place="" hidden={false} on={{ set() {}, unset() {}, reset() {}, saveView() {}, toggle: () => setFilters(false) }} />
        </div>
      ) : null}
      {s.state ? (
        <Sheet open look={{}} desk parts={{ title: 'Search', body: <SearchBody state={s.state} kind={s.kind} onKind={s.setKind} onDone={s.done} onAgain={s.open} onPick={pick} /> }} onClose={s.close} />
      ) : null}
      <Mark root={root} step={step} />
    </div>
  )
}

function GuidedDesk() {
  const [k, setK] = useState(0)
  const [n, setN] = useState(0)
  return (
    <div className="flex w-[1280px] flex-col gap-3">
      <Frame layout="desk" width={1280} height={800} label="Search at the top of the sidebar · the blue mark is the next tap">
        <Desk key={k} n={n} onNext={() => setN((x) => x + 1)} />
      </Frame>
      <GuideLine n={n} total={DESK_STEPS.length} say={DESK_STEPS[n]?.say} onAgain={() => (setK((x) => x + 1), setN(0))} />
    </div>
  )
}

// ---------------------------------------------------------------- the phone

const PHONE_STEPS: Step[] = [
  { say: 'The magnifier stays where it is. Tap it: a panel rises and listens at once', tap: sel('[aria-label="Search"]') },
  { say: 'Say what to find; your words come once you stop. Tap Done (or just pause)', tap: sel('[data-search="done"]') },
  { say: 'What it found, on a page of its own, by kind. Tap Items', tap: sel('[data-kind="item"]') },
  { say: 'Tap F001: it opens', tap: sel('button[data-code="F001"]') },
  { say: 'Tap ←: back to what it found', tap: sel('[aria-label="Back"]') },
  { say: 'Tap ✕: back to the list', tap: sel('[aria-label="Close the search"]') },
  { say: 'The filters are an icon at the end of the views. Tap it', tap: sel('[data-search="filters"]') },
]

function Phone({ n = -1, onNext }: { n?: number; onNext?(): void }) {
  const s = useSearch()
  const [open, setOpen] = useState<number | null>(null)
  const [filters, setFilters] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const step = n >= 0 ? (PHONE_STEPS[n] ?? null) : null
  const next = (e: React.MouseEvent) => {
    const el = root.current && step ? step.tap(root.current) : null
    if (el && el.contains(e.target as Node)) setTimeout(() => onNext?.(), 0)
  }
  const page = s.state === 'found' || s.state === 'none'
  const it = open ? PROJECT.find((x) => x.n === open) : null
  const body = <SearchBody state={s.state ?? 'listening'} kind={s.kind} onKind={s.setKind} onDone={s.done} onAgain={s.open} onPick={(f) => f.it && !f.project && setOpen(f.it.n)} />
  let screen: ReactNode
  if (it && page)
    // the item's own back goes back to what it found
    screen = <div className="h-full">{pageOf(it, false, { onBack: () => setOpen(null) })}</div>
  else if (page)
    screen = (
      <div className="flex h-full flex-col">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-200 px-4 dark:border-zinc-800">
          <span className="flex-1 text-[17px] font-semibold">Search</span>
          <button aria-label="Close the search" onClick={s.close} className="grid size-10 place-items-center rounded-full text-zinc-500 dark:text-zinc-400">
            <Icon n="x" c="size-5" sw="2" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{body}</div>
      </div>
    )
  else
    screen = (
      <div className="flex h-full flex-col">
        <ListHead phone title="Shop" otherNeeds={false} searching={false} q="" placeholder="" agent={agentInfo(M, 0)} notSaved={0} filtersSet={false} filtersOpen={false} place="" on={{ menu() {}, agents() {}, notSaved() {}, search: () => s.open(), query() {}, clear() {}, firstResult() {}, filters() {} }} />
        <div className="flex min-h-0 flex-1 flex-col">{listOf(PROJECT, 'items', {}, false, { viewsEnd: <FilterIcon on={filters} set={false} onTap={() => setFilters(true)} />, top: null })}</div>
        {s.state ? <Sheet open look={{}} desk={false} parts={{ title: 'Search', body }} onClose={s.close} /> : null}
        {filters ? <Sheet open look={{}} desk={false} parts={filtersSheet(filterFacts(M, 'items', { ...NO_FILTERS }), { set() {}, unset() {}, reset() {}, saveView() {}, close: () => setFilters(false) })} onClose={() => setFilters(false)} /> : null}
      </div>
    )
  return (
    <div ref={root} onClickCapture={next} className="relative h-full">
      {screen}
      <Mark root={root} step={step} />
    </div>
  )
}

function GuidedPhone() {
  const [k, setK] = useState(0)
  const [n, setN] = useState(0)
  return (
    <div className="flex w-[393px] flex-col gap-3">
      <Frame layout="phone" width={393} height={852} label="the magnifier where it is · the blue mark is the next tap">
        <Phone key={k} n={n} onNext={() => setN((x) => x + 1)} />
      </Frame>
      <GuideLine n={n} total={PHONE_STEPS.length} say={PHONE_STEPS[n]?.say} onAgain={() => (setK((x) => x + 1), setN(0))} />
    </div>
  )
}

// ---------------------------------------------------------------- the stories

/** Tap your way through it on the desktop, the blue mark showing the next tap (it never plays itself). */
export const Desktop: StoryObj = { name: 'Desktop: search everything', render: () => <GuidedDesk /> }
/** The same on the phone. */
export const Phone393: StoryObj = { name: 'Phone: search everything', render: () => <GuidedPhone /> }

const STATES: [string, State, Kind | 'all'][] = [
  ['listening, before you speak', 'listening', 'all'],
  ['you speaking (no words yet: they come when you stop)', 'speaking', 'all'],
  ['working out your words', 'working', 'all'],
  ['finding', 'finding', 'all'],
  ['found: All, by kind', 'found', 'all'],
  ['found: one kind', 'found', 'item'],
  ['found: a kind with none', 'found', 'project'],
  ['nothing found', 'none', 'all'],
  ['heard nothing', 'unheard', 'all'],
  ['no microphone', 'nomic', 'all'],
  ['Taska out of reach', 'offline', 'all'],
]
const none = () => {}
const body = (state: State, kind: Kind | 'all') => <SearchBody state={state} kind={kind} onKind={none} onDone={none} onAgain={none} onPick={none} />

/** The dialog in each state, in the middle of the desktop. */
export const StatesDesktop: StoryObj = {
  name: 'Every state: desktop',
  render: () => (
    <div className="flex flex-wrap gap-6">
      {STATES.map(([label, state, kind]) => (
        <Frame key={label} layout="desk" width={760} height={state === 'found' ? 620 : 440} label={label}>
          <Sheet open look={{}} desk parts={{ title: 'Search', body: body(state, kind) }} onClose={none} />
        </Frame>
      ))}
    </div>
  ),
}
/** The panel while it listens and works, the page of what it found, on the phone. */
export const StatesPhone: StoryObj = {
  name: 'Every state: phone',
  render: () => (
    <div className="flex flex-wrap gap-6">
      {STATES.map(([label, state, kind]) => (
        <Frame key={label} layout="phone" width={393} height={720} label={label}>
          {state === 'found' || state === 'none' ? (
            <div className="h-full overflow-y-auto px-4 py-3">{body(state, kind)}</div>
          ) : (
            <Sheet open look={{}} desk={false} parts={{ title: 'Search', body: body(state, kind) }} onClose={none} />
          )}
        </Frame>
      ))}
    </div>
  ),
}
/** The filters stay (#6924): an icon at the end of the views, no row over the list; opened, the page's own filters. */
export const Filters: StoryObj = {
  name: 'Filters at the end of the views',
  render: () => (
    <States
      items={[
        [
          'desktop: the icon at the end of the views, opened',
          <Frame layout="desk" width={420} height={560}>
            <div className="flex h-full flex-col">
              {listOf(PROJECT, 'items', {}, true, { viewsEnd: <FilterIcon on set={false} onTap={none} />, top: null })}
              <div className="absolute inset-x-0 top-[3.25rem] bg-white shadow-lg dark:bg-zinc-950">
                <DeskFilters tab="items" list={NO_FILTERS} set={[]} open place="" hidden={false} on={{ set: none, unset: none, reset: none, saveView: none, toggle: none }} />
              </div>
            </div>
          </Frame>,
        ],
        [
          'phone: the icon at the end of the views, and its sheet',
          <Frame layout="phone" width={393} height={760}>
            <div className="relative flex h-full flex-col">
              {listOf(PROJECT, 'items', {}, false, { viewsEnd: <FilterIcon on={false} set={false} onTap={none} />, top: null })}
              <Sheet open look={{}} desk={false} parts={filtersSheet(filterFacts(M, 'items', NO_FILTERS), { set: none, unset: none, reset: none, saveView: none, close: none })} onClose={none} />
            </div>
          </Frame>,
        ],
      ]}
    />
  ),
}
