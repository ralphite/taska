// The line once it is filed: filed by an agent, seen with no item made, moved to another project, the organizer failed.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { at, org, sent } from '../../stories/composerSentFixtures'

export default { title: 'Components/Input box/Line after sending/What it became' } satisfies Meta
type Story = StoryObj

export const FiledByYourAgent: Story = { ...at({ sent: sent({ acked: true, touched: [12], org: org(true, 'Created F012') }), organizer: true }), name: 'Filed: made an item' }
export const SeenByYourAgentNoItemMade: Story = { ...at({ sent: sent({ acked: true, touched: [] }) }), name: 'Seen, no item made' }
export const MovedToAnotherProject: Story = { ...at({ sent: sent({ moved: { to: 'home', as: 'r4' } }) }), name: 'Moved to another project' }
export const OrganizerFailed: Story = { ...at({ sent: sent({ org: org(false, 'Gemini HTTP 503: overloaded') }), organizer: true }), name: 'The organizer failed' }
/** an agent filed it, the organizer off: Organized, View, no Undo */
export const FiledByAnAgent: Story = { ...at({ sent: sent({ acked: true, touched: [12] }) }), name: 'Filed by an agent: View' }
