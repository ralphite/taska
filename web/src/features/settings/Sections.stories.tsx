// Settings' Projects: the list of projects, and renaming one.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { one } from '../../stories/sectionsFixtures'

export default { title: 'Components/Settings/Projects' } satisfies Meta
type Story = StoryObj

/** Every project (this one with this page's counts), new, rename, delete; a deleted one asking to be deleted forever. */
export const Projects: Story = { ...one('projects', { projects: { purging: ['old'] } }), name: 'Projects' }
export const ProjectsRenaming: Story = { ...one('projects', { projects: { renaming: 'home', pErr: 'A project with that address exists' } }), name: 'Renaming a project' }
// ---- more states (T639)
export const NewProjectNaming: Story = { ...one('projects', { projects: { pNew: true, pNewText: 'Garden' } }), name: 'New project: naming it' }
export const NewProjectNotMade: Story = { ...one('projects', { projects: { pNew: true, pNewText: 'Shop', pErr: 'A project with that address exists' } }), name: 'New project: not made' }
export const PhoneProjectMenuOpen: Story = { ...one('projects', { projects: { menu: 'home' } }), name: "On the phone: a project's ⋯ open" }
export const PhoneDeletedProjectPurging: Story = { ...one('projects', { projects: { menu: 'old', purging: ['old'] } }), name: "On the phone: a deleted project's Delete forever asks again" }
export const ProjectsLoading: Story = { ...one('projects', { projectsLoading: true }), name: 'Projects: loading' }
export const ProjectsNoneDeleted: Story = { ...one('projects', { noneDeleted: true }), name: 'Projects: none deleted' }
