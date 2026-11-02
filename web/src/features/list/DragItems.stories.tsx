// Dragging an item, on the desktop with a mouse (on the phone a finger scrolls and swipes rows instead): the row you
// hold fades, the row under the pointer says where it would go (before or after it in the queue, or under it as a
// subitem), a subitem dragged off every row comes out from under its parent, and an item over a project in the
// sidebar moves there. The demo project's list drawn by the page's own steps, with the page's sidebar beside it.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frame } from '../../stories/Frames'
import { PROJECT, listOf, type Holding } from '../../stories/listFixtures'
import { side } from '../../stories/sideFixtures'

export default { title: 'Components/Drag and drop/Items' } satisfies Meta
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

export const PickedUp = drag('Picked up: the row you hold fades', { drag: { n: 6 } })
export const BeforeARow = drag('Over the top of a row: it goes before it in the queue', { drag: { n: 6, at: { n: 5, how: 'before' } } })
export const AfterARow = drag('Over the bottom of a row: it goes after it in the queue', { drag: { n: 5, at: { n: 6, how: 'after' } } })
export const UnderARow = drag('Over the middle of a row: it becomes its subitem', { drag: { n: 6, at: { n: 2, how: 'into' } } })
export const OffEveryRow = drag('A subitem off every row: it comes out from under its parent', { drag: { n: 14, at: { how: 'out' } } })
export const OverAProject = drag('Over a project in the sidebar: it moves to that project', { drag: { n: 6 } }, 'home')
