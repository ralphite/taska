// What the page shows when drawing it threw (T859): a short line and Reload in its place, never a blank window.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../stories/Frames'
import { RenderGuard } from './RenderGuard'

export default { title: 'UI/Page/Could not show' } satisfies Meta
type Story = StoryObj

function Throws(): never {
  throw new TypeError('n.tags is not iterable')
}

/** Drawing the page threw: one line, and Reload (without the copies this browser kept). */
export const CouldNotShow: Story = {
  render: () => (
    <Frames deskWidth={1100} phoneWidth={393} height={240}>
      {() => (
        <RenderGuard again={0} reload={() => {}}>
          <Throws />
        </RenderGuard>
      )}
    </Frames>
  ),
  name: 'Could not show the page',
}
