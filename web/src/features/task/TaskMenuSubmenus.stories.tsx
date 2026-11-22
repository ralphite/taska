// Status, priority and tags, a choice under the pointer, and Delete asking again.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { both, desk } from '../../stories/taskMenuFixtures'

export default { title: 'UI/Task pane/Task menu/Its submenus' } satisfies Meta
type Story = StoryObj

/** One field's choices only, from its chip (or S, P, T). */
export const Status: Story = { ...both({ n: 1, arm: 's' }), name: 'Status' }
export const StatusHover: Story = { ...desk({ n: 1, arm: 's' }, { hover: ['[role="dialog"] button[data-v="open"]'] }), name: 'Status, pointer on a choice' }
export const StatusHoverTicked: Story = { ...desk({ n: 1, arm: 's' }, { hover: ['[role="dialog"] button[aria-pressed="true"]'] }), name: 'Status, pointer on the ticked one' }
export const Priority: Story = { ...both({ n: 1, arm: 'p' }), name: 'Priority' }
/** Its tags (T855): the project's, each put on or taken off by a click, and a field for a new one. */
export const Tags: Story = { ...both({ n: 1, arm: 't' }), name: 'Tags' }
/** Delete pressed once: it asks for a second click. */
export const DeleteAsks: Story = { ...both({ n: 1, asking: true }), name: 'Delete asks again' }
// ---- more states (T639)
