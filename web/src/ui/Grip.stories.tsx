// The line between panes, as the page draws it: the desktop's two columns of an item, the line between them as it is,
// under the pointer, and being dragged (blue). Drag it to resize; a double-click puts it back.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frame, States } from '../stories/Frames'
import { it } from '../stories/itemPageLayoutFixtures'
import { pageOf } from '../stories/itemPage'

const meta: Meta = { title: 'UI/Item pane/Layout' }
export default meta
type Story = StoryObj

// an item with its talk, so the column beside it is the talk
const page = (duoDragged?: string) => pageOf(it(), true, { duo: true, duoDragged })

/** A pane's edge: as it is, pointed at, dragged. */
export const Edge: Story = {
  name: 'The line between the columns: as it is, pointer, dragged',
  parameters: { pseudo: { hover: ['[data-look="pointer"] [data-grip="duo"]'] } },
  render: () => (
    <States
      items={[
        ['as it is', <Frame layout="desk" width={1100} height={320}>{page()}</Frame>],
        ['pointer on it', <div data-look="pointer"><Frame layout="desk" width={1100} height={320}>{page()}</Frame></div>],
        // dragged to the left: the line where the pointer has it, the columns as wide as it says
        ['being dragged', <Frame layout="desk" width={1100} height={320}>{page('40%')}</Frame>],
      ]}
    />
  ),
}
