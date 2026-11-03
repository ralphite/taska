// Deleted beside the items on the desktop: everything deleted, and what is picked in the pane beside it.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { DeletedList, DeletedView } from './SideLists'
import { docGone, gone, inputGone, no, page } from '../../stories/sideListsFixtures'

export default { title: 'Components/Around the page/Side lists/Deleted' } satisfies Meta
type Story = StoryObj

/** Everything deleted, the latest first: an item, what you said, a document. */
export const Deleted: Story = { ...page('deleted', gone.length, <DeletedList rows={gone} picked={null} on={{ show: no, restore: no }} />), name: 'Everything deleted' }
/** One picked: it shows in the pane, with Restore. */
export const DeletedPicked: Story = {
  ...page('deleted', gone.length, <DeletedList rows={gone} picked={gone[0].key} on={{ show: no, restore: no }} />, <DeletedView x={gone[0]} onRestore={no} />),
  name: 'An item picked: Restore beside it',
}
/** The pointer on a row: its Restore shows; hidden on the desktop until then. */
export const PointerOnARow: Story = {
  ...page('deleted', gone.length, <DeletedList rows={gone} picked={null} on={{ show: no, restore: no }} />),
  name: 'Pointer on a row: Restore',
  parameters: { pseudo: { hover: ['.group:first-child'] } },
}
export const DeletedNothing: Story = { ...page('deleted', 0, <DeletedList rows={[]} picked={null} on={{ show: no, restore: no }} />), name: 'Nothing deleted' }
export const DeletedInputPicked: Story = { ...page('deleted', gone.length, <DeletedList rows={gone} picked={inputGone?.key ?? null} on={{ show: no, restore: no }} />, inputGone ? <DeletedView x={inputGone} onRestore={no} /> : null), name: 'What you said picked' }
export const DeletedDocumentPicked: Story = { ...page('deleted', gone.length, <DeletedList rows={gone} picked={docGone?.key ?? null} on={{ show: no, restore: no }} />, docGone ? <DeletedView x={docGone} onRestore={no} /> : null), name: 'A document picked' }
