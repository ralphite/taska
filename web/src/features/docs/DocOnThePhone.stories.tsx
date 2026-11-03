// How a document behaves on the phone (B643, Yadong's rule; the stories are its record): it opens with no box under
// it; a part picked (a tap, words selected, an area drawn) brings one voice button floating over its bottom right,
// and nothing on the page moves; a tap on it records, a second tap posts, Cancel lets it go; Comment on the whole
// document at its end speaks about all of it. The box comes only to edit a comment of yours or the document.
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
      {step('2 · a paragraph picked: the voice button floats', { sel: ['p1'] })}
      {step('3 · speaking about it: Cancel, Stop', { sel: ['p1'], speaking: { key: 'p1', bar: false } })}
      {step('4 · speaking about the whole document', { speaking: { key: 'doc', bar: false } })}
    </div>
  ),
}
export const Opened: Story = { name: 'Opened: no box', render: () => step('phone', {}) }
export const PartPicked: Story = { name: 'A part picked: the voice button floats', render: () => step('phone', { sel: ['p1'] }) }
export const Speaking: Story = { name: 'Speaking about a part', render: () => step('phone', { sel: ['p1'], speaking: { key: 'p1', bar: false } }) }
