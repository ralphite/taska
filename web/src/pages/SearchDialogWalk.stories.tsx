// F479: the desktop's search (pages/SearchDialog), walked through: type, preview, a kind, open, search again, say it,
// fix a word, say more, close. Every journey: stories/searchDesk.tsx.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SearchDesk, Tips } from '../stories/searchDesk'
import { TourFrame } from '../stories/tour/TourFrame'
import { button, gone, marked, role, shows, type Tour } from '../stories/tour/tour'

export default { title: 'UI/Search/Desktop dialog/Walk through' } satisfies Meta

const STOP = button('Stop and search')
const DIALOG = role('dialog')
const CHIPS = marked('chips', undefined, { label: 'The filters' })
const TOUR: Tour = {
  steps: [
    { say: 'Click Search (or press ⌘K).', target: button('Search'), until: shows(DIALOG) },
    { say: 'Type “export filter”.', target: role('textbox', 'What to find'), until: shows(marked('found', undefined, { label: 'Results' })), wait: 20000 },
    { say: 'Press ↓ (or point at #8): the preview follows.', target: marked('found', 'shop/r8', { label: '#8' }), until: shows(marked('preview', 'inputs', { label: 'The preview' })), wait: 300 },
    { say: 'Click Items.', target: button(/^Items/, { within: CHIPS, label: 'Items' }) },
    { say: 'Press ↓ then ↵ to open F003 (or click it).', target: marked('found', 'shop/i3', { label: 'F003' }), until: gone(DIALOG), wait: 300 },
    { say: 'Search again: the same words, selected.', target: button('Search'), until: shows(DIALOG) },
    { say: 'Click the mic (or ⌥V) to say it instead.', target: button('Speak'), until: shows(STOP) },
    { say: 'Say “where the export loses my filter”, then ↵.', target: STOP, until: gone(STOP) },
    { say: 'Click the right word.', target: marked('side', 'alt', { label: 'The other word' }), wait: 5000 },
    { say: 'To add more, click the mic (or ⌥V).', target: button('Speak'), until: shows(STOP), wait: 5000 },
    { say: 'Say “only on the phone”, then ↵.', target: STOP, until: gone(STOP) },
    { say: 'Esc closes it (or a click outside).', until: gone(DIALOG), wait: 300 },
  ],
}

/** Click your way through it (it never plays itself; the yellow spot is the next click or key): type, preview, a kind,
 * open, search again, say it, fix a word, say more, close. */
export const WalkThrough: StoryObj = {
  name: 'Walk through',
  render: () => (
    <div className="flex flex-col gap-6 bg-white p-6 dark:bg-zinc-900">
      <TourFrame layout="desk" tour={TOUR} width={1440} height={900}>
        <SearchDesk />
      </TourFrame>
      <Tips />
    </div>
  ),
}
