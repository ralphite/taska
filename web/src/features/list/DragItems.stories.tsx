// Dragging an item, on the desktop with a mouse (on the phone a finger scrolls and swipes rows instead): the row you
// hold fades, the row under the pointer says where it would go (before or after it in the queue, or under it as a
// subitem), a subitem dragged off every row comes out from under its parent, and an item over a project in the
// sidebar moves there. The demo project's list drawn by the page's own steps, with the page's sidebar beside it.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frame } from '../../stories/Frames'
import { PROJECT, listOf, type Holding } from '../../stories/listFixtures'
import { side } from '../../stories/sideFixtures'

export default { title: 'UI/List pane/Dragging items' } satisfies Meta
type Story = StoryObj

const drag = (label: string, h: Holding, drop?: string): Story => ({
  name: label,
  render: () => (
    <div className="flex flex-wrap items-start gap-6 bg-zinc-200 p-6 dark:bg-zinc-800">
      <Frame layout="desk" width={240} height={760} label="sidebar">
        {side(false, { drop })}
      </Frame>
      <Frame layout="desk" width={460} height={760} label="list">
        {listOf(PROJECT, 'items', { status: 'all' }, true, h)}
      </Frame>
    </div>
  ),
})

export const PickedUp: Story = { ...drag('Picked up: the row you hold fades', { drag: { n: 6 } }), name: 'Picked up' }
export const BeforeARow: Story = { ...drag('Over the top of a row: it goes before it in the queue', { drag: { n: 6, at: { n: 5, how: 'before' } } }), name: 'Before a row' }
export const AfterARow: Story = { ...drag('Over the bottom of a row: it goes after it in the queue', { drag: { n: 5, at: { n: 6, how: 'after' } } }), name: 'After a row' }
export const UnderARow: Story = { ...drag('Over the middle of a row: it becomes its subitem', { drag: { n: 6, at: { n: 2, how: 'into' } } }), name: 'Under a row' }
export const OffEveryRow: Story = { ...drag('A subitem off every row: it comes out from under its parent', { drag: { n: 14, at: { how: 'out' } } }), name: 'Off every row' }
export const OverAProject: Story = { ...drag('Over a project in the sidebar: it moves to that project', { drag: { n: 6 } }, 'home'), name: 'Over a project' }
