// A row swiped back on the phone (to the left): the ways back, the one you want most at the edge under your finger.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { agent, swiped } from '../../stories/itemRowFixtures'
import { askOf } from '../../stories/needsCardFixtures'

export default { title: 'UI/List pane/Item row/Swiping on the phone/Back' } satisfies Meta
type Story = StoryObj

export const OpenBack: Story = { ...swiped({ it: { status: 'doing', agent } }, -160), name: "In progress: Won't do, Later" }
export const WaitingBack: Story = { ...swiped({ it: { wait: askOf('Which format should the export use?') } }, -220), name: "A question: Won't do, Later, Done" }
export const ProposalBack: Story = { ...swiped({ it: { status: 'proposed', by: 'claude-code' } }, -160), name: "A proposal: Won't do, Later" }
export const LaterBack: Story = { ...swiped({ it: { when: 'later', pri: 'P3' } }, -160), name: "For later: Won't do, Back to now" }
export const SwipingBack: Story = { ...swiped({ it: { status: 'review' } }, -160), name: 'Finished work: Later, Not yet' }
export const FinishedBack: Story = { ...swiped({ it: { status: 'done' } }, -160), name: 'Done: Reopen' }
