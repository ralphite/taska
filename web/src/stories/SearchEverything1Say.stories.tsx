// F479 (r982): searching by voice on the phone, each state of saying what to find and what it found. The journeys:
// searchProto.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { stateStory } from './searchProto'

export default { title: 'Prototype/F479 Search everything/Say and search', parameters: { layout: 'padded' } } satisfies Meta

export const Listening: StoryObj = { name: 'Listening', ...stateStory('listening', 'the magnifier tapped: recording at once, in the box') }
export const WritingItOut: StoryObj = { name: 'Writing out what you said', ...stateStory('writing', '↑ tapped: Taska writes the words out') }
export const Searching: StoryObj = { name: 'Searching', ...stateStory('searching', 'the words in the box, searching every project') }
export const ByMeaningToo: StoryObj = { name: 'Found by the words, looking by meaning', ...stateStory('meaning', 'what the words find, at once; by meaning a moment later') }
export const Found: StoryObj = { name: 'Found', ...stateStory('found', 'the closest first, by kind, each with why') }
export const OneKind: StoryObj = { name: 'Only one kind', ...stateStory('oneKind', 'Items tapped: only items, all of them') }
export const AResultOpen: StoryObj = { name: 'A result open', ...stateStory('open', 'a result tapped: it opens, the box replies to it; ← back to the search') }
