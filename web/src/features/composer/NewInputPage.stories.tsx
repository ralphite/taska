// The New input page as a whole (T661, the approved "Anchored Stream"): the desktop at 1440 and the phone at 393, with
// the data it was approved with (stories/newInputPage.tsx). Dark is Storybook's toolbar switch.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { DeskPage, PhonePage } from '../../stories/newInputPage'

export default { title: 'Components/Inputs/New input page/The whole page' } satisfies Meta
type Story = StoryObj

const pad = (node: ReactNode) => <div className="bg-zinc-200 p-6 dark:bg-zinc-800">{node}</div>

/** The project's name, the box; a voice note being recorded, one on its way, one waiting for Taska (× cancels each),
 * the draft to check; then every input with what became of it (its ⋯ deletes it), one being added to by voice. */
export const Desktop: Story = { name: 'Desktop', render: () => pad(<DeskPage />) }

/** Under the pointer: a row a shade darker, its Voice, Comment and ⋯ at the end of its first line. */
export const UnderThePointer: Story = {
  name: 'Under the pointer',
  parameters: { pseudo: { hover: ['article:has([aria-label="More for #1026"])'] } },
  render: () => pad(<DeskPage />),
}

/** The phone's Inputs tab: the same rows, ⋯ on each (its menu has the rest); the box at its foot. */
export const OnThePhone: Story = { name: 'On the phone', render: () => pad(<PhonePage />) }
