// Under the pointer, open, picked, dragged and where a dragged row would go, together.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../../stories/Frames'
import { question, row } from '../../stories/needsYouRowFixtures'

export default { title: 'Components/Item list/Needs-you row/Pointer, keys and picking' } satisfies Meta
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
