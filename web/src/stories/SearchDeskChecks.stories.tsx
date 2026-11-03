// F479 on the desktop, a prototype: the dialog in dark, and on a narrower desktop (1100 wide). The journeys:
// stories/searchDesk.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { deskStory, pageStory } from './searchDesk'

export default { title: 'Prototype/F479 Search on the desktop/Dark and narrower' } satisfies Meta

export const ResultsDark: StoryObj = { name: 'Results, dark', globals: { theme: 'dark' }, ...deskStory('found') }
export const ListeningDark: StoryObj = { name: 'Listening, dark', globals: { theme: 'dark' }, ...deskStory('listening') }
export const MisheardDark: StoryObj = { name: 'A word may be misheard, dark', globals: { theme: 'dark' }, ...deskStory('misheard') }
export const Results1100: StoryObj = { name: 'Results, 1100 wide', ...deskStory('found', { width: 1100 }) }
export const Page1100: StoryObj = { name: 'The page, 1100 wide', ...pageStory({ width: 1100 }) }
