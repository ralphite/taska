import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { PICTURE } from '../../stories/fixtures'
import { Viewer } from './Viewer'

const meta: Meta = { title: 'Components/Viewer' }
export default meta
type Story = StoryObj

const on = { close: () => {}, prev: () => {}, next: () => {}, zoom: () => {} }

/** A picture of three, fit to the screen. */
export const Fit: Story = {
  render: () => <Frames phoneWidth={393} deskWidth={900} height={600}>{() => <div className="relative h-[600px] [transform:translateZ(0)]"><Viewer open name="shot.png" url={PICTURE} idx={1} count={3} fit on={on} /></div>}</Frames>,
}

/** One picture at 100%. */
export const Zoomed: Story = {
  render: () => <Frames phoneWidth={393} deskWidth={900} height={600}>{() => <div className="relative h-[600px] [transform:translateZ(0)]"><Viewer open name="shot.png" url={PICTURE} idx={0} count={1} fit={false} on={on} /></div>}</Frames>,
}
