// B485: the card of a proposal or of finished work you replied on instead of deciding: what you did ("Skipped · you
// replied") stands out as your pick; Approve / Accept waits quietly beside it and is itself again under the pointer.
// B507 (r693): in the item's talk, as the page draws it: the card stays where it was, holding what the agent said, and
// your reply comes after it.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ItemTalk } from '../../../components/Detail'
import { U, byN, parseRef } from '../../../lib/state'
import type { Item } from '../../../lib/types'
import { Pane, type Setup } from '../../lib/demo'

// what this part of Storybook shows (T512: its stories are in the folders beside this file)
export const area: Meta = {}
export type Story = StoryObj

const talk = (ref: string, setup: (x: Setup) => void): Story => ({
  parameters: {
    taska: {
      setup: (x: Setup) => {
        U.open = x.it(ref).n
        setup(x)
      },
    },
  },
  render: () => (
    <Pane w="item">
      <div className="flex flex-col gap-6 p-4">
        <ItemTalk it={byN.get(parseRef(ref) as number) as Item} />
      </div>
    </Pane>
  ),
})

/** Finished work you answered with a reply, not Accept or Not yet: the card, then your reply */
export const FinishedYouReplied = talk('B6', ({ it }) => {
  it('B6').reply = true
})
/** A proposal you answered with a reply, not Approve or Won't do: the card, then your reply */
export const ProposalYouReplied = talk('I4', ({ it }) => {
  const i = it('I4'),
    t = new Date(Date.parse(i.thread.at(-1)?.t || i.t0) + 600000).toISOString()
  i.thread.push({
    id: 9001,
    by: 'you',
    kind: 'say',
    text: '\u62a5\u8868\u9875\u5148\u505a\u53ef\u4ee5\uff0c\u8bbe\u7f6e\u91cc\u7684\u624b\u52a8\u5207\u6362\u4e5f\u4e00\u8d77\u505a\u4e86\u5427\u3002',
    t,
    src: null,
    files: [],
  })
  i.reply = true
})
/** The same, Approve under the pointer: a button again (T522: drawn without a pointer, storybook-addon-pseudo-states;
 * the desktop only, as the phone has no pointer) */
export const ProposalYouRepliedPointed: Story = {
  ...ProposalYouReplied,
  parameters: { ...ProposalYouReplied.parameters, pseudo: { hover: ['[data-act="status"]'] }, platform: 'desktop' },
}
