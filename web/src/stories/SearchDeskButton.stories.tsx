// F479 on the desktop, a prototype: the search button in the sidebar's head, left of Hide sidebar (r796); the list
// with no search box over it, its filter at the end of the views' row. The journeys: stories/searchDesk.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { After } from './Frames'
import { DeskFrame, SearchDesk, pageStory } from './searchDesk'

export default { title: 'Prototype/F479 Search on the desktop/The search button' } satisfies Meta

/** The page as it is, but for the search: its button in the sidebar's head; no search box over the list. */
export const InTheSidebar: StoryObj = { name: 'In the sidebar', ...pageStory() }
/** The pointer on it: lit, with its tip (Search · /). */
export const UnderThePointer: StoryObj = {
  name: 'Under the pointer',
  parameters: { pseudo: { hover: ['#drawer button[aria-label="Search"]'] } },
  render: () => (
    <DeskFrame>
      <After run={(root) => root.querySelector('#drawer button[aria-label="Search"]')?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))}>
        <SearchDesk still />
      </After>
    </DeskFrame>
  ),
}
/** The sidebar folded to its rail: search under the logo (which shows the sidebar again). */
export const SidebarFolded: StoryObj = { name: 'Sidebar folded', ...pageStory({ rail: true }) }
