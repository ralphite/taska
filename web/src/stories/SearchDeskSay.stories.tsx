// F479 on the desktop, a prototype: each state of saying what to find and what it found, in the dialog. The
// journeys: stories/searchDesk.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { deskStory } from './searchDesk'

export default { title: 'Prototype/F479 Search on the desktop/Say and search' } satisfies Meta

/** Opened: it records at once; the time and the level, no words (r797). */
export const Listening: StoryObj = { name: 'Listening', ...deskStory('listening') }
export const Transcribing: StoryObj = { name: 'Transcribing', ...deskStory('writing') }
export const Searching: StoryObj = { name: 'Searching', ...deskStory('searching') }
/** By project, Shop (you are in it) first, closest first in each; the first row is the keys' (↵ opens it). */
export const Results: StoryObj = { name: 'Results', ...deskStory('found') }
export const OneKind: StoryObj = { name: 'One kind picked', ...deskStory('oneKind') }
/** ↓ three times: the keys' row is blue; the pointer on another row lights it grey and shows an item's actions. */
export const KeysAndPointer: StoryObj = {
  name: 'Keys on one row, pointer on another',
  parameters: { pseudo: { hover: ['[role="dialog"] [data-n="14"] .group'] } },
  ...deskStory('found', { sel: 3 }),
}
/** Opened: the dialog has gone, the result in its project's pane; Back to Search (or Esc) brings the same results. */
export const AResultOpen: StoryObj = { name: 'A result open', ...deskStory('open') }
