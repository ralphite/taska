// The New input page on the desktop: what you said lately under the box, from the page's own saidRows and SaidLately
// (the project's name over it is in ComposeHead.stories). The whole page with its box is Input box > What it writes to.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames, States } from '../../stories/Frames'
import { out } from '../../stories/boxFixtures'
import { DAY, ONE, said, saidOf } from '../../stories/inputFixtures'
import { shown } from '../../stories/fixtures'

export default { title: 'UI/Inputs page/New input page/Latest inputs/The list' } satisfies Meta
type Story = StoryObj

/** What you said lately, the latest first, with where each stands and what became of it; what is on its way on top. */
export const SaidLatelyList: Story = {
  name: 'The latest first, what each became',
  render: () => (
    <Frames phone={false} deskWidth={1024}>
      {() => <div className="p-6">{saidOf({ inputs: [...DAY, ONE.left, ONE.undone], outbox: [out({ q: 'a', text: 'Make the export button bigger', state: 'failed', net: true })] })}</div>}
    </Frames>
  ),
}

/** An input gone to (a search found it, an item's source): brought into view and lit, as the phone's Inputs tab does. */
export const SaidGoneTo: Story = {
  name: 'One gone to: in view and lit',
  render: () => <Frames phone={false} deskWidth={1024}>{() => <div className="p-6">{saidOf({ inputs: DAY, lit: ONE.made.id })}</div>}</Frames>,
}

const line = () => saidOf({ inputs: [ONE.made] })

/** A row under the pointer (a shade darker; Voice, Comment and ⋯ fade in at the end of its first line) and from the keys, side by
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
            ['pointer on a line: Voice, Comment and ⋯ show', <div data-pointer>{line()}</div>],
            ['keys: Tab on its item (Voice, Comment and ⋯ show; the browser draws the ring itself)', <div data-keys>{line()}</div>],
          ]}
        />
      )}
    </Frames>
  ),
}
/** Voice on a line (F657): pressed, it turns into the recording strip right there (B498's: ✕, the time and level, ✓
 * where Voice was), which stays while the pointer is elsewhere; ✓ stops it: transcribing on that line until its words
 * are in, then they are added at the end as Add more adds them. */
export const SaidVoice: Story = {
  name: 'A line: Voice recording, then added',
  render: () => (
    <Frames phone={false} deskWidth={760}>
      {() => (
        <States
          items={[
            ['recording (the pointer elsewhere): ✕, the time and level, ✓', saidOf({ inputs: [ONE.made], adding: { id: ONE.made.id, clock: '0:07' } })],
            ['stopped: transcribing', saidOf({ inputs: [ONE.made], addingUp: [ONE.made.id] })],
            ['its words added at the end, with the voice note', saidOf({ inputs: [shown({ ...ONE.made, files: [said('And on the tablet too.', 'And, uh, on the tablet too.')] })] })],
          ]}
        />
      )}
    </Frames>
  ),
}

const list = (s: Parameters<typeof saidOf>[0]): Story => ({ render: () => <Frames phone={false} deskWidth={1024}>{() => <div className="p-6">{saidOf(s)}</div>}</Frames> })
/** what one person says to Taska over a couple of days, newest first */
const SAID = [
  'The export should keep the sort too.',
  'Put the filter in the file name.',
  'The coupon box is still behind the keyboard on the iPhone.',
  'Excel export as well, later.',
  'Dates in the CSV should use the format from Settings.',
  'The orders list loads slowly when the filter is Last year.',
  'Search should find words in the talk too.',
  'The app icon looks blurry on the home screen.',
  'Close B014 once the fix is on the phone.',
  'The total at the bottom of the cart is cut off on small screens.',
  'Look at why the build takes so long on the release branch.',
  'The Pay button stays grey after the card is filled in.',
  'Add a way to export only the selected orders.',
  'Remember the last filter when the page is opened again.',
  'The checkout page jumps when the keyboard opens.',
  'Show which filter the export used at the top of the file.',
  'Refunds should be in the export as their own rows.',
  'The CSV columns are in a different order from the screen.',
  'Restart the nightly checks after the deploy.',
  'The empty cart page has no way back to the shop.',
  'Write the plan for the export in a document first.',
  'Two orders with the same number showed up in the list.',
  'The date picker opens behind the filters sheet on the phone.',
  'Make the export button bigger on the phone.',
  'Saving an address drops the last word of the street.',
  'The order page says Paid before the payment goes through.',
  'Ask finance which columns they really use.',
  'The shipping cost is missing from the export.',
  'When the export fails, say why instead of nothing.',
  'Dark mode: the coupon code is black on dark grey.',
  'The filters chips wrap onto three lines on the phone.',
  'Keep the scroll place when coming back to the list.',
  'The search box loses its words after a refresh.',
  'Check the export with ten thousand orders.',
]
const MANY = SAID.map((text, i) => ({ ...ONE.added, id: 'r' + (100 + i), text, t: new Date(Date.parse(ONE.waiting.t) - i * 3600_000).toISOString() }))
export const LatestInputsMoreToLoad: Story = { ...list({ inputs: MANY }), name: 'More to load' }
export const LatestInputsNoneYet: Story = { ...list({ inputs: [] }), name: 'None yet' }
