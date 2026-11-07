// F479: the desktop's search (pages/SearchDialog): narrowing what it found (a kind, a project, a status), and the
// actions its words name. The journeys: stories/searchDesk.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { deskStory } from '../stories/searchDesk'

export default { title: 'UI/Search/Desktop dialog/Filters and actions' } satisfies Meta

export const OneKind: StoryObj = { name: 'One kind', ...deskStory('oneKind') }
export const ProjectMenu: StoryObj = { name: 'Project: its menu', ...deskStory('projectMenu') }
export const InOneProject: StoryObj = { name: 'In one project', ...deskStory('inHome') }
/** Status: items and rules only, open or finished. */
export const StatusOpen: StoryObj = { name: 'Status: open', ...deskStory('statusOpen') }
/** Words that name a command: it shows under Actions, after what they found. */
export const WithActions: StoryObj = { name: 'Results and an action', ...deskStory('actions') }
/** Nothing found, but a command matches: only Actions. */
export const OnlyActions: StoryObj = { name: 'Only an action', ...deskStory('onlyActions') }
