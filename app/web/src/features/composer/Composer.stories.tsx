import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../../stories/Frames'
import type { FeedbackLine } from '../../model/boxFoot'
import { Composer, Feedback, type ComposerProps } from './Composer'

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

/** Its line on top, for each thing it writes to: a comment on a paragraph (its x lets go), choices ticked in a
 * document (Send choices), the phone's document (Reply to its item instead), an edit of what you said (Stop), a
 * recording made for another draft. */
export const Lines: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={720}>
      {(layout) => {
        const desk = layout === 'desk'
        return (
          <States
            items={[
              ['a comment on a paragraph', box(desk, { line: { icon: 'comment', label: 'Comment on D12', detail: '\u201cstays in use\u201d', right: { kind: 'x', label: 'Cancel the comment', act: 'unpick' } } })],
              ['choices ticked', box(desk, { line: { icon: 'check', label: '2 choices ticked, not sent', detail: '· D12', wideOnly: true, tight: true, right: { kind: 'ticks' } } })],
              ['the phone’s document', box(desk, { line: { icon: 'comment', label: 'Comment on D12', detail: '· or tap a part', right: { kind: 'to-item', code: 'F12' } } })],
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
