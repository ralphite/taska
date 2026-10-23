// T521: Pages > Settings: each page of the settings
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SHOP, pageParams, screen } from './screens'

const meta: Meta = { title: 'Pages/Settings', parameters: pageParams() }
export default meta

/** The phone opens Settings on its list of pages; the desktop opens it on Agents, with the list beside it. */
export const Menu: StoryObj = { ...screen(SHOP + 'settings', 'phone'), name: 'Settings menu' }
export const Agents: StoryObj = { ...screen(SHOP + 'agents'), name: 'Agents' }
export const Projects: StoryObj = { ...screen(SHOP + 'projects'), name: 'Projects' }
export const UseOnYourPhone: StoryObj = { ...screen(SHOP + 'phone'), name: 'Use on your phone' }
export const Notifications: StoryObj = { ...screen(SHOP + 'notifications'), name: 'Notifications' }
export const VoiceSpellings: StoryObj = { ...screen(SHOP + 'spellings'), name: 'Voice spellings' }
export const Organizer: StoryObj = { ...screen(SHOP + 'organizer'), name: 'Organizer' }
/** T522: Settings opened (or reloaded) while Taska has not answered: "Loading…" under the page's title. */
export const Loading: StoryObj = {
  ...screen(SHOP + 'agents', undefined, { net: { '^/(p|api)/': 'hang' } }),
  name: 'Loading',
}
/** T522: the project's data is here, the list of every project is not yet: Projects says "Loading…". */
export const ProjectsLoading: StoryObj = {
  ...screen(SHOP + 'projects', undefined, { net: { '^/api/projects': 'hang' } }),
  name: 'Projects: loading',
}
