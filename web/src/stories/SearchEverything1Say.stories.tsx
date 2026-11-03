// F479 (r982): searching by voice on the phone, each state of saying what to find and what it found. The journeys:
// searchProto.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { stateStory } from './searchProto'

export default { title: 'Prototype/F479 Search everything/Say and search', parameters: { layout: 'padded' } } satisfies Meta

export const Listening: StoryObj = { name: 'Listening', ...stateStory('listening') }
export const WritingItOut: StoryObj = { name: 'Writing out what you said', ...stateStory('writing') }
export const Searching: StoryObj = { name: 'Searching', ...stateStory('searching') }
export const Found: StoryObj = { name: 'Found', ...stateStory('found') }
export const OneKind: StoryObj = { name: 'Only one kind', ...stateStory('oneKind') }
export const AResultOpen: StoryObj = { name: 'A result open', ...stateStory('open') }
