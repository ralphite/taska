// Naming a new project in the sidebar (T591: Sidebar): the page's own field where the projects are, Create (any name:
// its address is made from it), and why it was not made.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { After, Frames, typeInto } from '../../stories/Frames'
import { side } from '../../stories/sideFixtures'
import { NewProjectField } from './NewProjectField'

export default { title: 'Components/Around the page/Sidebar/A new project' } satisfies Meta
type Story = StoryObj

const on = { create: () => {}, cancel: () => {} }

export const NewProject: Story = { name: 'Naming it', render: () => <Frames phoneWidth={320} deskWidth={240} height={760}>{(layout) => side(layout === 'phone', { newProject: <NewProjectField error="" on={on} /> })}</Frames> }
const named = (root: HTMLElement) => root.querySelectorAll<HTMLInputElement>('input[aria-label="New project name"]').forEach((f) => typeInto(f, 'Shop'))
export const NewProjectNotMade: Story = { name: 'Not made', render: () => <Frames phoneWidth={320} deskWidth={240} height={760}>{(layout) => <After run={named}>{side(layout === 'phone', { newProject: <NewProjectField error="A project of that name exists" on={on} /> })}</After>}</Frames> }
