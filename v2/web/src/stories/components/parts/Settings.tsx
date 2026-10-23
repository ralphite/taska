// T457: Settings, each section: its list of sections beside it on the desktop, a list of its own on the phone. Also
// the list column's Documents, Activity and Deleted (desktop), and the home page with every project.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProjectView } from '../../../components/Settings'
import { DetailView } from '../../../components/Detail'
import { ListColumn } from '../../lib/column'
import { Home } from '../../../pages/Home'
import { D, U, desk, model } from '../../../lib/state'
import { loadFixes, loadGuide, loadProjects } from '../../../lib/settings'
import { Pane, type Setup } from '../../lib/demo'

// what this part of Storybook shows (T512: its stories are in the folders beside this file)
export const area: Meta = {
  parameters: {
    covers: [
      'ProjectView',
      'Part',
      'Setting',
      'Box',
      'CopyBtn',
      'Ruled',
      'Loading',
      'Toggle',
      'LogMore',
      'LogList',
      'AgentCard',
      'GoneRows',
      'PhonePush',
      'DeskNav',
      'PhHead',
      'PhLabel',
      'PhNote',
      'PhoneIndex',
      'PhoneProjects',
      'PhoneSection',
      'Docs',
      'Log',
      'DeletedInput',
      'Deleted',
      'DeletedView',
      'Home',
      'AgentCell',
    ],
  },
}
export type Story = StoryObj

const section = (sec: string | null, setup?: (x: Setup) => void): Story => ({
  parameters: {
    taska: {
      setup: (x) => {
        D.page = 'project'
        D.section = sec
        // what opening a section asks Taska for (lib/nav.ts)
        loadGuide()
        void loadFixes(true)
        void loadProjects(true)
        setup?.(x)
      },
    },
  },
  render: () => (
    // Settings fills the window on the desktop: the sidebar gives way to its own list of sections
    <Pane w="full" h="flex h-screen flex-col">
      <ProjectView hidden={false} />
    </Pane>
  ),
})
/** The phone's list of sections (the desktop opens on Agents). */
export const SettingsIndex = section(null, () => {
  if (desk()) D.section = 'agents'
})
export const Agents = section('agents')
/** Agents when none has come yet. */
export const AgentsNoneYet: Story = {
  ...section('agents'),
  parameters: { taska: { ...section('agents').parameters!.taska, project: 'website' } },
}
export const Documents = section('docs')
export const Activity = section('log')
export const Deleted = section('deleted')
export const Projects = section('projects')
/** Renaming a project. */
export const ProjectsRenaming = section('projects', () => (U.renaming = 'shop'))
export const UseOnYourPhone = section('phone')
export const Notifications = section('notifications')
export const VoiceSpellings = section('fixes')
export const Organizer = section('organizer')

// ---------------------------------------------------------------- the list column's own lists (desktop)

const side = (s: 'docs' | 'log' | 'deleted', setup?: (x: Setup) => void): Story => ({
  parameters: { taska: { setup: (x) => ((U.side = s), setup?.(x)) } },
  // as the page has them on the desktop: in the list column, and what is picked in the pane beside it
  render: () => (
    <div className="flex">
      <ListColumn />
      <Pane w="item" h="flex h-screen flex-col lg:h-[calc(100dvh-3rem)]">
        <DetailView hidden={false} />
      </Pane>
    </div>
  ),
})
export const ListDocuments = side('docs')
export const ListActivity = side('log')
export const ListDeleted = side('deleted')
/** A deleted input picked: what it was, and Restore. */
export const ListDeletedPicked = side('deleted', ({ S }) => (U.sideSel = S.deleted[0]?.id || null))

// ---------------------------------------------------------------- the home page

export const HomePage: Story = {
  parameters: { taska: { setup: () => (model.S.project = '') } },
  render: () => (
    <div className="min-h-dvh bg-zinc-100 text-zinc-900 antialiased dark:bg-zinc-900 dark:text-zinc-100">
      <Home />
    </div>
  ),
}
