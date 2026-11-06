// What you said in a demo project, as the page works it out: the Inputs tab's rows come from the page's own inputRows
// and outgoingRows, the New input page's list from saidRows and saidOutgoing, and the page's InputsView, InputCard and
// SaidLately draw them. Used by the Inputs stories.
import { draftKey } from '../model/draftTarget'
import { InputCard, InputsView, type InputEvents } from '../features/inputs/InputsView'
import { inputRows, outgoingRows } from '../features/inputs/inputRows'
import { SaidLately, SaidRow, type SaidEvents } from '../features/composer/SaidLately'
import type { Outgoing } from '../model/outgoing'
import { saidOutgoing, saidRows } from '../model/saidLately'
import type { FileRef, Input, Item, OrgNote } from '../model/types'
import { FileChips } from '../ui/Files'
import { RecBar } from '../ui/PlaceVoice'
import { PICTURE, T, input, item, modelOf, record, shown, waiting } from './fixtures'
import { talkEnv } from './itemFixtures'
import { inputWords } from '../ui/Markdown'
import type { ProjectModel } from '../model/project'
import { acts } from './acts'
import { useMedia, usePop } from './liveParts'
import { useState } from 'react'
import { inputMenuSheet } from '../features/inputs/InputSheets'
import { inputDeleteAsk, inputMenuFacts } from '../features/inputs/inputSheetFacts'

const at = (min: number) => new Date(Date.parse(T) - min * 60_000).toISOString()
const org = (msg: string, f: Partial<OrgNote> = {}): OrgNote => ({ ok: true, msg, t: '', keep: false, changed: true, undone: false, ...f })
export const SHOT: FileRef = { f: 'f3-export.png', name: 'export.png', mime: 'image/png' }
/** a voice note before its words are in (still being written out) */
export const VOICE: FileRef = { f: 'f4-voice_0-12.webm', name: 'voice_0-12.webm', mime: 'audio/webm' }
/** a voice note with its words: its record (B682), as the page's model puts it with the note */
export const said = (tr: string, heard?: string): FileRef => ({ ...VOICE, voice: record(VOICE.f, tr, heard ?? tr) })

/** The items what you said made or changed. */
export const ITEMS: Item[] = [
  item({ n: 12, title: 'Export keeps the filter you set' }),
  item({ n: 14, type: 'bug', pri: 'P1', title: 'Coupon box hidden behind the keyboard' }),
  item({ n: 7, type: 'task', title: 'Which formats should the export offer?' }),
]

/** One input in each state it can be in. */
export const ONE = {
  waiting: input({ id: 'r23', t: at(2), text: 'The export button does nothing on the orders page.', files: [SHOT] }),
  voice: shown(input({ id: 'r22', t: at(6), acked: true, touched: [12], text: '', files: [said('Keep the filter, and the sort as well.', 'Keep the filter, and, um, the sort as well.')], org: org('Noted on F012') })),
  transcribing: shown(input({ id: 'r21', t: at(1), text: '', files: [VOICE] }), waiting(VOICE.f)),
  organizing: input({ id: 'r20', t: at(1), text: 'The coupon box hides behind the keyboard.' }),
  made: input({ id: 'r19', t: at(20), acked: true, touched: [14], text: 'The coupon box hides behind the keyboard on the phone.', org: org('Created B014') }),
  added: input({ id: 'r18', t: at(25), acked: true, touched: [12], text: 'It should keep the sort too, not only the filter.', org: org('Noted on F012') }),
  left: input({ id: 'r17', t: at(30), text: 'Look at why the build takes so long.', org: org('Left for your coding agent', { keep: true, changed: false }) }),
  handled: input({ id: 'r16', t: at(35), acked: true, text: 'Look at why the build takes so long.', org: org('Left for your coding agent', { keep: true, changed: false }) }),
  failed: input({ id: 'r14', t: at(45), text: 'The coupon box is in the way.', org: org('No changes needed · Some commands failed: err: B99 not found', { ok: false, changed: false }) }),
  keyRefused: input({ id: 'r14', t: at(45), text: 'The coupon box is in the way.', org: org('Gemini HTTP 401: API key not valid', { ok: false, changed: false }) }),
  undone: input({ id: 'r13', t: at(50), text: 'The coupon box hides behind the keyboard.', org: org('Created B015', { undone: true }) }),
  edited: input({
    id: 'r12',
    t: at(55),
    acked: true,
    touched: [12],
    text: 'The export should keep the filter and the sort I set.',
    org: org('Noted on F012'),
    history: [{ text: 'The export should keep the filter I set.', t: at(55), mode: 'edit' }],
    updated: at(50),
  }),
  moved: input({ id: 'r11', t: at(60), acked: true, text: 'The app icon looks blurry on the home screen.', moved: { to: 'mobile-app', as: 'r4' } }),
  answer: input({ id: 'r10', t: at(65), acked: true, kind: 'answer', scope: 7, text: 'CSV and Excel.' }),
  /** a recording cancelled with Esc, kept with its words: no one's work until it is sent (B627) */
  cancelled: shown(input({ id: 'r24', t: at(3), kind: 'cancelled', text: '', files: [said('Maybe the export should keep the columns too.', 'Maybe the export should, hmm, keep the columns too.')] })),
  long: input({ id: 'r9', t: at(60 * 24), acked: true, touched: [7], org: org('Created T007'), text: [
      'Work out which formats the export should offer.',
      'Finance opens the file in Excel every Monday, so Excel matters most.',
      'CSV is what the warehouse script reads; it must stay as it is.',
      'Ask whether anyone still needs PDF; I think no one prints these.',
      'Whatever we pick, the file keeps the filter and the sort the list shows.',
      'The columns come in the same order as on the screen.',
      'Dates use the format chosen in Settings, not ISO.',
      'Write down what we decide, and why, before anyone starts on it.',
    ].join('\n'),
  }),
}

/** A usual day's inputs, newest first by day: today's and yesterday's. */
export const DAY: Input[] = [ONE.waiting, ONE.voice, ONE.made, ONE.added, ONE.failed, ONE.moved, ONE.answer, ONE.long]

export interface Said {
  inputs?: Input[]
  /** the organizer is on (the default, as Taska is normally used; false: the story is the organizer off) and which
   * input it is on now */
  organizer?: boolean
  busy?: string
  outbox?: Outgoing[]
  /** how long Taska has not answered */
  away?: number
  opened?: string[]
  /** an edit not saved, by input */
  editDrafts?: string[]
  /** jumped to this input (lit; `litStill`: stays lit) */
  lit?: string
  litStill?: boolean
  /** a voice note being recorded into a new input: how long so far */
  recording?: string
  /** more being said into this input on its own line (its Voice), and how long so far */
  adding?: { id: string; clock: string }
  /** stopped there: on its way to these inputs */
  addingUp?: string[]
}

const title = (slug: string) => ({ 'mobile-app': 'Mobile app' })[slug] ?? slug
const project = (s: Said, items = ITEMS) => modelOf(items, s.inputs ?? DAY, { organizer: { on: s.organizer ?? true, model: 'gemini-flash-latest', busy: s.busy ? [s.busy] : [] } })
const fileUrl = (x: string) => (x.endsWith('.png') ? PICTURE : '#' + x)
const swipeActs = acts('Input swipe', ['open'] as const)
const inputActs = acts('Input', ['goto', 'retry', 'send', 'draft', 'moved', 'ref', 'outboxRetry', 'outboxEdit', 'end', 'append', 'loadMore'] as const, { append: 'Input box › What it writes to › Changing what you said', draft: 'Input box › What it writes to › Changing what you said' })
const menuActs = acts('Input menu', ['send', 'edit', 'append', 'asSaid', 'undo', 'move', 'history', 'rescope', 'takeOff', 'remove'] as const, {
  move: 'Move and pick › Input to another project',
  history: 'Sheets › An input: its words and history',
  edit: 'Input box › What it writes to › Changing what you said',
  append: 'Input box › What it writes to › Changing what you said',
})

/** An input's menu from its ⋯, as the page's InputMenuSheet runs it (Take off and Delete ask again); also the menu of
 * your message in an item's talk. */
export type InputMenuAt = { id: string; asked: Record<string, number> }
export function inputMenuParts(m: ProjectModel, desk: boolean, { id, asked }: InputMenuAt, menu: { close(): void; change(w: InputMenuAt): void }) {
  const r = m.byId.get(id)!
  const done = (run: () => void) => () => (menu.close(), run())
  const ask = (key: string, run: () => void) => (asked[key] ? (menu.close(), run()) : menu.change({ id, asked: { ...asked, [key]: 1 } }))
  return inputMenuSheet(inputMenuFacts(m, r, 2, asked, desk, true), {
    send: done(() => menuActs.send(id)),
    edit: done(() => menuActs.edit(id)),
    append: done(() => menuActs.append(id)),
    asSaid: menuActs.asSaid,
    undo: done(() => menuActs.undo(id)),
    move: done(() => menuActs.move(id)),
    history: done(() => menuActs.history(id)),
    rescope: done(() => menuActs.rescope(id)),
    takeOff: (f) => ask(`unfile ${id} ${f}`, () => menuActs.takeOff(f)),
    remove: () => ask(inputDeleteAsk(id), () => menuActs.remove(id)),
  })
}

/** What the page holds around inputs (T662): a long one opened (More, Less), its menu from ⋯ (the page's own
 * inputMenuSheet: Take off and Delete ask again), Voice recording more for one (its strip; again or ✕ stops it),
 * voice notes playing and pictures opening, one on its way cancelled with its × (it goes). What needs Taska (Retry,
 * Send, Undo organizing, Move, Delete) shows in the Actions panel. */
export function useInputs(m: ProjectModel, desk: boolean, s: Pick<Said, 'opened' | 'adding'>) {
  const [opened, setOpened] = useState(() => new Set(s.opened))
  const [adding, setAdding] = useState(s.adding ?? null)
  // on its way, cancelled with its ×
  const [cancelled, setCancelled] = useState<ReadonlySet<string>>(() => new Set())
  const cancel = (q: string) => setCancelled(new Set([...cancelled, q]))
  const media = useMedia(fileUrl)
  const menu = usePop<{ id: string; asked: Record<string, number> }>(desk)
  const more = (id: string) => {
    const next = new Set(opened)
    if (!next.delete(id)) next.add(id)
    setOpened(next)
  }
  const chips = (f: FileRef[]) => <FileChips files={f} url={fileUrl} play={media.play} tidy on={media.on} />
  const openMenu = (id: string, from?: HTMLElement) => menu.open({ id, asked: {} }, from, desk ? { at: undefined } : {})
  const menuNode = menu.draw((w) => inputMenuParts(m, desk, w, menu))
  const node = (
    <>
      {menuNode}
      {media.node}
    </>
  )
  // the phone's swipe (D115 #42): right opens what it became, left Move and Delete, held its menu
  const swipe = { right: (id: string) => ({ slide: false, run: () => swipeActs.open(id) }), hold: (id: string) => openMenu(id), blocked: () => false }
  const inputOn: InputEvents = { ...inputActs, more, menu: (id) => openMenu(id), picture: (f, all) => media.on.view(f, all), outboxCancel: cancel, moveInput: menuActs.move, remove: menuActs.remove, swipe }
  const saidOn: SaidEvents = {
    ...inputActs,
    more,
    cancel,
    menu: (id, from) => openMenu(id, from),
    // Voice on a row records more for it (its strip); again it stops and is added (Taska), ✕ lets it go
    voice: (id) => (adding?.id === id ? (setAdding(null), inputActs.append(id)) : setAdding({ id, clock: '0:00' })),
    discard: () => setAdding(null),
  }
  /** what is on its way, less what was cancelled */
  const going = (list: readonly Outgoing[] = []) => list.filter((o) => !cancelled.has(o.q))
  // an input's words as the page draws them everywhere (Markdown, r1099)
  const words = inputWords(talkEnv(m, desk).world, { picture: (f, all) => media.on.view(f, all) })
  return { opened, adding, chips, inputOn, saidOn, node, going, words }
}

function rowsOf(s: Said, opened: ReadonlySet<string>) {
  const m = project(s)
  const drafts = Object.fromEntries((s.editDrafts ?? []).map((id) => [draftKey({ kind: 'amend', mode: 'edit', id }), 'my edit']))
  const { rows, total } = inputRows(m, { title, opened, drafts, writing: null, lit: s.lit ?? null, litStill: !!s.litStill, upTo: 40 })
  return { m, rows: rows.map((x) => ({ ...x, movable: true })), total }
}

/** The phone's Inputs tab as the page draws it. */
export const inputsOf = (s: Said = {}) => <LiveInputs s={s} />
function LiveInputs({ s }: { s: Said }) {
  const live = useInputs(project(s), false, s)
  const { m, rows, total } = rowsOf(s, live.opened)
  return (
    <div className="flex h-full flex-col">
      <InputsView hidden={false} rows={rows} more={total > rows.length} outgoing={outgoingRows(live.going(s.outbox), 'demo', s.away ?? 0)} world={talkEnv(m, false).world} files={live.chips} recording={s.recording ?? null} on={live.inputOn} />
      {live.node}
    </div>
  )
}

/** One input as a row of the phone's Inputs tab draws it. */
export const cardOf = (r: Input, s: Said = {}) => <LiveCard r={r} s={s} />
function LiveCard({ r, s }: { r: Input; s: Said }) {
  const live = useInputs(project({ ...s, inputs: [r] }), false, s)
  const { m, rows } = rowsOf({ ...s, inputs: [r] }, live.opened)
  return (
    <>
      <InputCard x={rows[0]} world={talkEnv(m, false).world} files={live.chips} on={live.inputOn} />
      {live.node}
    </>
  )
}

/** One input as a row of the New input page's list draws it (the desktop). */
export const saidRowOf = (r: Input, s: Said = {}) => <LiveSaidRow r={r} s={s} />
function LiveSaidRow({ r, s }: { r: Input; s: Said }) {
  const m = project({ ...s, inputs: [r] })
  const live = useInputs(m, true, s)
  const drafts = Object.fromEntries((s.editDrafts ?? []).map((id) => [draftKey({ kind: 'amend', mode: 'edit', id }), 'my edit']))
  const x = saidRows(m, { upTo: 1, opened: live.opened, drafts, mode: null, title }).rows[0]
  return (
    <div className="px-6 py-3">
      <SaidRow x={x} files={r.files.length ? live.chips(r.files) : null} words={live.words} lit={s.lit === r.id} on={live.saidOn} />
      {live.node}
    </div>
  )
}

/** What you said lately under the New input page's box (the desktop), as the page draws it. */
export const saidOf = (s: Said = {}) => <LiveSaid s={s} />
function LiveSaid({ s }: { s: Said }) {
  const m = project(s)
  const live = useInputs(m, true, s)
  const drafts = Object.fromEntries((s.editDrafts ?? []).map((id) => [draftKey({ kind: 'amend', mode: 'edit', id }), 'my edit']))
  const said = saidRows(m, { upTo: 30, lit: s.lit, opened: live.opened, drafts, mode: null, title, adding: new Set(s.addingUp) })
  return (
    <div className="mx-auto mt-8 max-w-[42rem]">
      <SaidLately
        words={live.words}
        rows={said.rows}
        outgoing={saidOutgoing(live.going(s.outbox), s.away ?? 0)}
        lit={s.lit}
        more={said.all.length > said.rows.length}
        files={live.chips}
        recording={s.recording ?? null}
        adding={live.adding ? { id: live.adding.id, meter: <RecBar time={live.adding.clock} levels={[0.3, 0.75, 0.5, 0.95, 0.4, 0.65]} /> } : null}
        on={live.saidOn}
      />
      {live.node}
    </div>
  )
}
