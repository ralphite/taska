// The sidebar and the phone's drawer, one story for each state: the page's own list of projects (sideProjects, in your order, this one with this page's counts) and links
// (sideLinks), and the page's Sidebar and Rail.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { After, Frame, Frames } from '../../stories/Frames'
import { rail, side, sideOn } from '../../stories/sideFixtures'
import { Sidebar } from './Sidebar'

export default { title: 'Components/Sidebar' } satisfies Meta
type Story = StoryObj

/** Marks a row as the page's own code does while you press it or drag it. */
const mark = (slug: string, attr: string) => (root: HTMLElement) => root.querySelector(`a[data-slug="${slug}"]`)?.setAttribute(attr, '')

/** The desktop's sidebar (New input lit while you write one) and the phone's drawer: the projects in your order, each
 * with what needs you and how many are open; Documents, Activity, Deleted; the foot. */
export const Projects: Story = { name: 'Sidebar and phone drawer', render: () => <Frames phoneWidth={320} deskWidth={240} height={760}>{(layout) => side(layout === 'phone', { composing: true })}</Frames> }
/** A project under the pointer, from the keys, pressed, dragged to a new place, and one an item from the list is
 * dragged over. */
export const SidebarLooks: Story = {
  name: 'Pointer, keys, pressed, dragged: all side by side',
  parameters: { pseudo: { hover: ['[data-look="pointer"] a[data-slug="home"]', '[data-look="current"] a[data-slug="shop"]', '[data-look="new-input"] .group\\/ni'], focusVisible: ['[data-look="keys"] a[data-slug="home"]'] } },
  render: () => (
    <div className="flex flex-wrap gap-6 bg-zinc-200 p-6 dark:bg-zinc-800">
      {(
        [
          ['pointer on Home', 'pointer', {}],
          ['pointer on Shop, the current project', 'current', {}],
          ['pointer on New input: its mic shows', 'new-input', {}],
          ['keys: Tab on Home', 'keys', {}],
          ['Home pressed', 'pressed', {}],
          ['Home dragged', 'dragged', {}],
          ['an item dragged over Home', 'drop', { drop: 'home' }],
        ] as const
      ).map(([label, look, f]) => (
        <Frame key={look} layout="desk" width={240} height={720} label={label}>
          <div data-look={look} className="h-full">
            <After run={look === 'pressed' ? mark('home', 'data-pressed') : look === 'dragged' ? mark('home', 'data-dragging') : () => {}}>{side(false, f)}</After>
          </div>
        </Frame>
      ))}
    </div>
  ),
}
/** Documents open beside the pane (lit), and the pointer on Activity. */
export const SidebarSideOpenLooks: Story = {
  name: 'Documents open, and the pointer',
  parameters: { pseudo: { hover: ['nav a[href$="/log"]'] } },
  render: () => <Frames phone={false} deskWidth={240} height={760}>{() => side(false, { side: 'docs' })}</Frames>,
}
export const ActivityOpen: Story = {
  name: 'Activity open',
  render: () => <Frames phone={false} deskWidth={240} height={760}>{() => side(false, { side: 'log' })}</Frames>,
}
export const DeletedOpen: Story = {
  name: 'Deleted open',
  render: () => <Frames phone={false} deskWidth={240} height={760}>{() => side(false, { side: 'deleted' })}</Frames>,
}
/** The sidebar folded to icons: a project under the pointer, from the keys, pressed. */
export const RailLooks: Story = {
  name: 'Folded to icons: pointer, keys, pressed',
  parameters: { pseudo: { hover: ['[data-look="pointer"] #rail a:nth-of-type(1)'], focusVisible: ['[data-look="keys"] #rail a:nth-of-type(1)'], active: ['[data-look="pressed"] #rail a:nth-of-type(1)'] } },
  render: () => (
    <div className="flex gap-6 bg-zinc-200 p-6 dark:bg-zinc-800">
      {(['pointer', 'keys', 'pressed'] as const).map((look) => (
        <Frame key={look} layout="desk" width={56} height={420} label={look}>
          <div data-look={look} className="h-full">
            {rail()}
          </div>
        </Frame>
      ))}
    </div>
  ),
}
/** The drawer's foot on the phone: Undo of what you did last (a phone has no Z), the links. */
export const DrawerFoot: Story = { name: 'Drawer foot on the phone', render: () => <Frames desk={false} phoneWidth={320} height={760}>{() => side(true, { undo: 'T009 approved' })}</Frames> }
export const RailFolded: Story = { name: 'Folded to icons', render: () => <div className="flex gap-6 bg-zinc-200 p-6 dark:bg-zinc-800"><Frame layout="desk" width={56} height={560}>{rail()}</Frame></div> }
/** Before the projects were ever listed in this browser. */
export const NotListedYet: Story = {
  name: 'Not listed yet',
  render: () => <Frames phoneWidth={320} deskWidth={240} height={420}>{(layout) => <Sidebar phone={layout === 'phone'} projects={null} composing={false} links={[]} place={layout === 'phone' ? 'h-full bg-zinc-100' : 'h-full bg-zinc-50'} on={sideOn} />}</Frames>,
}
