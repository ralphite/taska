// A picture opened from where it is (T591: Floating > Picture viewer): the page's own Viewer over the page, the
// picture fit to the screen with which of how many it is, or at 100%.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, Hold } from '../../stories/Frames'
import { listOf, PROJECT } from '../../stories/listFixtures'
import SHOT from '../../stories/assets/screenshot-search.jpg'
import { Viewer } from './Viewer'

export default { title: 'UI/Floating/Picture viewer' } satisfies Meta
type Story = StoryObj

/** a real screenshot larger than the window (1600×1001), so fitted and at 100% differ; not a drawing that reads as a
 * loading placeholder (B709) */
const BIG = SHOT
const one = (fit: boolean, idx: number, count: number): Story => ({
  render: () => (
    <Frames phoneWidth={393} deskWidth={900} height={600}>
      {(layout) => (
        <div className="relative h-full">
          {listOf(PROJECT, 'items', {}, layout === 'desk')}
          {/* the page's media.close, step and zoom: × closes it, ‹ › step through the pictures, the picture zooms */}
          <Hold start={{ open: true, idx, fit }}>
            {(v, set) =>
              v.open ? <Viewer open name="shot.png" url={BIG} idx={v.idx} count={count} fit={v.fit} on={{ close: () => set({ ...v, open: false }), prev: () => set({ ...v, idx: (v.idx - 1 + count) % count }), next: () => set({ ...v, idx: (v.idx + 1) % count }), zoom: () => set({ ...v, fit: !v.fit }) }} /> : null
            }
          </Hold>
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
