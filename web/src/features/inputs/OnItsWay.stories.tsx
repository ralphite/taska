// What is still on its way, first where your inputs are listed: the page's own outgoingRows and InputsView, on the phone. The desktop lists them under You said lately.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { out } from '../../stories/boxFixtures'
import { inputsOf } from '../../stories/inputFixtures'

export default { title: 'Components/Inputs/On its way' } satisfies Meta
type Story = StoryObj

/** Sending; two sent while Taska is out of reach (they go by themselves when it answers); one Taska refused. */
export const OnItsWay: Story = {
  name: 'Sending, not sent, waiting',
  render: () => (
    <Frames desk={false} phoneWidth={393} height={620}>
      {() =>
        inputsOf({
          organizer: true,
          away: 0,
          outbox: [
            out({ q: 'q1', text: 'This one Taska refused', state: 'failed', net: false, t: 1 }),
            out({ q: 'q2', text: 'Buy milk on the way home', state: 'failed', net: true, t: 2 }),
            out({ q: 'q3', text: 'Also the sort, please.', scope: 'F012', t: 3 }),
          ],
        })
      }
    </Frames>
  ),
}
