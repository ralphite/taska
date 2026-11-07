// A document's ⋯ on the phone (D115 #41): Copy, Move, Mark an area, Edit and Delete, out of the way of reading. The
// page's own sheet over the page's own DocView, with a demo document. How the rest of the document behaves on the
// phone is in DocOnThePhone.stories.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { acts, opened } from '../../stories/menuFixtures'
import { doc } from '../../stories/docFixtures'
import { docAt } from '../../stories/docPage'
import { docMenuSheet } from './DocSheets'

export default { title: 'UI/Document pane/Its bar, the pointer on it' } satisfies Meta
type Story = StoryObj

const PLAN = doc()

// ---- its ⋯ (D115 #41): Copy, Move, Mark an area, Edit and Delete, out of the way of reading
const docActs = acts('Document menu', ['copy', 'move', 'mark', 'edit', 'remove'], { move: 'Move and pick › Put a document on' })
/** ⋯ by the close button opens them; Delete last, red */
export const ItsMenu: Story = {
  name: 'Its ⋯: Copy, Move, Mark an area, Edit, Delete',
  render: () => <Frames desk={false} height={760} phoneWidth={393}>{() => opened(docMenuSheet('D12', { web: false, deleting: false }, docActs), false, { under: docAt(PLAN, false) })}</Frames>,
}
/** Delete pressed once: Delete? asks again */
export const ItsMenuDeleteAsking: Story = {
  name: 'Its ⋯: Delete asking again',
  render: () => <Frames desk={false} height={760} phoneWidth={393}>{() => opened(docMenuSheet('D12', { web: false, deleting: true }, docActs), false, { under: docAt(PLAN, false) })}</Frames>,
}
