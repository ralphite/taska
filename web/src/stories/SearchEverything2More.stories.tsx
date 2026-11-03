// F479 (r982): searching by voice on the phone, each state of saying more and changing what it heard. The journeys:
// searchProto.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { stateStory } from './searchProto'

export default { title: 'Prototype/F479 Search everything/Say more or change it', parameters: { layout: 'padded' } } satisfies Meta

export const MaybeMisheard: StoryObj = { name: 'A word may be misheard', ...stateStory('misheard') }
export const SayingMore: StoryObj = { name: 'Saying more', ...stateStory('sayingMore') }
export const SearchingAgain: StoryObj = { name: 'Searching again', ...stateStory('again') }
export const FoundAgain: StoryObj = { name: 'Found again', ...stateStory('againFound') }
export const Typing: StoryObj = { name: 'Typing', ...stateStory('typing') }
export const Cleared: StoryObj = { name: 'Cleared', ...stateStory('cleared') }
