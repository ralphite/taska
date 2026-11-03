// An item's page while it waits on you: a question (choices, a checklist, or nothing to tick), proposed, waiting for review.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { message } from '../../stories/fixtures'
import { ask, at, report, said } from '../../stories/itemPageFixtures'

export default { title: 'Components/Item page/By item status/Waiting on you' } satisfies Meta
type Story = StoryObj

export const Question = at(ask(4, 'Which format should the export use?\n- ( ) CSV\n- ( ) Excel'))
export const ChecklistQuestion: Story = { ...at(ask(4, 'Which formats should the export offer?\n- [ ] CSV\n- [ ] Excel\n- [ ] JSON')), name: 'A checklist question' }
export const OpenQuestion: Story = { ...at({ status: 'open', ...ask(4, 'I need the API key for staging to test the export there. Where is it?') }), name: 'A question, nothing to tick' }
export const ProposedWithAPreview: Story = { ...at({ status: 'proposed', by: 'claude-code', thread: [said, message({ id: 2, kind: 'propose', text: 'Keep the filter in the export, and its name in the file name: `export-bugs-P0.csv`.' })] }), name: 'Proposed, with a preview' }
export const ProposedNothingSaid: Story = { ...at({ status: 'proposed', by: 'claude-code', body: '', next: '', srcs: [], thread: [] }), name: 'Proposed, nothing said' }
export const WaitsForReview: Story = { ...at({ status: 'review', thread: [said, report] }), name: 'Waits for review' }
