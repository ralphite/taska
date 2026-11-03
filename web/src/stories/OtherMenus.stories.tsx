// The other menus (T591: Menus and sheets > Other menus): a message's and a project's in the sidebar (this one,
// another), the page's own parts as the page opens them: at the button or the pointer on the desktop, a sheet on the
// phone. Your views' menu is in ViewMenu.stories; what you said's menu in InputMenu.stories.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { messageMenuSheet } from '../features/item/ItemSheets'
import { projectMenuSheet } from '../ui/ProjectSheets'
import { PROJECT_TONES } from '../ui/tones'
import { Frames } from './Frames'
import { AT_BUTTON, AT_POINTER, no, opened } from './menuFixtures'

export default { title: 'Components/Around the page/Menus and sheets/Other menus' } satisfies Meta
type Story = StoryObj

const both = (draw: (desk: boolean) => ReturnType<typeof opened>, height = 480): Story => ({ render: () => <Frames height={height} deskWidth={900} phoneWidth={393}>{(layout) => draw(layout === 'desk')}</Frames> })
const home = { slug: 'home', title: 'Home', tone: PROJECT_TONES[1], open: 13 }

/** A message's ⋯: hide it from the talk. */
export const MessageMenu: Story = { ...both((desk) => opened(messageMenuSheet(no), desk, { look: desk ? { pop: true, at: AT_BUTTON } : {} }), 320), name: 'Message' }
/** The sidebar's right-click on the project you are in. */
export const ProjectMenuHere: Story = { ...both((desk) => opened(projectMenuSheet({ here: true, slug: 'taska', title: 'taska', tone: PROJECT_TONES[0], open: 24 }, { open: no, settings: no, manage: no }), desk, { look: desk ? { pop: true, at: AT_POINTER(40, 120) } : {} }), 360), name: 'This project' }
export const ProjectMenuOther: Story = { ...both((desk) => opened(projectMenuSheet({ here: false, ...home }, { open: no, settings: no, manage: no }), desk, { look: desk ? { pop: true, at: AT_POINTER(40, 160) } : {} }), 360), name: 'Another project' }
