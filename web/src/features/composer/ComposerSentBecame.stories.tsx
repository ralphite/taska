// The line once it is filed: by the organizer, no changes needed, left for an agent and filed by it, moved to another
// project, the organizer failed; with the organizer off, filed or seen by an agent.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { at, org, sent } from '../../stories/composerSentFixtures'

export default { title: 'UI/Input box/Line after sending/What it became' } satisfies Meta
type Story = StoryObj

export const FiledByYourAgent: Story = { ...at({ sent: sent({ acked: true, touched: [12], org: org(true, 'Created F012') }) }), name: 'Filed: made an item' }
export const NothingToFile: Story = { ...at({ sent: sent({ text: 'Thanks, that looks right.', acked: true, org: { ...org(true, 'No changes needed'), changed: false } }) }), name: 'No changes needed' }
/** the organizer left it for an agent, which filed it: its note, View, no Undo */
export const LeftThenFiled: Story = { ...at({ sent: sent({ acked: true, touched: [12], org: { ...org(true, 'Left for agent'), keep: true, changed: false } }) }), name: 'Left for an agent, filed by it' }
export const SeenByYourAgentNoItemMade: Story = { ...at({ sent: sent({ acked: true, touched: [] }), organizer: false }), name: 'Seen, no item made: organizer off' }
export const MovedToAnotherProject: Story = { ...at({ sent: sent({ moved: { to: 'home', as: 'r4' } }) }), name: 'Moved to another project' }
export const OrganizerFailed: Story = { ...at({ sent: sent({ org: org(false, 'Gemini HTTP 503: overloaded') }) }), name: 'The organizer failed' }
/** its key refused: where to fix it, no Retry (it would fail the same way) */
export const OrganizerKeyRefused: Story = { ...at({ sent: sent({ org: org(false, 'Gemini HTTP 401: API key not valid') }) }), name: "The organizer's key not accepted" }
/** an agent filed it, the organizer off: Organized, View, no Undo */
export const FiledByAnAgent: Story = { ...at({ sent: sent({ acked: true, touched: [12] }), organizer: false }), name: 'Filed by an agent: organizer off' }
