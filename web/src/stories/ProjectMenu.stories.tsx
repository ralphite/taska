// A project's menu in the sidebar (T591: Menus and sheets > Other menus): this one, another; the page's own part as
// the page opens it, at the pointer on the desktop.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { keysShown } from '../app/actions'
import { projectMenuSheet } from '../ui/ProjectSheets'
import { PROJECT_TONES } from '../ui/tones'
import { Frames } from './Frames'
import { AT_POINTER, acts, opened } from './menuFixtures'

export default { title: 'UI/Left sidebar/Projects list/Project item/Its menu' } satisfies Meta
type Story = StoryObj

const home = { slug: 'home', title: 'Home', tone: PROJECT_TONES[1], open: 13 }
const projectOn = acts('Project menu', ['open', 'settings', 'rename', 'remove'])

/** The sidebar's right-click on the project you are in: the desktop only (the phone's projects have no menu). */
const deskOnly = (draw: () => ReturnType<typeof opened>): Story => ({ render: () => <Frames height={360} deskWidth={900} phone={false}>{() => draw()}</Frames> })
export const ProjectMenuHere: Story = { ...deskOnly(() => opened(projectMenuSheet({ here: true, slug: 'taska', title: 'taska', tone: PROJECT_TONES[0], open: 24, settingsKeys: keysShown('settings') }, projectOn), true, { look: { pop: true, at: AT_POINTER(40, 120) } })), name: 'This project' }
export const ProjectMenuOther: Story = { ...deskOnly(() => opened(projectMenuSheet({ here: false, ...home, settingsKeys: keysShown('settings') }, projectOn), true, { look: { pop: true, at: AT_POINTER(40, 160) } })), name: 'Another project' }
