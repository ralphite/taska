// A document as it is read, one story for each state (T591: the groups and names Yadong had before the rewrite): the
// page's own facts (factsOf) and DocView with a demo document, in the desktop's pane and the phone's sheet.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Doc } from '../../model/types'
import { Frames } from '../../stories/Frames'
import { LONG, doc } from '../../stories/docFixtures'
import { After, docAt, type DocHere } from '../../stories/docPage'

export default { title: 'Components/Document/Reading' } satisfies Meta
type Story = StoryObj

const PLAN = doc()
const both = (d: Doc, h: DocHere = {}, height = 900): Story => ({ render: () => <Frames height={height} deskWidth={900} phoneWidth={393}>{(layout) => docAt(d, layout === 'desk', h)}</Frames> })
const desk = (d: Doc, run: (root: HTMLElement) => void, height = 700): Story => ({
  render: () => (
    <Frames phone={false} height={height} deskWidth={900}>
      {() => <After run={run}>{docAt(d, true)}</After>}
    </Frames>
  ),
})

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
/** The desktop: the pointer on a paragraph lights it, and its speak and comment buttons show beside it. */
export const PointingAtParagraph: Story = {
  ...desk(PLAN, () => {}),
  name: 'Pointing at a paragraph',
  parameters: { pseudo: { hover: ['section[data-key="p1"]'] } },
}
/** The desktop: in a list each item is its own place to comment on; the pointer on one puts the buttons beside it. */
export const PointingAtListItem: Story = {
  ...desk(PLAN, (r) => r.querySelectorAll('section[data-key="l1"] li')[1]?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))),
  name: 'Pointing at an item of a list',
  parameters: { pseudo: { hover: ['section[data-key="l1"]'] } },
}
