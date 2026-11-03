// Making a new project, and one not made.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { shown } from '../../stories/homeFixtures'

export default { title: 'Components/Around the page/Home page/A new project' } satisfies Meta
type Story = StoryObj

/** A new project's name being typed, and why it was not made. */
export const NewProject: Story = { name: 'Naming a new project', render: () => shown({ making: { error: '' } }, 420) }
export const NotCreated: Story = { name: 'Not made: why', render: () => shown({ making: { error: 'Connection lost; try again' } }, 420) }
