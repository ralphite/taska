// The line between panes, as the page draws it: the desktop's two columns of an item, the line between them as it is,
// under the pointer, and being dragged (blue). Drag it to resize; a double-click puts it back.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { After, Frame, States } from '../stories/Frames'
import { item } from '../stories/fixtures'
import { pageOf } from '../stories/itemPage'

const meta: Meta = { title: 'Components/Item page/Layout and editing' }
export default meta
type Story = StoryObj

const page = () => pageOf(item({ n: 12, title: 'Export keeps the filter you set', body: 'The export should write the rows the list shows.' }), true, { duo: true })

/** A pane's edge: as it is, pointed at, dragged. */
export const Edge: Story = {
  name: 'The line between panes: as it is, pointer, dragged',
  parameters: { pseudo: { hover: ['[data-look="pointer"] [data-grip="duo"]'] } },
  render: () => (
    <States
      items={[
        ['as it is', <Frame layout="desk" width={1100} height={320}>{page()}</Frame>],
        ['pointer on it', <div data-look="pointer"><Frame layout="desk" width={1100} height={320}>{page()}</Frame></div>],
        ['being dragged', <Frame layout="desk" width={1100} height={320}><After run={(root) => root.querySelector('[data-grip="duo"]')?.setAttribute('data-drag', '')}>{page()}</After></Frame>],
      ]}
    />
  ),
}
