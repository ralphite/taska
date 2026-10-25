// A document open as the page shows it: on the desktop in the pane beside the list (its bar: what it is, its
// actions, the way back), on the phone in a sheet over its item. What it shows comes from the page's own factsOf and
// webFacts with a demo project, and the page's DocView, WebPage, Thread and DocEdit draw it. Used by the document's
// stories.
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { DocEdit } from '../features/docs/DocEdit'
import { DocPaneActs, DocPaneHead, DocPaneNav } from '../features/docs/DocPane'
import { DocView, SayRow, type DocEvents } from '../features/docs/DocView'
import { Lasso } from '../features/docs/Lasso'
import { WebThread, type DocEnv } from '../features/docs/Thread'
import { WebPage } from '../features/docs/WebPage'
import { editFacts, factsOf, webFacts } from '../features/docs/docFacts'
import type { TickState } from '../model/docTicks'
import { findRef } from '../model/project'
import type { Doc, Item } from '../model/types'
import type { NotSent } from '../model/voiceComments'
import { PaneFrame } from '../ui/PaneFrame'
import { Sheet, SheetLayout } from '../ui/Sheet'
import { PICTURE, T, item, modelOf } from './fixtures'

const no = () => {}
export const docOn: DocEvents = { ref: no, picture: no, play: no, words: no, view: no, edit: no, move: no, takeOff: no, remove: no, resolve: no, reply: no, goItem: no, toggle: no, away: no, pick: no, say: no, sayCancel: no, type: no, moveDoc: no, deleteDoc: no, circle: no, editDoc: no, whole: no, tick: no, modifyTicks: no }

/** How you have the document open, and what is going on around it. */
export interface DocHere {
  /** threads shown open: "key#th", a paragraph's key, "doc" */
  threads?: string[]
  sel?: string[]
  quote?: { key: string; text: string }
  reply?: string
  circle?: boolean
  typing?: boolean
  /** a web page's Comment mode (the desktop) */
  inspect?: boolean
  /** Delete pressed once; a file's Take off asking ("unfile 12 <id> <file>") */
  asked?: Record<string, number>
  /** a paragraph's own mic records a comment about it (`bar`: from the bar over selected words) */
  speaking?: { key: string | null; bar: boolean }
  /** a web page's part spoken about */
  spoken?: { key: string; text: string }
  ticks?: Partial<TickState>
  /** comments in the box not sent yet */
  notSent?: NotSent[]
  /** when you last saw each thread ("since": anything after is new) */
  seen?: Record<string, string>
  /** the document's item (its talk says whether you replied there instead of picking) */
  item?: Partial<Item>
}

const envOf = (m: ReturnType<typeof modelOf>, desk: boolean): DocEnv => {
  const url = (f: string) => (/\.(png|jpe?g)$/.test(f) ? PICTURE : '#' + f)
  return { world: { find: (c) => findRef(m, c), url, size: () => undefined }, now: Date.parse(T) + 60_000, desk, tidy: true, play: () => ({ playing: false, t: null }), url }
}

export function docAt(d: Doc, desk: boolean, h: DocHere = {}) {
  const m = modelOf([item({ n: d.n, title: 'Rewrite Taska from scratch', ...h.item })], [], {}, [d])
  const v = { threads: new Set(h.threads), sel: new Set(h.sel), quote: h.quote ?? null, reply: h.reply ?? null, circle: !!h.circle, typing: !!h.typing }
  const ticks: TickState = { mine: {}, going: {}, open: new Set(), ...h.ticks }
  const seen = h.seen ?? { since: T }
  const asked = h.asked ?? {}
  const env = envOf(m, desk)
  const facts = factsOf(m, d, v, seen, desk, asked, h.speaking ?? null, ticks, h.notSent ?? [])
  const web = d.fmt === 'html'
  let page: ReactNode = null
  if (web) {
    const w = webFacts(d, v, seen, asked, h.notSent ?? [], h.spoken ?? null)
    page = (
      <WebPage
        title={d.title}
        html={d.md}
        threads={w.threads}
        held={w.held}
        rec={!!h.spoken}
        open={w.open}
        desk={desk}
        inspect={!!h.inspect}
        renderThread={(tk, rail) => <WebThread card={w.cards[tk]} rail={rail} replying={v.reply === tk} asking={w.asking} env={env} on={docOn} />}
        sayRow={<SayRow rec={!!h.spoken} part={w.held ? { key: w.held.key, quote: w.held.text } : undefined} on={{ say: no, cancel: no, type: no }} />}
        on={{ pick: no, say: no, esc: no, toggle: no, away: no }}
      />
    )
  }
  const view = <DocView facts={facts} env={env} on={docOn} page={page} lasso={h.circle ? <Lasso onDrawn={no} /> : null} />
  return desk ? (
    <div className="flex h-full flex-col">
      <PaneFrame
        place=""
        desk
        head={<DocPaneHead d={d} editing={false} />}
        acts={<DocPaneActs web={web} inspect={!!h.inspect} deleting={!!asked['doc-delete ' + d.d]} d={d.d} on={{ inspect: no, edit: no, move: no, remove: no }} />}
        lead={<DocPaneNav to={facts.itemCode} onBack={no} />}
        onBack={no}
      >
        {/* a web page brings its own margins: none are added around it */}
        <div className={web ? 'w-full' : 'w-full px-8 pt-8 pb-12'}>{view}</div>
      </PaneFrame>
    </div>
  ) : (
    <Sheet open look={{ tall: true, aboveComposer: !!h.typing }} desk={false} onClose={no}>
      <SheetLayout title={`D${d.d}`} body={view} />
    </Sheet>
  )
}

/** The editor: an existing document where it is read on the desktop (in a sheet on the phone), a new one in a sheet. */
export function editAt(d: Doc | null, text: string, desk: boolean, f: { rec?: { ms: number }; waiting?: number } = {}) {
  const edit = <DocEdit isNew={!d} text={text} {...editFacts(f.rec ?? null, f.waiting ?? 0, desk)} on={{ change: no, discard: no, save: no, mic: no }} />
  if (d && desk)
    return (
      <div className="flex h-full flex-col">
        <PaneFrame place="" desk head={<DocPaneHead d={d} editing />} onBack={no}>
          <div className="mx-auto flex min-h-full w-full max-w-[46rem] flex-col px-8 pt-4 pb-12">{edit}</div>
        </PaneFrame>
      </div>
    )
  return (
    <Sheet open look={{ tall: true }} desk={desk} onClose={no}>
      <SheetLayout title={d ? `D${d.d}` : 'New doc on F012'} body={edit} />
    </Sheet>
  )
}

/** Something the page itself does once it is drawn, as you would have done it: a pointer over a part (its mousemove),
 * the contents opened, words selected. */
export function After({ run, children }: { run(root: HTMLElement): void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const t = setTimeout(() => ref.current && run(ref.current), 50)
    return () => clearTimeout(t)
  })
  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  )
}
