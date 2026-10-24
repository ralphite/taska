import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frame } from '../../stories/Frames'
import { Lasso } from './Lasso'

const meta: Meta = { title: 'Components/Document/Mark an area' }
export default meta
type Story = StoryObj

/** Drawing around paragraphs picks them (draw with the pointer here). */
export const Drawing: Story = {
  render: () => (
    <Frame layout="phone" width={393} height={360}>
      <div className="relative space-y-3 p-4 text-[15px]">
        <section data-key="a">The new page is written from scratch.</section>
        <section data-key="b">The old one stays in use until the ports are swapped.</section>
        <section data-key="c">Every check is green first.</section>
        <Lasso onDrawn={() => {}} />
      </div>
    </Frame>
  ),
}
