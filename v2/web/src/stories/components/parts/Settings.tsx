// T457: Settings, each section: its list of sections beside it on the desktop, a list of its own on the phone. Also
// the list column's Documents, Activity and Deleted (desktop), and the home page with every project.
// B555: each story is the real page at the section's address (after Yadong's steps there), showing that part of it.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { looksOf, place } from '../../lib/onpage'
import type { Do, Twin } from '../../lib/twin'

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

/** A section of Settings at its address: the whole of Settings (its sections beside it on the desktop). */
const section = (path: string, more: Partial<Twin> = {}, on?: 'phone'): Story =>
  place({ at: '/p/shop/' + path, part: '#projectView', ...more }, on)
/** The phone's list of sections (the desktop opens a section, Agents first). */
export const SettingsIndex = section('settings', {}, 'phone')
export const Agents = section('agents')
/** Agents when none has come yet (Website). */
export const AgentsNoneYet = section('agents', { at: '/p/website/agents' })
/** Documents, Activity and Deleted are sections on the phone; the desktop's sidebar opens them in the list column
 * (Side lists). */
export const Documents = section('docs', {}, 'phone')
export const Activity = section('log', {}, 'phone')
export const Deleted = section('deleted', {}, 'phone')
export const Projects = section('projects')
/** Renaming a project (its row's More on the phone, then Rename). */
export const ProjectsRenaming = section('projects', {
  steps: [
    { click: '#projectView [data-act="p-more"][data-key="shop"]', on: 'p' },
    { click: '#projectView [data-act="p-rename"][data-slug="shop"]' },
  ],
  live: false,
})
export const UseOnYourPhone = section('phone')
export const Notifications = section('notifications')
export const VoiceSpellings = section('spellings')
export const Organizer = section('organizer')

// ---------------------------------------------------------------- the list column's own lists (desktop)

/** As the page has them on the desktop: in the list column, and what is picked in the pane beside it. */
const side = (path: string, steps?: Do[]): Story =>
  place({ at: '/p/shop/' + path, part: ['#itemsView', '#detailView'], steps, live: false }, 'desktop')
export const ListDocuments = side('docs')
export const ListActivity = side('log')
export const ListDeleted = side('deleted')
/** A deleted input picked: what it was, and Restore. */
export const ListDeletedPicked = side('deleted', [{ click: '#sideList [data-act="gone-show"]' }])

// ---------------------------------------------------------------- under the pointer, the keys, on and off
// T522 (r731, r762): the sections of Settings and a row of the home page as the pointer, Tab or a press leaves them,
// side by side, each the real page. The desktop only.
const SEC = (k: string) => `#projectNav a[data-act="psec"][data-sec="${k}"]`
export const NavLooks: Story = looksOf({ at: '/p/shop/agents', part: '#projectNav' }, [
  { name: 'As it is (Agents open)' },
  { name: 'Pointer on a section', hover: SEC('projects') },
  { name: 'Pointer on the section open', hover: SEC('agents') },
  { name: 'Keys: Tab on a section', focus: SEC('projects') },
  { name: 'A section pressed', steps: [{ press: SEC('projects') }] },
  { name: 'Pointer on Back', hover: '#projectNav [data-act="project-back"]' },
])
const PROJ = 'li:first-child > a[href^="/p/"]'
export const HomeLooks: Story = looksOf({ at: '/', part: PROJ }, [
  { name: 'As it is' },
  { name: 'Pointer on a project', hover: PROJ },
  { name: 'A project pressed (mouse down)', steps: [{ press: PROJ }] },
  { name: 'Keys: Tab on a project', focus: PROJ },
])
/** Taska's home page: every project. */
export const HomePage = place({ at: '/', part: '#root > *' })
