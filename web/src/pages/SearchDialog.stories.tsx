// F479: the desktop's search (pages/SearchDialog): the Search button in the sidebar's head, and each state of
// finding by typing. The journeys: stories/searchDesk.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Pointed } from '../stories/tipFixtures'
import { DeskFrame, SearchDesk, deskStory } from '../stories/searchDesk'

export default { title: 'UI/Search/Desktop dialog/Type and find' } satisfies Meta

/** The page before the search: the magnifier right of the logo (⌘K); no search box over the list. */
export const InTheSidebar: StoryObj = { name: 'Search in the sidebar', ...deskStory('closed') }
/** The pointer on it, with its tip (Search · ⌘K). */
export const UnderThePointer: StoryObj = {
  name: 'Search under the pointer',
  parameters: { pseudo: { hover: ['#drawer button[aria-label="Search"]'] } },
  render: () => (
    <DeskFrame>
      <Pointed find={'#drawer button[aria-label="Search"]'} card={() => null}>
        <SearchDesk still />
      </Pointed>
    </DeskFrame>
  ),
}
/** Folded: a magnifier under the logo (Search · ⌘K). */
export const SidebarFolded: StoryObj = { name: 'Sidebar folded', ...deskStory('closed', { rail: true }) }
/** Opened: the field has the focus; nothing typed, Recent (the first highlighted, its preview beside). */
export const Recent: StoryObj = { name: 'Opened: Recent', ...deskStory('recent') }
export const FirstLetters: StoryObj = { name: 'Searching as you type', ...deskStory('typingFirst') }
/** Typing on: what it found stays, faded, the spinner in the field. */
export const TypingOn: StoryObj = { name: 'Typing on', ...deskStory('typingMore') }
/** All: by kind, each kind named over its rows, best first in each (T642 R9); each row's project as a path; the words
 * found lit; the first row's preview; the x beside the mic clears the words. */
export const Results: StoryObj = { name: 'Results', ...deskStory('found') }
export const PreviewInput: StoryObj = { name: 'An input highlighted', ...deskStory('previewInput') }
export const PreviewDoc: StoryObj = { name: 'A document highlighted', ...deskStory('previewDoc') }
/** Opened from the search: in its project's pane; the modal gone. */
export const AResultOpen: StoryObj = { name: 'A result open', ...deskStory('opened') }
/** ⌘K again: the last words, selected (typing starts over), and what they found. */
export const OpenedAgain: StoryObj = { name: 'Opened again', ...deskStory('reopened') }
