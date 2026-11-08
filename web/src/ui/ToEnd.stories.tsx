// The button to the talk's end (F716, Yadong r1171): a round button with a down arrow just above the box, over the
// middle of the talk. Scrolled up it shows; a tap scrolls to the end and it fades away. At the end it does not show.
// The page's own item pane (PaneFrame, ItemPage) and box, with an item's real talk.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { boxAt } from '../stories/boxFixtures'
import { After, Frames } from '../stories/Frames'
import { message } from '../stories/fixtures'
import { pageOf, you } from '../stories/itemPage'
import { it } from '../stories/itemPageLayoutFixtures'
import { LONG, later } from '../stories/talkFromAgentFixtures'
import { scrollerOf } from './scroller'

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
        <After
          ms={1200}
          run={(root) => {
            const el = root.querySelector<HTMLElement>('[data-item-talk]')
            const sc = el && scrollerOf(el)
            if (up && sc) sc.scrollTop = Math.max(0, sc.scrollHeight - sc.clientHeight - 600)
          }}
        >
          <div className="flex h-full flex-col">
            <div className="flex min-h-0 flex-1 flex-col">{pageOf(it({ thread: talk }), layout === 'desk')}</div>
            {boxAt({ at: 'F012' }, layout === 'desk')}
          </div>
        </After>
      )}
    </Frames>
  ),
})

export const ScrolledUp: Story = { ...page(true), name: 'Scrolled up: it shows' }
export const AtTheEnd: Story = { ...page(false), name: 'At the end: it does not show' }
