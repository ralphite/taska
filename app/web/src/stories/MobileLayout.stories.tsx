// T456 (D75): a prototype of the new phone layout, to look at before anything is built. One screen Yadong taps through
// himself (#6909: no autoplay, everything in one): the bar at the bottom by the levels (Projects, Items, the voice
// button in the very middle, Comments, Search; no Needs you), an opened item as two pages (its detail under Items, its
// talk under Comments), a document one level inside its item, Search that listens at once (F479).
// What is not built yet is drawn here: the bar, the top line with only the project and its agent, the line saying
// where the words go, the line after sending, the listening panel. Every page in between is the page's own component
// with the demo project's data. Nothing here changes Taska itself.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Composer } from '../features/composer/Composer'
import { SaidLately, type SaidEvents } from '../features/composer/SaidLately'
import { factsOf } from '../features/docs/docFacts'
import { DocView, type DocEvents } from '../features/docs/DocView'
import { ItemPage, ItemTalk } from '../features/item/ItemPage'
import { Sidebar, type SideLinkInfo, type SideProject } from '../features/sidebar/Sidebar'
import { boxRole, shownBox, type BoxLine } from '../model/boxFoot'
import { SHORT_STANDING, standing } from '../model/inputs'
import { findRef } from '../model/project'
import { parseRoute } from '../model/route'
import type { Input } from '../model/types'
import type { SaidInput } from '../model/saidLately'
import { Icon } from '../ui/Icon'
import type { IconName } from '../ui/icon-paths'
import { PROJECT_TONES } from '../ui/tones'
import { Frame } from './Frames'
import { GuideLine, Level, Mark, sel, withText, type Step } from './guide'
import { doc } from './docFixtures'
import { T, input, message, modelOf } from './fixtures'
import { itemFacts, noItemEvents, talkEnv, talkFacts } from './itemFixtures'
import { PROJECT, listOf } from './listFixtures'

export default { title: 'Prototype/New mobile layout', parameters: { layout: 'padded' } } satisfies Meta

// ---------------------------------------------------------------- the demo project: Shop

const D1 = doc({ d: 1, n: 1, title: 'Plan: the export keeps the filter' })
const F1 = {
  ...PROJECT[0],
  body: 'The export writes **every** row; it should write the rows the list shows, with the filter and the sort.',
  thread: [
    message({ id: 2, by: 'you', kind: 'say', text: 'The export should keep the filter I set.', t: '2026-10-23T14:10:00-07:00' }),
    message({ id: 3, text: 'Reproduced it: the export reads the list before the filter.', t: '2026-10-23T14:20:00-07:00' }),
    message({ id: 4, text: 'Done the first part: the rows the list shows are written. The plan is in D1.', t: '2026-10-23T14:30:00-07:00' }),
  ],
}
const ITEMS = [F1, ...PROJECT.slice(1)]
const INPUTS: Input[] = [
  input({ id: 'r9', text: 'Search should find words in the talk too.', acked: true, touched: [5] }),
  input({ id: 'r8', text: 'The export should keep the filter I set.', acked: true, touched: [1], files: [{ f: 'f8-voice_0-07.webm', name: 'voice_0-07.webm', mime: 'audio/webm' }] }),
  input({ id: 'r7', text: 'Excel export as well, later.', acked: true, touched: [6] }),
]
const M = modelOf(ITEMS, INPUTS, { title: 'Shop' }, [D1])
const PROJECTS: SideProject[] = [
  { slug: 'shop', title: 'Shop', tone: PROJECT_TONES[1], needs: 4, open: 9, current: true, href: '#' },
  { slug: 'home', title: 'Home', tone: PROJECT_TONES[0], needs: 2, open: 13, current: false, href: '#' },
  { slug: 'taska', title: 'taska', tone: PROJECT_TONES[4], needs: 0, open: 32, current: false, href: '#' },
]
const LINKS: SideLinkInfo[] = [
  { key: 'docs', label: 'Documents', icon: 'doc', href: '#', current: false },
  { key: 'log', label: 'Activity', icon: 'history', href: '#', current: false },
  { key: 'deleted', label: 'Deleted', icon: 'trash', href: '#', current: false },
]
const SAID: SaidInput[] = INPUTS.map((r, i) => {
  const s = standing(r, { on: false, busy: null }, (x) => x)
  return { r, code: '#' + r.id.slice(1), time: ['14:57', '14:10', '09:02'][i], day: i ? null : 'Today', standing: s, short: SHORT_STANDING[s.label] || s.label, scope: null, chips: [], busy: false, draft: null, canUndoSend: false, retry: null, opened: false, moved: null }
})
const noSaid: SaidEvents = { goto() {}, more() {}, append() {}, draft() {}, menu() {}, undoSend() {}, retry() {}, outboxRetry() {}, outboxEdit() {}, query() {}, loadMore() {}, moved() {} }
const noDoc = () => {}

// ---------------------------------------------------------------- the parts not built yet

type Tab = 'Projects' | 'Items' | 'Comments' | 'Search'
type Place = 'items' | 'detail' | 'doc' | 'comments' | 'inputs' | 'projects' | 'search'
const TAB_OF: Record<Place, Tab> = { items: 'Items', detail: 'Items', doc: 'Items', comments: 'Comments', inputs: 'Comments', projects: 'Projects', search: 'Search' }
const ICON_OF: Record<Tab, IconName> = { Projects: 'folder', Items: 'items', Comments: 'comment', Search: 'search' }

/** The bar at the bottom: five equal places with the voice button in the very middle, or three (no voice button). */
function Bar({ on, count, mic, to, onTap }: { on: Tab; count: number; mic: boolean; to: string; onTap(t: Tab | 'Mic'): void }) {
  const places = mic ? (['Projects', 'Items', 'Mic', 'Comments', 'Search'] as const) : (['Projects', 'Items', 'Comments'] as const)
  return (
    <nav className={`grid shrink-0 border-t border-zinc-200 bg-white/95 pb-5 dark:border-zinc-800 dark:bg-zinc-950/95 ${mic ? 'grid-cols-5' : 'grid-cols-3'}`}>
      {places.map((t) =>
        t === 'Mic' ? (
          <div key={t} className="flex h-15 flex-col items-center justify-center gap-0.5">
            <button aria-label="Say something" onClick={() => onTap('Mic')} className="grid size-11 place-items-center rounded-full bg-zinc-900 text-white shadow-md dark:bg-zinc-100 dark:text-zinc-900">
              <Icon n="mic" c="size-6" sw="2" />
            </button>
            {/* where the voice goes, before you tap (not only after) */}
            <span className="max-w-full truncate text-[10px] text-zinc-500 dark:text-zinc-400">{to}</span>
          </div>
        ) : (
          <button key={t} data-tab={t} onClick={() => onTap(t)} className={`flex h-15 flex-col items-center justify-center gap-1 text-[11px] font-medium ${on === t ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
            <Icon n={ICON_OF[t]} c="size-6" sw={on === t ? '2' : '1.75'} />
            <span>
              {t}
              {t === 'Comments' && count ? <span className="ml-0.5 text-[10px] text-zinc-400 tabular-nums">{count}</span> : null}
            </span>
          </button>
        ),
      )}
    </nav>
  )
}

/** The top line: the project and its agent; or, inside an item or its document, the way back and where you are. */
function Top({ back, code, sub, onBack }: { back: boolean; code: string; sub: string; onBack(): void }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-100 px-3 dark:border-zinc-800/70">
      {back ? (
        <button onClick={onBack} aria-label="Back" className="grid size-11 place-items-center rounded-full text-zinc-600 dark:text-zinc-400">
          <Icon n="left" c="size-6" />
        </button>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className={back ? 'font-mono text-sm font-bold' : 'text-[19px] font-semibold tracking-tight'}>{code}</span>
        {sub ? <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{sub}</span> : null}
      </div>
      {back ? null : (
        <span className="flex h-8 items-center gap-1.5 rounded-full bg-zinc-100 px-3 text-[13px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          <span className="size-2 rounded-full bg-emerald-500" />
          Claude Code · now
        </span>
      )}
    </header>
  )
}

/** After sending: one line over the bar for a few seconds. */
const Sent = ({ said, onSee }: { said: string; onSee(): void }) => (
  <div role="status" className="absolute inset-x-3 bottom-24 z-30 flex min-h-9 items-center gap-2 rounded-full bg-white px-3 text-[13px] text-zinc-700 shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700">
    <span className="text-emerald-600 dark:text-emerald-400">
      <Icon n="check" c="size-4" sw="2.5" />
    </span>
    <span className="min-w-0 flex-1 truncate">{said}</span>
    <button onClick={onSee} className="h-8 shrink-0 rounded-full px-2 text-[13px] font-semibold text-blue-600 dark:text-blue-400">
      See
    </button>
  </div>
)

/** The Comments tab has one meaning: talk, for the open item or for the whole project; this switch says which. */
function Scope({ item, onItem, onAll }: { item: boolean; onItem(): void; onAll(): void }) {
  const chip = (on: boolean) => `h-8 rounded-full px-3 text-[13px] font-medium ${on ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`
  return (
    <div className="flex shrink-0 gap-2 px-4 pt-3">
      <button onClick={onItem} className={chip(item)}>
        F001
      </button>
      <button onClick={onAll} className={chip(!item)}>
        All in Shop
      </button>
    </div>
  )
}

/** Search listens at once: what you say shows as you say it (F479). */
function Listening({ onDone, onCancel }: { onDone(): void; onCancel(): void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="grid size-20 place-items-center rounded-full bg-red-50 text-red-600 dark:bg-red-400/10 dark:text-red-400">
        <Icon n="mic" c="size-9" sw="2" />
      </span>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Listening · say what to find in Shop</p>
      {/* no words while you speak (#6930): they come once it stops */}
      <Level />
      <div className="flex gap-3">
        <button onClick={onCancel} className="h-11 rounded-full px-5 text-sm font-medium text-zinc-600 dark:text-zinc-300">
          Cancel
        </button>
        <button onClick={onDone} className="h-11 rounded-full bg-zinc-900 px-5 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
          Find
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- the guide: where to tap next (R488, B524)

const STEPS: Step[] = [
  { say: 'The voice button says where it goes (New input). Tap it: it records at once', tap: sel('[aria-label="Say something"]') },
  { say: 'Tap ✓: the recording stops and its words go into the box, to change or add to', tap: sel('[aria-label="Stop and put words in the box"]') },
  { say: 'Tap ↑: it goes; a line says where, with See', tap: sel('#composer [data-box="main"], [data-box="main"]') },
  { say: 'Tap See: your input is at the top of all you said in Shop', tap: withText('button', 'See') },
  { say: 'Tap Items: back to the list', tap: sel('[data-tab="Items"]') },
  { say: 'Tap F001: the item opens, its detail under Items; the voice button now says Reply F001', tap: sel('[data-n="1"]') },
  { say: 'Tap Comments: the same item’s talk (the switch on top says so)', tap: sel('[data-tab="Comments"]') },
  { say: 'Tap the voice button: it replies to F001', tap: sel('[aria-label="Say something"]') },
  { say: 'Tap ↑: the reply goes, and shows at the end of the talk', tap: sel('[aria-label="Stop and send"]') },
  { say: 'Tap All in Shop: the same tab, widened to the whole project; F001 stays open', tap: withText('button', 'All in Shop') },
  { say: 'Tap Items: back to F001’s detail', tap: sel('[data-tab="Items"]') },
  { say: 'Tap its document D1: a level inside the item', tap: withText('button', 'Plan: the export keeps the filter') },
  { say: 'Tap a part of it: only picked; the voice button now says Comment', tap: sel('[data-key="p1"]') },
  { say: 'Tap the voice button: it comments on that part', tap: sel('[aria-label="Say something"]') },
  { say: 'Tap ↑: the comment goes, on that part', tap: sel('[aria-label="Stop and send"]') },
  { say: 'Tap See: the comment is in F001’s talk, with the part it is on', tap: withText('button', 'See') },
  { say: 'Tap Search: it listens at once', tap: sel('[data-tab="Search"]') },
  { say: 'Tap Find: what it found in Shop', tap: withText('button', 'Find') },
  { say: 'Tap Projects: every project, and Documents, Activity, Deleted, Settings', tap: sel('[data-tab="Projects"]') },
]

function Phone({ mic, n = -1, onNext }: { mic: boolean; n?: number; onNext?(): void }) {
  const [place, setPlace] = useState<Place>('items')
  const [rec, setRec] = useState(false)
  const [text, setText] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [found, setFound] = useState(false)
  // the item stays open while you look at the project's talk, Search or a document: Items brings it back
  const [open, setOpen] = useState(false)
  // what was sent here, so it shows where it went (the prototype has no server)
  const [mine, setMine] = useState<{ to: 'shop' | 'item'; text: string }[]>([])
  const root = useRef<HTMLDivElement>(null)
  const step = n >= 0 ? (STEPS[n] ?? null) : null
  useEffect(() => {
    if (!sent) return
    const t = setTimeout(() => setSent(null), 8000)
    return () => clearTimeout(t)
  }, [sent])
  const go = (p: Place) => {
    setPlace(p)
    setRec(false)
    setText('')
    setFound(false)
    setSent(null)
    if (p !== 'doc') setSel(null)
    if (p === 'detail' || p === 'comments' || p === 'doc') setOpen(true)
    if (p === 'items' || p === 'projects') setOpen(false)
  }
  const inItem = place === 'detail' || place === 'comments' || place === 'doc'
  const tap = (t: Tab | 'Mic') => {
    if (t === 'Mic') return setRec(true)
    if (t === 'Comments') return go(open ? 'comments' : 'inputs')
    if (t === 'Items') return go(open && place !== 'detail' ? 'detail' : 'items')
    go(t === 'Projects' ? 'projects' : 'search')
  }
  const thread = [...F1.thread, ...mine.filter((x) => x.to === 'item').map((x, i) => message({ id: 100 + i, by: 'you', kind: 'say', text: x.text, t: T }))]
  const said: SaidInput[] = [
    ...mine
      .filter((x) => x.to === 'shop')
      .reverse()
      .map((x, i) => ({ ...SAID[0], r: input({ id: 'r' + (20 + i), text: x.text }), code: '#' + (20 + i), time: 'now', day: i ? null : 'Today', standing: { ...SAID[0].standing }, short: 'Sent' })),
    ...SAID.map((r, i) => (i === 0 && mine.some((x) => x.to === 'shop') ? { ...r, day: null } : r)),
  ]
  const to = place === 'doc' ? 'Comment D1' : inItem ? 'Reply F001' : 'New input'
  // where the box writes, as the page works it out: a new input on a list, a reply in an item, a comment in its document
  const at = place === 'doc' ? '/p/shop/D1' : place === 'comments' || place === 'detail' ? '/p/shop/F001' : '/p/shop/'
  const route = parseRoute(at, '')
  const role = route.page === 'project' ? boxRole(M, route, false, 'Shop', null, { reply: null, quote: null, sel: new Set(sel ? [sel] : []) }, { mine: {}, going: {}, open: new Set() }) : null
  const shown = role ? shownBox(role, { mode: null, text, key: '', recordingFor: null }) : null
  const where: BoxLine = shown?.line ?? (inItem ? { icon: 'reply', label: 'Reply to F001' } : { icon: 'newinput', label: 'New input to Shop' })
  const send = () => {
    const words = text || 'Voice note 0:05'
    const line = place === 'doc' ? `Comment sent on D1${sel ? '' : ' · whole document'}` : inItem ? 'Reply sent to F001' : 'Sent to Shop'
    setMine((m) => [...m, place === 'doc' ? { to: 'item', text: `On D1${sel ? ' “the export keeps the filter”' : ''}: ${words}` } : { to: inItem ? 'item' : 'shop', text: words }])
    setRec(false)
    setText('')
    setSent(line)
  }
  const see = () => go(inItem ? 'comments' : 'inputs')
  const box = (
    <div className="shrink-0 bg-zinc-50 px-3 pt-2 pb-6 dark:bg-zinc-950">
      <Composer
        line={where}
        placeholder={shown?.placeholder ?? 'Write…'}
        sendWord={shown?.send ?? 'Send'}
        text={text}
        desk={false}
        composePage={false}
        micTip="Voice note"
        rec={rec ? { time: '0:04', levels: [0.2, 0.5, 0.8, 0.4, 0.6, 0.3, 0.7, 0.5, 0.4, 0.6], from: 'main' } : null}
        on={{ text: setText, send, attach() {}, mic: () => setRec(true), recCancel: () => setRec(false), recStop: () => (setRec(false), setText('Keep the sort too.')), recSend: send }}
      />
    </div>
  )
  const env = talkEnv(M, false)
  const facts = itemFacts(M, F1, { docs: [D1] })
  const itemOn = { ...noItemEvents, doc: () => go('doc') }
  const docOn: DocEvents = { ref: noDoc, picture: noDoc, play: noDoc, words: noDoc, view: noDoc, edit: noDoc, move: noDoc, takeOff: noDoc, remove: noDoc, resolve: noDoc, reply: noDoc, goItem: () => go('detail'), toggle: noDoc, away: noDoc, pick: (key) => setSel((s) => (s === key ? null : key)), say: noDoc, sayCancel: noDoc, type: noDoc, moveDoc: noDoc, deleteDoc: noDoc, circle: noDoc, editDoc: noDoc, whole: noDoc, tick: noDoc, modifyTicks: noDoc }
  const docEnv = { world: { find: (c: string) => findRef(M, c), url: (f: string) => '#' + f, size: () => undefined }, now: Date.parse(T), desk: false, tidy: true, play: () => ({ playing: false, t: null }), url: (f: string) => '#' + f }
  let top: ReactNode
  let body: ReactNode
  if (place === 'items') {
    top = <Top back={false} code="Shop" sub="" onBack={() => {}} />
    body = listOf(ITEMS, 'items', { status: 'all' }, false, { on: { open: (n) => n === 1 && go('detail') } })
  } else if (place === 'detail') {
    top = <Top back code="F001" sub="" onBack={() => go('items')} />
    body = <ItemPage it={{ ...F1, thread: [] }} f={facts} env={env} facts={talkFacts(M)} on={itemOn} />
  } else if (place === 'comments') {
    top = <Top back code="F001" sub={F1.title} onBack={() => go('items')} />
    body = (
      <div className="flex flex-col gap-6 px-4 py-4">
        <div className="-mx-4 -mt-4">
          <Scope item onItem={() => {}} onAll={() => go('inputs')} />
        </div>
        <ItemTalk it={{ ...F1, thread }} f={facts} env={env} facts={talkFacts(M)} on={itemOn} />
      </div>
    )
  } else if (place === 'doc') {
    top = <Top back code="D1" sub="in F001" onBack={() => go('detail')} />
    const look = { threads: new Set<string>(), sel: new Set(sel ? [sel] : []), quote: null, reply: null, circle: false, typing: false }
    body = (
      <div className="px-4 pt-2 pb-6">
        <DocView facts={factsOf(M, D1, look, { since: T }, false, {}, { key: sel, bar: true }, { mine: {}, going: {}, open: new Set() })} env={docEnv} on={docOn} />
      </div>
    )
  } else if (place === 'inputs') {
    top = <Top back={false} code="Shop" sub="What you said" onBack={() => {}} />
    body = (
      <div className="px-3 py-3">
        {open ? (
          <div className="-mx-3 -mt-3 pb-3">
            <Scope item={false} onItem={() => go('comments')} onAll={() => {}} />
          </div>
        ) : null}
        <SaidLately count={said.length} total={said.length} q="" words={[]} more={false} outgoing={[]} rows={said} files={() => null} on={noSaid} />
      </div>
    )
  } else if (place === 'projects') {
    top = null
    body = <Sidebar phone projects={PROJECTS} composing={false} links={LINKS} place="h-full bg-zinc-100" on={{ newInput() {}, newVoice() {}, newProject() {}, hide() {}, settings() {}, keys() {}, go: (_, e) => (e.preventDefault(), go('items')), undo() {} }} />
  } else {
    top = <Top back={false} code="Shop" sub={found ? 'Searched for “export filter”' : ''} onBack={() => {}} />
    body = found ? listOf(ITEMS, 'items', { q: 'export filter' }, false, { on: { open: (n) => n === 1 && go('detail') } }) : <Listening onDone={() => setFound(true)} onCancel={() => go('items')} />
  }
  // a tap on what the step names moves the guide on (any other tap just does what it does)
  const next = (e: React.MouseEvent) => {
    const el = root.current && step ? step.tap(root.current) : null
    if (el && el.contains(e.target as Node)) setTimeout(() => onNext?.(), 0)
  }
  // without the voice button the box is always there, as it is now
  const boxShown = mic ? rec || !!text : place !== 'projects'
  return (
    <div ref={root} onClickCapture={next} className="relative flex h-full flex-col">
      {top}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{body}</div>
      {sent ? <Sent said={sent} onSee={see} /> : null}
      {boxShown ? box : null}
      {mic && boxShown ? null : <Bar on={TAB_OF[place]} count={open ? thread.length : 0} mic={mic} to={to} onTap={tap} />}
      <Mark root={root} step={step} />
    </div>
  )
}

/** One phone, its guide from the start again when Start again is tapped. */
function Guided() {
  const [k, setK] = useState(0)
  const [n, setN] = useState(0)
  const step = STEPS[n]
  return (
    <div className="flex w-[393px] flex-col gap-3">
      <Frame layout="phone" width={393} height={852} label="the voice button in the middle (D75) · the blue mark is the next tap">
        <Phone key={k} mic n={n} onNext={() => setN((x) => x + 1)} />
      </Frame>
      <GuideLine n={n} total={STEPS.length} say={step?.say} onAgain={() => (setK((x) => x + 1), setN(0))} />
    </div>
  )
}

/** Tap your way through it, the blue mark showing the next tap (it never plays itself): a new input by voice, an
 * item's detail and its talk, a reply, its document and a comment on a part, Search, Projects, all you said. Any
 * other tap just does what it does. Beside it, the same with three places and no voice button (the box as now). */
export const NewMobileLayout: StoryObj = {
  render: () => (
    <div className="flex flex-wrap items-start gap-10">
      <Guided />
      <Frame layout="phone" width={393} height={852} label="three places, no voice button: the box as it is now">
        <Phone mic={false} />
      </Frame>
    </div>
  ),
}
