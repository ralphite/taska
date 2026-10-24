import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Doc, Item, Message } from '../../model/types'
import { Frames, States } from '../../stories/Frames'
import { T, input, item, message, modelOf } from '../../stories/fixtures'
import { comment, doc, noItemEvents, talkEnv, talkFacts } from '../../stories/itemFixtures'
import { Talk, docNotes } from './Talk'
import type { TalkFacts } from './Talk'

const meta: Meta = { title: 'Components/Item/Talk' }
export default meta
type Story = StoryObj

const you = (f: Partial<Message> & { id: number }) => message({ by: 'you', kind: 'say', text: 'The export should keep the filter I set.', ...f })
const later = (min: number) => new Date(Date.parse(T) + min * 60_000).toISOString()

function talk(it: Item, desk: boolean, f: Partial<TalkFacts> = {}, docs: Doc[] = []) {
  const m = modelOf([it], [input({ id: 'r4', text: 'The export should keep the filter I set.', files: [{ f: 'f2-voice_0-12.webm', name: 'voice_0-12.webm', mime: 'audio/webm' }] })])
  const env = talkEnv(m, desk)
  return (
    <div className="flex flex-col gap-6 p-4">
      <Talk it={it} list={it.thread} notes={docNotes(docs, env, noItemEvents)} env={env} on={noItemEvents} facts={talkFacts(m, f)} docs={docs} code={(n) => 'F' + String(n).padStart(3, '0')} />
    </div>
  )
}

/** Messages: yours (with its voice note, read by an agent), an agent's with its kind, the organizer's from an input,
 * a long one, one edited, versions of an input you edited. */
export const Messages: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={720}>
      {(layout) => {
        const desk = layout === 'desk'
        return (
          <States
            items={[
              ['yours, from an input with a voice note', talk(item({ n: 12, thread: [you({ id: 1, src: 'r4' })] }), desk)],
              ['yours, read by an agent', talk(item({ n: 12, thread: [you({ id: 1 })], readBy: { 'claude-code': Date.parse(T) + 30_000 } }), desk)],
              ['an agent’s: progress, a proposal, a decision', talk(item({ n: 12, thread: [message({ id: 2 }), message({ id: 3, kind: 'propose', text: 'Put the filter in the file name.' }), message({ id: 4, kind: 'decide', text: 'CSV it is.', by: 'codex', ses: 'tests' })] }), desk)],
              ['the organizer’s, from what you said', talk(item({ n: 12, thread: [message({ id: 2, by: 'org', kind: 'say', src: 'r4', text: 'Added to F012: keep the filter' })] }), desk)],
              ['a long one', talk(item({ n: 12, thread: [message({ id: 2, text: Array.from({ length: 12 }, (_, i) => `Line ${i + 1} of the report, with some words to fill it.`).join('\n') }), you({ id: 3, t: later(2) })] }), desk)],
              ['edited', talk(item({ n: 12, thread: [you({ id: 1, edited: later(1) })] }), desk)],
              ['to another session', talk(item({ n: 12, thread: [message({ id: 2, to: ['worker-b'], text: '@worker-b take the tests' })] }), desk)],
            ]}
          />
        )
      }}
    </Frames>
  ),
}

/** A question taken back, a hidden message, an answered question, a document's comments in time, what you sent on its way. */
export const Moments: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={720}>
      {(layout) => {
        const desk = layout === 'desk'
        const ask = message({ id: 2, kind: 'ask', text: 'Which format?\n\n- ( ) CSV\n- ( ) Excel' })
        const d = doc({ d: 1, n: 12, blocks: [{ key: 'k1', kind: 'para', text: 'x', comments: [comment({ id: 9, t: later(1) }), comment({ id: 10, by: 'claude-code', t: later(2), quote: '', text: 'Done in the plan.' })] }] })
        return (
          <States
            items={[
              ['a question taken back', talk(item({ n: 12, thread: [message({ id: 2, kind: 'ask', text: 'Keep the old export?' }), message({ id: 3, kind: 'withdraw', text: 'Found it in the notes.', t: later(1) })] }), desk)],
              ['a hidden message', talk(item({ n: 12, thread: [message({ id: 2, hidden: true })] }), desk)],
              ['an answered question', talk(item({ n: 12, thread: [ask, you({ id: 3, text: '✓ Excel', t: later(1) })] }), desk)],
              ['comments on its document', talk(item({ n: 12, thread: [message({ id: 2 })] }), desk, {}, [d])],
              ['sending, and not sent', talk(item({ n: 12, thread: [message({ id: 2 })] }), desk, { outgoing: [{ q: 'q1', text: 'Also keep the sort.', state: 'Sending…', bad: false, canUndo: true }, { q: 'q2', text: 'And the columns.', state: 'Not sent', bad: true, canUndo: false }] })],
            ]}
          />
        )
      }}
    </Frames>
  ),
}
