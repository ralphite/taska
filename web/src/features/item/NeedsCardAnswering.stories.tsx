// The card while you answer: a choice picked, you replied on a proposal or commented on finished work's document.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { at, q, repliedOnProposal, report } from '../../stories/needsCardFixtures'

export default { title: 'Components/Item page/Needs-you card/While you answer' } satisfies Meta
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
