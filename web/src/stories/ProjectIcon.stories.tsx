// A project's picture (F743): an agent sets it (`project icon f12-logo.png`, an image it uploaded) and the page draws it
// wherever the project's tile is, in the same square; a project without one, or whose picture does not load, keeps its
// letter on its colour. Every place, through the page's own parts: the tile at each size, the sidebar folded to icons
// and open (desktop and phone), a project's card, Home, Switch project, Settings › Projects, a search's project heads.
// Light or dark: the toolbar.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { projectCard } from '../model/projects'
import { ProjectCard } from '../features/sidebar/ProjectCard'
import { Switcher } from '../features/find/Finders'
import { ProjTile } from '../ui/bits'
import { PROJECT_TONES } from '../ui/tones'
import { Frame, Frames, States } from './Frames'
import { ROWS as SWITCH_ROWS } from './findersFixtures'
import { rows as HOME_ROWS, shown } from './homeFixtures'
import { act, opened } from './menuFixtures'
import { PROJECT_ICONS, withIcon } from './projectIcons'
import { AT, SearchPhone } from './searchPhone'
import { one } from './sectionsFixtures'
import { rail, side } from './sideFixtures'

export default { title: 'Base components/Status icons and marks/Project icon' } satisfies Meta
type Story = StoryObj

const TILES: [string, string, string | undefined][] = [
  ['Taska', PROJECT_TONES[0], PROJECT_ICONS.taska],
  ['Home', PROJECT_TONES[1], PROJECT_ICONS.home],
  ['Notes', PROJECT_TONES[3], PROJECT_ICONS.notes],
  ['Shop', PROJECT_TONES[2], undefined],
  ['Gone', PROJECT_TONES[4], PROJECT_ICONS.long],
]
const SIZES: [string, string][] = [
  ['in a search result', 'size-4 rounded text-[9px]'],
  ["in the sidebar's list, the menus", 'size-5 rounded-md text-[11px]'],
  ["in the project's bar, the desktop's sidebar", 'size-6 rounded-md text-xs'],
  ['in the switcher, the rail', 'size-7 rounded-lg text-xs'],
  ["in the phone's drawer and Settings", 'size-8 rounded-lg text-sm'],
  ['over the New input page', 'size-11 rounded-xl text-xl shadow-sm'],
]

/** Taska's own icon, a filled one, a see-through favicon (on the tile's light plate), no picture (its letter), a picture
 * that does not load (its letter again): at every size the page draws a tile. */
export const Tiles: Story = {
  name: 'A picture or the letter',
  render: () => (
    <Frames phone={false} deskWidth={720}>
      {() => (
        <States
          items={SIZES.map(([where, cls]) => [
            where,
            <div className="flex flex-wrap items-center gap-3 p-3">
              {TILES.map(([title, tone, icon]) => (
                <ProjTile key={title} title={title} tone={tone} icon={icon} cls={cls} />
              ))}
            </div>,
          ])}
        />
      )}
    </Frames>
  ),
}

/** The sidebar folded to icons: each project told apart by its picture (Home, the notes), the others by their letter. */
export const Rail: Story = {
  name: 'Sidebar folded to icons',
  render: () => (
    <div className="flex gap-6 bg-zinc-200 p-6 dark:bg-zinc-800">
      <Frame layout="desk" width={56} height={520}>
        {rail({ icons: true })}
      </Frame>
    </div>
  ),
}

/** The sidebar open: the desktop's list and the phone's drawer. */
export const Sidebar: Story = {
  name: 'Sidebar',
  render: () => <Frames deskWidth={240} height={600}>{(layout) => side(layout === 'phone', { icons: true })}</Frames>,
}

/** A project's card (beside its row or its icon under the pointer). */
export const Card: Story = {
  name: "A project's card",
  render: () => (
    <div className="bg-zinc-200 p-6 dark:bg-zinc-800">
      <ProjectCard title="Home" tone={PROJECT_TONES[1]} icon={PROJECT_ICONS.home} card={projectCard({ open: 13, closed: 42, needs: 11, inputs: 120, docs: 6 }, 0)} href="#" />
    </div>
  ),
}

export const Home: Story = { name: 'Home', render: () => shown({ rows: HOME_ROWS.map((r) => ({ ...r, icon: PROJECT_ICONS[r.name] })) }) }

export const Switch: Story = {
  name: 'Switch project',
  render: () => (
    <Frames deskWidth={560} height={520}>
      {(layout) => opened({ title: 'Switch project', body: <Switcher rows={SWITCH_ROWS.map(withIcon)} loading={false} onOpen={act('Switch project: open')} /> }, layout === 'desk')}
    </Frames>
  ),
}

export const Settings: Story = { ...one('projects', { icons: true }), name: 'Settings › Projects' }

/** What a search found, under each project's head: Home by its picture, Shop by its letter. */
export const Search: Story = {
  name: "A search's projects",
  render: () => (
    <Frame layout="phone">
      <SearchPhone start={AT.found} still icons />
    </Frame>
  ),
}
