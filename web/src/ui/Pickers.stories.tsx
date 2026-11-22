// Putting a task under another, and what you said with another task (T591: Menus and sheets > Move and pick): the
// page's own pickers (moveParentSheet, pickSheet) with the task list's demo project, as the page opens them: under the
// menu's row on the desktop, a sheet on the phone.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { codeOf } from '../model/project'
import { inputCode } from '../model/words'
import { Frames } from '../stories/Frames'
import { AT_BUTTON, act, menuModel, opened, underList } from '../stories/menuFixtures'
import { moveParentSheet, pickSheet } from './Pickers'

export default { title: 'Base components/Menus/Move and pick' } satisfies Meta
type Story = StoryObj

const putUnder = (desk: boolean, n = 14, query?: string) => {
  const m = menuModel()
  return opened(moveParentSheet({ it: m.byN.get(n)!, tasks: m.tasks, kids: m.kids, code: (c) => codeOf(m, c), desk, query }, act('Put under: pick')), desk, { under: underList(desk), look: desk ? { pop: true, at: AT_BUTTON } : {} })
}

/** The tasks it can go under (its parent now marked), and No parent. */
export const MoveTask: Story = { name: 'Put under', render: () => <Frames height={640} deskWidth={900} phoneWidth={393}>{(layout) => putUnder(layout === 'desk')}</Frames> }
export const MoveTaskNothingMatches: Story = {
  name: 'Put under: nothing matches',
  render: () => <Frames height={480} deskWidth={900} phoneWidth={393}>{(layout) => putUnder(layout === 'desk', 14, 'invoices')}</Frames>,
}
/** What you said, put with a task (its talk): any task but the one it is with now. */
export const PickAnTask: Story = {
  name: 'What you said, with another task',
  render: () => (
    <Frames height={640} deskWidth={900} phoneWidth={393}>
      {(layout) => {
        const m = menuModel()
        return opened(pickSheet({ head: `Put ${inputCode('r12')} with…`, tasks: m.tasks, skip: [1], code: (n) => codeOf(m, n), desk: layout === 'desk' }, act('Put with: pick')), layout === 'desk')
      }}
    </Frames>
  ),
}
// ---- more states (T639)
/** Put under for a task on its own: No parent ticked, no row marked */
export const MoveTaskOnItsOwn: Story = { name: 'Put under: on its own now', render: () => <Frames height={640} deskWidth={900} phoneWidth={393}>{(layout) => putUnder(layout === 'desk', 5)}</Frames> }
