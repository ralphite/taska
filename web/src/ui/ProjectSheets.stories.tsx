// Moving a task, or what you said, to another project (T591: Menus and sheets > Move and pick): the page's own sheets
// (taskMoveProjectSheet, moveInputSheet with inputMoveFacts) with the task list's demo project and two other projects.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { inputMoveFacts } from '../features/inputs/inputSheetFacts'
import { Frames } from '../stories/Frames'
import { input, task, modelOf } from '../stories/fixtures'
import { act, opened } from '../stories/menuFixtures'
import { taskMoveProjectSheet, moveInputSheet } from './ProjectSheets'
import { PROJECT_TONES } from './tones'

export default { title: 'Base components/Menus/Move and pick' } satisfies Meta
type Story = StoryObj

const OTHERS = [
  { slug: 'home', title: 'Home', tone: PROJECT_TONES[1], open: 13 },
  { slug: 'todos', title: 'todos', tone: PROJECT_TONES[2], open: 8 },
]
const said = input({ id: 'r12', scope: 4, acked: true, touched: [12], text: 'The export should keep the filter I set.', org: { ok: true, msg: 'Created T012', t: '', keep: false, changed: true, undone: false } })
const m = modelOf([task({ n: 4, title: 'Exports that keep what you see' }), task({ n: 12, title: 'Export keeps the filter' })], [said])

export const MoveToProject: Story = { name: 'Task to another project', render: () => <Frames height={420} deskWidth={900} phoneWidth={393}>{(layout) => opened(taskMoveProjectSheet({ code: 'T012', others: OTHERS }, act('Task to another project: pick')), layout === 'desk')}</Frames> }
/** What goes with it: the task the organizer made of it moves too. */
export const MoveInput: Story = {
  name: 'What you said, to another project',
  render: () => <Frames height={520} deskWidth={900} phoneWidth={393}>{(layout) => opened(moveInputSheet({ ...inputMoveFacts(m, said), others: OTHERS }, act('What you said to another project: pick')), layout === 'desk')}</Frames>,
}
