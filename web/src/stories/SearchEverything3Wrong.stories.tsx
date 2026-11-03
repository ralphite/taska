// F479 (r982): searching by voice on the phone, each state of something going wrong. The journeys: searchProto.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { stateStory } from './searchProto'

export default { title: 'Prototype/F479 Search everything/When it goes wrong', parameters: { layout: 'padded' } } satisfies Meta

export const NothingFound: StoryObj = { name: 'Nothing found', ...stateStory('nothing') }
export const NothingHeard: StoryObj = { name: 'Nothing heard', ...stateStory('unheard') }
export const NoMicrophone: StoryObj = { name: 'No microphone', ...stateStory('nomic') }
export const OutOfReach: StoryObj = { name: 'Taska out of reach', ...stateStory('offline') }
