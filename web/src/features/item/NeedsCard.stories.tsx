// The card as an item waits on you: a question, a checklist, blocked, a proposal, a rule proposed, work to review.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { message } from '../../stories/fixtures'
import { askOf, at, proposal, q, report } from '../../stories/needsCardFixtures'

export default { title: 'Components/Item page/Needs-you card/Waiting on you' } satisfies Meta
type Story = StoryObj

export const Question = at(q('Which format should the export use?\n- ( ) CSV\n- ( ) Excel'))
export const ChecklistQuestion = at(q('Which formats should the export offer?\n- [ ] CSV\n- [ ] Excel\n- [ ] JSON'))
export const Blocked = at({ status: 'open', wait: askOf('I need the API key for staging.', 'block', 'codex') })
export const BlockedWithAScreenshot: Story = {
  ...at({ status: 'open', wait: { ...askOf('The export button does nothing here.', 'block', 'codex'), files: [{ f: 'f3-shot.png', name: 'shot.png', mime: 'image/png' }] } }),
  name: 'Blocked, with a screenshot',
}
export const Proposal = at({ status: 'proposed', thread: [proposal] })
export const ProposedNothingSaid: Story = { ...at({ status: 'proposed', by: 'claude-code', thread: [] }), name: 'Proposed, nothing said' }
export const QuestionOnAProposal = at({ status: 'proposed', ...q('Which format should the export use?\n- ( ) CSV\n- ( ) Excel') })
export const RuleProposed = at({ type: 'rule', status: 'proposed', title: 'Screenshots go in the item', thread: [message({ id: 5, kind: 'propose', text: 'Every screenshot of a change is posted on its item.' })] })
export const WaitsForReview = at({ status: 'review', thread: [report] })
// ---- more states (T639)
/** a question with nothing to tick: the question alone, answered in the box under it */
export const OpenQuestion: Story = { ...at(q('How should the export name its files?')), name: 'A question with nothing to tick' }
/** finished work with a question waiting: Accept beside Send answer, in one card */
export const QuestionOnFinishedWork: Story = {
  ...at({ status: 'review', thread: [report, message({ id: 7, kind: 'ask', text: 'Should the file name carry the date too?\n- ( ) Yes\n- ( ) No' })], wait: askOf('Should the file name carry the date too?\n- ( ) Yes\n- ( ) No') }),
  name: 'A question on finished work',
}
/** a proposal the agent is blocked on: Approve only, with "Answer below" beside it on a wide screen */
export const BlockedWhileProposed: Story = { ...at({ status: 'proposed', thread: [proposal], wait: askOf('Which page should it start from?', 'block') }), name: 'Blocked on a proposal' }
/** finished work the agent is blocked on: Accept only */
export const BlockedWhileInReview: Story = { ...at({ status: 'review', thread: [report], wait: askOf('I cannot reach staging to check it there.', 'block', 'codex') }), name: 'Blocked on finished work' }
