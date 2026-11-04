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
import { otherTabs, searchWords } from '../model/visible'
import { SearchHints } from '../ui/SearchHints'
import { FileChips } from '../ui/Files'
import { RecBar } from '../ui/PlaceVoice'
import { PROJECT_TONES } from '../ui/tones'
import { PICTURE, T, input, item, modelOf } from './fixtures'
import { talkEnv } from './itemFixtures'

const at = (min: number) => new Date(Date.parse(T) - min * 60_000).toISOString()
const org = (msg: string, f: Partial<OrgNote> = {}): OrgNote => ({ ok: true, msg, t: '', keep: false, changed: true, undone: false, ...f })
export const SHOT: FileRef = { f: 'f3-export.png', name: 'export.png', mime: 'image/png' }
export const VOICE: FileRef = { f: 'f4-voice_0-12.webm', name: 'voice_0-12.webm', mime: 'audio/webm' }

/** The items what you said made or changed. */
export const ITEMS: Item[] = [
  item({ n: 12, title: 'Export keeps the filter you set' }),
  item({ n: 14, type: 'bug', pri: 'P1', title: 'Coupon box hidden behind the keyboard' }),
  item({ n: 7, type: 'task', title: 'Which formats should the export offer?' }),
]

/** One input in each state it can be in. */
export const ONE = {
  waiting: input({ id: 'r23', t: at(2), text: 'The export button does nothing on the orders page.', files: [SHOT] }),
  voice: input({ id: 'r22', t: at(6), acked: true, touched: [12], text: 'Keep the filter, and the sort as well.', files: [VOICE], org: org('Noted on F012') }),
  transcribing: input({ id: 'r21', t: at(1), text: '', files: [VOICE], trWait: true }),
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
  cancelled: input({ id: 'r24', t: at(3), kind: 'cancelled', text: 'Maybe the export should keep the columns too.', files: [VOICE] }),
  long: input({ id: 'r9', t: at(60 * 24), acked: true, touched: [7], org: org('Created T007'), text: Array.from({ length: 8 }, (_, i) => `Step ${i + 1}: open the orders page, set a filter, export.`).join('\n') }),
}

/** A usual day's inputs, newest first by day: today's and yesterday's. */
export const DAY: Input[] = [ONE.waiting, ONE.voice, ONE.made, ONE.added, ONE.failed, ONE.moved, ONE.answer, ONE.long]

export interface Said {
  inputs?: Input[]
  /** the organizer is on (the default, as Taska is normally used; false: the story is the organizer off) and which
   * input it is on now */
  organizer?: boolean
  busy?: string
  q?: string
  outbox?: Outgoing[]
  /** how long Taska has not answered */
  away?: number
  opened?: string[]
  /** just sent: Undo shows on these */
  justSent?: string[]
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
const project = (s: Said, items = ITEMS) => modelOf(items, s.inputs ?? DAY, { organizer: { on: s.organizer ?? true, model: 'gemini-flash-latest', busy: s.busy ?? null } })
const chips = (f: FileRef[]) => <FileChips files={f} url={(x) => (x.endsWith('.png') ? PICTURE : '#' + x)} play={() => ({ playing: false, t: null })} tidy on={{ play() {}, words() {}, view() {} }} />
const noInput: InputEvents = { goto() {}, more() {}, menu() {}, retry() {}, send() {}, draft() {}, moved() {}, ref() {}, picture() {}, outboxRetry() {}, outboxEdit() {}, end() {} }

function rowsOf(s: Said) {
  const m = project(s)
  const words = searchWords(s.q ?? '')
  const drafts = Object.fromEntries((s.editDrafts ?? []).map((id) => [draftKey({ kind: 'amend', mode: 'edit', id }), 'my edit']))
  const { rows, total } = inputRows(m, { words, title, opened: new Set(s.opened), drafts, writing: null, lit: s.lit ?? null, litStill: !!s.litStill, upTo: 40 })
  return { m, words, rows, total }
}

/** The phone's Inputs tab as the page draws it. */
export function inputsOf(s: Said = {}) {
  const { m, words, rows, total } = rowsOf(s)
  const hints = words.length ? <SearchHints other={otherTabs(m, words, 'inputs', total)} cross={{ list: [], failed: false, q: words.join(' ') }} tone={() => PROJECT_TONES[1]} onShow={() => {}} onGo={() => {}} /> : null
  return (
    <div className="flex h-full flex-col">
      <InputsView hidden={false} rows={rows} more={total > rows.length} outgoing={outgoingRows(s.outbox ?? [], 'demo', s.away ?? 0)} words={words} world={talkEnv(m, false).world} hints={hints} files={chips} recording={s.recording ?? null} on={noInput} />
    </div>
  )
}

/** One input as a row of the phone's Inputs tab draws it. */
export function cardOf(r: Input, s: Said = {}) {
  const { m, rows } = rowsOf({ ...s, inputs: [r] })
  return <InputCard x={rows[0]} words={[]} world={talkEnv(m, false).world} files={chips} on={noInput} />
}

/** One input as a row of the New input page's list draws it (the desktop). */
export function saidRowOf(r: Input, s: Said = {}) {
  const m = project({ ...s, inputs: [r] })
  const drafts = Object.fromEntries((s.editDrafts ?? []).map((id) => [draftKey({ kind: 'amend', mode: 'edit', id }), 'my edit']))
  const x = saidRows(m, { words: [], upTo: 1, opened: new Set(s.opened), justSent: (s.justSent ?? []).map((rid) => ({ rid })), drafts, mode: null, title }).rows[0]
  return (
    <div className="px-6 py-3">
      <SaidRow x={x} files={r.files.length ? chips(r.files) : null} on={noSaid} />
    </div>
  )
}

const noSaid: SaidEvents = { goto() {}, more() {}, append() {}, voice() {}, draft() {}, menu() {}, undoSend() {}, retry() {}, send() {}, outboxRetry() {}, outboxEdit() {}, discard() {}, loadMore() {}, moved() {} }

/** What you said lately under the New input page's box (the desktop), as the page draws it. */
export function saidOf(s: Said = {}) {
  const m = project(s)
  const drafts = Object.fromEntries((s.editDrafts ?? []).map((id) => [draftKey({ kind: 'amend', mode: 'edit', id }), 'my edit']))
  const said = saidRows(m, { words: [], upTo: 30, opened: new Set(s.opened), justSent: (s.justSent ?? []).map((rid) => ({ rid })), drafts, mode: null, title, adding: new Set(s.addingUp) })
  return (
    <div className="mx-auto mt-5 max-w-[660px]">
      <SaidLately
        rows={said.rows}
        outgoing={saidOutgoing(s.outbox ?? [], [], s.away ?? 0, (s.justSent ?? []).map((q) => ({ q })))}
        more={said.all.length > said.rows.length}
        files={chips}
        recording={s.recording ?? null}
        adding={s.adding ? { id: s.adding.id, meter: <RecBar time={s.adding.clock} levels={[0.3, 0.75, 0.5, 0.95, 0.4, 0.65]} /> } : null}
        on={noSaid}
      />
    </div>
  )
}
