// What such a row can carry: later and part of another item, a draft, searched words.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { item } from '../../stories/fixtures'
import { listOf } from '../../stories/listFixtures'
import { one, question } from '../../stories/needsYouRowFixtures'

export default { title: 'Components/Item list/Needs-you row/What it shows' } satisfies Meta
type Story = StoryObj

export const LaterPartOfAnother: Story = { ...one({ it: { n: 14, status: 'proposed', when: 'later', parent: 3 }, excerpt: 'Split from F003', f: { code: 'F014', parentCode: 'F003' } }), name: 'Later, part of another item' }
// ---- more states (B636)
export const WithADraft: Story = { ...one({ ...question, f: { draft: true } }), name: 'With a draft' }
export const SearchedWordsMarked: Story = { ...one({ ...question, l: { words: ['export'] }, f: { hitLine: 'The old export stays a week.' } }), name: 'Searched words marked' }
// ---- more states (T639)
/** in Active, a subitem that needs you stays under its parent, indented */
export const AsASubitem: Story = {
  name: 'As a subitem, under its parent',
  render: () => <Frames phoneWidth={393} deskWidth={460} height={420}>{(layout) => listOf([item({ n: 1, status: 'doing', title: 'Export keeps the filter you set' }), item({ n: 14, type: 'task', parent: 1, title: 'Which file name?', wait: { id: 4, kind: 'ask', text: 'Put the date in the file name?', by: 'claude-code', files: [] } })], 'items', { status: 'all' }, layout === 'desk')}</Frames>,
}
