// F479: the phone's search page (pages/SearchPage), each state of something going wrong. The journeys: stories/searchPhone.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { stateStory } from '../stories/searchPhone'

export default { title: 'UI/Search/Phone page/When it goes wrong', parameters: { layout: 'padded' } } satisfies Meta

export const NothingFound: StoryObj = { name: 'Nothing found', ...stateStory('nothing') }
export const NothingHeard: StoryObj = { name: 'Nothing heard', ...stateStory('unheard') }
export const NoMicrophone: StoryObj = { name: 'No microphone', ...stateStory('nomic') }
export const OutOfReach: StoryObj = { name: 'Taska out of reach', ...stateStory('offline') }
