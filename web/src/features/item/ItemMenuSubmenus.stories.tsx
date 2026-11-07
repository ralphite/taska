// Status, priority and type, a choice under the pointer, and Delete asking again.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { both, desk } from '../../stories/itemMenuFixtures'

export default { title: 'UI/Item pane/Item menu/Its submenus' } satisfies Meta
type Story = StoryObj

/** One field's choices only, from its chip (or S, P, T). */
export const Status: Story = { ...both({ n: 1, arm: 's' }), name: 'Status' }
export const StatusHover: Story = { ...desk({ n: 1, arm: 's' }, { hover: ['[role="dialog"] button[data-v="open"]'] }), name: 'Status, pointer on a choice' }
export const StatusHoverTicked: Story = { ...desk({ n: 1, arm: 's' }, { hover: ['[role="dialog"] button[aria-pressed="true"]'] }), name: 'Status, pointer on the ticked one' }
export const Priority: Story = { ...both({ n: 1, arm: 'p' }), name: 'Priority' }
export const Type: Story = { ...both({ n: 1, arm: 't' }), name: 'Type' }
/** Delete pressed once: it asks for a second click. */
export const DeleteAsks: Story = { ...both({ n: 1, asking: true }), name: 'Delete asks again' }
// ---- more states (T639)
/** Status on a rule: the rule's own words (Active, Retired; Proposed only while it is proposed) */
export const StatusOfARule: Story = { ...both({ n: 11, arm: 's' }), name: 'Status of a rule' }
