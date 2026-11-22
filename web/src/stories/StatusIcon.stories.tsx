// A task's status icon (T591: Icons and marks > Task status icon): the page's own StateIcon for what the page shows
// of each status (shownStatus: Needs you while a question waits).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { statusChoices } from '../model/tasks'
import { shownStatus } from '../model/needStates'
import type { Task } from '../model/types'
import { StateIcon } from '../ui/Icon'
import { Frames } from './Frames'
import { task } from './fixtures'

export default { title: 'Base components/Status icons and marks/Task status icon' } satisfies Meta
type Story = StoryObj

const row = (it: Task) => {
  const st = shownStatus(it)
  return (
    <div key={it.status + it.n} className="flex items-center gap-2 px-3 py-2 text-sm">
      <StateIcon {...st} />
      <span>{st.label}</span>
    </div>
  )
}
const ask = { wait: { id: 1, kind: 'ask' as const, text: 'Which format?', by: 'claude-code', files: [] } }
const statuses = () => statusChoices(task({ n: 1, status: 'proposed' })).map(([s], i) => task({ n: i + 1, status: s as Task['status'] }))

export const TaskStatuses: Story = {
  name: 'Every task status',
  render: () => <Frames phoneWidth={393} deskWidth={360}>{() => <div className="py-2">{[...statuses().map(row), row(task({ n: 9, status: 'open', ...ask }))]}</div>}</Frames>,
}
