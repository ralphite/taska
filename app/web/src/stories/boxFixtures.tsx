// The box where it is, as the page works it out: a demo project (F012 with its documents D1 and D2, a voice note's
// input r7), where you are, what is picked or ticked in a document, what the box is in and holds; the box's line,
// placeholder and Send come from the page's own boxRole and shownBox, and the page's Composer draws it. Used by the
// input box's stories.
import type { ReactNode } from 'react'
import { Composer, Feedback, type ComposerProps } from '../features/composer/Composer'
import { DraftFiles, type DraftFile } from '../features/composer/DraftFiles'
import { boxRole, feedbackLine, shownBox, type BoxMode } from '../model/boxFoot'
import { blockKeys } from '../model/docs'
import type { Outgoing } from '../model/outgoing'
import { parseRoute } from '../model/route'
import type { Input } from '../model/types'
import { input, item, modelOf } from './fixtures'
import { comment, doc } from './itemFixtures'

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
  organizer?: boolean
  composePage?: boolean
  doubts?: ReactNode
}

export const boxProject = (inputs: Input[] = [VOICE_INPUT], organizer = false) =>
  modelOf([item({ n: 12 })], inputs, { organizer: { on: organizer, model: 'gemini-flash-latest', busy: null } }, [PLAN, WEB])

export function boxAt(h: Here, desk: boolean, extra: Partial<ComposerProps> = {}) {
  const m = boxProject([VOICE_INPUT], h.organizer)
  const route = parseRoute(`/p/demo/${h.at ?? ''}`, '')
  if (route.page !== 'project') throw new Error('not a project')
  const pick = { reply: h.reply ?? null, quote: h.quote ?? null, sel: new Set(h.sel ?? []) }
  const mine: Record<number, Record<string, string>> = h.at === 'D1' && h.ticks ? { 1: h.ticks } : {}
  const ticks = { mine, going: {}, open: new Set<string>() }
  const role = boxRole(m, route, desk, 'demo', h.mode ?? null, pick, ticks)
  const text = h.text ?? ''
  const shown = shownBox(role, { mode: h.mode ?? null, text, key: 'here', recordingFor: h.recordingFor ?? null })
  const files = h.files ?? []
  return (
    <div className="bg-zinc-50 p-3 dark:bg-zinc-950">
      <Composer
        line={shown.line}
        placeholder={shown.placeholder}
        sendWord={shown.send}
        text={text}
        desk={desk}
        composePage={desk && !!h.composePage}
        micTip="Voice note · V"
        hasFiles={files.length > 0}
        files={files.length ? <DraftFiles files={files} url={() => '#'} onRemove={() => {}} onView={() => {}} /> : undefined}
        doubts={h.doubts}
        rec={h.rec ? REC : null}
        on={{ text() {}, send() {}, attach() {}, mic() {} }}
        {...extra}
      />
    </div>
  )
}

const noLine = { dismiss() {}, undo() {}, retry() {}, edit() {}, view() {}, undoFiling() {}, move() {}, retryOrganizer() {} }

/** The line over the box about what you sent last, as the page works it out (feedbackLine): what is on its way, or
 * what became of the input you sent. */
export function sentLine(f: { mine?: Outgoing[]; sent?: Input; organizer?: boolean; others?: boolean; undoable?: boolean }, desk: boolean) {
  const m = boxProject(f.sent ? [f.sent] : [], f.organizer)
  const r = feedbackLine({ m, desk, composePage: false, scope: null, mine: f.mine ?? [], lastSent: f.sent?.id ?? null, others: !!f.others, undoable: () => !!f.undoable })
  return (
    <div className="bg-zinc-50 p-3 dark:bg-zinc-950">
      <Feedback line={r?.line ?? null} on={noLine} />
    </div>
  )
}

/** Something you sent, on its way. */
export const out = (f: Partial<Outgoing> = {}): Outgoing => ({ q: 'q1', slug: 'demo', text: 'Buy milk on the way home', scope: null, files: [], t: 0, state: 'sending', tries: 0, ...f })
