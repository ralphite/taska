// Settings' Projects: the list of projects, and renaming one.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { one } from '../../stories/sectionsFixtures'
import { Frames } from '../../stories/Frames'
import { settingsAt } from '../../stories/settingsFixtures'
import { opened } from '../../stories/menuFixtures'
import { act, acts } from '../../stories/acts'
import { goneProjectMenuSheet, projectMenuSheet } from '../../ui/ProjectSheets'
import { PROJECT_TONES } from '../../ui/tones'

export default { title: 'Components/Settings, help and parts/Settings/Projects' } satisfies Meta
type Story = StoryObj

/** Every project (this one with this page's counts), new, rename, delete; a deleted one asking to be deleted forever. */
/** the pointer on the first: its Rename and Delete (the desktop shows a row's buttons under the pointer or the keys) */
export const Projects: Story = { ...one('projects', { projects: { purging: ['old'] } }), name: 'Every project', parameters: { pseudo: { hover: ['li.group:first-of-type'] } } }
export const ProjectsRenaming: Story = { ...one('projects', { projects: { renaming: 'home', pErr: 'A project with that address exists' } }), name: 'Renaming a project' }
// ---- more states (T639)
export const NewProjectNaming: Story = { ...one('projects', { projects: { pNew: true, pNewText: 'Garden' } }), name: 'New project: naming it' }
export const NewProjectNotMade: Story = { ...one('projects', { projects: { pNew: true, pNewText: 'Shop', newErr: 'A project with that address exists' } }), name: 'New project: not made' }
/** the phone's ⋯ opens the project's menu as a sheet, as its other ⋯ do (r1095) */
const sheetOver = (parts: Parameters<typeof opened>[0]): Story => ({ render: () => <Frames desk={false}>{() => opened(parts, false, { under: settingsAt('projects', false) })}</Frames> })
const projectOn = acts('Project menu', ['open', 'settings', 'rename', 'remove'])
export const PhoneProjectMenuOpen: Story = { ...sheetOver(projectMenuSheet({ here: false, slug: 'home', title: 'Home', tone: PROJECT_TONES[1], open: 13, settingsKeys: '' }, projectOn)), name: "On the phone: a project's ⋯ open" }
export const PhoneDeletedProjectPurging: Story = { ...sheetOver(goneProjectMenuSheet({ title: 'Old', asking: true }, act('Project menu: delete forever'))), name: "On the phone: a deleted project's Delete forever asks again" }
export const ProjectsLoading: Story = { ...one('projects', { projectsLoading: true }), name: 'Loading' }
export const ProjectsNoneDeleted: Story = { ...one('projects', { noneDeleted: true }), name: 'None deleted' }
