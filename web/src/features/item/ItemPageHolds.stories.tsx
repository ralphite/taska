// An item's page by what it holds: subitems, a document,
// pictures, a long talk, a question taken back, a decided proposal. The page's own pane and ItemPage.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Item } from '../../model/types'
import { Frames } from '../../stories/Frames'
import { T, input, item, message } from '../../stories/fixtures'
import { comment, doc } from '../../stories/itemFixtures'
import { KIDS, PARENT, pageOf, you, type PageOpts } from '../../stories/itemPage'

export default { title: 'Components/Item page/By what it holds' } satisfies Meta
type Story = StoryObj

const at = (f: Partial<Item>, o: PageOpts = {}, height = 820): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={900} height={height}>{(layout) => pageOf(item({ n: 12, pri: 'P1', ...f }), layout === 'desk', o)}</Frames>,
})
const plan = doc({ d: 1, n: 12, title: 'Plan: the export keeps the filter', blocks: [{ key: 'k1', kind: 'para', text: 'Read the filter first.', comments: [comment({ id: 9 })] }] })

export const Subitem = at({ n: 14, parent: 3, title: 'Keep the filter in the file name' }, { others: [PARENT] })
export const SubitemsAndADocument = at({ title: 'Export keeps the filter you set' }, { others: KIDS, docs: [plan] })
export const ASubitemInLater = at({ title: 'Export keeps the filter you set' }, { others: [KIDS[0], KIDS[2]] })
export const LongTalk = at({ status: 'doing', title: 'Saving drops the last word', thread: Array.from({ length: 11 }, (_, i) => message({ id: i + 1, text: `Step ${i + 1} done.` })) }, {}, 760)
export const Pictures = at(
  { title: 'The export button is cut off on the phone', srcs: ['r4'], thread: [you(1, 'See the screenshots.')] },
  { inputs: [input({ id: 'r4', text: 'The export button is cut off', files: [{ f: 'f1-shot.png', name: 'shot.png', mime: 'image/png' }, { f: 'f2-shot.png', name: 'shot2.png', mime: 'image/png' }] })], f: { files: [{ f: 'f1-shot.png', name: 'shot.png', mime: 'image/png' }, { f: 'f2-shot.png', name: 'shot2.png', mime: 'image/png' }] } },
)
export const QuestionTakenBack = at({ thread: [you(1, 'The export should keep the filter.'), message({ id: 2, kind: 'ask', text: 'Keep the old export for a while?' }), message({ id: 3, kind: 'withdraw', text: 'Found it in the notes: no.' })] })
export const ProposalDecided = at({ status: 'open', thread: [message({ id: 5, kind: 'propose', text: 'Keep the filter in the export, and its name in the file name.' })], decided: { from: 'proposed', to: 'open', msg: 5, t: T } })
