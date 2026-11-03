// An item's page while it is worked on: open, in progress with its talk, the agent's turn, P0, for later, made from two inputs.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { T, message } from '../../stories/fixtures'
import { at, said } from '../../stories/itemPageFixtures'

export default { title: 'Components/Item page/By item status/Being worked on' } satisfies Meta
type Story = StoryObj

export const Open = at({ thread: [said] })
export const InProgressWithItsTalk: Story = {
  ...at({ status: 'doing', agent: { by: 'claude-code', t: T }, thread: [said, message({ id: 2, text: 'Reproduced it: the export reads the list before the filter.' }), message({ id: 3, text: 'Fixed the order; testing with three filters now.' })] }),
  name: 'In progress, with its talk',
}
export const AgentsTurnYouReplied: Story = { ...at({ talked: true, thread: [said] }), name: 'Open, you replied' }
// ---- more states (B636)
export const P0: Story = { ...at({ pri: 'P0', thread: [said] }), name: 'P0' }
export const Later = at({ when: 'later', thread: [said] })
export const MadeFromTwoInputs: Story = { ...at({ thread: [said], srcs: ['r4', 'r5'] }), name: 'Made from two inputs' }
