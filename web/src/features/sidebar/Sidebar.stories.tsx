// The sidebar and the phone's drawer: its projects, under the pointer, from the keys, pressed; the drawer's foot; loading; a project not listed yet.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { After, Frame, Frames } from '../../stories/Frames'
import { side, sideOn } from '../../stories/sideFixtures'
import { Sidebar } from './Sidebar'
import { SIDE_KEYS } from './sideLinks'
import { mark } from '../../stories/sidebarFixtures'

export default { title: 'Components/Around the page/Sidebar/The sidebar' } satisfies Meta
type Story = StoryObj

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
/** The drawer's foot on the phone: Undo of what you did last (a phone has no Z), the links. */
export const DrawerFoot: Story = { name: 'Drawer foot on the phone', render: () => <Frames desk={false} phoneWidth={320} height={760}>{() => side(true, { undo: 'T009 approved' })}</Frames> }
// ---- more states (B636)
export const ProjectsLoading: Story = { name: 'Projects loading (phone drawer)', render: () => <Frames desk={false} phoneWidth={320} height={420}>{() => side(true, { loading: true })}</Frames> }
/** Before the projects were ever listed in this browser. */
export const NotListedYet: Story = {
  name: 'Not listed yet',
  render: () => <Frames phoneWidth={320} deskWidth={240} height={420}>{(layout) => <Sidebar phone={layout === 'phone'} keys={SIDE_KEYS} projects={null} composing={false} links={[]} place={layout === 'phone' ? 'h-full bg-zinc-100' : 'h-full bg-zinc-50'} on={sideOn} />}</Frames>,
}
// ---- more states (T639)
/** a project in the phone's drawer pressed (a finger on it) */
export const DrawerProjectPressed: Story = {
  name: 'Phone drawer: a project pressed',
  render: () => <Frames desk={false} phoneWidth={320} height={560}>{() => <After run={mark('home', 'data-pressed')}>{side(true)}</After>}</Frames>,
}
