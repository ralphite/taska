// The card while you answer: a choice picked, you replied on a proposal or commented on finished work's document.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { T, message } from '../../stories/fixtures'
import { askOf, at, proposal, q, repliedOnProposal, report } from '../../stories/needsCardFixtures'

export default { title: 'UI/Item pane/Talk/Needs-you card/While you answer' } satisfies Meta
type Story = StoryObj

// ---- more states (B636)
export const QuestionAChoicePicked: Story = { ...at(q('Which format should the export use?\n- ( ) CSV\n- ( ) Excel'), { picked: [0] }), name: 'Question, a choice picked' }
export const ProposalYouReplied: Story = { ...at(repliedOnProposal), name: 'Proposal, you replied' }
export const ProposalYouRepliedPointerOnApprove: Story = {
  ...at(repliedOnProposal),
  name: 'Proposal, you replied, pointer on Approve',
  parameters: { pseudo: { hover: ['button'] } },
}
/** Words on an item in review set it back to open (B606); a comment on one of its documents still answers it here. */
export const FinishedYouCommented: Story = { ...at({ status: 'review', talked: true, thread: [report] }), name: 'Finished, you commented on its document' }
/** you approved the proposal while its question still waits: ✓ Approve beside Send answer */
export const ApprovedQuestionWaits: Story = {
  ...at({ status: 'open', thread: [proposal, message({ id: 7, kind: 'ask', text: 'Which format should the export use?\n- ( ) CSV\n- ( ) Excel' })], wait: askOf('Which format should the export use?\n- ( ) CSV\n- ( ) Excel'), decided: { from: 'proposed', to: 'open', msg: 7, t: T } }),
  name: 'Proposal approved, its question still waits',
}
/** T728 #3: approved while a question in words still waits: ✓ Approved stays where Approve was, beside ↓ Answer below
 * (it went before; r1003) */
export const ApprovedWordsQuestionWaits: Story = {
  ...at({ status: 'open', thread: [proposal, message({ id: 7, kind: 'ask', text: 'Should the file name say the filter too?' })], wait: askOf('Should the file name say the filter too?'), decided: { from: 'proposed', to: 'open', msg: 7, t: T } }),
  name: 'Proposal approved, its question in words still waits',
}
/** a proposal with a question in words: Approve beside it; A answers it, as the row's Answer does (T728 #3) */
export const ProposalWordsQuestion: Story = {
  ...at({ status: 'proposed', thread: [proposal, message({ id: 7, kind: 'ask', text: 'Should the file name say the filter too?' })], wait: askOf('Should the file name say the filter too?') }),
  name: 'Proposal, a question in words waits',
}
