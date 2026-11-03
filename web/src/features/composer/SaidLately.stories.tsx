// The New input page on the desktop: what you said lately under the box, from the page's own saidRows and SaidLately
// (the project's name over it is in ComposeHead.stories). The whole page with its box is Input box > What it writes to.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../../stories/Frames'
import { out } from '../../stories/boxFixtures'
import { DAY, ONE, saidOf } from '../../stories/inputFixtures'

export default { title: 'Components/Inputs/New input page/Latest inputs/The list' } satisfies Meta
type Story = StoryObj

/** What you said lately, the latest first, with where each stands and what became of it; what is on its way on top. */
export const SaidLatelyList: Story = {
  name: 'The latest first, what each became',
  render: () => (
    <Frames phone={false} deskWidth={1024}>
      {() => <div className="p-6">{saidOf({ inputs: [...DAY, ONE.left, ONE.undone], outbox: [out({ q: 'a', text: 'Buy milk on the way home', state: 'failed', net: true })] })}</div>}
    </Frames>
  ),
}

const line = () => saidOf({ inputs: [ONE.made] })

/** A line under the pointer (Add more and ⋯ show at the end of its first line, taking no room before) and from the
 * keys, side by side. */
export const SaidLooks: Story = {
  name: 'A line: pointer, keys',
  parameters: { pseudo: { hover: ['[data-pointer] .group\\/row', '[data-pointer-goto] .group\\/row button:first-of-type'], focusWithin: ['[data-keys] .group\\/row'], focusVisible: ['[data-keys] .group\\/row button:first-of-type'] } },
  render: () => (
    <Frames phone={false} deskWidth={760}>
      {() => (
        <States
          items={[
            ['as it is', line()],
            ['pointer on a line: Add more and ⋯ show', <div data-pointer>{line()}</div>],
            ['keys: Tab on its item (Add more and ⋯ show; the browser draws the ring itself)', <div data-keys>{line()}</div>],
          ]}
        />
      )}
    </Frames>
  ),
}
const list = (s: Parameters<typeof saidOf>[0]): Story => ({ render: () => <Frames phone={false} deskWidth={1024}>{() => <div className="p-6">{saidOf(s)}</div>}</Frames> })
const MANY = Array.from({ length: 34 }, (_, i) => ({ ...ONE.added, id: 'r' + (100 + i), text: `Thing ${i + 1} to do`, t: new Date(Date.parse(ONE.waiting.t) - i * 3600_000).toISOString() }))
export const LatestInputsMoreToLoad: Story = { ...list({ inputs: MANY }), name: 'More to load' }
export const LatestInputsFound: Story = { ...list({ q: 'coupon', inputs: DAY }), name: 'Searched: the words marked, how many found' }
export const LatestInputsNothingFound: Story = { ...list({ q: 'zebra' }), name: 'Searched, nothing found' }
export const LatestInputsNoneYet: Story = { ...list({ inputs: [] }), name: 'None yet' }
