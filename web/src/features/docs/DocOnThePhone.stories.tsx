// How a document behaves on the phone (B643 and B498, Yadong's rules; the stories are its record): it opens with no
// box under it; a part picked (a tap, words selected, an area drawn) has Voice and Comment floating under it, over
// the text below (B715 r1169: they never push the text down). Voice turns them into a recording strip (✕ cancels, ✓
// posts it: no ↑ on the phone, r1062); Comment opens the box to write about it. Nothing at the document's end
// (B715: no hint and no button for the whole document). The box comes only to write: that Comment, or an edit of a
// comment of yours or of the document.
// The page's own facts and DocView, in the page's own phone sheet, with a demo document. Its ⋯ is with the bar's
// stories, in DocOnThePhoneMenu.stories.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frame } from '../../stories/Frames'
import { doc } from '../../stories/docFixtures'
import { docAt, type DocHere } from '../../stories/docPage'

export default { title: 'UI/Document pane/Commenting/Phone' } satisfies Meta
type Story = StoryObj

const PLAN = doc()
const step = (label: string, h: DocHere) => (
  <Frame layout="phone" label={label}>
    {docAt(PLAN, false, h)}
  </Frame>
)

/** One after another: opened, a part picked, speaking about it, an item of a list picked. */
export const Behaviour: Story = {
  name: 'Opened, a part picked, speaking: the whole behaviour',
  render: () => (
    <div className="flex flex-wrap items-start gap-6 bg-zinc-200 p-6 dark:bg-zinc-800">
      {step('1 · opened: no box', {})}
      {step('2 · a paragraph picked: Voice and Comment float under it', { sel: ['p1'] })}
      {step('3 · speaking about it: ✕, ✓ in their place', { sel: ['p1'], speaking: { key: 'p1', bar: false } })}
      {step('4 · an item of a list picked: under it, over the next', { quote: { key: 'l1', text: 'Build the pilot' } })}
    </div>
  ),
}
export const Opened: Story = { name: 'Opened: no box', render: () => step('phone', {}) }
export const PartPicked: Story = { name: 'A part picked: Voice and Comment float under it', render: () => step('phone', { sel: ['p1'] }) }
export const Speaking: Story = { name: 'Speaking about a part', render: () => step('phone', { sel: ['p1'], speaking: { key: 'p1', bar: false } }) }
/** Mark an area picked: draw around a part; Done where ⋯ was ends it */
export const MarkingAnArea: Story = { name: 'Marking an area: Done in the ⋯’s place', render: () => step('phone', { circle: true }) }
