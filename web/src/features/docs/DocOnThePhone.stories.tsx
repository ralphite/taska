// How a document behaves on the phone (B643 and B498, Yadong's rules; the stories are its record): it opens with no
// box under it; a part picked (a tap, words selected, an area drawn) has a row under it: Voice and Comment. Voice
// turns the row into a recording strip (✕ cancels, ✓ posts it: no ↑ on the phone, r1062); Comment opens the box to write about it.
// Comment on the whole document at its end speaks about all of it, its button the strip meanwhile. The box comes
// only to write: that Comment, or an edit of a comment of yours or of the document.
// The page's own facts and DocView, in the page's own phone sheet, with a demo document. Its ⋯ is with the bar's
// stories, in DocOnThePhoneMenu.stories.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { After, Frame } from '../../stories/Frames'
import { doc } from '../../stories/docFixtures'
import { docAt, type DocHere } from '../../stories/docPage'

export default { title: 'UI/Document pane/Commenting/On the phone' } satisfies Meta
type Story = StoryObj

const PLAN = doc()
/** `end`: scrolled to the document's end (where the whole document's Comment and its strip are) */
const step = (label: string, h: DocHere, end = false) => (
  <Frame layout="phone" label={label}>
    {end ? (
      <After run={(root) => setTimeout(() => root.querySelectorAll<HTMLElement>('*').forEach((el) => /auto|scroll/.test(getComputedStyle(el).overflowY) && (el.scrollTop = el.scrollHeight)), 400)}>{docAt(PLAN, false, h)}</After>
    ) : (
      docAt(PLAN, false, h)
    )}
  </Frame>
)

/** One after another: opened, a part picked, speaking about it, speaking about the whole document. */
export const Behaviour: Story = {
  name: 'Opened, a part picked, speaking: the whole behaviour',
  render: () => (
    <div className="flex flex-wrap items-start gap-6 bg-zinc-200 p-6 dark:bg-zinc-800">
      {step('1 · opened: no box', {})}
      {step('2 · a paragraph picked: Voice and Comment under it', { sel: ['p1'] })}
      {step('3 · speaking about it: ✕, ✓', { sel: ['p1'], speaking: { key: 'p1', bar: false } })}
      {step('4 · speaking about the whole document: its strip at the end', { speaking: { key: 'doc', bar: false } }, true)}
    </div>
  ),
}
export const Opened: Story = { name: 'Opened: no box', render: () => step('phone', {}) }
export const PartPicked: Story = { name: 'A part picked: Voice and Comment under it', render: () => step('phone', { sel: ['p1'] }) }
export const Speaking: Story = { name: 'Speaking about a part', render: () => step('phone', { sel: ['p1'], speaking: { key: 'p1', bar: false } }) }
/** Mark an area picked: draw around a part; Done where ⋯ was ends it */
export const MarkingAnArea: Story = { name: 'Marking an area: Done in the ⋯’s place', render: () => step('phone', { circle: true }) }
