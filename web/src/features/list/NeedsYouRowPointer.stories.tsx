// Under the pointer, open, picked, dragged and where a dragged row would go, together.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../../stories/Frames'
import { one, question, row } from '../../stories/needsYouRowFixtures'

export default { title: 'UI/List pane/Needs-you row/Pointer, keys and picking' } satisfies Meta
type Story = StoryObj

/** Under the pointer, open in the pane, picked, dragged and where a dragged row would go, together. */
export const Together: Story = {
  name: 'Pointer, keys, picked, dragged: all side by side',
  parameters: { pseudo: { hover: ['[data-pointer] .group'] } },
  render: () => (
    <Frames phoneWidth={393} deskWidth={460}>
      {(layout) => {
        const desk = layout === 'desk'
        return (
          <States
            items={[
              ['under the pointer', <div data-pointer>{row(question, desk)}</div>],
              ['open in the pane (where the keys are)', row({ ...question, l: { current: true } }, desk)],
              ['picked', row({ ...question, l: { selected: true } }, desk)],
              ['dragged', row({ ...question, l: { drag: 'dragging' } }, desk)],
              ['a dragged row would go under it', row({ ...question, l: { drag: 'into' } }, desk)],
            ]}
          />
        )
      }}
    </Frames>
  ),
}
// ---- more states (T639): the pointer on each kind of need, and the pill from the keys
const proposed = { it: { status: 'proposed' as const, by: 'claude-code' }, excerpt: 'Keep the filter in the export file name' }
const review = { it: { status: 'review' as const }, excerpt: 'Done: the export writes the rows the list shows.' }
export const PointerOnAProposal: Story = { ...one(proposed), parameters: { pseudo: { hover: ['.group'] } }, name: "Pointer on a proposal: Won't do, Later" }
export const PointerOnFinishedWork: Story = { ...one(review), parameters: { pseudo: { hover: ['.group'] } }, name: 'Pointer on finished work: Not yet, Later' }
export const PillFromTheKeys: Story = {
  ...one(question),
  parameters: { pseudo: { hover: ['[data-need]'], focusVisible: ['[data-need]'] } },
  name: 'Its pill under the pointer and from the keys',
}
