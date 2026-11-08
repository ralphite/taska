// An item's status icon (T591: Icons and marks > Item status icon): the page's own StateIcon for what the page shows
// of each status (shownStatus: Needs you while a question waits).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { statusChoices } from '../model/items'
import { shownStatus } from '../model/needStates'
import type { Item } from '../model/types'
import { StateIcon } from '../ui/Icon'
import { Frames } from './Frames'
import { item } from './fixtures'

export default { title: 'Base components/Status icons and marks/Item status icon' } satisfies Meta
type Story = StoryObj

const row = (it: Item) => {
  const st = shownStatus(it)
  return (
    <div key={it.status + it.n} className="flex items-center gap-2 px-3 py-2 text-sm">
      <StateIcon {...st} />
      <span>{st.label}</span>
    </div>
  )
}
const ask = { wait: { id: 1, kind: 'ask' as const, text: 'Which format?', by: 'claude-code', files: [] } }
const statuses = (type: Item['type']) => statusChoices(item({ n: 1, type, status: 'proposed' })).map(([s], i) => item({ n: i + 1, type, status: s as Item['status'] }))

export const ItemStatuses: Story = {
  name: 'Every item status',
  render: () => <Frames phoneWidth={393} deskWidth={360}>{() => <div className="py-2">{[...statuses('feature').map(row), row(item({ n: 9, status: 'open', ...ask }))]}</div>}</Frames>,
}
