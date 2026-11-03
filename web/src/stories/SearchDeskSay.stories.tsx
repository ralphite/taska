// F479 on the desktop, a prototype: saying what to find with the mic at the field's end. The journeys:
// stories/searchDesk.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { deskStory } from './searchDesk'

export default { title: 'Prototype/F479 Search on the desktop/Say it' } satisfies Meta

/** The mic (or ⌥V): the time and the level, no words (r797); Recent stays under it. */
export const Listening: StoryObj = { name: 'Listening', ...deskStory('listening') }
export const Transcribing: StoryObj = { name: 'Transcribing', ...deskStory('writing') }
/** A word heard two ways: click the right one, and it searches again. */
export const MaybeMisheard: StoryObj = { name: 'A word may be misheard', ...deskStory('misheard') }
/** The mic again: what you said stays before the recording; the results stay. */
export const SayingMore: StoryObj = { name: 'Saying more', ...deskStory('sayingMore') }
/** What you added, lit at the end. */
export const SaidMore: StoryObj = { name: 'Said more', ...deskStory('saidMore') }
