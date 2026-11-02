// Settings' Projects: the list of projects, and renaming one.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { one } from '../../stories/sectionsFixtures'

export default { title: 'Components/Settings/Projects' } satisfies Meta
type Story = StoryObj

/** Every project (this one with this page's counts), new, rename, delete; a deleted one asking to be deleted forever. */
export const Projects: Story = { ...one('projects', { projects: { purging: ['old'] } }), name: 'Projects' }
export const ProjectsRenaming: Story = { ...one('projects', { projects: { renaming: 'home', pErr: 'A project with that address exists' } }), name: 'Renaming a project' }
