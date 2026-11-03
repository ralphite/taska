// F479 (r982): searching by voice on the phone, each state of saying more and changing what it heard. The journeys:
// searchProto.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { stateStory } from './searchProto'

export default { title: 'Prototype/F479 Search everything/Say more or change it', parameters: { layout: 'padded' } } satisfies Meta

export const MaybeMisheard: StoryObj = { name: 'A word may be misheard', ...stateStory('misheard', 'heard two ways: both in the box, tap the right one') }
export const SayingMore: StoryObj = { name: 'Saying more', ...stateStory('sayingMore', 'the mic tapped with results there: your words and the results stay') }
export const SearchingAgain: StoryObj = { name: 'Searching again', ...stateStory('again', 'what you added, lit; the results before it, faded') }
export const FoundAgain: StoryObj = { name: 'Found again', ...stateStory('againFound', 'what all your words find now') }
export const Typing: StoryObj = { name: 'Typing', ...stateStory('typing', 'the words tapped: typing; ↑ searches what you typed') }
export const Cleared: StoryObj = { name: 'Cleared', ...stateStory('cleared', 'the x tapped: no words, nothing found yet') }
