import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, Hold, States } from '../stories/Frames'
import { priOpts, SegCtl, typeOpts } from './Segments'

const meta: Meta = { title: 'Components/Around the page/Top bar and list head/Filters' }
export default meta
type Story = StoryObj

/** a choice that picks, as the page's filters and fields do */
const seg = (opts: ReturnType<typeof typeOpts>, start: string, small = false) => <Hold start={start}>{(v, set) => <SegCtl opts={opts} on={v} small={small} pick={set} />}</Hold>

/** A type, a priority (P0 in red), each with and without All or Any; the small one of the desktop's filters. */
export const Segments: Story = {
  name: 'The segmented choices',
  render: () => (
    <Frames phoneWidth={393} deskWidth={480} height={400}>
      {() => (
        <States
          items={[
            ['type', <div className="p-3">{seg(typeOpts(true), 'bug')}</div>],
            ['type, a filter', <div className="p-3">{seg(typeOpts(false), 'all')}</div>],
            ['priority', <div className="p-3">{seg(priOpts(false), 'P0')}</div>],
            ['priority, a small filter', <div className="p-3">{seg(priOpts(true), 'all', true)}</div>],
          ]}
        />
      )}
    </Frames>
  ),
}
// ---- more states (T639)
export const SegmentsPointer: Story = { name: 'The segmented choices: one under the pointer', parameters: { pseudo: { hover: ['button:nth-of-type(2)'] } }, render: () => <Frames phone={false} deskWidth={460}>{() => <div className="p-3">{seg(typeOpts(true), 'bug')}</div>}</Frames> }
