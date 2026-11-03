// The card when something waits for your yes: a proposal (with words, or none), a rule proposed, finished work to accept.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { message } from '../../stories/fixtures'
import { at, proposal, report } from '../../stories/needsCardFixtures'

export default { title: 'Components/Item page/Needs-you card/To approve or accept' } satisfies Meta
type Story = StoryObj

export const Proposal: Story = { ...at({ status: 'proposed', thread: [proposal] }), name: 'A proposal' }
export const ProposedNothingSaid: Story = { ...at({ status: 'proposed', by: 'claude-code', thread: [] }), name: 'Proposed, nothing said' }
export const RuleProposed: Story = { ...at({ type: 'rule', status: 'proposed', title: 'Screenshots go in the item', thread: [message({ id: 5, kind: 'propose', text: 'Every screenshot of a change is posted on its item.' })] }), name: 'A rule proposed' }
export const WaitsForReview: Story = { ...at({ status: 'review', thread: [report] }), name: 'Finished work to accept' }
