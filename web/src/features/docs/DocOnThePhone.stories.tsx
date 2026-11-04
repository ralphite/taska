// How a document behaves on the phone (B643 and B498, Yadong's rules; the stories are its record): it opens with no
// box under it; a part picked (a tap, words selected, an area drawn) has a row under it: Voice and Comment. Voice
// turns the row into a recording strip (✕ cancels, ✓ and ↑ post it); Comment opens the box to write about it.
// Comment on the whole document at its end speaks about all of it, its button the strip meanwhile. The box comes
// only to write: that Comment, or an edit of a comment of yours or of the document.
// The page's own facts and DocView, in the page's own phone sheet, with a demo document.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frame } from '../../stories/Frames'
import { doc } from '../../stories/docFixtures'
import { docAt, type DocHere } from '../../stories/docPage'

export default { title: 'Components/Document/On the phone' } satisfies Meta
type Story = StoryObj

const PLAN = doc()
const step = (label: string, h: DocHere) => (
  <Frame layout="phone" label={label}>
    {docAt(PLAN, false, h)}
  </Frame>
)

/** One after another: opened, a part picked, speaking about it, speaking about the whole document. */
export const Behaviour: Story = {
  name: 'Opened, a part picked, speaking: the whole behaviour',
  render: () => (
    <div className="flex flex-wrap items-start gap-6 bg-zinc-200 p-6 dark:bg-zinc-800">
      {step('1 · opened: no box', {})}
      {step('2 · a paragraph picked: Voice and Comment under it', { sel: ['p1'] })}
      {step('3 · speaking about it: ✕, ✓, ↑', { sel: ['p1'], speaking: { key: 'p1', bar: false } })}
      {step('4 · speaking about the whole document', { speaking: { key: 'doc', bar: false } })}
    </div>
  ),
}
export const Opened: Story = { name: 'Opened: no box', render: () => step('phone', {}) }
export const PartPicked: Story = { name: 'A part picked: Voice and Comment under it', render: () => step('phone', { sel: ['p1'] }) }
export const Speaking: Story = { name: 'Speaking about a part', render: () => step('phone', { sel: ['p1'], speaking: { key: 'p1', bar: false } }) }
