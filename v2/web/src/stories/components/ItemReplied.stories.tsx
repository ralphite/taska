// B485: the card of a proposal or of finished work you replied on instead of deciding: what you did ("Skipped · you
// replied") stands out as your pick; Approve / Accept waits quietly beside it and is itself again under the pointer.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { NeedsCard } from '../../components/Detail'
import { byN, parseRef } from '../../lib/state'
import type { Item } from '../../lib/types'
import { Pane, type Setup } from '../lib/demo'

const meta: Meta = {
  title: 'Components/Item card, you replied',
}
export default meta
type Story = StoryObj

const card = (ref: string, setup: (x: Setup) => void): Story => ({
  parameters: { taska: { setup } },
  render: () => (
    <Pane w="item">
      <div className="p-4">
        <NeedsCard it={byN.get(parseRef(ref) as number) as Item} />
      </div>
    </Pane>
  ),
})

/** Finished work you answered with a reply, not Accept or Not yet */
export const FinishedYouReplied = card('B6', ({ it }) => {
  it('B6').reply = true
})
/** A proposal you answered with a reply, not Approve or Won't do */
export const ProposalYouReplied = card('I4', ({ it }) => {
  it('I4').reply = true
})
