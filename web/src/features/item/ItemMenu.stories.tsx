// An item's menu for each kind of item: in progress, done, for later, a subitem, archived, a rule, placed first in the queue.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { both } from '../../stories/itemMenuFixtures'

export default { title: 'Components/Menus and sheets/Item menu/By item' } satisfies Meta
type Story = StoryObj

/** In progress, with its subitems: every action, then its type, priority and status (the phone); rows with their keys
 * (the desktop). */
export const ItemInProgress: Story = { ...both({ n: 1 }), name: 'In progress' }
/** Done: Archive, no Later. */
export const ItemDone: Story = { ...both({ n: 8 }), name: 'Done' }
/** For later: Back to now. */
export const ItemLater: Story = { ...both({ n: 7 }), name: 'For later' }
/** Under another: Put under says which. */
export const Subitem: Story = { ...both({ n: 14 }), name: 'A subitem' }
export const ItemArchived: Story = { ...both({ n: 10 }), name: 'Archived' }
/** A rule: no New doc, subitem, Put under, Later or priority. */
export const Rule: Story = { ...both({ n: 11 }), name: 'A rule' }
// ---- more states (B636)
export const ItemPlacedFirstInTheQueue: Story = { ...both({ n: 5, rank: 0 }), name: 'Placed first in the queue: Back in order' }
