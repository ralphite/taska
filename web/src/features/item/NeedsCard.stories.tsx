// The card as an item waits on you: a question, a checklist, blocked, a proposal, a rule proposed, work to review.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { message } from '../../stories/fixtures'
import { askOf, at, proposal, q, report } from '../../stories/needsCardFixtures'

export default { title: 'Components/Item page/Needs-you card/Waiting on you' } satisfies Meta
type Story = StoryObj

export const Question = at(q('Which format should the export use?\n- ( ) CSV\n- ( ) Excel'))
export const ChecklistQuestion = at(q('Which formats should the export offer?\n- [ ] CSV\n- [ ] Excel\n- [ ] JSON'))
export const Blocked = at({ status: 'doing', wait: askOf('I need the API key for staging.', 'block', 'codex') })
export const BlockedWithAScreenshot: Story = {
  ...at({ status: 'doing', wait: { ...askOf('The export button does nothing here.', 'block', 'codex'), files: [{ f: 'f3-shot.png', name: 'shot.png', mime: 'image/png' }] } }),
  name: 'Blocked, with a screenshot',
}
export const Proposal = at({ status: 'proposed', thread: [proposal] })
export const ProposedNothingSaid: Story = { ...at({ status: 'proposed', by: 'claude-code', thread: [] }), name: 'Proposed, nothing said' }
export const QuestionOnAProposal = at({ status: 'proposed', ...q('Which format should the export use?\n- ( ) CSV\n- ( ) Excel') })
export const RuleProposed = at({ type: 'rule', status: 'proposed', title: 'Screenshots go in the item', thread: [message({ id: 5, kind: 'propose', text: 'Every screenshot of a change is posted on its item.' })] })
export const WaitsForReview = at({ status: 'review', thread: [report] })
