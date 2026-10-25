// Moving an item, or what you said, to another project (T591: Menus and sheets > Move and pick): the page's own sheets
// (itemMoveProjectSheet, moveInputSheet with inputMoveFacts) with the item list's demo project and two other projects.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { inputMoveFacts } from '../features/inputs/inputSheetFacts'
import { Frames } from '../stories/Frames'
import { input, item, modelOf } from '../stories/fixtures'
import { no, opened } from '../stories/menuFixtures'
import { itemMoveProjectSheet, moveInputSheet } from './ProjectSheets'
import { PROJECT_TONES } from './tones'

export default { title: 'Components/Menus and sheets/Move and pick' } satisfies Meta
type Story = StoryObj

export const OTHERS = [
  { slug: 'home', title: 'Home', tone: PROJECT_TONES[1], open: 13 },
  { slug: 'todos', title: 'todos', tone: PROJECT_TONES[2], open: 8 },
]
const said = input({ id: 'r12', scope: 4, acked: true, touched: [12], text: 'The export should keep the filter I set.', org: { ok: true, msg: 'Created F012', t: '', keep: false, changed: true, undone: false } })
const m = modelOf([item({ n: 4, title: 'Exports that keep what you see' }), item({ n: 12, title: 'Export keeps the filter' })], [said])

export const MoveToProject: Story = { name: 'Item to another project', render: () => <Frames height={420} deskWidth={900} phoneWidth={393}>{(layout) => opened(itemMoveProjectSheet({ code: 'F012', others: OTHERS }, no), layout === 'desk')}</Frames> }
/** What goes with it: the item the organizer made of it moves too. */
export const MoveInput: Story = {
  name: 'What you said, to another project',
  render: () => <Frames height={520} deskWidth={900} phoneWidth={393}>{(layout) => opened(moveInputSheet({ ...inputMoveFacts(m, said), others: OTHERS }, no), layout === 'desk')}</Frames>,
}
