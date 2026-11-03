// F479 on the desktop, a prototype: each state of saying more and changing what it heard, in the dialog. The
// journeys: stories/searchDesk.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { deskStory } from './searchDesk'

export default { title: 'Prototype/F479 Search on the desktop/Say more or change it' } satisfies Meta

/** The mic in the box, or ⌥V: what you said stays above the recording; the results stay. */
export const SayingMore: StoryObj = { name: 'Saying more', ...deskStory('sayingMore') }
/** What you added, lit at the end; it searches all of it again, the results faded meanwhile. */
export const SearchingAgain: StoryObj = { name: 'Searching again', ...deskStory('again') }
export const SaidMore: StoryObj = { name: 'Said more', ...deskStory('againFound') }
/** A word two models heard differently: click the right one, and it searches again. */
export const MaybeMisheard: StoryObj = { name: 'A word may be misheard', ...deskStory('misheard') }
/** Typed words: ↵ searches them (the mic beside says more). */
export const Typing: StoryObj = { name: 'Typing', ...deskStory('typing') }
