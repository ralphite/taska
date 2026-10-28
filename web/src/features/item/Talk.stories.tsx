// An item's whole talk: every kind of message with the
// document's comments among them in time; with the card that asks you where its question is; a long back-and-forth
// (the earlier ones folded). The page's own ItemTalk.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Item, Message } from '../../model/types'
import { Frames } from '../../stories/Frames'
import { T, input, item, message } from '../../stories/fixtures'
import { comment, doc } from '../../stories/itemFixtures'
import { talkOf, type PageOpts } from '../../stories/itemPage'

export default { title: 'Components/Conversation/Whole conversation' } satisfies Meta
type Story = StoryObj

const at = (min: number) => new Date(Date.parse(T) + min * 60_000).toISOString()
const you = (id: number, min: number, text: string, src?: string) => message({ id, by: 'you', kind: 'say', text, t: at(min), ...(src ? { src } : {}) })
const agent = (id: number, min: number, text: string, f: Partial<Message> = {}) => message({ id, text, t: at(min), ...f })
const whole = (thread: Message[], f: Partial<Item> = {}, o: PageOpts = {}, height?: number): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={720} height={height}>{(layout) => talkOf(item({ n: 12, thread, ...f }), layout === 'desk', o)}</Frames>,
})
const plan = doc({ d: 1, n: 12, title: 'Plan: the export keeps the filter', blocks: [{ key: 'k1', kind: 'para', text: 'Read the filter first.', comments: [comment({ id: 20, t: at(6), quote: 'Read the filter', text: 'Before or after the sort?' })] }] })

export const EveryMessageWithDocumentComments: Story = {
  ...whole(
    [
      you(1, 0, 'The export should keep the filter I set.', 'r4'),
      message({ id: 2, by: 'org', kind: 'say', src: 'r4', text: 'Added to F012: keep the filter', t: at(0) }),
      agent(3, 2, 'Reproduced it: the export reads the list before the filter.'),
      agent(4, 4, 'Put the filter in the file name too.', { kind: 'propose' }),
      agent(5, 8, 'The plan is in D1.', { by: 'codex', ses: 'tests' }),
      you(6, 9, 'Good, go ahead.'),
    ],
    {},
    { inputs: [input({ id: 'r4', text: 'The export should keep the filter I set.' })], docs: [plan] },
  ),
  name: 'Every message, with document comments',
}
export const WithTheCardThatAsksYou = whole([you(1, 0, 'The export should keep the filter I set.'), agent(2, 3, 'Reproduced it.'), agent(3, 5, 'Which format?\n- ( ) CSV\n- ( ) Excel', { kind: 'ask' })], { wait: { id: 3, kind: 'ask', text: 'Which format?\n- ( ) CSV\n- ( ) Excel', by: 'claude-code', files: [] } })
export const LongBackAndForth = whole(
  Array.from({ length: 14 }, (_, i) => (i % 2 ? agent(i + 1, i * 3, `Step ${(i + 1) / 2} done.`) : you(i + 1, i * 3, `Then step ${i / 2 + 1}, please.`))),
  {},
  {},
  900,
)
