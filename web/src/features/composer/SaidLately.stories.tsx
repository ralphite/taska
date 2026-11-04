// The New input page on the desktop: what you said lately under the box, from the page's own saidRows and SaidLately
// (the project's name over it is in ComposeHead.stories). The whole page with its box is Input box > What it writes to.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../../stories/Frames'
import { out } from '../../stories/boxFixtures'
import { DAY, ONE, VOICE, saidOf } from '../../stories/inputFixtures'

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

/** A row under the pointer (Comment, Voice and ⋯ fade in at the end of its first line) and from the keys, side by
 * side. */
export const SaidLooks: Story = {
  name: 'A line: pointer, keys',
  parameters: { pseudo: { hover: ['[data-pointer] .group\\/row', '[data-pointer-goto] .group\\/row button:first-of-type'], focusWithin: ['[data-keys] .group\\/row'], focusVisible: ['[data-keys] .group\\/row button:first-of-type'] } },
  render: () => (
    <Frames phone={false} deskWidth={760}>
      {() => (
        <States
          items={[
            ['as it is', line()],
            ['pointer on a line: Comment, Voice and ⋯ show', <div data-pointer>{line()}</div>],
            ['keys: Tab on its item (Comment, Voice and ⋯ show; the browser draws the ring itself)', <div data-keys>{line()}</div>],
          ]}
        />
      )}
    </Frames>
  ),
}
/** Voice on a line (F657): pressed, it records right there, red with how long so far, and stays while the pointer is
 * elsewhere; pressed again it stops: transcribing on that line until its words are in, then they are added at the end
 * as Add more adds them. */
export const SaidVoice: Story = {
  name: 'A line: Voice recording, then added',
  render: () => (
    <Frames phone={false} deskWidth={760}>
      {() => (
        <States
          items={[
            ['recording (the pointer elsewhere): Stop with how long so far', saidOf({ inputs: [ONE.made], adding: { id: ONE.made.id, clock: '0:07' } })],
            ['stopped: transcribing', saidOf({ inputs: [ONE.made], addingUp: [ONE.made.id] })],
            ['its words added at the end, with the voice note', saidOf({ inputs: [{ ...ONE.made, text: `${ONE.made.text}\n\nAnd on the tablet too.`, files: [VOICE] }] })],
          ]}
        />
      )}
    </Frames>
  ),
}

const list = (s: Parameters<typeof saidOf>[0]): Story => ({ render: () => <Frames phone={false} deskWidth={1024}>{() => <div className="p-6">{saidOf(s)}</div>}</Frames> })
const MANY = Array.from({ length: 34 }, (_, i) => ({ ...ONE.added, id: 'r' + (100 + i), text: `Thing ${i + 1} to do`, t: new Date(Date.parse(ONE.waiting.t) - i * 3600_000).toISOString() }))
export const LatestInputsMoreToLoad: Story = { ...list({ inputs: MANY }), name: 'More to load' }
export const LatestInputsNoneYet: Story = { ...list({ inputs: [] }), name: 'None yet' }
