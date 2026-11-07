// Deleted beside the items on the desktop: everything deleted, and what is picked in the pane beside it.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { deleted, docGone, gone, inputGone } from '../../stories/sideListsFixtures'

export default { title: 'UI/Left sidebar/A list open beside it/Deleted' } satisfies Meta
type Story = StoryObj

/** Everything deleted, the latest first: an item, what you said, a document. */
export const Deleted: Story = { ...deleted(null), name: 'Everything deleted' }
/** One picked: it shows in the pane, with Restore. */
export const DeletedPicked: Story = {
  ...deleted(gone[0].key),
  name: 'An item picked: Restore beside it',
}
/** The pointer on a row: its Restore shows; hidden on the desktop until then. */
export const PointerOnARow: Story = {
  ...deleted(null),
  name: 'Pointer on a row: Restore',
  parameters: { pseudo: { hover: ['.group:first-child'] } },
}
export const DeletedNothing: Story = { ...deleted(null, []), name: 'Nothing deleted' }
export const DeletedInputPicked: Story = { ...deleted(inputGone?.key ?? null), name: 'What you said picked' }
export const DeletedDocumentPicked: Story = { ...deleted(docGone?.key ?? null), name: 'A document picked' }
