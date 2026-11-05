// Move to… on the line once it is sent, and the filing undone. No Undo of the sending itself (B666): what is still on
// its way has × (On its way); once Taska has it, its ⋯ in the list deletes it.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { at, org, sent } from '../../stories/composerSentFixtures'

export default { title: 'Components/Input box/Line after sending/Move and filing undone' } satisfies Meta
type Story = StoryObj

/** sent and left for an agent: Move to… */
export const SentMoveTo: Story = { ...at({ sent: sent({ org: { ...org(true, 'Left for agent'), keep: true, changed: false } }), others: true }), name: 'Sent, Move to…' }
export const FiledMoveTo: Story = { ...at({ sent: sent({ acked: true, touched: [12], org: org(true, 'Created F012') }), others: true }), name: 'Filed, Move to…' }
export const FilingUndone: Story = { ...at({ sent: sent({ org: { ...org(true, 'Created F012'), undone: true } }) }), name: 'Filing undone' }
