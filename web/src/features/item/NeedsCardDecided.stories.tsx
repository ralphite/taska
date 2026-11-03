// The card after you decided, as a sent form (T642): its buttons where they were, greyed and disabled, what you chose
// said as done; the pointer on it shows Edit (always there on the phone); Edit brings the buttons back with Cancel.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { T } from '../../stories/fixtures'
import { approved, at, proposal, report } from '../../stories/needsCardFixtures'

export default { title: 'Components/Item page/Needs-you card/After you decided' } satisfies Meta
type Story = StoryObj

export const ProposalApproved: Story = { ...at(approved), name: 'Proposal approved' }
export const ProposalApprovedPointerOnIt: Story = { ...at(approved), name: 'Proposal approved, pointer on it: Edit', parameters: { pseudo: { hover: true } } }
export const ProposalApprovedModifyPressed: Story = { ...at(approved, { remodify: true }), name: 'Proposal approved, Edit pressed' }
/** a proposal with no words from the agent, approved: the card says who proposed it, with only what you chose */
export const ProposalApprovedNothingSaid: Story = { ...at({ status: 'open', by: 'claude-code', thread: [], decided: { from: 'proposed', to: 'open', msg: null, t: T } }), name: 'Proposed with nothing said, approved' }
export const ProposalDeclined: Story = { ...at({ status: 'dropped', thread: [proposal], decided: { from: 'proposed', to: 'dropped', msg: 5, t: T } }), name: 'Proposal declined' }
export const WorkAccepted: Story = { ...at({ status: 'done', thread: [report], decided: { from: 'review', to: 'done', msg: 6, t: T } }), name: 'Work accepted' }
export const WorkAcceptedModifyPressed: Story = {
  ...at({ status: 'done', thread: [report], decided: { from: 'review', to: 'done', msg: 6, t: T } }, { remodify: true }),
  name: 'Work accepted, Edit pressed',
}
export const WorkSentBack: Story = { ...at({ status: 'open', thread: [report], decided: { from: 'review', to: 'open', msg: 6, t: T } }), name: 'Work sent back (Not yet)' }
