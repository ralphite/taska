// F479: searching by voice on the phone, walked through: say what to find, fix a misheard word, say more, open a
// result, come back, leave. Every journey: stories/searchPhone.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SearchPhone } from '../stories/searchPhone'
import { TourFrame } from '../stories/tour/TourFrame'
import { button, marked, row, type Tour } from '../stories/tour/tour'

export default { title: 'UI/Search/Phone page/Walk through', parameters: { layout: 'padded' } } satisfies Meta

const TOUR: Tour = {
  steps: [
    { say: 'Tap search.', target: button('Search') },
    { say: 'Say “where the export loses my filter”, then ↑.', target: button('Stop and search') },
    { say: 'Tap the right word.', target: marked('side', 'alt', { label: 'The other word' }) },
    { say: 'To add more, tap the mic.', target: button('Say more') },
    { say: 'Say “only on the phone”, then ↑.', target: button('Stop and search') },
    { say: 'Tap B018.', target: marked('swipe', undefined, { within: row(18), label: 'B018' }), wait: 5000 },
    { say: 'Back.', target: button('Back') },
    { say: 'Leave search.', target: button('Leave search') },
  ],
}

/** Tap your way through it: say, fix a word, say more, open a result, come back, leave (it never plays itself). */
export const SayThenSayMore: StoryObj = {
  name: 'Say, then say more',
  render: () => (
    <div className="bg-white p-4 dark:bg-zinc-900">
      <TourFrame layout="phone" tour={TOUR}>
        <SearchPhone />
      </TourFrame>
    </div>
  ),
}
