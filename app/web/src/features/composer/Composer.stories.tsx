import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../../stories/Frames'
import { item, modelOf } from '../../stories/fixtures'
import { comment, doc } from '../../stories/itemFixtures'
import { boxRole, shownBox, type BoxMode, type FeedbackLine } from '../../model/boxFoot'
import { blockKeys, threadKey } from '../../model/docs'
import { parseRoute } from '../../model/route'
import { Composer, Feedback, type ComposerProps } from './Composer'
import { DraftFiles, type DraftFile } from './DraftFiles'

const meta: Meta = { title: 'Components/Box' }
export default meta
type Story = StoryObj

const on: ComposerProps['on'] = { text() {}, send() {}, attach() {}, mic() {} }
const box = (desk: boolean, p: Partial<ComposerProps> = {}) => (
  <div className="bg-zinc-50 p-3 dark:bg-zinc-950">
    <Composer line={null} placeholder="Write to taska…" sendWord="Send" text="" desk={desk} composePage={false} micTip="Voice note · V" on={on} {...p} />
  </div>
)

/** The one input box: empty, with words, with its line on top. */
export const Box: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={720}>
      {(layout) => {
        const desk = layout === 'desk'
        return (
          <States
            items={[
              ['empty: the mic', box(desk)],
              ['a reply to an item', box(desk, { placeholder: 'Reply to F012…' })],
              ['words: Send', box(desk, { text: 'The export should keep the filter' })],
              ['many lines (the buttons go under the words on the desktop)', box(desk, { text: 'First line\nSecond line\nThird line' })],
              ['its line: New input', box(desk, { line: { icon: 'newinput', label: 'New input', detail: '· your agent files it' } })],
            ]}
          />
        )
      }}
    </Frames>
  ),
}

/** Its line on top, for each thing it writes to: an edit of what you said (Stop), a recording made for another draft.
 * On a document: the stories after these. */
export const Lines: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={720}>
      {(layout) => {
        const desk = layout === 'desk'
        return (
          <States
            items={[
              ['an edit of what you said', box(desk, { line: { icon: 'pencil', label: 'Edit #7', detail: '\u201cKeep the filter\u201d', right: { kind: 'x', label: 'Stop editing', act: 'stop' } } })],
              ['recording for another draft', box(desk, { line: { icon: 'mic', label: 'Recording for F12', detail: '· it goes there when you stop' } })],
            ]}
          />
        )
      }}
    </Frames>
  ),
}

const noop = { dismiss() {}, undo() {}, retry() {}, edit() {}, view() {}, undoFiling() {}, move() {}, retryOrganizer() {} }
const line = (l: FeedbackLine) => (
  <div className="bg-zinc-50 p-3 dark:bg-zinc-950">
    <Feedback line={l} on={noop} />
  </div>
)

/** The line over the box: what happened to what you sent. */
export const SentLines: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={720}>
      {() => (
        <States
          items={[
            ['sending', line({ kind: 'sending', text: 'Buy milk on the way home', more: 0, uploading: false, canUndo: true })],
            ['uploading, then sending (+1)', line({ kind: 'sending', text: 'Voice note', more: 1, uploading: true, canUndo: false })],
            ['waiting for Taska (it is away)', line({ kind: 'waiting', text: 'Buy milk on the way home', more: 0 })],
            ['not sent (Taska said no)', line({ kind: 'not-sent', text: 'Buy milk on the way home', more: 0 })],
            ['sent, waiting for your agent', line({ kind: 'sent', organizer: false, canUndo: false, move: true })],
            ['sent, organizing', line({ kind: 'organizing' })],
            ['organized', line({ kind: 'organized', msg: 'Created T10', view: true, undo: true, move: true })],
            ['the organizer failed', line({ kind: 'org-failed', msg: 'Gemini HTTP 503: overloaded' })],
            ['moved to another project', line({ kind: 'moved', code: '#12', to: 'home', as: '#40', href: '#' })],
          ]}
        />
      )}
    </Frames>
  ),
}

// ---------------------------------------------------------------- on a document (T550)

// F012 and its documents: D1 (paragraphs, a comment on the first, a list to tick) and D2 (a web page)
const plan = doc({
  d: 1,
  n: 12,
  blocks: [
    { key: 'k1', kind: 'para', text: 'The export keeps the filter.', comments: [comment({ id: 9, quote: '' })] },
    { key: 'k2', kind: 'para', text: 'Its file name says which filter.', comments: [] },
    { key: 'k3', kind: 'list', text: '- [ ] CSV\n- [ ] Excel', comments: [] },
  ],
})
const web = doc({ d: 2, n: 12, fmt: 'html', title: 'Orders dashboard', blocks: [{ key: 'p1', kind: 'html', text: 'Avg. order value', comments: [] }] })
const project = modelOf([item({ n: 12 })], [], {}, [plan, web])
const ticked = { [blockKeys(plan)[2]]: '- [x] CSV\n- [ ] Excel' }
const voice: DraftFile = { key: 'v', f: 'f5-voice_0-09.webm', name: 'voice_0-09.webm', mime: 'audio/webm', ms: 9000 }

/** Where you are and what the box holds: the document open (none: its item), what is picked in it (paragraphs, words
 * or a web page's part, a thread to reply in), lists ticked, an edit of your comment, the words, a recording, files. */
interface Here {
  d?: number
  sel?: string[]
  quote?: { key: string; text: string }
  reply?: string
  ticks?: Record<string, string>
  mode?: BoxMode
  text?: string
  rec?: boolean
  files?: DraftFile[]
}

/** The box there, as the page works it out (boxRole, shownBox). */
function boxAt(h: Here, desk: boolean) {
  const route = parseRoute(`/p/demo/${h.d ? 'D' + h.d : 'F012'}`, '')
  if (route.page !== 'project') throw new Error('not a project')
  const pick = { reply: h.reply ?? null, quote: h.quote ?? null, sel: new Set(h.sel ?? []) }
  const ticks = { mine: h.d && h.ticks ? { [h.d]: h.ticks } : {}, going: {}, open: new Set<string>() }
  const role = boxRole(project, route, desk, 'demo', h.mode ?? null, pick, ticks)
  const text = h.text ?? ''
  const shown = shownBox(role, { mode: h.mode ?? null, text, key: '', recordingFor: null })
  const files = h.files ?? []
  return box(desk, {
    line: shown.line,
    placeholder: shown.placeholder,
    sendWord: shown.send,
    text,
    hasFiles: files.length > 0,
    files: files.length ? <DraftFiles files={files} url={() => '#'} onRemove={() => {}} onView={() => {}} /> : undefined,
    rec: h.rec ? { time: '0:04', levels: [0.2, 0.5, 0.8, 0.4, 0.6, 0.3, 0.7, 0.5], from: 'main' } : null,
  })
}

const states = (list: [string, Here][]) => (
  <Frames phoneWidth={393} deskWidth={720}>
    {(layout) => <States items={list.map(([name, h]) => [name, boxAt(h, layout === 'desk')])} />}
  </Frames>
)

/** The box while you comment on a document: nothing picked (the desktop replies on its item; the phone comments on
 * the whole document), paragraphs or words picked, typing, a voice note, voice comments waiting, a reply in a
 * thread, an edit of your comment, choices ticked, a web page's part. */
export const OnADocument: Story = {
  render: () =>
    states([
      ['nothing picked', { d: 1 }],
      ['a paragraph picked', { d: 1, sel: ['k1'] }],
      ['two paragraphs picked', { d: 1, sel: ['k1', 'k2'] }],
      ['words picked in a paragraph', { d: 1, quote: { key: 'k2', text: 'which filter' } }],
      ['a paragraph picked, typing', { d: 1, sel: ['k1'], text: 'Also keep the sort.' }],
      ['a paragraph picked, recording', { d: 1, sel: ['k1'], rec: true }],
      ['a paragraph picked, its voice note transcribing', { d: 1, sel: ['k1'], files: [{ ...voice, tr: '', transcribing: true }] }],
      ['a paragraph picked, its voice note’s words in the box', { d: 1, sel: ['k1'], text: 'Keep the sort too.', files: [{ ...voice, tr: 'Keep the sort too.' }] }],
      ['voice comments not sent, each under its quote', { d: 1, text: '> “The export keeps the filter.”\nKeep the sort too.\n\n> “Its file name says which filter.”\nAnd the date.' }],
      ['replying in a thread', { d: 1, reply: threadKey(plan.blocks[0].comments[0]) }],
      ['editing your comment', { d: 1, mode: { kind: 'comment', d: 1, id: 9, was: 'Yes, and its name says which filter.' }, text: 'Yes, and its name says which filter.' }],
      ['choices ticked, not sent', { d: 1, ticks: ticked }],
      ['choices ticked, then a paragraph picked', { d: 1, ticks: ticked, sel: ['k1'] }],
      ['a web page’s part picked, typing', { d: 2, quote: { key: 'p1', text: 'Avg. order value' }, text: 'Show it per week.' }],
    ]),
}

/** The box after a comment: sent, what was picked is let go and the box is as with nothing picked (a comment, a reply
 * and a voice comment alike); not sent (Taska said no), its words come back, and nothing is picked. */
export const AfterAComment: Story = {
  render: () =>
    states([
      ['sent', { d: 1 }],
      ['not sent: the words back, nothing picked', { d: 1, text: 'Also keep the sort.' }],
    ]),
}
