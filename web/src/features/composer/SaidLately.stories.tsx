// The New input page on the desktop, its parts: what you
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
  name: 'Latest inputs',
  render: () => (
    <Frames phone={false} deskWidth={1024}>
      {() => <div className="p-6">{saidOf({ organizer: true, inputs: [...DAY, ONE.left, ONE.seen, ONE.undone], outbox: [out({ q: 'a', text: 'Buy milk on the way home', state: 'failed', net: true })] })}</div>}
    </Frames>
  ),
}

const line = () => saidOf({ organizer: true, inputs: [ONE.made] })

/** A line under the pointer (its time gives way to Add more and ⋯) and from the keys, side by side. */
export const SaidLooks: Story = {
  name: 'Latest inputs: pointer, keys',
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
// ---- more states (B636)
const list = (name: string, s: Parameters<typeof saidOf>[0]): Story => ({ name, render: () => <Frames phone={false} deskWidth={1024}>{() => <div className="p-6">{saidOf(s)}</div>}</Frames> })
const MANY = Array.from({ length: 34 }, (_, i) => ({ ...ONE.waiting, id: 'r' + (100 + i), text: `Thing ${i + 1} to do`, t: new Date(Date.parse(ONE.waiting.t) - i * 3600_000).toISOString() }))
export const LatestInputsNothingFound = list('Latest inputs, nothing found', { q: 'zebra' })
export const LatestInputsMoreToLoad = list('Latest inputs, more to load', { inputs: MANY })
export const LatestInputsJustSentUndo = list('Latest inputs, just sent: Undo', { inputs: DAY, justSent: [DAY[0].id] })
export const LatestInputsDraftOpenedOrganizing = list('Latest inputs: an edit not saved, a long one opened, organizing', { organizer: true, busy: DAY[0].id, inputs: DAY, editDrafts: [DAY[1].id], opened: [ONE.long.id] })
export const LatestInputsNotSentSending = list('Latest inputs: not sent, and sending with Undo', { inputs: DAY, outbox: [out({ q: 'a', text: 'Buy milk on the way home', state: 'failed' }), out({ q: 'b', text: 'And bread' })], justSent: ['b'] })
export const LatestInputsNoneYet = list('Latest inputs, none yet', { inputs: [] })
