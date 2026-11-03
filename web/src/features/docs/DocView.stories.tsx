// A document as it is read: the page's own facts (factsOf) and DocView with a demo document, in the desktop's pane and
// the phone's sheet. The pointer on its parts and its bar are in DocViewPointer.stories.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Doc } from '../../model/types'
import { After, Frames } from '../../stories/Frames'
import { LONG, comment, doc } from '../../stories/docFixtures'
import { docAt, type DocHere } from '../../stories/docPage'

export default { title: 'Components/Document/Reading' } satisfies Meta
type Story = StoryObj

const PLAN = doc()
const both = (d: Doc, h: DocHere = {}, height = 900): Story => ({ render: () => <Frames height={height} deskWidth={900} phoneWidth={393}>{(layout) => docAt(d, layout === 'desk', h)}</Frames> })

/** Its title, words, a heading, a list, a quote, code and a table; each commented paragraph shows its count (beside
 * the text on the desktop, a chip on the phone), the words a thread quotes marked; the comments on the whole document
 * (a button at the top on the desktop, under the text on the phone). */
export const WithComments: Story = { ...both(PLAN), name: 'With comments' }
/** Enough headings for its contents, folded. */
export const LongWithOutline: Story = { ...both(LONG), name: 'Long, with contents' }
export const ContentsOpen: Story = {
  ...both(LONG),
  name: 'Contents opened',
  render: () => <Frames height={900} deskWidth={900} phoneWidth={393}>{(layout) => <After run={(r) => r.querySelector('details')?.setAttribute('open', '')}>{docAt(LONG, layout === 'desk')}</After>}</Frames>,
}
const untitledBlocks = PLAN.blocks.slice(1)
/** a document whose words have no title heading: its title drawn large above them */
export const NoTitleInItsText: Story = { ...both(doc({ blocks: untitledBlocks, md: untitledBlocks.map((b) => b.text).join('\n\n') })), name: 'No title in its words' }
/** a comment on a heading: on the phone its count sits at the heading's right edge */
export const ACommentOnAHeading: Story = {
  ...both(doc({ blocks: PLAN.blocks.map((b) => (b.key === 'h1' ? { ...b, comments: [comment({ id: 9, key: 'h1', th: 9, text: 'Add the dates?' })] } : b)) })),
  name: 'A comment on a heading',
}
