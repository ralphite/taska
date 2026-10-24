import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../stories/Frames'
import { priOpts, SegCtl, typeOpts } from './Segments'

const meta: Meta = { title: 'Components/Primitives/Segments' }
export default meta
type Story = StoryObj

const no = () => {}

/** A type, a priority (P0 in red), each with and without All or Any; the small one of the desktop's filters. */
export const Segments: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={480} height={400}>
      {() => (
        <States
          items={[
            ['type', <div className="p-3"><SegCtl opts={typeOpts(true)} on="bug" pick={no} /></div>],
            ['type, a filter', <div className="p-3"><SegCtl opts={typeOpts(false)} on="all" pick={no} /></div>],
            ['priority', <div className="p-3"><SegCtl opts={priOpts(false)} on="P0" pick={no} /></div>],
            ['priority, a small filter', <div className="p-3"><SegCtl opts={priOpts(true)} on="all" small pick={no} /></div>],
          ]}
        />
      )}
    </Frames>
  ),
}
