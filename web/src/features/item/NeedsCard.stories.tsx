// The card when an agent asks you something: choices to pick (one, or a checklist), or nothing to tick; on a proposal
// or on finished work too.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { message } from '../../stories/fixtures'
import { askOf, at, q, report } from '../../stories/needsCardFixtures'

export default { title: 'Components/Item page/Needs-you card/A question' } satisfies Meta
type Story = StoryObj

export const Question: Story = { ...at(q('Which format should the export use?\n- ( ) CSV\n- ( ) Excel')), name: 'One choice to pick' }
export const ChecklistQuestion: Story = { ...at(q('Which formats should the export offer?\n- [ ] CSV\n- [ ] Excel\n- [ ] JSON')), name: 'A checklist' }
/** a question with nothing to tick: the question alone, answered in the box under it */
export const OpenQuestion: Story = { ...at(q('How should the export name its files?')), name: 'Nothing to tick' }
export const QuestionOnAProposal: Story = { ...at({ status: 'proposed', ...q('Which format should the export use?\n- ( ) CSV\n- ( ) Excel') }), name: 'On a proposal' }
/** finished work with a question waiting: Accept beside Send answer, in one card */
export const QuestionOnFinishedWork: Story = {
  ...at({ status: 'review', thread: [report, message({ id: 7, kind: 'ask', text: 'Should the file name carry the date too?\n- ( ) Yes\n- ( ) No' })], wait: askOf('Should the file name carry the date too?\n- ( ) Yes\n- ( ) No') }),
  name: 'On finished work',
}
