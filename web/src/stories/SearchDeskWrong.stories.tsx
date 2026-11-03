// F479 on the desktop, a prototype: each state of something going wrong, in the dialog; then the results in dark and
// on a narrower desktop. The journeys: stories/searchDesk.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { deskStory } from './searchDesk'

export default { title: 'Prototype/F479 Search on the desktop/When it goes wrong' } satisfies Meta

export const NothingFound: StoryObj = { name: 'Nothing found', ...deskStory('nothing') }
export const DidntCatchThat: StoryObj = { name: 'Didn’t catch that', ...deskStory('unheard') }
/** The box takes typing instead. */
export const MicrophoneNotAllowed: StoryObj = { name: 'Microphone not allowed', ...deskStory('nomic') }
/** It keeps trying and searches by itself once Taska answers. */
export const CantReachTaska: StoryObj = { name: 'Can’t reach Taska', ...deskStory('offline') }
