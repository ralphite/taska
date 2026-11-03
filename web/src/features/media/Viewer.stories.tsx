// A picture opened from where it is (T591: Floating > Picture viewer): the page's own Viewer over the page, the
// picture fit to the screen with which of how many it is, or at 100%.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { listOf, PROJECT } from '../../stories/listFixtures'
import { Viewer } from './Viewer'

export default { title: 'Components/Around the page/Floating/Picture viewer' } satisfies Meta
type Story = StoryObj

const on = { close: () => {}, prev: () => {}, next: () => {}, zoom: () => {} }
/** a screenshot larger than the window (1600×1000), so fitted and at 100% differ */
const BIG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#eff6ff"/><rect x="80" y="80" width="600" height="60" rx="12" fill="#60a5fa"/><rect x="80" y="200" width="1440" height="40" rx="10" fill="#93c5fd"/><rect x="80" y="280" width="1100" height="40" rx="10" fill="#93c5fd"/><rect x="80" y="360" width="1300" height="40" rx="10" fill="#bfdbfe"/></svg>')}`
const one = (fit: boolean, idx: number, count: number): Story => ({
  render: () => (
    <Frames phoneWidth={393} deskWidth={900} height={600}>
      {(layout) => (
        <div className="relative h-full">
          {listOf(PROJECT, 'items', {}, layout === 'desk')}
          <Viewer open name="shot.png" url={BIG} idx={idx} count={count} fit={fit} on={on} />
        </div>
      )}
    </Frames>
  ),
})

/** The second of three pictures, fit to the screen. */
export const Fit: Story = { ...one(true, 1, 3), name: 'Fitted to the window' }
/** The same at 100%: still which of how many it is. */
export const Zoomed: Story = { ...one(false, 1, 3), name: 'At 100%' }
/** One picture alone: no Previous or Next. */
export const OnePicture: Story = { ...one(true, 0, 1), name: 'One picture' }
