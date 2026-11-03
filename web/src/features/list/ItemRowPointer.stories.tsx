// A row under the pointer, open in the pane, picked, and all of these side by side.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../../stories/Frames'
import { agent, hover, one, row } from '../../stories/itemRowFixtures'

export default { title: 'Components/Item list/Item row/Pointer, keys and picking' } satisfies Meta
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

/** The desktop shows the row's quick actions while the pointer is on it (the phone has no pointer). */
export const PointerOnIt: Story = { ...one({}), parameters: { pseudo: { hover: ['.group'] } } }
export const PointerOnItInProgress: Story = { ...one({ it: { status: 'doing', agent } }), ...hover, name: 'Pointer on it: in progress' }
export const PointerOnItWaitsForReview: Story = { ...one({ it: { status: 'review' } }), ...hover, name: 'Pointer on it: waits for review' }
export const PointerOnItDone: Story = { ...one({ it: { status: 'done' } }), ...hover, name: 'Pointer on it: done' }
export const OpenInThePane = one({ l: { current: true } })
export const Picked = one({ l: { selected: true } })
// ---- more states (T639)
export const PointerOnItArchived: Story = { ...one({ it: { status: 'done', archived: true } }), ...hover, name: 'Pointer on it: archived (Unarchive)' }
export const PointerOnItLater: Story = { ...one({ it: { when: 'later' } }), ...hover, name: 'Pointer on it: later (Back to now)' }
