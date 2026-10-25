// T456 (D75): a prototype of the new phone layout, to look at before anything is built. One screen Yadong taps through
// himself (#6909: no autoplay, everything in one): the bar at the bottom by the levels (Projects, Items, the voice
// button in the very middle, Comments, Search; no Needs you), an opened item as two pages (its detail under Items, its
// talk under Comments), a document one level inside its item, Search that listens at once (F479).
// What is not built yet is drawn here: the bar, the top line with only the project and its agent, the line saying
// where the words go, the line after sending, the listening panel. Every page in between is the page's own component
// with the demo project's data. Nothing here changes Taska itself.
import { useEffect, useState, type ReactNode } from 'react'
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

/** The bar at the bottom: five equal places, the voice button in the very middle. */
function Bar({ on, count, onTap }: { on: Tab; count: number; onTap(t: Tab | 'Mic'): void }) {
  return (
    <nav className="grid shrink-0 grid-cols-5 border-t border-zinc-200 bg-white/95 pb-5 dark:border-zinc-800 dark:bg-zinc-950/95">
      {(['Projects', 'Items', 'Mic', 'Comments', 'Search'] as const).map((t) =>
        t === 'Mic' ? (
          <div key={t} className="grid h-15 place-items-center">
            <button aria-label="Say something" onClick={() => onTap('Mic')} className="grid size-12 place-items-center rounded-full bg-zinc-900 text-white shadow-md dark:bg-zinc-100 dark:text-zinc-900">
              <Icon n="mic" c="size-6" sw="2" />
            </button>
          </div>
        ) : (
          <button key={t} onClick={() => onTap(t)} className={`flex h-15 flex-col items-center justify-center gap-1 text-[11px] font-medium ${on === t ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
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
const Sent = ({ said }: { said: string }) => (
  <div role="status" className="absolute inset-x-3 bottom-24 z-30 flex min-h-9 items-center gap-2 rounded-full bg-white px-3 text-[13px] text-zinc-700 shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700">
    <span className="text-emerald-600 dark:text-emerald-400">
      <Icon n="check" c="size-4" sw="2.5" />
    </span>
    <span className="min-w-0 truncate">{said}</span>
  </div>
)

/** Search listens at once: what you say shows as you say it (F479). */
function Listening({ onDone, onCancel }: { onDone(): void; onCancel(): void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="grid size-20 place-items-center rounded-full bg-red-50 text-red-600 dark:bg-red-400/10 dark:text-red-400">
        <Icon n="mic" c="size-9" sw="2" />
      </span>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Listening · say what to find in Shop</p>
      <p className="text-xl font-medium">“export filter”</p>
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

// ---------------------------------------------------------------- the screen

function Phone() {
  const [place, setPlace] = useState<Place>('items')
  const [rec, setRec] = useState(false)
  const [text, setText] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [found, setFound] = useState(false)
  useEffect(() => {
    if (!sent) return
    const t = setTimeout(() => setSent(null), 3000)
    return () => clearTimeout(t)
  }, [sent])
  const go = (p: Place) => {
    setPlace(p)
    setRec(false)
    setText('')
    setFound(false)
    if (p !== 'doc') setSel(null)
  }
  const inItem = place === 'detail' || place === 'comments' || place === 'doc'
  const tap = (t: Tab | 'Mic') => {
    if (t === 'Mic') return setRec(true)
    if (t === 'Comments') return go(inItem ? 'comments' : 'inputs')
    if (t === 'Items') return go(inItem && place !== 'detail' ? 'detail' : 'items')
    go(t === 'Projects' ? 'projects' : 'search')
  }
  // where the box writes, as the page works it out: a new input on a list, a reply in an item, a comment in its document
  const at = place === 'doc' ? '/p/shop/D1' : place === 'comments' || place === 'detail' ? '/p/shop/F001' : '/p/shop/'
  const route = parseRoute(at, '')
  const role = route.page === 'project' ? boxRole(M, route, false, 'Shop', null, { reply: null, quote: null, sel: new Set(sel ? [sel] : []) }, { mine: {}, going: {}, open: new Set() }) : null
  const shown = role ? shownBox(role, { mode: null, text, key: '', recordingFor: null }) : null
  const where: BoxLine = shown?.line ?? (inItem ? { icon: 'reply', label: 'Reply to F001' } : { icon: 'newinput', label: 'New input to Shop' })
  const send = () => {
    const to = place === 'doc' ? `Comment sent on D1${sel ? '' : ' · whole document'}` : inItem ? 'Reply sent to F001' : 'Sent to Shop · voice note 0:07'
    setRec(false)
    setText('')
    setSent(to)
  }
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
  const docOn: DocEvents = { ref: noDoc, picture: noDoc, play: noDoc, words: noDoc, view: noDoc, edit: noDoc, move: noDoc, takeOff: noDoc, remove: noDoc, resolve: noDoc, reply: noDoc, goItem: () => go('detail'), toggle: noDoc, away: noDoc, pick: (key) => setSel((s) => (s === key ? null : key)), say: noDoc, sayCancel: noDoc, type: noDoc, moveDoc: noDoc, deleteDoc: noDoc, circle: noDoc, quote: noDoc, editDoc: noDoc, whole: noDoc, tick: noDoc, modifyTicks: noDoc }
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
        <ItemTalk it={F1} f={facts} env={env} facts={talkFacts(M)} on={itemOn} />
      </div>
    )
  } else if (place === 'doc') {
    top = <Top back code="D1" sub="in F001" onBack={() => go('detail')} />
    const look = { threads: new Set<string>(), sel: new Set(sel ? [sel] : []), quote: null, reply: null, circle: false, typing: false }
    body = (
      <div className="px-4 pt-2 pb-6">
        <DocView facts={factsOf(M, D1, look, { since: T }, false, {}, null, { mine: {}, going: {}, open: new Set() })} env={docEnv} on={docOn} />
      </div>
    )
  } else if (place === 'inputs') {
    top = <Top back={false} code="Shop" sub="What you said" onBack={() => {}} />
    body = (
      <div className="px-3 py-3">
        <SaidLately count={SAID.length} total={SAID.length} q="" words={[]} more={false} outgoing={[]} rows={SAID} files={() => null} on={noSaid} />
      </div>
    )
  } else if (place === 'projects') {
    top = null
    body = <Sidebar phone projects={PROJECTS} composing={false} links={LINKS} place="h-full bg-zinc-100" on={{ newInput() {}, newVoice() {}, newProject() {}, hide() {}, settings() {}, keys() {}, go: (_, e) => (e.preventDefault(), go('items')), undo() {} }} />
  } else {
    top = <Top back={false} code="Shop" sub={found ? 'Searched for “export filter”' : ''} onBack={() => {}} />
    body = found ? listOf(ITEMS, 'items', { q: 'export filter' }, false, { on: { open: (n) => n === 1 && go('detail') } }) : <Listening onDone={() => setFound(true)} onCancel={() => go('items')} />
  }
  return (
    <div className="relative flex h-full flex-col">
      {top}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{body}</div>
      {sent ? <Sent said={sent} /> : null}
      {rec || text ? box : <Bar on={TAB_OF[place]} count={inItem ? F1.thread.length : 0} onTap={tap} />}
    </div>
  )
}

/** Tap your way through it: the bar's places, an item (its detail, then Comments), its document (tap a part, then the
 * voice button), the voice button anywhere (✓ stops into the box, ↑ sends), Search (it listens at once), Projects. */
export const NewMobileLayout: StoryObj = {
  render: () => (
    <div className="flex flex-wrap items-start gap-8">
      <Frame layout="phone" width={393} height={852} label="phone · tap anywhere">
        <Phone />
      </Frame>
      <div className="max-w-sm text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        <p className="mb-2 font-semibold text-zinc-800 dark:text-zinc-100">What to try</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>The bar: Projects, Items, the voice button, Comments, Search.</li>
          <li>F001 on the list: its detail under Items, its talk under Comments.</li>
          <li>Its document D1: tap a part, then the voice button to comment on it.</li>
          <li>The voice button: ✓ stops into the box, ↑ sends it.</li>
          <li>Search: it listens at once, then shows what it found.</li>
        </ul>
      </div>
    </div>
  ),
}
