import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { item, message, modelOf } from '../../stories/fixtures'
import { ItemPane } from './ItemPane'

const meta: Meta = { title: 'Components/Item/Item pane' }
export default meta
type Story = StoryObj

const it = item({
  n: 12,
  status: 'doing',
  body: 'Export to CSV writes every row; it should write the rows the list shows.',
  thread: [
    message({ id: 1, by: 'you', kind: 'say', text: 'The export should keep the filter I set.' }),
    message({ id: 2, by: 'claude-code', kind: 'progress', text: 'Reproduced it: the export reads the list before the filter.' }),
  ],
})

/** An item with its text and talk. */
export const Pane: Story = {
  render: () => <Frames phoneWidth={393} deskWidth={900}>{() => <ItemPane it={it} model={modelOf([it])} slug="taska" />}</Frames>,
}
