// Undo and Move to… on the line, and the filing undone.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { at, org, sent } from '../../stories/composerSentFixtures'

export default { title: 'Components/Input box/Line after sending/Undo and move' } satisfies Meta
type Story = StoryObj

/** just sent and left for an agent: Undo while it is fresh, and Move to… */
export const SentUndoAndMoveTo: Story = { ...at({ sent: sent({ org: { ...org(true, 'Left for your coding agent'), keep: true, changed: false } }), undoable: true, others: true }), name: 'Sent, Undo and Move to…' }
export const FiledMoveTo: Story = { ...at({ sent: sent({ acked: true, touched: [12], org: org(true, 'Created F012') }), others: true }), name: 'Filed, Move to…' }
export const FilingUndone: Story = { ...at({ sent: sent({ org: { ...org(true, 'Created F012'), undone: true } }) }), name: 'Filing undone' }
