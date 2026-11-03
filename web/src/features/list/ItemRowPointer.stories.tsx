// A row open in the pane, picked, dragged, under the pointer, and all of these side by side.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../../stories/Frames'
import { one, row } from '../../stories/itemRowFixtures'

export default { title: 'Components/Item list/Item row/Pointer, keys and picking/Open, picked, dragged' } satisfies Meta
type Story = StoryObj

/** Under the pointer, open in the pane, picked, dragged and where a dragged row would go, together. */
export const Together: Story = {
  name: 'All side by side',
  parameters: { pseudo: { hover: ['[data-pointer] .group'] } },
  render: () => (
    <Frames phoneWidth={393} deskWidth={460}>
      {(layout) => {
        const desk = layout === 'desk'
        return (
          <States
            items={[
              ['under the pointer', <div data-pointer>{row({}, desk)}</div>],
              ['open in the pane (where the keys are)', row({ l: { current: true } }, desk)],
              ['picked', row({ l: { selected: true } }, desk)],
              ['dragged', row({ l: { drag: 'dragging' } }, desk)],
              ['a dragged row would go before it', row({ l: { drag: 'before' } }, desk)],
              ['after it', row({ l: { drag: 'after' } }, desk)],
              ['under it', row({ l: { drag: 'into' } }, desk)],
            ]}
          />
        )
      }}
    </Frames>
  ),
}

export const OpenInThePane: Story = { ...one({ l: { current: true } }), name: 'Open in the pane' }
export const Picked = one({ l: { selected: true } })
