// A document open as the page shows it: on the desktop in the pane beside the list (its bar: what it is, its
// actions, the way back), on the phone in a sheet over its item. What it shows comes from the page's own factsOf and
// webFacts with a demo project, and the page's DocView, WebPage, Thread and DocEdit draw it, with the state the page
// keeps for it. Used by the document's stories.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SelectionBar } from '../features/composer/SelectionBar'
import { selected, useSelectedWords } from '../features/composer/selectedWords'
import { DocEdit } from '../features/docs/DocEdit'
import { DocPaneActs, DocPaneHead, DocPaneNav } from '../features/docs/DocPane'
import { DocSheetMore } from '../features/docs/DocSheets'
import { DocView, PHONE_DOC_LOOK, type DocEvents } from '../features/docs/DocView'
import { Lasso } from '../features/docs/Lasso'
import { WebThread, type DocEnv } from '../features/docs/Thread'
import { WebPage } from '../features/docs/WebPage'
import { editFacts, factsOf, webFacts } from '../features/docs/docFacts'
import { tickText, tickedBlock, type TickState } from '../model/docTicks'
import { blockKeys } from '../model/docs'
import { findRef } from '../model/project'
import { clock } from '../model/time'
import type { Doc, Item } from '../model/types'
import type { NotSent } from '../model/voiceComments'
import { PaneFrame } from '../ui/PaneFrame'
import { PLACE_LEVELS, RecBar } from '../ui/PlaceVoice'
import { Sheet, SheetLayout } from '../ui/Sheet'
import { DIAGRAMS, PICTURE, T, item, modelOf } from './fixtures'
import { inFrame, inLayout } from './Frames'
import { acts } from './acts'
import { useMedia } from './liveParts'

/** A voice comment recording: how long, as the page's own clock writes it, and its level lately (B498's strip). */
const LEVELS = [0.3, 0.75, 0.5, 0.95, 0.4, 0.65, 0.2, 0.85, 0.55, 0.35, 0.9, 0.6]
export const recMeter = (desk: boolean) => <RecBar time={clock(2000)} levels={LEVELS.slice(-(desk ? PLACE_LEVELS.desk : PLACE_LEVELS.phone))} />

/** A document's handlers, each in the Actions panel (stories that draw a document's part alone). */
export const docOn: DocEvents = acts('Document', ['copyDoc', 'ref', 'picture', 'play', 'words', 'view', 'edit', 'move', 'takeOff', 'remove', 'menu', 'resolve', 'reply', 'goItem', 'toggle', 'away', 'pick', 'say', 'sayCancel', 'sayCheck', 'saySend', 'type', 'moveDoc', 'deleteDoc', 'circle', 'editDoc', 'tick', 'modifyTicks', 'sendTicks'] as const)

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
  /** only the document's words, for a column beside its item's talk (as the desktop's two columns show it) */
  viewOnly?: boolean
  /** its contents opened */
  contentsOpen?: boolean
  /** the pointer on an item of a list (the desktop) */
  pointing?: { key: string; li: number }
  /** a passage brought into view ('doc': its end) */
  aim?: string
  /** the browser's selection on some words of a paragraph, as a drag over them leaves it (`recording`: the bar's mic
   * pressed: it records a comment about them) */
  selected?: { key: string; words: string; recording?: boolean }
}

export const envOf = (m: ReturnType<typeof modelOf>, desk: boolean): DocEnv => {
  const url = (f: string) => (/\.(png|jpe?g)$/.test(f) ? PICTURE : '#' + f)
  return { world: { find: (c) => findRef(m, c), url, size: () => undefined, diagram: (src, dark, id) => DIAGRAMS.draw(src, dark, id) }, now: Date.parse(T) + 60_000, desk, tidy: true, play: () => ({ playing: false, t: null }), url }
}

export const docAt = (d: Doc, desk: boolean, h: DocHere = {}) => <LiveDoc d={d} desk={desk} h={h} />

const docActs = acts('Document', ['ref', 'edit', 'move', 'takeOff', 'remove', 'menu', 'resolve', 'goItem', 'saySend', 'sayCheck', 'moveDoc', 'deleteDoc', 'copyDoc', 'editDoc', 'sendTicks'] as const, {
  goItem: 'Item page',
  edit: 'Input box › Commenting on a document › Sent and not sent',
  move: 'Move and pick',
  menu: 'Comment threads › Your comments',
  editDoc: 'Document › Editing',
  moveDoc: 'Move and pick',
})
const paneActs = acts('Document pane', ['copy', 'edit', 'move', 'back'] as const, { edit: 'Document › Editing', move: 'Move and pick' })
const sheetActs = acts('Document sheet', ['more', 'done'] as const, { more: 'Document › On the phone › Its ⋯' })

/** The document with what the page holds for it (stores.docView: the threads open, what is picked, circling, the
 * web page's Comment mode; the ticks; a voice comment recording; Delete asking again; the player and viewer): a
 * paragraph's comments open and close, Comment and a tap pick (the phone's Comment opens its box), Reply picks the
 * thread, the circle draws, choices tick and Modify opens them again, a place's mic records and its x stops it,
 * Delete asks again (T662). Sending, saving, moving and opening its item need Taska or the rest of the page: the
 * Actions panel. */
function LiveDoc({ d, desk, h }: { d: Doc; desk: boolean; h: DocHere }) {
  const m = modelOf([item({ n: d.n, title: 'Rewrite Taska from scratch', ...h.item })], [], {}, [d])
  const [v, setV] = useState({ threads: new Set(h.threads), sel: new Set(h.sel), quote: h.quote ?? null, reply: h.reply ?? null, circle: !!h.circle, typing: !!h.typing })
  const [inspect, setInspect] = useState(!!h.inspect)
  const [ticks, setTicks] = useState<TickState>({ mine: {}, going: {}, open: new Set(), ...h.ticks })
  const [asked, setAsked] = useState(h.asked ?? {})
  const [speaking, setSpeaking] = useState(h.speaking ?? (h.spoken ? { key: h.spoken.key, bar: false, quote: h.spoken.text } : h.selected?.recording ? { key: h.selected.key, bar: true, quote: h.selected.words } : null))
  const seen = h.seen ?? { since: T }
  const env0 = envOf(m, desk)
  const media = useMedia(env0.url)
  // the browser's selection, followed as the page's SelectionBarContainer follows it (B708 r1149)
  const words = useSelectedWords(d.d, v.circle, !!speaking, !!speaking?.bar)
  // the words selected when it is drawn: the browser's selection on them (and the bar's mic pressed)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // after the page's own listener for the selection is set (useSelectedWords), so it hears it
    const w = h.selected
    const sec = w && box.current?.querySelector(`section[data-key="${w.key}"] [data-block]`)
    const walk = sec && document.createTreeWalker(sec, NodeFilter.SHOW_TEXT)
    while (w && walk?.nextNode()) {
      const t = walk.currentNode as Text
      const i = t.data.indexOf(w.words)
      if (i < 0) continue
      const r = document.createRange()
      r.setStart(t, i)
      r.setEnd(t, i + w.words.length)
      getSelection()?.removeAllRanges()
      getSelection()?.addRange(r)
      // the bar's mic pressed: it records about these words, its strip where they are
      const p = w.recording ? selected(d.d, false) : null
      if (p) words.start(p)
      return
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- what is selected when it is drawn, once
  }, [])
  const env = { ...env0, play: media.play }
  const facts = factsOf(m, d, v, seen, desk, asked, speaking, ticks, h.notSent ?? [])
  const web = d.fmt === 'html'
  // the page's docs.pick, toggle, away, reply and type
  const pick = (key: string, quote: string | null, by: 'button' | 'tap') => {
    if (v.circle) return
    if (desk && by === 'tap' && !v.sel.size) return
    if (quote) return setV({ ...v, ...(!desk && v.quote?.key === key && v.quote.text === quote ? { quote: null } : { sel: new Set(), quote: { key, text: quote }, reply: null }) })
    const sel = new Set(v.sel)
    if (!sel.delete(key)) {
      if (!desk && !v.typing) sel.clear()
      sel.add(key)
    }
    setV({ ...v, sel, quote: null, reply: null })
  }
  const toggle = (tk: string) => {
    const threads = new Set(v.threads)
    if (!threads.delete(tk)) threads.add(tk)
    setV({ ...v, threads })
  }
  const stopSaying = (then?: () => void) => () => (setSpeaking(null), then?.())
  const deleting = 'doc-delete ' + d.d
  const on: DocEvents = {
    ...docActs,
    picture: (f, all) => media.on.view(f, all),
    play: media.on.play,
    words: media.on.words,
    view: (f, all) => media.on.view(f, all),
    toggle,
    away: (tk) => setV({ ...v, threads: new Set([...v.threads].filter((t) => t !== tk && t !== tk.split('#')[0])) }),
    reply: (tk) => setV({ ...v, reply: tk, sel: new Set(), quote: null }),
    pick,
    say: (key, quote) => setSpeaking({ key, bar: false, quote: quote ?? d.blocks.find((b) => b.key === key)?.text ?? '' }),
    sayCancel: stopSaying(),
    sayCheck: stopSaying(docActs.sayCheck),
    saySend: stopSaying(docActs.saySend),
    type: () => setV({ ...v, typing: true }),
    circle: () => setV({ ...v, circle: !v.circle, ...(!v.circle ? { quote: null } : {}) }),
    tick: (tk, i) => {
      const b = d.blocks[blockKeys(d).indexOf(tk)]
      const next = b ? tickedBlock(tickText(ticks, d.d, tk, b.text), i) : null
      if (!b || next == null) return
      const of = { ...ticks.mine[d.d] }
      if (next === b.text) delete of[tk]
      else of[tk] = next
      setTicks({ ...ticks, mine: { ...ticks.mine, [d.d]: of } })
    },
    modifyTicks: (tk) => setTicks({ ...ticks, open: new Set([...ticks.open, `${d.d} ${tk}`]) }),
    // the desktop's Delete asks again; pressed again it deletes (Taska)
    deleteDoc: () => (asked[deleting] ? docActs.deleteDoc() : setAsked({ ...asked, [deleting]: 1 })),
  }
  let page: ReactNode = null
  if (web) {
    const w = webFacts(d, v, seen, asked, h.notSent ?? [], speaking && !speaking.bar && speaking.key?.startsWith('h:') ? { key: speaking.key, text: 'quote' in speaking ? speaking.quote : '' } : (h.spoken ?? null))
    page = (
      <WebPage
        title={d.title}
        html={d.md}
        threads={w.threads}
        held={w.held}
        rec={!!speaking}
        open={w.open}
        desk={desk}
        inspect={inspect}
        renderThread={(tk, rail) => <WebThread card={w.cards[tk]} rail={rail} replying={v.reply === tk} asking={w.asking} env={env} on={on} />}
        meter={recMeter(desk)}
        on={{
          pick: (q) => setV({ ...v, quote: q, sel: new Set(), reply: null }),
          comment: (q) => setV({ ...v, quote: q, sel: new Set(), reply: null, typing: !desk || v.typing }),
          say: (part) => setSpeaking({ key: part.key, bar: false, quote: part.text }),
          cancel: on.sayCancel,
          check: on.sayCheck,
          send: on.saySend,
          esc: () => setInspect(false),
          toggle,
          away: on.away,
        }}
      />
    )
  }
  // the page's bar over words selected in this frame: the mic speaks about them (pressed again it is ✓), Comment
  // makes them what the box comments on (B584)
  const layout = desk ? 'desk' : 'phone'
  const mine = () => {
    const p = selected(d.d, v.circle)
    return p && inLayout(p.range.commonAncestorContainer, layout) ? p : null
  }
  const at = words.at && words.from && inLayout(words.from.commonAncestorContainer, layout) ? inFrame(words.at, words.from.commonAncestorContainer) : null
  const bar = (
    <SelectionBar
      at={at}
      recording={!!speaking?.bar}
      desk={desk}
      meter={recMeter(desk)}
      comment={!speaking && !!words.s?.key}
      fix={false}
      on={{
        mic: () => {
          if (speaking?.bar) return on.sayCheck()
          const p = mine()
          if (speaking || !p) return
          words.start(p)
          setSpeaking({ key: p.key, bar: true, quote: p.text })
        },
        comment: () => {
          const p = mine()
          if (p?.key) setV({ ...v, quote: { key: p.key, text: p.text }, sel: new Set(), reply: null })
        },
        cancel: on.sayCancel,
        check: on.sayCheck,
        send: on.saySend,
        fix: () => {},
      }}
    />
  )
  const view = (
    <div ref={box} className="contents">
      <DocView facts={facts} env={env} on={on} page={page} meter={recMeter(desk)} contentsOpen={h.contentsOpen} pointing={h.pointing} aim={h.aim ?? null} lasso={v.circle ? <Lasso onDrawn={(keys) => setV({ ...v, circle: false, sel: new Set(keys), quote: null })} /> : null} />
    </div>
  )
  if (h.viewOnly)
    return (
      <>
        {view}
        {bar}
        {media.node}
      </>
    )
  return desk ? (
    <div className="flex h-full flex-col">
      <PaneFrame
        place=""
        desk
        head={<DocPaneHead d={d} editing={false} />}
        acts={<DocPaneActs web={web} inspect={inspect} whole={v.quote?.key === 'doc'} deleting={!!asked[deleting]} on={{ inspect: () => setInspect(!inspect), whole: () => setV(v.quote?.key === 'doc' ? { ...v, quote: null } : { ...v, sel: new Set(), quote: { key: 'doc', text: '' }, reply: null, typing: true }), copy: paneActs.copy, edit: paneActs.edit, move: paneActs.move, remove: on.deleteDoc }} />}
        lead={<DocPaneNav to={facts.itemCode} onBack={paneActs.back} />}
        onBack={paneActs.back}
      >
        {/* a web page brings its own margins: none are added around it */}
        <div className={web ? 'w-full' : 'w-full px-8 pt-8 pb-12'}>{view}</div>
      </PaneFrame>
      {bar}
      {media.node}
    </div>
  ) : (
    <>
      <Sheet open look={PHONE_DOC_LOOK} desk={false} onClose={paneActs.back}>
        <SheetLayout title={`D${d.d}`} extra={<DocSheetMore code={`D${d.d}`} circle={!!h.circle} on={{ more: sheetActs.more, done: sheetActs.done }} />} body={view} />
      </Sheet>
      {bar}
      {media.node}
    </>
  )
}

const editActs = acts('Document editor', ['discard', 'save'] as const)

/** The editor as the page keeps it: you type in it, Speak records (its time runs) and stops; Save and Discard need
 * Taska or the page (the Actions panel). */
function LiveEdit({ d, text: start, desk, f }: { d: Doc | null; text: string; desk: boolean; f: { rec?: { ms: number }; waiting?: number } }) {
  const [text, setText] = useState(start)
  const [rec, setRec] = useState(f.rec ?? null)
  const edit = <DocEdit isNew={!d} text={text} {...editFacts(rec, f.waiting ?? 0, desk)} on={{ change: setText, discard: editActs.discard, save: () => editActs.save(text), mic: () => setRec(rec ? null : { ms: 0 }) }} />
  if (d && desk)
    return (
      <div className="flex h-full flex-col">
        <PaneFrame place="" desk head={<DocPaneHead d={d} editing />} onBack={paneActs.back}>
          <div className="mx-auto flex min-h-full w-full max-w-[46rem] flex-col px-8 pt-4 pb-12">{edit}</div>
        </PaneFrame>
      </div>
    )
  return (
    <Sheet open look={{ tall: true }} desk={desk} onClose={editActs.discard}>
      <SheetLayout title={d ? `D${d.d}` : 'New doc on F012'} body={edit} />
    </Sheet>
  )
}

/** The editor: an existing document where it is read on the desktop (in a sheet on the phone), a new one in a sheet. */
export const editAt = (d: Doc | null, text: string, desk: boolean, f: { rec?: { ms: number }; waiting?: number } = {}) => <LiveEdit d={d} text={text} desk={desk} f={f} />
