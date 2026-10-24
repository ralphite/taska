import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../../stories/Frames'
import { Composer, Feedback, type ComposerProps, type FeedbackLine } from './Composer'

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
