// A document under the pointer on the desktop (a paragraph, an item of a list: its speak and comment buttons beside
// it), and its Delete asking again; the pane's bar is in DocPane.stories.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Doc } from '../../model/types'
import { After, Frames } from '../../stories/Frames'
import { doc } from '../../stories/docFixtures'
import { docAt, type DocHere } from '../../stories/docPage'

export default { title: 'UI/Document pane/Its bar, the pointer on it' } satisfies Meta
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
export const DeleteAsksAgain: Story = { ...both(PLAN, { asked: { 'doc-delete 12': 1 } }), name: 'Delete asks again' }
