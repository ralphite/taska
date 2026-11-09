// F479: the desktop's search (pages/SearchDialog): each state of something going wrong (the phone's words), then
// the dialog in dark and on a narrower desktop. The journeys: stories/searchDesk.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { deskStory } from '../stories/searchDesk'

export default { title: 'UI/Search/Desktop dialog/When it goes wrong, dark, narrower' } satisfies Meta

export const NothingFound: StoryObj = { name: 'Nothing found', ...deskStory('nothing') }
/** Taska refused the search: said so, not as nothing found (T728 #7). */
export const SearchFailed: StoryObj = { name: 'Search failed', ...deskStory('failed') }
export const DidntCatchThat: StoryObj = { name: "Didn't catch that", ...deskStory('unheard') }
/** The field takes typing instead. */
export const MicrophoneNotAllowed: StoryObj = { name: 'Microphone not allowed', ...deskStory('nomic') }
/** It keeps trying, and searches by itself once Taska answers. */
export const CantReachTaska: StoryObj = { name: "Can't reach Taska", ...deskStory('offline') }
export const ResultsDark: StoryObj = { name: 'Results, dark', globals: { theme: 'dark' }, ...deskStory('found') }
export const MisheardDark: StoryObj = { name: 'A word may be misheard, dark', globals: { theme: 'dark' }, ...deskStory('misheard') }
export const RecentDark: StoryObj = { name: 'Recent, dark', globals: { theme: 'dark' }, ...deskStory('recent') }
export const Results1100: StoryObj = { name: 'Results, 1100 wide', ...deskStory('found', { width: 1100 }) }
export const Page1100: StoryObj = { name: 'The page, 1100 wide', ...deskStory('closed', { width: 1100 }) }
