// The card when something waits for your yes: a proposal (with words, or none), finished work to accept.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { at, proposal, report } from '../../stories/needsCardFixtures'

export default { title: 'UI/Item pane/Talk/Needs-you card/To approve or accept' } satisfies Meta
type Story = StoryObj

export const Proposal: Story = { ...at({ status: 'proposed', thread: [proposal] }), name: 'A proposal' }
export const ProposedNothingSaid: Story = { ...at({ status: 'proposed', by: 'claude-code', thread: [] }), name: 'Proposed, nothing said' }
export const WaitsForReview: Story = { ...at({ status: 'review', thread: [report] }), name: 'Finished work to accept' }
