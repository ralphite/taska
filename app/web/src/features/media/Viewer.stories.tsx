// A picture opened from where it is (T591: Floating > Picture viewer): the page's own Viewer over the page, the
// picture fit to the screen with which of how many it is, or at 100%.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { PICTURE } from '../../stories/fixtures'
import { listOf, PROJECT } from '../../stories/listFixtures'
import { Viewer } from './Viewer'

export default { title: 'Components/Floating/Picture viewer' } satisfies Meta
type Story = StoryObj

const on = { close: () => {}, prev: () => {}, next: () => {}, zoom: () => {} }
const one = (fit: boolean, idx: number, count: number): Story => ({
  render: () => (
    <Frames phoneWidth={393} deskWidth={900} height={600}>
      {(layout) => (
        <div className="relative h-full">
          {listOf(PROJECT, 'items', {}, layout === 'desk')}
          <Viewer open name="shot.png" url={PICTURE} idx={idx} count={count} fit={fit} on={on} />
        </div>
      )}
    </Frames>
  ),
})

/** The second of three pictures, fit to the screen. */
export const Fit: Story = { ...one(true, 1, 3), name: 'Picture viewer' }
export const Zoomed: Story = { ...one(false, 0, 1), name: 'At 100%' }
