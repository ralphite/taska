// An agent's question answered: with a choice, a checklist, your own words; the pointer on it; Approve beside it.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { T, message } from '../../stories/fixtures'
import { CHECKS, answered, ask, at, said } from '../../stories/talkQuestionFixtures'

export default { title: 'Components/Conversation/Message/Question/Answered' } satisfies Meta
type Story = StoryObj

export const Answered = at(answered)
export const AnsweredPointerOnItModify: Story = { ...at(answered), name: 'Answered, pointer on it: Modify', parameters: { pseudo: { hover: ['.group'] } } }
export const ChecklistAnswered: Story = { ...at([ask(CHECKS), said('✓ CSV\n✓ JSON')]), name: 'A checklist answered' }
export const NoChoicesAnsweredByYourWords: Story = { ...at([ask('Should the old export stay for a while?'), said('A week, then remove it.')]), name: 'No choices, answered by your words' }
export const AnsweredApproveBesideIt: Story = { ...at(answered, { status: 'proposed', by: 'claude-code' }), name: 'Answered, Approve beside it' }
export const AnsweredPointerOnApprove: Story = { ...at(answered, { status: 'proposed', by: 'claude-code' }), name: 'Answered, pointer on Approve', parameters: { pseudo: { hover: ['button'] } } }
// ---- more states (T639): answered, and then the proposal approved or the work accepted
const proposal = message({ id: 3, kind: 'propose', text: 'Keep the filter in the export file name.' })
const report = message({ id: 3, text: 'Done: the export keeps the filter.' })
export const AnsweredThenApproved: Story = {
  ...at([proposal, ...answered], { status: 'open', decided: { from: 'proposed', to: 'open', msg: 4, t: T } }),
  name: 'Answered, then the proposal approved',
}
export const AnsweredThenAccepted: Story = {
  ...at([report, ...answered], { status: 'done', decided: { from: 'review', to: 'done', msg: 4, t: T } }),
  name: 'Answered, then the work accepted',
}
