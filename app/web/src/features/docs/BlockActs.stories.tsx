import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frame } from '../../stories/Frames'
import { BlockActs } from './BlockActs'

const meta: Meta = { title: 'Components/Document/Beside a paragraph' }
export default meta
type Story = StoryObj

const on = { say() {}, comment() {}, toggle() {}, away() {} }

/** A paragraph's counts beside it (one resolved), and the buttons to speak or comment (shown while recording). */
export const Counts: Story = {
  render: () => (
    <Frame layout="desk" width={700} height={220}>
      <div className="p-6 pr-32">
        <section className="group/blk relative rounded-lg px-2 py-1 text-[15px]">
          <div data-block>The new page is written from scratch, and the old one stays in use until the ports are swapped.</div>
          <BlockActs counts={[{ tk: 'p1#1', n: 2, done: false, quote: '' }, { tk: 'p1#7', n: 1, done: true, quote: 'ports' }]} open={null} rec on={on} />
        </section>
      </div>
    </Frame>
  ),
}
