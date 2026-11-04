// Documents beside the items on the desktop: every document with its item and its comments.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { listedDocs } from '../../model/docs'
import { DocsList } from './SideLists'
import { m, page } from '../../stories/sideListsFixtures'
import { Hold } from '../../stories/Frames'
import { act } from '../../stories/acts'

// a document picked is lit in the list; it opens in the pane beside it (the page: the Actions panel)
const openDoc = act('Documents: open → Document › Reading')

export default { title: 'Components/Around the page/Side lists/Documents' } satisfies Meta
type Story = StoryObj

/** Every document, the newest first, each with its item and its comments; the one open beside the list lit. */
export const Documents: Story = { ...page('docs', m.docs.length, <Hold<number | null> start={1}>{(open, set) => <DocsList docs={listedDocs(m)} open={open} onOpen={(d) => (set(d), openDoc(d))} />}</Hold>), name: 'Every document' }
export const DocumentsNoneYet: Story = { ...page('docs', 0, <DocsList docs={[]} open={null} onOpen={openDoc} />), name: 'None yet' }
