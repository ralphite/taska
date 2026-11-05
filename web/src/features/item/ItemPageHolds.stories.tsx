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
export const SubitemsAndADocument: Story = { ...at({ title: 'Export keeps the filter you set' }, { others: KIDS, docs: [plan] }), name: 'Subitems and a document' }
export const ASubitemInLater: Story = { ...at({ title: 'Export keeps the filter you set' }, { others: [KIDS[0], KIDS[2]] }), name: 'A subitem in Later' }
/** a next step and no details: the Next line alone under the title */
export const OnlyANextStep: Story = { ...at({ title: 'Export keeps the filter you set', body: '', next: 'Read the filter from the address' }), name: 'Only a next step, no details' }
/** an agent's reports while it works on a bug, one after another */
const SAVING_STEPS = [
  'Reproduced it: typing fast and pressing Save right away drops the last word.',
  'The save reads the text box before its last change is in.',
  'Wrote a test that types and saves in the same moment; it fails as you see it.',
  'Save now waits for the text box to settle before it reads it.',
  'The test passes. Checking the phone, where the keyboard sends its words later.',
  'On the iPhone the last word was still dropped when it came from autocorrect.',
  'Save now also takes the word the keyboard is still holding.',
  'Both tests pass, on the desktop and on the phone.',
  'Checked saving by Enter, by the button and by leaving the page: no word lost.',
  'Ran all the checks: they pass.',
  'Done. Ready for you to try on the phone.',
]
export const LongTalk: Story = { ...at({ status: 'doing', title: 'Saving drops the last word', thread: SAVING_STEPS.map((text, i) => message({ id: i + 1, text })) }, {}, 760), name: 'A long talk' }
export const Pictures = at(
  { title: 'The export button is cut off on the phone', srcs: ['r4'], thread: [you(1, 'See the screenshots.')] },
  { inputs: [input({ id: 'r4', text: 'The export button is cut off', files: [{ f: 'f1-shot.png', name: 'shot.png', mime: 'image/png' }, { f: 'f2-shot.png', name: 'shot2.png', mime: 'image/png' }] })], f: { files: [{ f: 'f1-shot.png', name: 'shot.png', mime: 'image/png' }, { f: 'f2-shot.png', name: 'shot2.png', mime: 'image/png' }] } },
)
export const QuestionTakenBack: Story = { ...at({ thread: [you(1, 'The export should keep the filter.'), message({ id: 2, kind: 'ask', text: 'Keep the old export for a while?' }), message({ id: 3, kind: 'withdraw', text: 'Found it in the notes: no.' })] }), name: 'A question taken back' }
export const ProposalDecided: Story = { ...at({ status: 'open', thread: [message({ id: 5, kind: 'propose', text: 'Keep the filter in the export, and its name in the file name.' })], decided: { from: 'proposed', to: 'open', msg: 5, t: T } }), name: 'A proposal decided' }
