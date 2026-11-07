// An agent's question answered: with a choice, a checklist, your own words; the pointer on it; Approve beside it.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { T, item, message } from '../../stories/fixtures'
import { talkOf } from '../../stories/itemPage'
import { CHECKS, answered, ask, at, said } from '../../stories/talkQuestionFixtures'

export default { title: 'UI/Item pane/Talk/Message/Question/Answered' } satisfies Meta
type Story = StoryObj

export const Answered = at(answered)
export const AnsweredPointerOnItModify: Story = { ...at(answered), name: 'Pointer on it: Edit', parameters: { pseudo: { hover: ['.group\\/form'] } } }
export const ChecklistAnswered: Story = { ...at([ask(CHECKS), said('✓ CSV\n✓ JSON')]), name: 'A checklist answered' }
export const NoChoicesAnsweredByYourWords: Story = { ...at([ask('Should the old export stay for a while?'), said('A week, then remove it.')]), name: 'No choices, answered by your words' }
export const AnsweredApproveBesideIt: Story = { ...at(answered, { status: 'proposed', by: 'claude-code' }), name: 'Approve beside it' }
/** the desktop (the phone has no pointer) */
export const AnsweredPointerOnApprove: Story = {
  render: () => <Frames phone={false} deskWidth={720}>{() => talkOf(item({ n: 12, thread: answered, status: 'proposed', by: 'claude-code' }), true)}</Frames>,
  name: 'Pointer on Approve',
  parameters: { pseudo: { hover: ['section button:has(svg):not(:disabled)'] } },
}
// ---- more states (T639): answered, and then the proposal approved or the work accepted
const proposal = message({ id: 3, kind: 'propose', text: 'Keep the filter in the export file name.' })
const report = message({ id: 3, text: 'Done: the export keeps the filter.' })
export const AnsweredThenApproved: Story = {
  ...at([proposal, ...answered], { status: 'open', decided: { from: 'proposed', to: 'open', msg: 4, t: T } }),
  name: 'Then the proposal approved',
}
export const AnsweredThenAccepted: Story = {
  ...at([report, ...answered], { status: 'done', decided: { from: 'review', to: 'done', msg: 4, t: T } }),
  name: 'Then the work accepted',
}
