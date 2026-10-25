// An item's page in each status it can be in (T591: the groups and names Yadong had before the rewrite): the page's own
// pane bar and ItemPage with that item's data, on the phone and the desktop (../../stories/itemPage).
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Item } from '../../model/types'
import { Frames } from '../../stories/Frames'
import { T, item, message } from '../../stories/fixtures'
import { PARENT, pageOf, you, type PageOpts } from '../../stories/itemPage'

export default { title: 'Components/Item page/By item status' } satisfies Meta
type Story = StoryObj

const body = 'The export writes **every** row; it should write the rows the list shows.\n\n- with the filter\n- with the sort'
const base = (f: Partial<Item>): Item => item({ n: 12, parent: 3, pri: 'P1', body, next: 'Read the filter from the address', srcs: ['r4'], ...f })
const at = (f: Partial<Item>, o: PageOpts = {}, height = 820): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={900} height={height}>{(layout) => pageOf(base(f), layout === 'desk', { others: [PARENT], ...o })}</Frames>,
})
const said = you(1, 'The export should keep the filter I set.')
const ask = (id: number, text: string, kind: 'ask' | 'block' = 'ask'): Partial<Item> => ({ wait: { id, kind, text, by: 'claude-code', files: [] }, thread: [said, message({ id, kind, text })] })
const report = message({ id: 6, text: 'Done: the export writes the rows the list shows. Tested with three filters.' })

export const Open = at({ thread: [said] })
export const InProgressWithItsTalk: Story = {
  ...at({ status: 'doing', agent: { by: 'claude-code', t: T }, thread: [said, message({ id: 2, text: 'Reproduced it: the export reads the list before the filter.' }), message({ id: 3, text: 'Fixed the order; testing with three filters now.' })] }),
  name: 'In progress, with its talk',
}
export const Blocked = at({ status: 'doing', ...ask(4, 'I need the API key for staging to test the export there.', 'block') })
export const Question = at(ask(4, 'Which format should the export use?\n- ( ) CSV\n- ( ) Excel'))
export const ChecklistQuestion = at(ask(4, 'Which formats should the export offer?\n- [ ] CSV\n- [ ] Excel\n- [ ] JSON'))
export const ProposedWithAPreview: Story = { ...at({ status: 'proposed', by: 'claude-code', thread: [said, message({ id: 2, kind: 'propose', text: 'Keep the filter in the export, and its name in the file name: `export-bugs-P0.csv`.' })] }), name: 'Proposed, with a preview' }
export const ProposedNothingSaid: Story = { ...at({ status: 'proposed', by: 'claude-code', body: '', next: '', srcs: [], thread: [] }), name: 'Proposed, nothing said' }
export const WaitsForReview = at({ status: 'review', thread: [said, report] })
export const Done = at({ status: 'done', thread: [said, report], decided: { from: 'review', to: 'done', msg: 6, t: T } })
export const WontDo: Story = { ...at({ status: 'dropped', thread: [said, message({ id: 2, text: 'Not needed: the filter is kept by the new export.' })] }), name: 'Won’t do' }
export const Later = at({ when: 'later', thread: [said] })
export const Archived = at({ status: 'done', archived: true, thread: [said, report] })
export const RuleInForce = at({ type: 'rule', parent: null, title: 'Commit messages are in English', body: 'Code, commit messages and docs are in English; Chinese only to talk with Yadong.', next: '', thread: [] })
export const RuleProposed = at({ type: 'rule', parent: null, status: 'proposed', by: 'claude-code', title: 'Screenshots go in the item', body: 'Every screenshot of a change is posted on its item, not only in the chat.', next: '', thread: [] })
