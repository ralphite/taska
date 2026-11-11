// The button to the talk's end (F716, Yadong r1171): a round button with a down arrow just above the box, over the
// middle of the talk. Scrolled up it points down; a tap scrolls to the end. At the end it points up, Back to top, and a
// tap goes to the top (F752 r1250).
// The page's own item pane (PaneFrame, ItemPage) and box, with an item's real talk.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { boxAt } from '../stories/boxFixtures'
import { Frames } from '../stories/Frames'
import { message } from '../stories/fixtures'
import { pageOf, you } from '../stories/itemPage'
import { it } from '../stories/itemPageLayoutFixtures'
import { LONG, later } from '../stories/talkFromAgentFixtures'

export default { title: 'UI/Item pane/Button to the end' } satisfies Meta
type Story = StoryObj

// an item whose talk is longer than the screen: the report, your questions and the agent's answers
const talk = [
  you(1, 'The export should keep the filter I set.'),
  { ...message({ id: 2, text: 'Reproduced it: the export reads the list before the filter.' }), t: later(4) },
  { ...message({ id: 3, text: LONG }), t: later(40) },
  { ...you(4, 'Tried it on the orders page: Paid and Last 30 days both export what the list shows.'), t: later(55) },
  { ...you(5, 'Can the file name say the sort as well?'), t: later(56) },
  { ...message({ id: 6, text: 'Yes: `orders-paid-last-30-days-by-total.csv`. The sort goes after the filter, and only when it is not the default.' }), t: later(62) },
  { ...you(7, 'Good, do that.'), t: later(64) },
]

/** The item's pane over its box, as the page lays them out; `up`: you have scrolled the talk up from its end. */
const page = (up: boolean): Story => ({
  render: () => (
    <Frames phoneWidth={393} deskWidth={900} height={760}>
      {(layout) => (
        <div className="flex h-full flex-col">
          <div className="flex min-h-0 flex-1 flex-col">{pageOf(it({ thread: talk }), layout === 'desk', up ? { scrolledUp: 600 } : {})}</div>
          {boxAt({ at: 'F012' }, layout === 'desk')}
        </div>
      )}
    </Frames>
  ),
})

export const ScrolledUp: Story = { ...page(true), name: 'Scrolled up: down to the end' }
export const AtTheEnd: Story = { ...page(false), name: 'At the end: back to top' }
