// The card when an agent asks you something (also for what it needs when it is stuck: T646): choices to pick (one, or
// a checklist), or nothing to tick, with a screenshot; on a proposal or on finished work too.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { message } from '../../stories/fixtures'
import { askOf, at, proposal, q, report } from '../../stories/needsCardFixtures'

export default { title: 'UI/Item pane/Talk/Needs-you card/A question' } satisfies Meta
type Story = StoryObj

export const Question: Story = { ...at(q('Which format should the export use?\n- ( ) CSV\n- ( ) Excel')), name: 'One choice to pick' }
const LONG =
  'The export can keep the filter in two ways, and each changes what a file opened later says. Which should I build?\n' +
  '- ( ) Keep the filter in the file itself: the export writes only the rows the list shows, adds a first line that says which filter made it, and names the file after the filter, so a file opened next month still says what it holds.\n' +
  '- ( ) Keep the filter beside the file: the export writes every row as it does now, and a second small file lists the filter, so the same export can be filtered again in a spreadsheet without asking Taska for it a second time.\n' +
  '- ( ) Ask each time'
/** long choices, one picked: each circle and its key at its choice's first line (T642 R9) */
export const LongChoices: Story = { ...at(q(LONG), { picked: [1] }), name: 'Long choices' }
export const ChecklistQuestion: Story = { ...at(q('Which formats should the export offer?\n- [ ] CSV\n- [ ] Excel\n- [ ] JSON')), name: 'A checklist' }
/** a question with nothing to tick: the question alone, answered in the box under it */
export const OpenQuestion: Story = { ...at(q('How should the export name its files?')), name: 'Nothing to tick' }
export const WithAScreenshot: Story = {
  ...at({ status: 'open', ...q('The export button does nothing here. Which build should I test it on?'), wait: { ...askOf('The export button does nothing here. Which build should I test it on?', 'codex'), files: [{ f: 'f3-shot.png', name: 'shot.png', mime: 'image/png' }] } }),
  name: 'With a screenshot',
}
export const QuestionOnAProposal: Story = { ...at({ status: 'proposed', ...q('Which format should the export use?\n- ( ) CSV\n- ( ) Excel') }), name: 'On a proposal' }
/** finished work with a question waiting: Accept beside Send answer, in one card */
export const QuestionOnFinishedWork: Story = {
  ...at({ status: 'review', thread: [report, message({ id: 7, kind: 'ask', text: 'Should the file name carry the date too?\n- ( ) Yes\n- ( ) No' })], wait: askOf('Should the file name carry the date too?\n- ( ) Yes\n- ( ) No') }),
  name: 'On finished work',
}
/** a proposal with a question that has nothing to tick: Approve, with "Answer below" beside it on a wide screen */
export const OpenQuestionOnAProposal: Story = { ...at({ status: 'proposed', thread: [proposal, message({ id: 7, kind: 'ask', text: 'Which page should it start from?' })], wait: askOf('Which page should it start from?') }), name: 'On a proposal, nothing to tick' }
/** finished work with a question that has nothing to tick: Accept, the answer in the box under it */
export const OpenQuestionOnFinishedWork: Story = {
  ...at({ status: 'review', thread: [report, message({ id: 7, kind: 'ask', text: 'I cannot reach staging to check it there. Can you open it for me?' })], wait: askOf('I cannot reach staging to check it there. Can you open it for me?', 'codex') }),
  name: 'On finished work, nothing to tick',
}
