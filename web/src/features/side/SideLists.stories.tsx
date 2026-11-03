// Documents beside the items on the desktop: every document with its item and its comments.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { listedDocs } from '../../model/docs'
import { DocsList } from './SideLists'
import { m, no, page } from '../../stories/sideListsFixtures'

export default { title: 'Components/Around the page/Side lists/Documents' } satisfies Meta
type Story = StoryObj

/** Every document, the newest first, each with its item and its comments; the one open beside the list lit. */
export const Documents: Story = { ...page('docs', m.docs.length, <DocsList docs={listedDocs(m)} open={1} onOpen={no} />), name: 'Every document' }
export const DocumentsNoneYet: Story = { ...page('docs', 0, <DocsList docs={[]} open={null} onOpen={no} />), name: 'None yet' }
