// The sidebar and the phone's drawer: its projects, under the pointer, from the keys, pressed; loading; a project not
// listed yet. Its foot is in SidebarBottomLinks.stories.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { After, Frame, Frames } from '../../stories/Frames'
import { side } from '../../stories/sideFixtures'
import { mark } from '../../stories/sidebarFixtures'

export default { title: 'UI/Left sidebar/Whole' } satisfies Meta
type Story = StoryObj

/** The desktop's sidebar (New input lit while you write one) and the phone's drawer: the projects in your order, each
 * with the Needs you mark when something there needs you (how many in its tip) and how many are open; Documents,
 * Activity, Deleted; the foot, Help above Settings. On the desktop Hide sidebar folds
 * it to the rail (Show sidebar unfolds it) and its right edge drags it wider or narrower (a double-click puts it back);
 * New project names one. What needs the rest of the page (a project, Settings, Search) shows in the Actions panel. */
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
// ---- more states (B636)
export const ProjectsLoading: Story = { name: 'Projects loading (phone drawer)', render: () => <Frames desk={false} phoneWidth={320} height={420}>{() => side(true, { loading: true })}</Frames> }
/** Before the projects were ever listed in this browser. */
export const NotListedYet: Story = {
  name: 'Not listed yet',
  render: () => <Frames phoneWidth={320} deskWidth={240} height={420}>{(layout) => side(layout === 'phone', { loading: true, noLinks: true })}</Frames>,
}
