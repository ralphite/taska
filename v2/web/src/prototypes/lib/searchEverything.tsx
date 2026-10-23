// F479 (D85): search everything, the parts not built yet, for the prototype. A Search button under New input in the
// sidebar (the phone keeps its magnifier at the top) opens a dialog that is already listening (D76's microphone); you
// talk, pause, and it finds in every project and every kind of thing, by words and by meaning: items, documents, what
// you said, rules, projects. What was found shows in the dialog by kind: All (in groups) or one kind. The list keeps
// no search box and no filter button: views are made in Settings (ViewsSettings below). Everything here is drawn in
// the page's own styles; a click on what was found opens it where it is.
import { useEffect, useState, type ReactNode } from 'react'
import { Icon, Kbd } from '../../components/ui'
import { LINK_BTN, TYPE_TEXT } from '../../lib/constants'
import type { IconName } from '../../lib/icons'
import { wait } from './onPage'
import { Mic, type Phase } from './voiceSearch'

// what Yadong says, and what would be found for it in the demo's projects, the closest first, each with why
export const SAID = '\u8ba2\u5355\u5bfc\u51fa\u76f8\u5173\u7684'
export type Kind = 'item' | 'doc' | 'input' | 'rule' | 'project'
export type Pick = 'all' | Kind
export const KINDS: [Pick, string][] = [
  ['all', 'All'],
  ['item', 'Items'],
  ['doc', 'Documents'],
  ['input', 'You said'],
  ['rule', 'Rules'],
  ['project', 'Projects'],
]
const KIND_ICON: Record<Kind, IconName> = { item: 'items', doc: 'doc', input: 'quote', rule: 'book', project: 'folder' }
const GREY = 'text-zinc-500 dark:text-zinc-400'
export type Hit = {
  kind: Kind
  code: string
  tone: string
  title: string
  why: string
  path: string
  /** another project's: its name shows on the row */
  project?: string
  done?: boolean
}
export const HITS: Hit[] = [
  {
    kind: 'item',
    code: 'F01',
    tone: TYPE_TEXT.feature,
    title: '\u5bfc\u51fa CSV \u65f6\u53ea\u5bfc\u51fa\u7b5b\u9009\u540e\u770b\u5230\u7684\u884c',
    why: '\u5bfc\u51fa\u7684 CSV \u6ca1\u6309\u4f60\u7b5b\u7684\u6765',
    path: '/p/shop/F1',
  },
  {
    kind: 'item',
    code: 'T15',
    tone: TYPE_TEXT.task,
    title: '\u5bfc\u51fa\uff1a\u5728\u624b\u673a\u548c\u7535\u8111\u4e0a\u5404\u6d4b\u4e00\u904d',
    why: '\u5bfc\u51fa\u5728\u624b\u673a\u548c\u7535\u8111\u4e0a\u7684\u6d4b\u8bd5',
    path: '/p/shop/T15',
  },
  {
    kind: 'item',
    code: 'F04',
    tone: TYPE_TEXT.feature,
    title: '\u8ba2\u5355\u5bfc\u51fa\u5728 App \u91cc\u4e5f\u8981\u80fd\u7528',
    why: 'App \u91cc\u7684\u8ba2\u5355\u5bfc\u51fa',
    path: '/p/mobile-app/F4',
    project: 'Mobile app',
  },
  {
    kind: 'item',
    code: 'T14',
    tone: TYPE_TEXT.task,
    title: '\u5bfc\u51fa\uff1a\u5199\u6587\u4ef6\u65f6\u5e94\u7528\u5f53\u524d\u7b5b\u9009',
    why: '\u5bfc\u51fa\u65f6\u7528\u5f53\u524d\u7684\u7b5b\u9009\uff08\u5df2\u505a\u5b8c\uff09',
    path: '/p/shop/T14',
    done: true,
  },
  {
    kind: 'doc',
    code: 'D1',
    tone: GREY,
    title: '\u5bfc\u51fa\u65b9\u6848',
    why: '\u5bfc\u51fa\u7684\u4e24\u4e2a\u65b9\u6848\u548c\u6b65\u9aa4',
    path: '/p/shop/D1',
  },
  {
    kind: 'input',
    code: '#1',
    tone: GREY,
    title:
      '\u5bfc\u51fa\u8ba2\u5355\u7684\u65f6\u5019\uff0c\u6211\u5728\u5217\u8868\u91cc\u7b5b\u4e86\u53ea\u770b\u5df2\u4ed8\u6b3e\u7684\uff0c\u7ed3\u679c\u5bfc\u51fa\u6765\u7684 CSV \u8fd8\u662f\u5168\u90e8\u8ba2\u5355',
    why: '\u4f60\u8bf4\u8fc7\u5bfc\u51fa\u7684 CSV \u8fd8\u662f\u5168\u90e8\u8ba2\u5355',
    path: '/p/shop/',
  },
]
/** in All, each kind shows this many first; the rest behind "Show N more" */
const FIRST = 3

/** listen: up, nothing said yet; speak: you talk; heard: you paused, finding; found: what was found; none: nothing
 * found; silent: no voice heard; nomic: the microphone is not allowed; offline: Taska cannot be reached */
export type Shown = Phase | 'found' | 'none' | 'silent' | 'nomic' | 'offline'

const CloseBtn = ({ onClose }: { onClose: () => void }) => (
  <button
    data-proto-act="close"
    aria-label="Close"
    className="group grid size-11 place-items-center rounded-full"
    onClick={onClose}
  >
    <span className="grid size-8 place-items-center rounded-full bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200 group-hover:text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:group-hover:bg-zinc-700 dark:group-hover:text-zinc-200">
      <Icon n="x" c="size-4" sw="2.25" />
    </span>
  </button>
)
const AgainBtn = ({ onAgain }: { onAgain: () => void }) => (
  <button
    data-proto-act="again"
    onClick={onAgain}
    className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-zinc-100 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
  >
    <Icon n="mic" c="size-4" />
    Again
  </button>
)

/** One thing found: what it is, its code and title, its project when not this one, and why it was found */
function Row({ h, on, onOpen }: { h: Hit; on: boolean; onOpen: (h: Hit) => void }) {
  return (
    <button
      data-proto-act="open"
      data-path={h.path}
      aria-selected={on}
      onClick={() => onOpen(h)}
      className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-zinc-50 aria-selected:bg-zinc-100 dark:hover:bg-zinc-800/60 dark:aria-selected:bg-zinc-800"
    >
      <Icon n={KIND_ICON[h.kind]} c={`mt-0.5 size-4.5 shrink-0 ${GREY}`} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className={`shrink-0 font-mono text-[13px] font-semibold ${h.tone}`}>{h.code}</span>
          <span
            className={`min-w-0 truncate text-[15px] ${h.done ? 'text-zinc-400 line-through dark:text-zinc-500' : 'text-zinc-900 dark:text-zinc-100'}`}
          >
            {h.title}
          </span>
          {h.project ? (
            <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {h.project}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 flex items-start gap-1 text-[13px] leading-snug text-violet-700 dark:text-violet-300">
          <Icon n="sparkle" c="mt-px size-3.5 shrink-0 text-violet-500 dark:text-violet-400" />
          <span className="line-clamp-2 min-w-0">{h.why}</span>
        </span>
      </span>
    </button>
  )
}

/** The kinds, each with how many were found; the one picked is dark, as the list's views */
function Kinds({ pick, onPick }: { pick: Pick; onPick: (k: Pick) => void }) {
  return (
    <div className="flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-3 lg:px-5">
      {KINDS.map(([k, label]) => {
        const n = k === 'all' ? HITS.length : HITS.filter((h) => h.kind === k).length
        return (
          <button
            key={k}
            data-proto-act="kind"
            data-kind={k}
            aria-pressed={pick === k}
            onClick={() => onPick(k)}
            className={`flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-medium aria-pressed:bg-zinc-900 aria-pressed:text-white dark:aria-pressed:bg-white dark:aria-pressed:text-zinc-900 ${n ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700' : 'bg-zinc-50 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500'}`}
          >
            {label}
            <span className="text-xs tabular-nums opacity-60">{n}</span>
          </button>
        )
      })}
    </div>
  )
}

/** What was found: in All, a group for each kind that has something (the first few, then "Show N more"); one kind
 * picked, all of that kind, or a line saying there is none */
function Found({ pick, onOpen }: { pick: Pick; onOpen: (h: Hit) => void }) {
  const [more, setMore] = useState<Kind | null>(null)
  const kinds = KINDS.map(([k]) => k).filter((k): k is Kind => k !== 'all')
  let first = true
  const rows = (list: Hit[]) =>
    list.map((h) => {
      const on = first
      first = false
      return <Row key={h.code} h={h} on={on} onOpen={onOpen} />
    })
  if (pick !== 'all') {
    const list = HITS.filter((h) => h.kind === pick)
    return list.length ? (
      <div className="px-2 pb-2 lg:px-2.5">{rows(list)}</div>
    ) : (
      <p className={`px-5 py-8 text-center text-[15px] ${GREY}`}>
        No {KINDS.find(([k]) => k === pick)?.[1].toLowerCase()} for {'\u201c'}
        {SAID}
        {'\u201d'}.
      </p>
    )
  }
  return (
    <div className="px-2 pb-2 lg:px-2.5">
      {kinds.map((k) => {
        const list = HITS.filter((h) => h.kind === k)
        if (!list.length) return null
        const shown = more === k ? list : list.slice(0, FIRST)
        return (
          <section key={k} data-proto="group" data-kind={k}>
            <h3 className="flex items-center gap-1.5 px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              {KINDS.find(([x]) => x === k)?.[1]}
              <span className="tabular-nums">{list.length}</span>
            </h3>
            {rows(shown)}
            {list.length > shown.length ? (
              <button data-proto-act="more" className={`${LINK_BTN} ml-1`} onClick={() => setMore(k)}>
                Show {list.length - shown.length} more
              </button>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}

/** A short message in place of what was found, with Again */
function Note({
  icon,
  title,
  text,
  onAgain,
  spin = false,
}: {
  icon: IconName
  title: string
  text: string
  onAgain?: () => void
  spin?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <Icon n={icon} c={`size-8 ${GREY} ${spin ? 'animate-spin' : ''}`} />
      <p className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
      <p className={`max-w-sm text-sm ${GREY}`}>{text}</p>
      {onAgain ? (
        <div className="mt-2">
          <AgainBtn onAgain={onAgain} />
        </div>
      ) : null}
    </div>
  )
}

/** The search: listening first (the big microphone), then what was found, in one dialog in the middle of the desktop;
 * on the phone the panel comes up from the bottom while it listens and what was found is a page of its own */
export function SearchPanel({
  shown,
  words,
  pick,
  desk,
  onPick,
  onAgain,
  onClose,
  onFinish,
  onOpen,
  framed = false,
}: {
  shown: Shown
  words: string
  pick: Pick
  desk: boolean
  onPick: (k: Pick) => void
  onAgain: () => void
  onClose: () => void
  onFinish: () => void
  onOpen: (h: Hit) => void
  /** drawn in a frame of a board, not over a page: its room is the frame's, not the window's */
  framed?: boolean
}) {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setInView(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const listening = shown === 'listen' || shown === 'speak' || shown === 'heard'
  const page = !desk && !listening // the phone: what was found is a page of its own
  const head = listening ? (
    <header className="flex shrink-0 items-center gap-2 py-1 pr-2 pl-5">
      <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold text-zinc-900 dark:text-zinc-100">
        Search everything
      </h2>
      <CloseBtn onClose={onClose} />
    </header>
  ) : (
    <header
      className={`flex shrink-0 items-center gap-2 pr-2 pl-4 lg:pl-5 ${page ? 'pt-[max(0.5rem,env(safe-area-inset-top))] pb-2' : 'pt-3 pb-3'}`}
    >
      <Icon n="search" c={`size-5 shrink-0 ${GREY}`} />
      {/* what you said: words, not a box to type in */}
      <p className="min-w-0 flex-1 truncate text-[17px] font-semibold text-zinc-900 dark:text-zinc-50">
        {'\u201c'}
        {words}
        {'\u201d'}
      </p>
      <AgainBtn onAgain={onAgain} />
      <CloseBtn onClose={onClose} />
    </header>
  )
  const body = listening ? (
    <div className="flex flex-col items-center px-6 pt-3 pb-4">
      <p
        className={`flex min-h-16 w-full items-center justify-center text-center text-[22px] leading-8 ${words ? 'font-medium text-zinc-900 dark:text-zinc-50' : GREY}`}
      >
        {words || 'Listening\u2026'}
      </p>
      <Mic phase={shown as Phase} onFinish={onFinish} />
      <p className={`mt-2 flex h-6 items-center gap-2 text-sm ${GREY}`}>
        {shown === 'heard' ? 'Finding in every project, by words and by meaning\u2026' : 'Stops when you pause, or tap'}
      </p>
    </div>
  ) : shown === 'found' ? (
    <>
      <Kinds pick={pick} onPick={onPick} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-zinc-100 dark:border-zinc-800">
        <Found key={pick} pick={pick} onOpen={onOpen} />
      </div>
      {desk ? (
        <footer
          className={`flex shrink-0 items-center gap-4 border-t border-zinc-100 px-5 py-2.5 text-xs dark:border-zinc-800 ${GREY}`}
        >
          <span className="flex items-center gap-1">
            <Kbd k={'\u2191'} />
            <Kbd k={'\u2193'} /> move
          </span>
          <span className="flex items-center gap-1">
            <Kbd k={'\u21b5'} /> open
          </span>
          <span className="flex items-center gap-1">
            <Kbd k="Tab" /> next kind
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Kbd k="Esc" /> close
          </span>
        </footer>
      ) : null}
    </>
  ) : shown === 'none' ? (
    <Note
      icon="search"
      title="Nothing found"
      text="Nothing in any project matches it, by words or by meaning."
      onAgain={onAgain}
    />
  ) : shown === 'silent' ? (
    <Note
      icon="mic"
      title={'Didn\u2019t hear anything'}
      text="Say what you are looking for after you tap Again."
      onAgain={onAgain}
    />
  ) : shown === 'nomic' ? (
    <Note
      icon="mic"
      title={'Taska can\u2019t use the microphone'}
      text="Allow the microphone for Taska in the browser (the icon at the left of its address bar), then tap Again."
      onAgain={onAgain}
    />
  ) : (
    <Note
      icon="spinner"
      spin
      title={'Can\u2019t reach Taska'}
      text="Trying again; it searches as soon as Taska answers."
    />
  )
  const wrap = (node: ReactNode) =>
    page ? (
      <section
        role="dialog"
        aria-label="Search everything"
        data-proto="search"
        className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-zinc-950"
      >
        {node}
      </section>
    ) : (
      <div
        data-proto="search"
        {...(inView ? { 'data-in': '' } : {})}
        className={`fixed inset-0 z-50 flex justify-center bg-black/40 opacity-0 transition-opacity duration-200 data-in:opacity-100 dark:bg-black/70 ${desk ? `items-start px-6 ${framed ? 'pt-10' : 'pt-[12vh]'}` : 'items-end'}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <section
          role="dialog"
          aria-label="Search everything"
          className={`flex w-full flex-col bg-white shadow-xl transition-transform duration-300 ease-out dark:bg-zinc-900 dark:ring-1 dark:ring-white/10 ${desk ? `${framed ? 'max-h-[calc(100%-5rem)]' : 'max-h-[76vh]'} max-w-2xl rounded-2xl ring-1 ring-zinc-900/5` : 'rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))]'} ${inView ? 'translate-y-0 scale-100' : desk ? 'scale-95' : 'translate-y-full'}`}
        >
          {!desk ? (
            <div className="flex shrink-0 justify-center pt-2">
              <span className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            </div>
          ) : null}
          {node}
        </section>
      </div>
    )
  return wrap(
    <>
      {head}
      {body}
    </>,
  )
}

/** The Search button under New input in the sidebar: the same size and look, its key / */
export function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="mx-2.5 -mt-1 mb-3 shrink-0">
      <button
        data-proto-act="search"
        onClick={onClick}
        className="flex h-9 w-full items-center gap-2 rounded-xl bg-white px-3 text-sm font-medium text-zinc-800 shadow-sm ring-1 ring-zinc-900/10 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/10 dark:hover:bg-zinc-700"
      >
        <Icon n="search" c="size-4" />
        <span className="flex-1 text-left">Search</span>
        <Kbd k="/" />
      </button>
    </div>
  )
}

const STEPS = ['listen', 'speak', 'heard', 'found'] as const
const CUTS = [2, 4, 5, 7]
type Step = (typeof STEPS)[number]

/** The search on a page: listen, hear, find, show; Again, another kind, close; by a tap or a script */
export class SearchEverything {
  shown: Shown | null = null
  words = ''
  pick: Pick = 'all'
  private run = 0
  private cut = false
  private at = -1
  private waits: { at: number; done: () => void }[] = []
  constructor(private redraw: () => void) {}
  private reach(x: Step) {
    this.at = STEPS.indexOf(x)
    for (const w of this.waits.filter((w) => w.at <= this.at)) w.done()
    this.waits = this.waits.filter((w) => w.at > this.at)
  }
  /** resolves once the search has got there (for the walkthrough's words) */
  until(x: Step) {
    const at = STEPS.indexOf(x)
    return at <= this.at ? Promise.resolve() : new Promise<void>((done) => this.waits.push({ at, done }))
  }
  async ask() {
    const run = ++this.run
    this.at = -1
    this.words = ''
    this.cut = false
    this.pick = 'all'
    this.shown = 'listen'
    this.redraw()
    this.reach('listen')
    await wait(1500)
    if (run !== this.run) return
    this.shown = 'speak'
    this.reach('speak')
    for (const n of CUTS) {
      this.words = SAID.slice(0, this.cut ? SAID.length : n)
      this.redraw()
      if (this.cut) break
      await wait(650)
      if (run !== this.run) return
    }
    this.shown = 'heard'
    this.redraw()
    this.reach('heard')
    await wait(2000)
    if (run !== this.run) return
    this.shown = 'found'
    this.redraw()
    this.reach('found')
  }
  finish() {
    this.cut = true
  }
  close() {
    this.run++
    this.shown = null
    this.redraw()
  }
  setPick(k: Pick) {
    this.pick = k
    this.redraw()
  }
}

// ---------------------------------------------------------------- views in Settings

type View = { name: string; type: string[]; when: string; status: string[]; pri: string[]; sort: string }
const BUILT_IN: [string, string][] = [
  ['Needs you', 'An agent asks or is blocked, or waits for your OK'],
  ['Active', 'Now and not finished'],
  ['All', 'Everything not archived'],
  ['Queue', 'What agents do next, in order'],
  ['Later', 'Put off for later'],
  ['Finished', 'Done or won\u2019t do'],
  ['Archive', 'Archived'],
]
const YOURS: View[] = [
  { name: 'Bugs now', type: ['Bug'], when: 'Now', status: [], pri: ['P0', 'P1'], sort: 'Priority' },
  { name: 'In review', type: [], when: 'Both', status: ['In review'], pri: [], sort: 'Newest' },
]
const say = (v: View) =>
  [
    v.type.length ? v.type.join(', ') : 'Any type',
    v.when === 'Both' ? 'Now and Later' : v.when,
    v.status.length ? v.status.join(', ') : 'Not finished',
    v.pri.length ? v.pri.join('\u2013') : 'Any priority',
    `by ${v.sort.toLowerCase()}`,
  ].join(' \u00b7 ')
const CHIP =
  'flex h-8 items-center rounded-full px-3 text-sm font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 aria-pressed:bg-zinc-900 aria-pressed:text-white dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:aria-pressed:bg-white dark:aria-pressed:text-zinc-900'

function Chips({ all, on, onTap }: { all: string[]; on: string[]; onTap: (x: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((x) => (
        <button key={x} aria-pressed={on.includes(x)} className={CHIP} onClick={() => onTap(x)}>
          {x}
        </button>
      ))}
    </div>
  )
}
const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1.5 lg:flex-row lg:items-start lg:gap-4">
    <span className={`text-sm font-medium lg:w-24 lg:shrink-0 lg:pt-1.5 ${GREY}`}>{label}</span>
    <div className="min-w-0 flex-1">{children}</div>
  </div>
)

/** A view being made or changed: its name and what it shows */
function ViewForm({ v, onDone }: { v: View; onDone: () => void }) {
  const [w, setW] = useState(v)
  const flip = (k: 'type' | 'status' | 'pri') => (x: string) =>
    setW({ ...w, [k]: w[k].includes(x) ? w[k].filter((y) => y !== x) : [...w[k], x] })
  return (
    <div data-proto="view-form" className="flex flex-col gap-4 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900">
      <Field label="Name">
        <input
          defaultValue={w.name}
          className="h-10 w-full rounded-xl bg-white px-3 text-[15px] text-zinc-900 ring-1 ring-zinc-900/10 outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/10"
        />
      </Field>
      <Field label="Type">
        <Chips all={['Feature', 'Bug', 'Idea', 'Task', 'Rule']} on={w.type} onTap={flip('type')} />
      </Field>
      <Field label="When">
        <Chips all={['Now', 'Later', 'Both']} on={[w.when]} onTap={(x) => setW({ ...w, when: x })} />
      </Field>
      <Field label="Status">
        <Chips
          all={['Proposed', 'Open', 'In progress', 'In review', 'Done', 'Won\u2019t do']}
          on={w.status}
          onTap={flip('status')}
        />
      </Field>
      <Field label="Priority">
        <Chips all={['P0', 'P1', 'P2', 'P3']} on={w.pri} onTap={flip('pri')} />
      </Field>
      <Field label="Order">
        <Chips all={['Priority', 'Newest', 'Oldest', 'Queue']} on={[w.sort]} onTap={(x) => setW({ ...w, sort: x })} />
      </Field>
      <div className="flex items-center gap-2 pt-1">
        <button
          className="h-9 rounded-xl px-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-400/10"
          onClick={onDone}
        >
          Delete
        </button>
        <span className="flex-1" />
        <button
          className="h-9 rounded-xl px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-200 dark:hover:bg-zinc-800"
          onClick={onDone}
        >
          Cancel
        </button>
        <button
          className="h-9 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          onClick={onDone}
        >
          Save
        </button>
      </div>
    </div>
  )
}

/** Settings > Views: the views the list offers, the built-in ones first, then yours, which you make, change, order
 * and delete here (the list itself has no filter button any more) */
export function ViewsSettings({ editing = -1 }: { editing?: number }) {
  const [open, setOpen] = useState(editing)
  return (
    <div data-proto="views" className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-6 lg:px-8 lg:py-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Views</h1>
        <p className={`mt-1 text-sm ${GREY}`}>
          The views above the item list, in every project. The built-in ones first; yours after them, in the order you
          give them here.
        </p>
      </div>
      <section>
        <h2 className="px-1 pb-2 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
          Built in
        </h2>
        <div className="divide-y divide-zinc-100 rounded-2xl ring-1 ring-zinc-900/10 dark:divide-zinc-800 dark:ring-white/10">
          {BUILT_IN.map(([n, what]) => (
            <div key={n} className="flex min-h-12 items-center gap-3 px-4 py-2.5">
              <span className="w-24 shrink-0 text-[15px] font-medium text-zinc-900 dark:text-zinc-100">{n}</span>
              <span className={`min-w-0 flex-1 text-sm ${GREY}`}>{what}</span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="px-1 pb-2 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
          Yours
        </h2>
        <div className="flex flex-col gap-2">
          {YOURS.map((v, i) =>
            open === i ? (
              <ViewForm key={v.name} v={v} onDone={() => setOpen(-1)} />
            ) : (
              <button
                key={v.name}
                data-proto-act="view-edit"
                onClick={() => setOpen(i)}
                className="group flex min-h-14 items-center gap-3 rounded-2xl px-4 py-2.5 text-left ring-1 ring-zinc-900/10 hover:bg-zinc-50 dark:ring-white/10 dark:hover:bg-zinc-900"
              >
                <Icon n="updown" c={`size-4 shrink-0 ${GREY}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-zinc-900 dark:text-zinc-100">{v.name}</span>
                  <span className={`block truncate text-sm ${GREY}`}>{say(v)}</span>
                </span>
                <Icon n="pencil" c={`size-4 shrink-0 ${GREY} lg:invisible lg:group-hover:visible`} />
              </button>
            ),
          )}
          {open === YOURS.length ? (
            <ViewForm
              v={{ name: '', type: [], when: 'Now', status: [], pri: [], sort: 'Priority' }}
              onDone={() => setOpen(-1)}
            />
          ) : (
            <button
              data-proto-act="view-new"
              onClick={() => setOpen(YOURS.length)}
              className={`${LINK_BTN} self-start`}
            >
              <Icon n="plus" c="size-4" />
              New view
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
