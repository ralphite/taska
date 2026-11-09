// The desktop's search (F479) as the stories show it: the page's own dialog (pages/SearchDialog, drawn from
// searchDialogView) over the desktop's project page (searchDeskPage.tsx), fed by the demo projects Shop and Home
// (searchFixtures.ts), with a pause in place of the microphone and the server: ⌘K (or /, or the sidebar's magnifier)
// opens it on the last words, selected; typing searches a moment after you stop; the mic records, writes out and
// searches; a row opens in its project's pane.
import { useEffect, useState, type ReactNode } from 'react'
import { listedActions } from '../app/actions'
import { Tooltip } from '../app/Tooltip'
import type { HeardFile } from '../model/doubts'
import { foundMeta, saidMore, type FindAnswer, type FindKind, type FindPhase, type Found } from '../model/find'
import { codeOf } from '../model/project'
import { refCard } from '../model/refCard'
import type { Visit } from '../stores/recent'
import { FoundPreview, SearchDialog, type DialogEvents } from '../pages/SearchDialog'
import { isFound, searchDialogView, type DialogPlace, type FoundLine } from '../pages/searchDialogView'
import { Sheet } from '../ui/Sheet'
import { toneOf } from '../ui/tones'
import { Frame } from './Frames'
import { ADDED, HEARD, MISHEARD, MORE, RIGHT, SHOP, searchOf } from './searchFixtures'
import { DeskPage, TONES, modelFor, previewOf, titleOf } from './searchDeskPage'
import { pickSide } from '../model/doubts'

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
  /** a filter's menu open (a story's) */
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
  previewInput: found(TYPED, RIGHT, { sel: 5 }),
  previewDoc: found(TYPED, RIGHT, { sel: 8 }),
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
  failed: { open: true, phase: 'failed', words: TYPED },
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

// ---------------------------------------------------------------- the dialog

/** What you opened lately: F001, its document D1, B002, B018, and Home's F021. */
const visit = (slug: string, n: number): Visit => {
  const it = modelFor(slug).byN.get(n)
  return { project: slug, kind: 'items', n, code: codeOf(modelFor(slug), n), title: it?.title ?? '', type: it?.type, status: it?.status }
}
const RECENT: Visit[] = [visit('shop', 1), { project: 'shop', kind: 'docs', n: 1, d: 1, code: 'D1', title: 'Plan: the export keeps the filter', on: 'F001' }, visit('shop', 2), visit('shop', 18), visit('home', 21)]
const ACTIONS = [...listedActions(true), ...listedActions(false)]
const NOW = Date.parse('2026-11-02T18:00:00-08:00')

/** The highlighted row's preview, as the page draws it: an item's page; anything else, what the search knows of it. */
function Preview({ l }: { l: FoundLine }) {
  const x = l.found
  if (x.kind === 'items' || x.kind === 'rules') return previewOf(x)
  return <FoundPreview l={l} text={x.kind === 'docs' ? (modelFor(x.project).docs.find((d) => d.d === x.d)?.md ?? '') : ''} meta={foundMeta(x, NOW)} />
}

/** The dialog in the page's sheet, from where the search is. */
function StoryDialog({ f, set, onOpen, onClose }: { f: Desk; set(p: Partial<Desk>): void; onOpen(x: Found): void; onClose(): void }) {
  const place: DialogPlace = {
    here: 'shop',
    model: (slug) => (slug === 'shop' || slug === 'home' ? modelFor(slug) : null),
    title: titleOf,
    tone: (slug) => toneOf(TONES, slug),
    projects: ['shop', 'home'],
    recent: RECENT,
    actions: ACTIONS,
    openCode: codeOf(modelFor(f.pane.slug), f.pane.n),
  }
  const v = searchDialogView({ ...f, typed: f.typing, levels: LEVELS }, place)
  const busy = f.phase === 'listening' || f.phase === 'writing'
  const on: DialogEvents = {
    // as the finder's typeLive: too few words (cleared by the x) and what it found goes at once
    type: (w) => set({ words: w, added: '', heard: [], typing: true, replace: false, sel: 0, ...(w.trim().length < 2 ? { phase: 'ready', answer: null } : busy || f.phase === 'unheard' ? { phase: f.answer ? 'found' : 'ready' } : {}) }),
    toTyping: () => set({ typing: true, added: '', heard: [] }),
    mic: (replace) => set({ phase: 'listening', typing: false, replace, voice: true, ms: 0 }),
    stop: () => set({ phase: 'writing' }),
    discard: () => set({ phase: f.answer ? 'found' : f.words ? 'nothing' : 'ready', typing: true, replace: false }),
    pick: (fk, k, side) => {
      const h = f.heard.find((x) => x.key === fk)
      if (!h) return
      const r = pickSide(f.words, h, k, side)
      set({ words: r.text, heard: f.heard.map((x) => (x === h ? { ...x, trAdded: r.trAdded, doubts: r.doubts } : x)), phase: 'searching', voice: true })
    },
    kind: (k) => set({ kind: k, sel: 0 }),
    project: (p) => set({ project: p, sel: 0 }),
    status: (x) => set({ status: x, sel: 0 }),
    select: (i) => set({ sel: i }),
    open: (x, tab) => (tab ? undefined : onOpen(x)),
    act: () => onClose(),
    close: onClose,
  }
  return (
    <Sheet open look={{ search: true }} desk onClose={onClose}>
      {/* a filter's menu open (the dialog's own state) */}
      <SearchDialog v={v} preview={isFound(v.lit) ? <Preview l={v.lit} /> : null} menuOpen={f.menu ?? null} on={on} />
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
      {f.open ? <StoryDialog f={f} set={set} onOpen={(x) => x.n != null && set({ open: false, menu: null, pane: { slug: x.project, n: x.n } })} onClose={close} /> : null}
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
