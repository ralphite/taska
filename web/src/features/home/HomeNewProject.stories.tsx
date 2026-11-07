// New project from the home page (D115 #7): a popover under its button on the desktop, a sheet on the phone; one not
// made; and the home page with no projects yet: one line and one New project button, no table.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { shown } from '../../stories/homeFixtures'

export default { title: 'UI/Home page/A new project' } satisfies Meta
type Story = StoryObj

export const NewProject: Story = { name: 'Naming a new project', render: () => shown({}, 620, { value: 'Garden', error: '' }) }
export const NotCreated: Story = { name: 'Not made: why', render: () => shown({}, 620, { value: 'Shop', error: 'A project of that name exists' }) }
export const NoProjectsYet: Story = { name: 'No projects yet', render: () => shown({ rows: [], needs: 0 }, 420) }
export const NoProjectsYetNaming: Story = { name: 'No projects yet: naming the first', render: () => shown({ rows: [], needs: 0 }, 520, { value: '', error: '' }) }
