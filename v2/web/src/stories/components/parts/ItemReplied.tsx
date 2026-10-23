// B485: the card of a proposal or of finished work you replied on instead of deciding: what you did ("Skipped · you
// replied") stands out as your pick; Approve / Accept waits quietly beside it and is itself again under the pointer.
// B507 (r693): in the item's talk, as the page draws it: the card stays where it was, holding what the agent said, and
// your reply comes after it.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Do } from '../../lib/twin'

// what this part of Storybook shows (T512: its stories are in the folders beside this file)
export const area: Meta = {}
export type Story = StoryObj

/** B555: the item's talk on the real page, after these steps. */
const talk = (ref: string, steps?: Do[], hover?: string): Story => ({
  parameters: { taska: { page: { at: '/p/shop/' + ref, part: '#itemTalk', steps, hover } } },
  render: () => <></>,
})

/** Finished work you answered with a reply, not Accept or Not yet: the card, then your reply (B6, as the demo has it) */
export const FinishedYouReplied = talk('B6')
/** A proposal you answered with a reply, not Approve or Won't do: the card, then your reply */
const reply: Do[] = [
  {
    type: '\u62a5\u8868\u9875\u5148\u505a\u53ef\u4ee5\uff0c\u8bbe\u7f6e\u91cc\u7684\u624b\u52a8\u5207\u6362\u4e5f\u4e00\u8d77\u505a\u4e86\u5427\u3002',
    into: '#text',
  },
  { click: '[data-act="send"]' },
]
export const ProposalYouReplied = talk('I4', reply)
/** The same, Approve under the pointer: a button again (the desktop only, as the phone has no pointer) */
export const ProposalYouRepliedPointed: Story = {
  ...talk('I4', reply, '#itemTalk [data-act="status"]'),
  parameters: { ...talk('I4', reply, '#itemTalk [data-act="status"]').parameters, platform: 'desktop' },
}
