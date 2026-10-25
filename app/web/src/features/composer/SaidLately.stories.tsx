// The New input page on the desktop, its parts (T591: the groups and names Yadong had before the rewrite): what you
// said lately under the box, from the page's own saidRows and SaidLately (the project's name over it is in
// ComposeHead.stories). The whole page with its box is Input box > What it writes to.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../../stories/Frames'
import { out } from '../../stories/boxFixtures'
import { DAY, ONE, saidOf } from '../../stories/inputFixtures'

export default { title: 'Components/Inputs/New input page' } satisfies Meta
type Story = StoryObj

/** What you said lately, the latest first, with where each stands and what became of it; what is on its way on top. */
export const SaidLatelyList: Story = {
  name: 'You said lately',
  render: () => (
    <Frames phone={false} deskWidth={1024}>
      {() => <div className="p-6">{saidOf({ organizer: true, inputs: [...DAY, ONE.left, ONE.seen, ONE.undone], outbox: [out({ q: 'a', text: 'Buy milk on the way home', state: 'failed', net: true })] })}</div>}
    </Frames>
  ),
}

const line = () => saidOf({ organizer: true, inputs: [ONE.made] })

/** A line under the pointer (its time gives way to Add more and ⋯) and from the keys, side by side. */
export const SaidLooks: Story = {
  name: 'You said lately: pointer, keys',
  parameters: { pseudo: { hover: ['[data-pointer] .group\\/row', '[data-pointer-goto] .group\\/row button:first-of-type'], focusWithin: ['[data-keys] .group\\/row'], focusVisible: ['[data-keys] .group\\/row button:first-of-type'] } },
  render: () => (
    <Frames phone={false} deskWidth={760}>
      {() => (
        <States
          items={[
            ['as it is', line()],
            ['pointer on a line: Add more and ⋯ show', <div data-pointer>{line()}</div>],
            ['keys: Tab on its item', <div data-keys>{line()}</div>],
          ]}
        />
      )}
    </Frames>
  ),
}
