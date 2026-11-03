// F479: the phone's search page (pages/SearchPage), each state of saying more and changing what it heard. The journeys:
// stories/searchPhone.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { stateStory } from '../stories/searchPhone'

export default { title: 'Components/Search on the phone/Say more or change it', parameters: { layout: 'padded' } } satisfies Meta

export const MaybeMisheard: StoryObj = { name: 'A word may be misheard', ...stateStory('misheard') }
export const SayingMore: StoryObj = { name: 'Saying more', ...stateStory('sayingMore') }
export const SearchingAgain: StoryObj = { name: 'Searching again', ...stateStory('again') }
export const FoundAgain: StoryObj = { name: 'Found again', ...stateStory('againFound') }
export const Typing: StoryObj = { name: 'Typing', ...stateStory('typing') }
export const Cleared: StoryObj = { name: 'Cleared', ...stateStory('cleared') }
