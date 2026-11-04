// The box where it is, as the page works it out: a demo project (F012 with its documents D1 and D2, a voice note's
// input r7), where you are, what is picked or ticked in a document, what the box is in and holds; the box's line,
// placeholder and Send come from the page's own boxRole and shownBox, and the page's Composer draws it with the state
// the page keeps for it. Used by the input box's stories.
import { useEffect, useState, type ReactNode } from 'react'
import { Composer, Feedback, type ComposerProps } from '../features/composer/Composer'
import { DraftFiles, type DraftFile } from '../features/composer/DraftFiles'
import { BOX_WORDS_LOOK, Doubts, DraftWords, type DoubtsView } from '../features/composer/Doubts'
import { openDoubts, pickSide, spotsIn, type HeardFile } from '../model/doubts'
import { boxRole, feedbackLine, shownBox, type BoxMode } from '../model/boxFoot'
import { blockKeys } from '../model/docs'
import type { Outgoing } from '../model/outgoing'
import { parseRoute } from '../model/route'
import type { Input } from '../model/types'
import { input, item, modelOf } from './fixtures'
import { comment, doc } from './itemFixtures'
import { acts } from './acts'
import { useMedia } from './liveParts'
import { clock } from '../model/time'

export const PLAN = doc({
  d: 1,
  n: 12,
  blocks: [
    { key: 'k1', kind: 'para', text: 'The export keeps the filter.', comments: [comment({ id: 9, quote: '' })] },
    { key: 'k2', kind: 'para', text: 'Its file name says which filter.', comments: [] },
    { key: 'k3', kind: 'list', text: '- [ ] CSV\n- [ ] Excel', comments: [] },
  ],
})
export const WEB = doc({ d: 2, n: 12, fmt: 'html', title: 'Orders dashboard', blocks: [{ key: 'p1', kind: 'html', text: 'Avg. order value', comments: [] }] })
export const VOICE_INPUT = input({ id: 'r7', text: 'Keep the filter, and the sort.', files: [{ f: 'f7-voice_0-07.webm', name: 'voice_0-07.webm', mime: 'audio/webm' }] })
export const TICKED = { [blockKeys(PLAN)[2]]: '- [x] CSV\n- [ ] Excel' }
export const VOICE: DraftFile = { key: 'v', f: 'f5-voice_0-09.webm', name: 'voice_0-09.webm', mime: 'audio/webm', ms: 9000 }
export const REC = { time: '0:04', levels: [0.2, 0.5, 0.8, 0.4, 0.6, 0.3, 0.7, 0.5], from: 'main' as const }

/** Where you are and what the box holds. */
export interface Here {
  /** the address: '' a list (New input), 'F012' an item, 'D1' a document, 'new' the New input page */
  at?: string
  sel?: string[]
  quote?: { key: string; text: string }
  reply?: string
  ticks?: Record<string, string>
  mode?: BoxMode
  text?: string
  rec?: boolean
  /** a recording made for another draft (its key) */
  recordingFor?: string
  files?: DraftFile[]
  /** the organizer is on (the default, as Taska is normally used); false: the story is the organizer off */
  organizer?: boolean
  /** the project's inputs (default: one voice note with words) */
  inputs?: Input[]
  /** a recording from the second mic */
  recAux?: boolean
  /** the document's item is gone (deleted or merged away) */
  docItemGone?: boolean
  composePage?: boolean
  doubts?: ReactNode
  /** its voice notes' words may be misheard (their doubts in `files`): the box draws them as the page's BoxContainer
   * does, and a version picked or used swaps the words (`showing`: the phone shows the words in the box) */
  heard?: { showing?: boolean }
}

export const boxProject = (inputs: Input[] = [VOICE_INPUT], organizer = true, docItemGone = false) =>
  modelOf([item({ n: 12 })], inputs, { organizer: { on: organizer, model: 'gemini-flash-latest', busy: null } }, [docItemGone ? { ...PLAN, n: 99 } : PLAN, WEB])

export const boxAt = (h: Here, desk: boolean, extra: Partial<ComposerProps> = {}) => <LiveBox h={h} desk={desk} extra={extra} />

const boxActs = acts('Box', ['send', 'discard', 'sendTicks', 'toItem', 'recStop', 'recSend'] as const, { toItem: 'Input box › What it writes to › A reply to an item' })

/** The box with what the page holds for it (the draft's words and files, what the box is in, what is picked or
 * ticked in the document, a recording): you type in it, Cancel and x stop what it is in or let go of what is picked,
 * the ticks clear, + adds files (a picture opens, x takes one off), the mic records and Discard stops it (T662).
 * Sending, posting and the words of a recording need Taska: they show in the Actions panel. */
function LiveBox({ h, desk, extra }: { h: Here; desk: boolean; extra: Partial<ComposerProps> }) {
  const m = boxProject(h.inputs ?? [VOICE_INPUT], h.organizer, h.docItemGone)
  const route = parseRoute(`/p/demo/${h.at ?? ''}`, '')
  if (route.page !== 'project') throw new Error('not a project')
  const [text, setText] = useState(h.text ?? '')
  const [mode, setMode] = useState(h.mode ?? null)
  const [picked, setPicked] = useState({ reply: h.reply ?? null, quote: h.quote ?? null, sel: h.sel ?? [] })
  const [ticked, setTicked] = useState(h.ticks ?? null)
  const [files, setFiles] = useState<(DraftFile & Partial<HeardFile>)[]>(h.files ?? [])
  const [showing, setShowing] = useState(!!h.heard?.showing)
  const [rec, setRec] = useState<{ from: 'main' | 'aux'; t0: number | null } | null>(h.rec ? { from: h.recAux ? 'aux' : 'main', t0: null } : null)
  const [now, setNow] = useState(0)
  const media = useMedia((f) => files.find((x) => x.f === f)?.preview ?? '#')
  // a recording you started: its time runs
  const live = rec?.t0 != null
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [live])
  const pick = { reply: picked.reply, quote: picked.quote, sel: new Set(picked.sel) }
  const mine: Record<number, Record<string, string>> = h.at === 'D1' && ticked ? { 1: ticked } : {}
  const ticks = { mine, going: {}, open: new Set<string>() }
  const role = boxRole(m, route, desk, 'demo', mode, pick, ticks)
  const shown = shownBox(role, { mode, text, key: 'here', recordingFor: h.recordingFor ?? null })
  const stopRec = () => setRec(null)
  // the words that may be misheard (BoxContainer and useHeard): under the box, or on the phone in the box to pick from;
  // a version picked swaps the words as voiceWords.pick does (the model's pickSide)
  const heardFiles = files.map((f) => ({ ...f, key: f.key }))
  const spots = spotsIn(text, heardFiles)
  const open = openDoubts(text, heardFiles)
  const altOpen = open.filter((d) => d.x.alt).length
  const pickable = spots.some((p) => p.x.alt)
  const pickWord = (fk: string, k: number, side: 'was' | 'alt') => {
    const f = files.find((x) => x.key === fk)
    if (!f) return
    const r = pickSide(text, f, k, side)
    if (r.changed) setText(r.text)
    setFiles(files.map((x) => (x.key === fk ? { ...x, doubts: r.doubts, trAdded: r.trAdded } : x)))
  }
  const viewWords = !desk && pickable && showing && !rec
  const doubtsView: DoubtsView | null = !h.heard
    ? null
    : desk && h.composePage
      ? altOpen
        ? { kind: 'card', toCheck: altOpen }
        : null
      : !desk
        ? pickable
          ? { kind: 'phone', toCheck: altOpen, showing: viewWords }
          : null
        : open.length
          ? { kind: 'list', lines: open }
          : null
  const doubts = doubtsView ? <Doubts view={doubtsView} on={{ use: (fk, k) => pickWord(fk, k, 'alt'), show: () => setShowing(true) }} /> : h.doubts
  const words = viewWords ? <DraftWords text={text} spots={spots} className={BOX_WORDS_LOOK} on={{ pick: pickWord, escape: () => {}, plain: () => setShowing(false) }} /> : undefined
  const recShown = rec ? (rec.t0 == null ? { ...REC, from: rec.from } : { ...REC, from: rec.from, time: clock(Math.max(0, now - rec.t0)) }) : null
  return (
    <div className="bg-zinc-50 p-3 dark:bg-zinc-950">
      <Composer
        attach={shown.attach}
        line={shown.line}
        lineOn={{
          stop: () => (setMode(null), setPicked({ ...picked, reply: null })),
          unpick: () => setPicked({ reply: null, quote: null, sel: [] }),
          discard: () => (setText(''), boxActs.discard()),
          sendTicks: () => (setTicked(null), boxActs.sendTicks()),
          clearTicks: () => setTicked(null),
          toItem: boxActs.toItem,
        }}
        waiting={shown.waiting}
        placeholder={shown.placeholder}
        sendWord={shown.send}
        text={text}
        desk={desk}
        composePage={desk && !!h.composePage}
        micTip="Voice note · V"
        hasFiles={files.length > 0}
        files={
          files.length ? (
            <DraftFiles
              files={files}
              url={(f) => files.find((x) => x.f === f)?.preview ?? '#'}
              onRemove={(k) => setFiles(files.filter((x) => x.key !== k))}
              onView={(k) => {
                const pics = files.filter((x) => (x.mime || '').startsWith('image/')).map((x) => x.f)
                const f = files.find((x) => x.key === k)?.f
                if (f) media.on.view(f, pics)
              }}
            />
          ) : undefined
        }
        doubts={doubts}
        words={words}
        rec={recShown}
        on={{
          text: setText,
          send: () => {
            boxActs.send(text)
            setText('')
            setFiles([])
            setMode(null)
          },
          // the files you picked go in the draft, as the page's box.attach puts them
          attach: (list) => setFiles([...files, ...list.map((f, i) => ({ key: `a${files.length + i}`, f: `f${files.length + i}-${f.name}`, name: f.name, mime: f.type, preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined }))]),
          mic: (aux) => {
            setNow(Date.now())
            setRec({ from: aux ? 'aux' : 'main', t0: Date.now() })
          },
          recCancel: stopRec,
          recStop: () => (stopRec(), boxActs.recStop()),
          recSend: () => (stopRec(), boxActs.recSend()),
        }}
        {...extra}
      />
      {media.node}
    </div>
  )
}

const noLine = acts('Sent line', ['dismiss', 'undo', 'retry', 'edit', 'view', 'undoFiling', 'move', 'retryOrganizer'] as const, { move: 'Move and pick › Input to another project', edit: 'Input box › What it writes to › Changing what you said' })

/** The line over the box about what you sent last, as the page works it out (feedbackLine): what is on its way, or
 * what became of the input you sent. */
type SentFacts = { mine?: Outgoing[]; sent?: Input; organizer?: boolean; others?: boolean; undoable?: boolean }
export const sentLine = (f: SentFacts, desk: boolean) => <LiveLine f={f} desk={desk} />
/** the line as the page keeps it: Dismiss lets it go; Undo, Retry, View, Move need Taska (the Actions panel) */
function LiveLine({ f, desk }: { f: SentFacts; desk: boolean }) {
  const [gone, setGone] = useState(false)
  const m = boxProject(f.sent ? [f.sent] : [], f.organizer)
  const r = feedbackLine({ m, desk, composePage: false, scope: null, mine: f.mine ?? [], lastSent: f.sent?.id ?? null, others: !!f.others, undoable: () => !!f.undoable })
  return (
    <div className="bg-zinc-50 p-3 dark:bg-zinc-950">
      <Feedback line={gone ? null : (r?.line ?? null)} on={{ ...noLine, dismiss: () => setGone(true) }} />
    </div>
  )
}

/** Something you sent, on its way. */
export const out = (f: Partial<Outgoing> = {}): Outgoing => ({ q: 'q1', slug: 'demo', text: 'Buy milk on the way home', scope: null, files: [], t: 0, state: 'sending', tries: 0, ...f })
